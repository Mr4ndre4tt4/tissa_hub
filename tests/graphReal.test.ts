/**
 * `GraphReal` sobre `fetch` — só o que o protocolo de revisões depende: que um
 * erro HTTP traga método e caminho junto da mensagem da Microsoft.
 *
 * Sem isso, duas chamadas que falham com a mesma mensagem genérica (por
 * exemplo "Item not found") ficam indistinguíveis na tela — foi exatamente o
 * caso relatado (secção "Item not found" no relato de login).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GraphReal, type ProvedorDeToken } from '../src/adapters/graph/graphReal';
import { ErroGraph } from '../src/adapters/graph/cliente';

const TOKEN: ProvedorDeToken = { obterToken: async () => 'token-de-teste' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GraphReal — erro HTTP traz método e caminho', () => {
  it('um 404 na leitura de approot identifica a chamada que falhou', async () => {
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
    await expect(graph.approot()).rejects.toMatchObject({
      codigo: 'nao_encontrado',
      status: 404,
    });
    try {
      await graph.approot();
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErroGraph);
      const detalhe = (e as ErroGraph).message;
      expect(detalhe).toContain('GET');
      expect(detalhe).toContain('/me/drive/special/approot');
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
