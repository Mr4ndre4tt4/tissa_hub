// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Importacoes } from '../src/features/imports/Importacoes';
import { novoWorkspace, revisaoInicial } from '../src/domain/entities/revisao';
import type { ContextoApp } from '../src/app/estado';

const estado = vi.hoisted(() => ({ ctx: {} as ContextoApp }));
vi.mock('../src/app/estado', () => ({ useApp: () => estado.ctx }));
let host: HTMLDivElement;
let root: Root;
const csv = 'Incident ID;Title;Status;Last Update Time\nIR90009999;Teste sintético;Working;14/09/2026 08:00:00';
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  estado.ctx = {
    revisao: revisaoInicial(novoWorkspace()), modo: 'conectado',
    gravacao: { situacao: 'ocioso' },
    mutar: vi.fn(async (_op, mutacao) => { mutacao(estado.ctx.revisao); return 'erro'; }),
  } as unknown as ContextoApp;
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Importacoes />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function carregar() {
  const input = host.querySelector<HTMLInputElement>('#entrada-csv_incidentes')!;
  const bytes = new TextEncoder().encode(csv);
  const arquivo = { name: 'sintetico.csv', size: bytes.length, arrayBuffer: async () => bytes.buffer };
  Object.defineProperty(input, 'files', { value: [arquivo], configurable: true });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  await vi.waitFor(async () => {
    await act(async () => { await Promise.resolve(); });
    expect(host.textContent).toContain('Prévia da carga');
  });
}
function confirmar() { return [...host.querySelectorAll('button')].find(b => b.textContent?.startsWith('Confirmar '))!; }

it.each(['erro', 'incerto', 'conflito', 'invalido', 'nao_autorizado', 'quota'] as const)(
  'preserva a prévia e não anuncia sucesso em %s', async (resultado) => {
    estado.ctx.mutar = vi.fn(async () => resultado);
    await carregar();
    await act(async () => confirmar().click());
    expect(host.textContent).not.toContain('Carga confirmada:');
    expect(host.textContent).toContain('Prévia da carga');
  },
);
it('conclui a importação apenas depois da confirmação da gravação', async () => {
  estado.ctx.mutar = vi.fn<ContextoApp['mutar']>(async (_op, mutacao) => { mutacao(estado.ctx.revisao); return 'confirmado'; });
  await carregar();
  await act(async () => confirmar().click());
  expect(host.textContent).toContain('Carga confirmada: 1 registro(s)');
  expect(host.textContent).not.toContain('Prévia da carga');
});
it('impede confirmação dupla enquanto a primeira está em andamento', async () => {
  let resolver!: (r: 'confirmado') => void;
  estado.ctx.mutar = vi.fn<ContextoApp['mutar']>(() => new Promise(resolve => { resolver = resolve; }));
  await carregar();
  const botao = confirmar();
  await act(async () => { botao.click(); botao.click(); });
  expect(estado.ctx.mutar).toHaveBeenCalledTimes(1);
  await act(async () => resolver('confirmado'));
});

it('bloqueia UTF-8 inválido em vez de alterar silenciosamente os textos', async () => {
  const input = host.querySelector<HTMLInputElement>('#entrada-csv_incidentes')!;
  const bytes = new TextEncoder().encode(csv);
  bytes[bytes.indexOf(84, csv.indexOf('IR90009999'))] = 0xff;
  Object.defineProperty(input, 'files', { value: [{ name: 'invalido.csv', size: bytes.length, arrayBuffer: async () => bytes.buffer }], configurable: true });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  await vi.waitFor(async () => {
    await act(async () => { await Promise.resolve(); });
    expect(host.textContent).not.toContain('Lendo o arquivo');
  });
  expect(host.textContent).not.toContain('Prévia da carga');
  expect(host.textContent).toContain('UTF-8');
});
