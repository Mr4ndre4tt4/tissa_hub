/**
 * `GraphReal` sobre `fetch`.
 *
 * Dois comportamentos cobertos:
 *  - um erro HTTP traz método, caminho, código e `innerError` junto da
 *    mensagem da Microsoft — mensagens rasas ("Item not found", "Invalid
 *    request.") já esconderam a causa demais vezes neste projeto para
 *    descartar qualquer parte do corpo do erro;
 *  - `approot()` lê a pasta do aplicativo por nome, na raiz do OneDrive
 *    (`root:/{nome}`), e cria com `POST root/children` se ainda não existir —
 *    o mesmo padrão "ler, criar no 404, reler no 409" que
 *    `RepositorioOneDrive.inicializar()` usa para as subpastas. Não é mais o
 *    mecanismo especial `special/approot`: confirmado contra a conta real que
 *    ele não funciona nesta conta por nenhum método testado, enquanto uma
 *    pasta comum na raiz funciona normalmente (DECISOES.md §18-19).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GraphReal, NOME_PASTA_DO_APP, type ProvedorDeToken } from '../src/adapters/graph/graphReal';
import { ErroGraph } from '../src/adapters/graph/cliente';

const TOKEN: ProvedorDeToken = { obterToken: async () => 'token-de-teste' };
const CAMINHO_LEITURA = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(NOME_PASTA_DO_APP)}`;
const CAMINHO_CRIACAO = 'https://graph.microsoft.com/v1.0/me/drive/root/children';

afterEach(() => {
  vi.unstubAllGlobals();
});

function itemResposta(id: string) {
  return new Response(JSON.stringify({ id, name: NOME_PASTA_DO_APP, eTag: 'etag-1', folder: {} }), { status: 200 });
}

function erro(status: number, mensagem: string) {
  return new Response(JSON.stringify({ error: { message: mensagem } }), { status });
}

describe('GraphReal — erro HTTP traz método, caminho e o corpo do erro', () => {
  it('um 404 na leitura de um item identifica a chamada que falhou', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => erro(404, 'Item not found')));

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
    vi.stubGlobal('fetch', vi.fn(async () => erro(403, 'Access denied')));

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
    // "Invalid request." sozinho não diz por quê. error.code e innerError
    // costumam ter a causa real (relato real contra a conta, secção 17).
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

describe('GraphReal — approot() lê ou cria a pasta do aplicativo por nome, na raiz', () => {
  it('lê direto quando a pasta já existe: nenhuma escrita é feita', async () => {
    const chamadas: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        chamadas.push(`${init?.method ?? 'GET'} ${url}`);
        return itemResposta('pasta-id');
      }),
    );

    const graph = new GraphReal(TOKEN);
    const item = await graph.approot();
    expect(item.id).toBe('pasta-id');
    expect(chamadas).toEqual([`GET ${CAMINHO_LEITURA}`]);
  });

  it('404 na leitura: cria pelo nome na raiz e devolve o item criado', async () => {
    const chamadas: { metodo: string; url: string; corpo?: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const metodo = init?.method ?? 'GET';
        chamadas.push({ metodo, url, corpo: init?.body ? JSON.parse(init.body as string) : undefined });
        if (metodo === 'GET') return erro(404, 'Item not found');
        return new Response(JSON.stringify({ id: 'pasta-id-criada', name: NOME_PASTA_DO_APP, folder: {} }), { status: 201 });
      }),
    );

    const graph = new GraphReal(TOKEN);
    const item = await graph.approot();

    expect(item.id).toBe('pasta-id-criada');
    expect(chamadas.map((c) => `${c.metodo} ${c.url}`)).toEqual([`GET ${CAMINHO_LEITURA}`, `POST ${CAMINHO_CRIACAO}`]);
    expect(chamadas[1]!.corpo).toMatchObject({
      name: NOME_PASTA_DO_APP,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    });
  });

  it('404 seguido de 409 na criação: outra sessão criou primeiro, relê pelo nome', async () => {
    const chamadas: string[] = [];
    let leiturasPorNome = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const metodo = init?.method ?? 'GET';
        chamadas.push(`${metodo} ${url}`);
        if (metodo === 'POST') return erro(409, 'Name already exists');
        leiturasPorNome += 1;
        if (leiturasPorNome === 1) return erro(404, 'Item not found');
        return itemResposta('pasta-id-existente');
      }),
    );

    const graph = new GraphReal(TOKEN);
    const item = await graph.approot();
    expect(item.id).toBe('pasta-id-existente');
    expect(chamadas).toEqual([`GET ${CAMINHO_LEITURA}`, `POST ${CAMINHO_CRIACAO}`, `GET ${CAMINHO_LEITURA}`]);
  });

  it('404 seguido de um erro real na criação (não conflito): propaga o erro, não a leitura original', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const metodo = init?.method ?? 'GET';
        if (metodo === 'GET') return erro(404, 'Item not found');
        return erro(403, 'Insufficient privileges');
      }),
    );

    const graph = new GraphReal(TOKEN);
    await expect(graph.approot()).rejects.toMatchObject({ codigo: 'proibido', status: 403 });
  });

  it('um erro não-404 na leitura (por exemplo 403) não tenta criar nada', async () => {
    const chamadas: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        chamadas.push(`${init?.method ?? 'GET'} ${url}`);
        return erro(403, 'Insufficient privileges');
      }),
    );

    const graph = new GraphReal(TOKEN);
    await expect(graph.approot()).rejects.toMatchObject({ codigo: 'proibido', status: 403 });
    expect(chamadas).toEqual([`GET ${CAMINHO_LEITURA}`]);
  });
});
