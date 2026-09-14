// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FormularioChamado } from '../src/features/tickets/FormularioChamado';
import { novoWorkspace, revisaoInicial } from '../src/domain/entities/revisao';
import { salvarChamado, type DadosChamado } from '../src/domain/entities/chamados';
import type { ContextoApp } from '../src/app/estado';
const estado = vi.hoisted(() => ({ ctx: {} as ContextoApp }));
vi.mock('../src/app/estado', () => ({ useApp: () => estado.ctx }));
let host: HTMLDivElement; let root: Root;
const concluiu = vi.fn(); const cancelou = vi.fn();
const dados: DadosChamado = { referencia: 'IR90007777', tipo: 'incident', titulo: 'Chamado sintético', andamento: '', prioridade: '', responsavel: '', celula: '', proximaAcao: '', prazo: '', estimativa: '' };
beforeEach(async () => {
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); concluiu.mockReset(); cancelou.mockReset();
 const base = revisaoInicial(novoWorkspace());
 estado.ctx = { revisao: salvarChamado(base, { id: 'ticket', editando: false, revisaoBase: base.revisionId, dados }), modo: 'conectado', mutar: vi.fn(async () => 'erro') } as unknown as ContextoApp;
 host = document.createElement('div'); document.body.append(host); root = createRoot(host);
 await renderizar();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function renderizar() { await act(async () => root.render(<FormularioChamado ticket={estado.ctx.revisao.tickets[0]!} aoCancelar={cancelou} aoSalvar={concluiu} />)); }
async function submit() { await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }
function titulo() { const label = [...host.querySelectorAll('label')].find(l => l.textContent?.startsWith('Título'))!; return document.getElementById(label.htmlFor) as HTMLInputElement; }
async function preencherTitulo(value: string) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(titulo(), value); titulo().dispatchEvent(new Event('input', { bubbles: true })); }); }
it.each(['erro','incerto','conflito','invalido','nao_autorizado','quota'] as const)('preserva a edição se a gravação retorna %s', async resultado => {
 estado.ctx.mutar = vi.fn(async () => resultado); await preencherTitulo('Texto alterado'); await submit();
 expect(concluiu).not.toHaveBeenCalled(); expect(titulo().value).toBe('Texto alterado'); expect(host.textContent).toContain('não foi confirmada');
});
it('grava a edição somente no salvar e sai após confirmação', async () => {
 estado.ctx.mutar = vi.fn<ContextoApp['mutar']>(async (_op, mudar) => { estado.ctx.revisao = mudar(estado.ctx.revisao); return 'confirmado'; });
 await preencherTitulo('Alterado'); expect(estado.ctx.mutar).not.toHaveBeenCalled(); await submit();
 expect(estado.ctx.revisao.personalStates[0]!.tituloPessoal).toBe('Alterado'); expect(concluiu).toHaveBeenCalledWith('ticket');
});
it('cancelar não salva a alteração', async () => {
 await preencherTitulo('Descartar'); await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Cancelar')!.click());
 expect(cancelou).toHaveBeenCalledTimes(1); expect(estado.ctx.mutar).not.toHaveBeenCalled();
});
it('impede envio duplo e bloqueia campos enquanto salva', async () => {
 let resolver!: (r: 'confirmado') => void;
 estado.ctx.mutar = vi.fn<ContextoApp['mutar']>(() => new Promise(resolve => { resolver = resolve; }));
 await submit(); await submit(); expect(estado.ctx.mutar).toHaveBeenCalledTimes(1); expect(host.querySelector('fieldset')!.disabled).toBe(true);
 await act(async () => resolver('confirmado')); expect(concluiu).toHaveBeenCalledTimes(1);
});
it('não grava título vazio ou formulário de uma revisão anterior', async () => {
 await preencherTitulo(' '); await submit(); expect(host.textContent).toContain('Informe o título'); expect(estado.ctx.mutar).not.toHaveBeenCalled();
 await preencherTitulo('Válido'); estado.ctx.revisao = { ...estado.ctx.revisao, revisionId: 'outra' }; await renderizar(); await submit();
 expect(host.textContent).toContain('A base mudou'); expect(estado.ctx.mutar).not.toHaveBeenCalled();
});
