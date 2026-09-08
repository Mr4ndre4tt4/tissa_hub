/**
 * `GraphReal` sobre `fetch`.
 *
 * Dois comportamentos cobertos:
 *  - um erro HTTP traz método e caminho junto da mensagem da Microsoft, para
 *    duas chamadas que falham com a mesma mensagem genérica (por exemplo
 *    "Item not found") não ficarem indistinguíveis na tela — foi exatamente o
 *    caso relatado no login real;
 *  - `approot()` provisiona a pasta do aplicativo quando ela ainda não existe.
 *    Confirmado contra a conta real: OneDrive pessoal devolve 404 numa
 *    simples leitura da pasta especial antes de qualquer escrita nela, mesmo
 *    com o consentimento certo e o OneDrive normal funcionando.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GraphReal, type ProvedorDeToken } from '../src/adapters/graph/graphReal';
import { ErroGraph } from '../src/adapters/graph/cliente';

const TOKEN: ProvedorDeToken = { obterToken: async () => 'token-de-teste' };

afterEach(() => {
  vi.unstubAllGlobals();
});

function itemResposta(id: string) {
  return new Response(JSON.stringify({ id, name: 'App', eTag: 'etag-1', folder: {} }), { status: 200 });
}

describe('GraphReal — erro HTTP traz método e caminho', () => {
  it('um 404 na leitura de um item identifica a chamada que falhou', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: 'Item not found' } }), {
          status: 404,
          statusText: 'Not Found',
        }),
      ),
    );

    const graph = new GraphReal(TOKEN);
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
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Access denied' } }), { status: 403 })),
    );

    const graph = new GraphReal(TOKEN);
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

    const graph = new GraphReal(TOKEN);
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

describe('GraphReal — approot() provisiona a pasta do aplicativo quando ela não existe', () => {
  it('lê direto quando a pasta já existe: nenhuma escrita é feita', async () => {
    const chamadas: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        chamadas.push(`${init?.method ?? 'GET'} ${url}`);
        return itemResposta('approot-id');
      }),
    );

    const graph = new GraphReal(TOKEN);
    const item = await graph.approot();
    expect(item.id).toBe('approot-id');
    expect(chamadas).toEqual(['GET https://graph.microsoft.com/v1.0/me/drive/special/approot']);
  });

  it('404 na primeira leitura: cria a pasta-marcador pelo alias e relê, sem deixar a pasta sem provisionar', async () => {
    const chamadas: { metodo: string; url: string; corpo?: unknown }[] = [];
    let leituras = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const metodo = init?.method ?? 'GET';
        chamadas.push({ metodo, url, corpo: init?.body ? JSON.parse(init.body as string) : undefined });
        if (metodo === 'GET') {
          leituras += 1;
          if (leituras === 1) {
            return new Response(JSON.stringify({ error: { message: 'Item not found' } }), { status: 404 });
          }
          return itemResposta('approot-id-provisionado');
        }
        // POST da pasta-marcador de provisionamento, pelo alias — sem dois-pontos.
        return new Response(JSON.stringify({ id: 'marcador-id', name: 'provisionamento-inicial', folder: {} }), { status: 201 });
      }),
    );

    const graph = new GraphReal(TOKEN);
    const item = await graph.approot();

    expect(item.id).toBe('approot-id-provisionado');
    expect(chamadas.map((c) => `${c.metodo} ${c.url}`)).toEqual([
      'GET https://graph.microsoft.com/v1.0/me/drive/special/approot',
      'POST https://graph.microsoft.com/v1.0/me/drive/special/approot/children',
      'GET https://graph.microsoft.com/v1.0/me/drive/special/approot',
    ]);
    expect(chamadas[1]!.corpo).toMatchObject({
      name: 'provisionamento-inicial',
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    });
    // Sem ponto inicial: um nome começando com "." é a diferença mais
    // concreta em relação aos exemplos documentados de criação de pasta, e
    // uma tentativa real contra a conta devolveu 400 com o nome antigo.
    expect((chamadas[1]!.corpo as { name: string }).name.startsWith('.')).toBe(false);
  });

  it('404 seguido de conflito no marcador: outra sessão provisionou primeiro, relê normalmente', async () => {
    let leituras = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const metodo = init?.method ?? 'GET';
        if (metodo === 'GET') {
          leituras += 1;
          if (leituras === 1) return new Response(JSON.stringify({ error: { message: 'Item not found' } }), { status: 404 });
          return itemResposta('approot-id');
        }
        return new Response(JSON.stringify({ error: { message: 'Name already exists' } }), { status: 409 });
      }),
    );

    const graph = new GraphReal(TOKEN);
    const item = await graph.approot();
    expect(item.id).toBe('approot-id');
  });

  it('404 seguido de falha real no marcador (não conflito): propaga o erro do provisionamento', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const metodo = init?.method ?? 'GET';
        if (metodo === 'GET') return new Response(JSON.stringify({ error: { message: 'Item not found' } }), { status: 404 });
        return new Response(JSON.stringify({ error: { message: 'Insufficient privileges' } }), { status: 403 });
      }),
    );

    const graph = new GraphReal(TOKEN);
    await expect(graph.approot()).rejects.toMatchObject({ codigo: 'proibido', status: 403 });
  });
});
