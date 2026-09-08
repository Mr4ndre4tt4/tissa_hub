/**
 * `GraphReal` sobre `fetch`.
 *
 * Dois comportamentos cobertos:
 *  - um erro HTTP traz método, caminho, código e `innerError` junto da
 *    mensagem da Microsoft — mensagens rasas ("Item not found", "Invalid
 *    request.") já esconderam a causa demais vezes neste projeto para
 *    descartar qualquer parte do corpo do erro;
 *  - `approot()`, ao encontrar 404 na primeira leitura, toca o drive padrão e
 *    tenta de novo, com retentativa curta só para 503. Duas tentativas de
 *    provisionar por escrita (`PUT .../content` endereçado por caminho,
 *    `POST .../children` pelo alias) já foram testadas e descartadas contra
 *    a conta real — a segunda devolveu 405 Method Not Allowed, confirmado no
 *    Graph Explorer: não existe escrita válida nesse endereço para criar a
 *    pasta do zero. Ver DECISOES.md §18.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GraphReal, type ProvedorDeToken } from '../src/adapters/graph/graphReal';
import { ErroGraph } from '../src/adapters/graph/cliente';

const TOKEN: ProvedorDeToken = { obterToken: async () => 'token-de-teste' };
/** Sem atraso real nas retentativas: os testes não devem esperar segundos de verdade. */
const SEM_ATRASO = 0;

afterEach(() => {
  vi.unstubAllGlobals();
});

function itemResposta(id: string) {
  return new Response(JSON.stringify({ id, name: 'App', eTag: 'etag-1', folder: {} }), { status: 200 });
}

function erro(status: number, mensagem: string) {
  return new Response(JSON.stringify({ error: { message: mensagem } }), { status });
}

describe('GraphReal — erro HTTP traz método, caminho e o corpo do erro', () => {
  it('um 404 na leitura de um item identifica a chamada que falhou', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => erro(404, 'Item not found')));

    const graph = new GraphReal(TOKEN, SEM_ATRASO);
    try {
      await graph.obterItem('item-x');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErroGraph);
      expect((e as ErroGraph).codigo).toBe('nao_encontrado');
      expect((e as ErroGraph).status).toBe(404);
      const detalhe = (e as ErroGraph).message;
      expect(detalhe).toContain('GET');
      expect(detalhe).toContain('/me/drive/items/item-x');
      expect(detalhe).toContain('404');
      expect(detalhe).toContain('Item not found');
    }
  });

  it('um erro de escrita mostra o método correto, não sempre GET', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => erro(403, 'Access denied')));

    const graph = new GraphReal(TOKEN, SEM_ATRASO);
    try {
      await graph.criarPasta('pai-id', 'state-head');
      expect.unreachable();
    } catch (e) {
      expect((e as ErroGraph).message).toContain('POST');
      expect((e as ErroGraph).message).toContain('/me/drive/items/pai-id/children');
    }
  });

  it('inclui o código do erro, o innerError e o request-id quando presentes', async () => {
    // "Invalid request." sozinho (relato real, 400 em special/approot/children)
    // não diz por quê. error.code e innerError costumam ter a causa real.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: 'invalidRequest',
                message: 'Invalid request.',
                innerError: { code: 'invalidRequestBody', message: 'The name property is not valid.' },
              },
            }),
            { status: 400, headers: { 'request-id': 'req-123' } },
          ),
      ),
    );

    const graph = new GraphReal(TOKEN, SEM_ATRASO);
    try {
      await graph.criarPasta('pai-id', 'x');
      expect.unreachable();
    } catch (e) {
      const detalhe = (e as ErroGraph).message;
      expect(detalhe).toContain('invalidRequest');
      expect(detalhe).toContain('invalidRequestBody');
      expect(detalhe).toContain('The name property is not valid.');
      expect(detalhe).toContain('req-123');
    }
  });
});

describe('GraphReal — approot() diante de um 404 na primeira leitura', () => {
  it('lê direto quando a pasta já existe: nenhuma chamada extra é feita', async () => {
    const chamadas: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        chamadas.push(`${init?.method ?? 'GET'} ${url}`);
        return itemResposta('approot-id');
      }),
    );

    const graph = new GraphReal(TOKEN, SEM_ATRASO);
    const item = await graph.approot();
    expect(item.id).toBe('approot-id');
    expect(chamadas).toEqual(['GET https://graph.microsoft.com/v1.0/me/drive/special/approot']);
  });

  it('404 na primeira leitura: toca o drive padrão e relê, sem tentar nenhuma escrita', async () => {
    const chamadas: string[] = [];
    let leiturasDeApproot = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const metodo = init?.method ?? 'GET';
        chamadas.push(`${metodo} ${url}`);
        if (url.endsWith('/me/drive')) return itemResposta('drive-id');
        leiturasDeApproot += 1;
        if (leiturasDeApproot === 1) return erro(404, 'Item not found');
        return itemResposta('approot-id-depois-de-tocar-o-drive');
      }),
    );

    const graph = new GraphReal(TOKEN, SEM_ATRASO);
    const item = await graph.approot();

    expect(item.id).toBe('approot-id-depois-de-tocar-o-drive');
    expect(chamadas).toEqual([
      'GET https://graph.microsoft.com/v1.0/me/drive/special/approot',
      'GET https://graph.microsoft.com/v1.0/me/drive',
      'GET https://graph.microsoft.com/v1.0/me/drive/special/approot',
    ]);
  });

  it('mesmo que tocar o drive padrão também falhe, tenta reler approot assim mesmo', async () => {
    let leiturasDeApproot = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/me/drive')) return erro(404, 'Item not found');
        leiturasDeApproot += 1;
        if (leiturasDeApproot === 1) return erro(404, 'Item not found');
        return itemResposta('approot-id');
      }),
    );

    const graph = new GraphReal(TOKEN, SEM_ATRASO);
    const item = await graph.approot();
    expect(item.id).toBe('approot-id');
  });

  it('503 depois de tocar o drive: tenta de novo até três vezes, sem esperar de verdade no teste', async () => {
    let leiturasDeApproot = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/me/drive')) return itemResposta('drive-id');
        leiturasDeApproot += 1;
        if (leiturasDeApproot === 1) return erro(404, 'Item not found');
        if (leiturasDeApproot <= 3) return erro(503, 'User is pending provisioning');
        return itemResposta('approot-id-na-terceira-retentativa');
      }),
    );

    const graph = new GraphReal(TOKEN, SEM_ATRASO);
    const item = await graph.approot();
    expect(item.id).toBe('approot-id-na-terceira-retentativa');
    expect(leiturasDeApproot).toBe(4);
  });

  it('503 persistente: desiste depois de três tentativas e propaga o erro', async () => {
    let leiturasDeApproot = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/me/drive')) return itemResposta('drive-id');
        leiturasDeApproot += 1;
        if (leiturasDeApproot === 1) return erro(404, 'Item not found');
        return erro(503, 'User is pending provisioning');
      }),
    );

    const graph = new GraphReal(TOKEN, SEM_ATRASO);
    await expect(graph.approot()).rejects.toMatchObject({ status: 503 });
  });

  it('um erro não transitório (403) depois de tocar o drive não é retentado', async () => {
    let leiturasDeApproot = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/me/drive')) return itemResposta('drive-id');
        leiturasDeApproot += 1;
        if (leiturasDeApproot === 1) return erro(404, 'Item not found');
        return erro(403, 'Insufficient privileges');
      }),
    );

    const graph = new GraphReal(TOKEN, SEM_ATRASO);
    await expect(graph.approot()).rejects.toMatchObject({ codigo: 'proibido', status: 403 });
    expect(leiturasDeApproot).toBe(2);
  });
});
