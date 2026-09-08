/**
 * Implementação real do Graph sobre `fetch`.
 *
 * ATENÇÃO — estado de verificação: o login contra o Microsoft Entra real
 * passou a funcionar, e a primeira chamada real ao Graph (`approot()`)
 * continua bloqueada contra a conta real — ver o comentário de `approot()`
 * para o histórico das tentativas já descartadas e a hipótese em uso. O
 * restante do protocolo — gravar e reler uma revisão, publicar o ponteiro com
 * `If-Match`, conflito entre dois clientes — continua **sem confirmação na
 * conta real**. A prova técnica bloqueante da secção 16.5 continua pendente.
 * Nada neste projeto deve afirmar que a integração funciona antes dessa
 * execução.
 *
 * Decisões que este arquivo aplica:
 *  - download por `@microsoft.graph.downloadUrl`, usando a URL temporária sem
 *    anexar o bearer token e sem guardá-la em estado, log ou repositório (M3);
 *  - PATCH de propriedades sempre com `If-Match` (M6);
 *  - criação de pasta com `conflictBehavior: fail` (secção 16.3);
 *  - nenhuma chamada a `workbook/createSession`: conta pessoal não suporta (M4).
 */

import { ErroGraph, type ClienteGraph, type ItemDrive, type CodigoErroGraph } from './cliente';

const BASE = 'https://graph.microsoft.com/v1.0';

export interface ProvedorDeToken {
  /** Devolve um access token válido para os escopos já consentidos. */
  obterToken(): Promise<string>;
}

interface RespostaItem {
  id: string;
  name: string;
  eTag?: string;
  cTag?: string;
  description?: string;
  size?: number;
  folder?: unknown;
  '@microsoft.graph.downloadUrl'?: string;
}

function traduzirStatus(status: number): CodigoErroGraph {
  if (status === 401) return 'nao_autorizado';
  if (status === 403) return 'proibido';
  if (status === 404) return 'nao_encontrado';
  if (status === 409) return 'conflito';
  if (status === 412 || status === 428) return 'precondicao_falhou';
  if (status === 429) return 'limite_taxa';
  if (status === 507) return 'quota';
  if (status >= 500) return 'servidor';
  return 'transporte';
}

function paraItem(r: RespostaItem): ItemDrive {
  return {
    id: r.id,
    nome: r.name,
    eTag: r.eTag ?? '',
    cTag: r.cTag,
    descricao: r.description ?? '',
    tamanho: r.size,
    pasta: r.folder !== undefined,
    downloadUrl: r['@microsoft.graph.downloadUrl'],
  };
}

export class GraphReal implements ClienteGraph {
  constructor(
    private readonly tokens: ProvedorDeToken,
    /** Injeção para teste: evita esperar de verdade nas retentativas de 503. */
    private readonly atrasoRetentativaMs: number = 3000,
  ) {}

  private async requisitar(
    caminho: string,
    init: RequestInit & { corpoBinario?: Uint8Array } = {},
  ): Promise<Response> {
    const token = await this.tokens.obterToken();
    const cabecalhos = new Headers(init.headers);
    cabecalhos.set('Authorization', `Bearer ${token}`);

    let resposta: Response;
    try {
      resposta = await fetch(`${BASE}${caminho}`, {
        ...init,
        headers: cabecalhos,
        body: init.corpoBinario ? (init.corpoBinario as unknown as BodyInit) : init.body,
      });
    } catch (e) {
      // Um erro de transporte nunca é retorno de sucesso (secção 14.3).
      throw new ErroGraph(`A conexão falhou: ${(e as Error).message}`, 'transporte');
    }

    if (!resposta.ok) {
      const retryAfter = Number(resposta.headers.get('Retry-After') ?? '');
      let mensagem = resposta.statusText;
      try {
        const corpo = (await resposta.json()) as {
          error?: { code?: string; message?: string; innerError?: { code?: string; message?: string } };
        };
        const partes = [
          corpo?.error?.code,
          corpo?.error?.message,
          corpo?.error?.innerError?.code,
          corpo?.error?.innerError?.message,
        ].filter((p): p is string => typeof p === 'string' && p.length > 0);
        // O código (`invalidRequest`, por exemplo) e o `innerError`, quando
        // vêm, dizem mais que a mensagem genérica sozinha ("Invalid
        // request.") — mensagens rasas da Microsoft já esconderam a causa
        // demais vezes para descartar qualquer parte do corpo do erro.
        if (partes.length > 0) mensagem = partes.join(' | ');
      } catch {
        // Corpo sem JSON: mantemos o texto do status.
      }
      // O caminho e o método vão junto: sem eles, uma mesma mensagem da
      // Microsoft ("Item not found", por exemplo) não diz qual chamada falhou.
      const metodo = init.method ?? 'GET';
      const idDaRequisicao = resposta.headers.get('request-id');
      const detalhe = `${metodo} ${caminho} → ${resposta.status} ${mensagem}${idDaRequisicao ? ` (request-id: ${idDaRequisicao})` : ''}`;
      throw new ErroGraph(detalhe, traduzirStatus(resposta.status), resposta.status, Number.isFinite(retryAfter) ? retryAfter : undefined);
    }

    return resposta;
  }

  /**
   * Lê a pasta especial do aplicativo.
   *
   * Duas tentativas de provisionar por escrita já foram testadas contra a
   * conta real e **descartadas**:
   *  - `PUT special/approot:/nome:/content` (escrita endereçada por caminho)
   *    devolveu 404, inclusive com escopo `Files.ReadWrite` de todo o
   *    OneDrive — o caminho precisa resolver `special/approot` como um item
   *    já existente antes de aplicar o resto, e não há o que resolver numa
   *    pasta que nunca existiu;
   *  - `POST special/approot/children` devolveu **405 Method Not Allowed**,
   *    confirmado no Graph Explorer: não é um método aceito nesse endereço —
   *    a documentação que sugeria isso não corresponde à API real.
   *
   * A pasta "Apps" existe na conta (confirmado manualmente) mas está vazia:
   * nenhuma tentativa chegou a criar nada.
   *
   * O padrão que resta, apoiado num relato recente da própria Microsoft para
   * contas pessoais com aplicativo recém-consentido, é 404 seguido de 503
   * "pending provisioning" — uma etapa de inicialização do lado da Microsoft
   * que um escopo mais amplo (`Files.ReadWrite`) dispara, mas que pode não
   * completar na hora. Por isso, um 404 aqui tenta "tocar" o drive padrão
   * (`GET /me/drive`, sem ser a pasta especial) e espera um 503 se aparecer,
   * antes de desistir.
   */
  async approot(): Promise<ItemDrive> {
    const ler = async (): Promise<ItemDrive> => {
      const r = await this.requisitar('/me/drive/special/approot');
      return paraItem((await r.json()) as RespostaItem);
    };

    try {
      return await ler();
    } catch (e) {
      if (!(e instanceof ErroGraph) || e.codigo !== 'nao_encontrado') throw e;
      await this.tocarDrivePadrao();
      return await this.relerComRetentativa(ler);
    }
  }

  /** GET simples ao drive padrão: só para destravar uma inicialização pendente do lado da Microsoft. */
  private async tocarDrivePadrao(): Promise<void> {
    try {
      await this.requisitar('/me/drive');
    } catch {
      // Mesmo que também falhe, seguimos para a nova tentativa de approot: o
      // detalhe relevante para quem usa o app é o dessa chamada, não desta.
    }
  }

  /** Até duas retentativas com espera crescente, só para 503 ("pending provisioning"). */
  private async relerComRetentativa(ler: () => Promise<ItemDrive>): Promise<ItemDrive> {
    for (let tentativa = 1; ; tentativa++) {
      try {
        return await ler();
      } catch (e) {
        const transitorio = e instanceof ErroGraph && (e.status === 503 || e.codigo === 'servidor');
        if (!transitorio || tentativa >= 3) throw e;
        await new Promise((resolve) => setTimeout(resolve, this.atrasoRetentativaMs * tentativa));
      }
    }
  }

  async filhos(pastaId: string): Promise<ItemDrive[]> {
    const itens: ItemDrive[] = [];
    let caminho: string | null = `/me/drive/items/${encodeURIComponent(pastaId)}/children?$top=200`;

    while (caminho) {
      const r: Response = await this.requisitar(caminho);
      const corpo = (await r.json()) as { value: RespostaItem[]; '@odata.nextLink'?: string };
      itens.push(...corpo.value.map(paraItem));
      const proximo = corpo['@odata.nextLink'];
      caminho = proximo ? proximo.replace(BASE, '') : null;
    }
    return itens;
  }

  async criarPasta(paiId: string, nome: string): Promise<ItemDrive> {
    const r = await this.requisitar(`/me/drive/items/${encodeURIComponent(paiId)}/children`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nome,
        folder: {},
        // Nunca `rename`: a disputa é resolvida lendo a pasta existente.
        '@microsoft.graph.conflictBehavior': 'fail',
      }),
    });
    return paraItem((await r.json()) as RespostaItem);
  }

  async obterItem(itemId: string): Promise<ItemDrive> {
    const r = await this.requisitar(`/me/drive/items/${encodeURIComponent(itemId)}`);
    return paraItem((await r.json()) as RespostaItem);
  }

  async enviarConteudo(paiId: string, nome: string, bytes: Uint8Array): Promise<ItemDrive> {
    // `fail` garante que uma revisão nunca substitui outra já existente.
    const caminho =
      `/me/drive/items/${encodeURIComponent(paiId)}:/${encodeURIComponent(nome)}:/content` +
      `?@microsoft.graph.conflictBehavior=fail`;
    const r = await this.requisitar(caminho, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      corpoBinario: bytes,
    });
    return paraItem((await r.json()) as RespostaItem);
  }

  async baixarConteudo(itemId: string): Promise<Uint8Array> {
    // Ler os metadados primeiro evita o problema de redirecionamento CORS de
    // `/content` em aplicações JavaScript (M3).
    const item = await this.obterItem(itemId);
    if (!item.downloadUrl) {
      throw new ErroGraph('O item não expôs uma URL de download.', 'nao_encontrado', 404);
    }

    let resposta: Response;
    try {
      // A URL temporária é pré-autenticada: o bearer token NÃO é anexado a ela,
      // e ela não é guardada em estado, log nem repositório.
      resposta = await fetch(item.downloadUrl);
    } catch (e) {
      throw new ErroGraph(`A conexão falhou durante o download: ${(e as Error).message}`, 'transporte');
    }
    if (!resposta.ok) {
      throw new ErroGraph(`Falha ao baixar o conteúdo: ${resposta.status}`, traduzirStatus(resposta.status), resposta.status);
    }
    return new Uint8Array(await resposta.arrayBuffer());
  }

  async atualizarDescricao(itemId: string, descricao: string, ifMatch: string): Promise<ItemDrive> {
    if (!ifMatch) {
      // O contrato deste projeto proíbe PATCH sem condição (secção 16.2, passo 5).
      throw new ErroGraph('PATCH sem If-Match não é permitido por este protocolo.', 'precondicao_falhou', 428);
    }
    const r = await this.requisitar(`/me/drive/items/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': ifMatch },
      // Somente a nova descrição é enviada.
      body: JSON.stringify({ description: descricao }),
    });
    return paraItem((await r.json()) as RespostaItem);
  }
}
