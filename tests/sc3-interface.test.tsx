// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FormularioSc3 } from '../src/features/tickets/FormularioSc3';
import { DetalheChamado } from '../src/features/tickets/DetalheChamado';
import { novoWorkspace, revisaoInicial } from '../src/domain/entities/revisao';
import { camposSc3Vazios, salvarDadosSc3 } from '../src/domain/entities/dadosSc3';
import { salvarChamado } from '../src/domain/entities/chamados';
import type { ContextoApp } from '../src/app/estado';
const estado = vi.hoisted(() => ({ ctx: {} as ContextoApp }));
vi.mock('../src/app/estado', () => ({ useApp: () => estado.ctx }));
let host: HTMLDivElement; let root: Root;
const fechou = vi.fn();
beforeEach(async () => {
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); fechou.mockReset();
 const base = revisaoInicial(novoWorkspace());
 const revisao = salvarChamado(base, { id: 'ticket', editando: false, revisaoBase: base.revisionId, dados: { referencia: 'IR90004444', tipo: 'incident', titulo: 'Pessoal', andamento: '', prioridade: '', responsavel: '', celula: '', proximaAcao: '', prazo: '', estimativa: '' } });
 revisao.tickets[0]!.oficial = { ...camposSc3Vazios(), title: 'Título importado', statusBruto: 'Working', lastUpdateTimeBruto: '14/09/2026 09:00:00' };
 estado.ctx = { revisao, modo: 'conectado', mutar: vi.fn(async () => 'erro') } as unknown as ContextoApp;
 host = document.createElement('div'); document.body.append(host); root = createRoot(host); await renderizar();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function renderizar() { await act(async () => root.render(<FormularioSc3 ticket={estado.ctx.revisao.tickets[0]!} aoFechar={fechou} />)); }
function input(rotulo: string) { const label = [...host.querySelectorAll('label')].find(l => l.textContent?.startsWith(rotulo))!; return document.getElementById(label.htmlFor) as HTMLInputElement; }
async function preencher(rotulo: string, value: string) { await act(async () => { const el = input(rotulo); const select = el.tagName === 'SELECT'; Object.getOwnPropertyDescriptor(select ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event(select ? 'change' : 'input', { bubbles: true })); }); }
async function submit() { await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }
it.each(['erro','incerto','conflito','invalido','nao_autorizado','quota'] as const)('mantém dados SC3 no formulário em %s', async resultado => {
 estado.ctx.mutar = vi.fn(async () => resultado); await preencher('Título SC3', 'Correção SC3'); await submit();
 expect(fechou).not.toHaveBeenCalled(); expect(input('Título SC3').value).toBe('Correção SC3'); expect(host.textContent).toContain('não foi confirmada');
});
it('grava título, status, responsável e tags somente ao salvar', async () => {
 estado.ctx.mutar = vi.fn<ContextoApp['mutar']>(async (_op, mudar) => { estado.ctx.revisao = mudar(estado.ctx.revisao); return 'confirmado'; });
 await preencher('Título SC3', 'Correção SC3'); await preencher('Status SC3', 'Update'); await preencher('Responsável', 'Pessoa teste'); await preencher('Tag 3', 'TASK FORCE');
 expect(estado.ctx.mutar).not.toHaveBeenCalled(); await submit(); expect(fechou).toHaveBeenCalledTimes(1);
 expect(estado.ctx.revisao.tickets[0]!.oficial).toMatchObject({ title: 'Correção SC3', statusBruto: 'Update', assignedTo: 'Pessoa teste', tags: [null,null,'TASK FORCE',null,null,null] });
});
it('cancelar não salva; envio duplo é bloqueado', async () => {
 await preencher('Título SC3', 'Descartar'); await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Cancelar')!.click());
 expect(estado.ctx.mutar).not.toHaveBeenCalled(); expect(fechou).toHaveBeenCalledTimes(1); fechou.mockReset();
 let resolver!: (r: 'confirmado') => void; estado.ctx.mutar = vi.fn<ContextoApp['mutar']>(() => new Promise(resolve => { resolver = resolve; }));
 await submit(); await submit(); expect(estado.ctx.mutar).toHaveBeenCalledTimes(1); expect(host.querySelector('fieldset')!.disabled).toBe(true);
 await act(async () => resolver('confirmado'));
});
it('restaurar apenas preenche a prévia, exigindo salvar para gravar', async () => {
 const r = estado.ctx.revisao;
 estado.ctx.revisao = salvarDadosSc3(r, { ticketId: 'ticket', revisaoBase: r.revisionId, campos: { ...r.tickets[0]!.oficial!, title: 'Ajustado' } });
 await act(async () => root.unmount()); root = createRoot(host); await renderizar();
 await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Restaurar valores do último CSV')!.click());
 expect(input('Título SC3').value).toBe('Título importado'); expect(estado.ctx.mutar).not.toHaveBeenCalled();
 expect(host.textContent).toContain('Salve para confirmar');
});
it('detalhe oferece edição dos dados SC3 e não exibe o nome antigo', async () => {
 await act(async () => root.render(<DetalheChamado ticketId="ticket" aoVoltar={fechou} />));
 expect(host.textContent).toContain('Editar dados SC3'); expect(host.textContent).not.toContain('CS3');
 expect(host.textContent).not.toContain('não são editáveis');
});

it.each(['Waiting External','Waiting User','Went On Fulfillment','Update','Working','Resolved','Closed'])('salva o status selecionado %s', async status => {
 estado.ctx.mutar = vi.fn<ContextoApp['mutar']>(async (_op, mudar) => { estado.ctx.revisao = mudar(estado.ctx.revisao); return 'confirmado'; });
 const select = input('Status SC3') as unknown as HTMLSelectElement;
 expect(select.tagName).toBe('SELECT');
 expect([...select.options].map(o => o.value)).toEqual(['','Waiting External','Waiting User','Went On Fulfillment','Update','Working','Resolved','Closed']);
 await preencher('Status SC3', status); await submit();
 expect(estado.ctx.revisao.tickets[0]!.oficial!.statusBruto).toBe(status);
});
it('preserva um status legado até a pessoa escolher outra opção', async () => {
 estado.ctx.revisao.tickets[0]!.oficial!.statusBruto = 'Wait on User';
 await act(async () => root.unmount()); root = createRoot(host); await renderizar();
 expect(input('Status SC3').value).toBe('Wait on User'); expect(host.textContent).toContain('Wait on User (valor atual)');
 estado.ctx.mutar = vi.fn<ContextoApp['mutar']>(async (_op, mudar) => { estado.ctx.revisao = mudar(estado.ctx.revisao); return 'confirmado'; });
 await preencher('Responsável', 'Pessoa nova'); await submit();
 expect(estado.ctx.revisao.tickets[0]!.oficial!.statusBruto).toBe('Wait on User');
});
