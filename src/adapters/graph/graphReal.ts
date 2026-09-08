/**
 * Implementação real do Graph sobre `fetch`.
 *
 * ATENÇÃO — estado de verificação: o login contra o Microsoft Entra real
 * passou a funcionar, e a primeira chamada real ao Graph (`approot()`) já foi
 * exercitada — e corrigida (ver abaixo). O restante do protocolo — gravar e
 * reler uma revisão, publicar o ponteiro com `If-Match`, conflito entre dois
 * clientes — continua **sem confirmação na conta real**. A prova técnica
 * bloqueante da secção 16.5 continua pendente. Nada neste projeto deve afirmar
 * que a integração funciona por inteiro antes dessa execução.
 *
 * Decisões que este arquivo aplica:
 *  - download por `@microsoft.graph.downloadUrl`, usando a URL temporária sem
 *    anexar o bearer token e sem guardá-la em estado, log ou repositório (M3);
 *  - PATCH de propriedades sempre com `If-Match` (M6);
 *  - criação de pasta com `conflictBehavior: fail` (secção 16.3);
 *  - nenhuma chamada a `workbook/createSession`: conta pessoal não suporta (M4);
 *  - `approot()` provisiona a pasta do aplicativo com uma escrita quando ela
 *    ainda não existe: diferente de contas corporativas, o OneDrive pessoal
 *    **não** cria a pasta especial numa simples leitura (ver `approot()`).
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
  constructor(private readonly tokens: ProvedorDeToken) {}

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
        const corpo = (await resposta.json()) as { error?: { message?: string } };
        if (corpo?.error?.message) mensagem = corpo.error.message;
      } catch {
        // Corpo sem JSON: mantemos o texto do status.
      }
      // O caminho e o método vão junto: sem eles, uma mesma mensagem da
      // Microsoft ("Item not found", por exemplo) não diz qual chamada falhou.
      const metodo = init.method ?? 'GET';
      const detalhe = `${metodo} ${caminho} → ${resposta.status} ${mensagem}`;
      throw new ErroGraph(detalhe, traduzirStatus(resposta.status), resposta.status, Number.isFinite(retryAfter) ? retryAfter : undefined);
    }

    return resposta;
  }

  /**
   * Lê a pasta especial do aplicativo, provisionando-a se ainda não existir.
   *
   * Diferente de contas corporativas, o OneDrive pessoal **não** cria a pasta
   * especial numa leitura: uma conta que nunca teve o aplicativo usado devolve
   * 404 ("Item not found") em `GET .../special/approot`, mesmo com o
   * consentimento certo e o OneDrive normal funcionando (relato confirmado
   * contra a conta real).
   *
   * A tentativa de provisionar por uma **escrita endereçada pelo caminho**
   * (`PUT special/approot:/nome:/content`) também falhou 404 contra a conta
   * real — inclusive com escopo `Files.ReadWrite` de todo o OneDrive, não só
   * `Files.ReadWrite.AppFolder`. O endereçamento por caminho exige resolver
   * `special/approot` como um item já existente antes de aplicar o restante
   * do caminho; se a pasta nunca existiu, não há o que resolver. A
   * documentação da Microsoft para pastas especiais cita um caminho
   * diferente, sem dois-pontos: `POST /drive/special/approot/children` — o
   * alias é tratado como referência de pai para criação de filho, não como um
   * caminho a resolver, e é justamente o mecanismo desenhado para o primeiro
   * uso.
   */
  async approot(): Promise<ItemDrive> {
    try {
      const r = await this.requisitar('/me/drive/special/approot');
      return paraItem((await r.json()) as RespostaItem);
    } catch (e) {
      if (!(e instanceof ErroGraph) || e.codigo !== 'nao_encontrado') throw e;
      await this.provisionarPastaDoApp();
      const r = await this.requisitar('/me/drive/special/approot');
      return paraItem((await r.json()) as RespostaItem);
    }
  }

  /** Cria uma pasta-marcador dentro da pasta do app só para provisioná-la. */
  private async provisionarPastaDoApp(): Promise<void> {
    try {
      await this.requisitar('/me/drive/special/approot/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '.provisionamento',
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        }),
      });
    } catch (e) {
      // Outra sessão pode ter provisionado entre a leitura e esta tentativa;
      // seguimos e relemos approot normalmente.
      if (e instanceof ErroGraph && e.codigo === 'conflito') return;
      throw e;
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
