import { describe, expect, it, vi } from 'vitest';
import { GraphReal } from '../src/adapters/graph/graphReal';

const tokens = { obterToken: async () => 'token-de-teste' };

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Graph real — pasta especial do aplicativo', () => {
  it('repete ItemNotFound transitório depois do primeiro consentimento', async () => {
    const fetchOriginal = globalThis.fetch;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(resposta(404, { error: { code: 'itemNotFound', message: 'Item not found' } }))
      .mockResolvedValueOnce(resposta(404, { error: { code: 'itemNotFound', message: 'Item not found' } }))
      .mockResolvedValueOnce(resposta(200, { id: 'approot-id', name: 'Aplicativos', folder: {}, eTag: '1' }));
    globalThis.fetch = fetchMock;
    const esperas: number[] = [];

    try {
      const graph = new GraphReal(tokens, async (ms) => { esperas.push(ms); });
      await expect(graph.approot()).resolves.toMatchObject({ id: 'approot-id', pasta: true });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(esperas).toEqual([500, 1000]);
      expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith('/me/drive/special/approot'))).toBe(true);
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it('explica como ativar o OneDrive quando ItemNotFound persiste', async () => {
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      resposta(404, { error: { code: 'itemNotFound', message: 'Item not found' } }),
    );

    try {
      const graph = new GraphReal(tokens, async () => undefined);
      await expect(graph.approot()).rejects.toThrow(/onedrive\.live\.com.*ativação.*tente novamente/i);
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });
});
