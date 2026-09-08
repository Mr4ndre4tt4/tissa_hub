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

  it('404 na primeira leitura: escreve um marcador e relê, sem deixar a pasta sem provisionar', async () => {
    const chamadas: string[] = [];
    let leituras = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const metodo = init?.method ?? 'GET';
        chamadas.push(`${metodo} ${url}`);
        if (metodo === 'GET') {
          leituras += 1;
          if (leituras === 1) {
            return new Response(JSON.stringify({ error: { message: 'Item not found' } }), { status: 404 });
          }
          return itemResposta('approot-id-provisionado');
        }
        // PUT do marcador de provisionamento.
        return new Response(JSON.stringify({ id: 'marcador-id', name: '.provisionamento' }), { status: 201 });
      }),
    );

    const graph = new GraphReal(TOKEN);
    const item = await graph.approot();

    expect(item.id).toBe('approot-id-provisionado');
    expect(chamadas).toEqual([
      'GET https://graph.microsoft.com/v1.0/me/drive/special/approot',
      'PUT https://graph.microsoft.com/v1.0/me/drive/special/approot:/.provisionamento:/content?@microsoft.graph.conflictBehavior=replace',
      'GET https://graph.microsoft.com/v1.0/me/drive/special/approot',
    ]);
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
