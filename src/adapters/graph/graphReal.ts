/**
 * Implementação real do Graph sobre `fetch`.
 *
 * ATENÇÃO — estado de verificação: este adaptador está implementado, tipado e
 * compilado, mas **nunca foi executado contra o Microsoft Graph real**, porque
 * a configuração pública (client ID e redirect URI) ainda não existe. A prova
 * técnica bloqueante da secção 16.5 continua pendente. Nada neste projeto deve
 * afirmar que a integração funciona antes dessa execução.
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
      let detalhe = `${resposta.status} ${resposta.statusText}`;
      try {
        const corpo = (await resposta.json()) as { error?: { message?: string } };
        if (corpo?.error?.message) detalhe = corpo.error.message;
      } catch {
        // Corpo sem JSON: mantemos o status como detalhe.
      }
      throw new ErroGraph(detalhe, traduzirStatus(resposta.status), resposta.status, Number.isFinite(retryAfter) ? retryAfter : undefined);
    }

    return resposta;
  }

  async approot(): Promise<ItemDrive> {
    const r = await this.requisitar('/me/drive/special/approot');
    return paraItem((await r.json()) as RespostaItem);
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
