// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { revisaoDemonstrativa } from '../src/fixtures/demonstracao';
import type { ContextoApp } from '../src/app/estado';
const estado = vi.hoisted(() => ({ ctx: {} as ContextoApp }));
vi.mock('../src/app/estado', () => ({ useApp: () => estado.ctx, usarMensagemDeGravacao: () => null, hojeLocal: () => '2030-12-15' }));
let host: HTMLDivElement; let root: Root;
beforeEach(async () => {
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
 window.location.hash = '/chamados';
 const revisao = revisaoDemonstrativa();
 revisao.tickets[0]!.oficial!.statusBruto = 'Working';
 revisao.tickets[1]!.oficial!.statusBruto = 'Closed';
 revisao.tickets[2]!.oficial!.statusBruto = 'Resolved';
 estado.ctx = { revisao, modo: 'conectado', conta: {email:'teste'}, dataSelecionada: '2030-12-15', mutar: vi.fn(async () => 'erro') } as unknown as ContextoApp;
 host = document.createElement('div'); document.body.append(host); root = createRoot(host);
 await act(async () => root.render(<App />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
function el(id: string) { return host.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!; }
async function preencher(id: string, value: string) { await act(async () => { const campo = el(id); const select = campo.tagName === 'SELECT'; Object.getOwnPropertyDescriptor(select ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(campo, value); campo.dispatchEvent(new Event(select ? 'change' : 'input', { bubbles: true })); }); }
function botao(text: string) { return [...host.querySelectorAll('button')].find(b => b.textContent === text)!; }
function linhas() { return host.querySelectorAll('tbody tr'); }
it('abre no mês corrente em vez do mês fixo de 2026', () => {
 expect(el('periodo-inicio').value).toBe('2030-12-01'); expect(el('periodo-fim').value).toBe('2030-12-31');
});
it('busca sem acentos e também pelo responsável', async () => {
 await preencher('busca-chamados','relatorio'); expect(linhas()).toHaveLength(1);
 await preencher('busca-chamados','Pessoa Sintetica'); expect(linhas()).toHaveLength(3);
});
it('filtra abertos e encerrados, sem excluir registros da base', async () => {
 await preencher('filtro-situacao','abertos'); expect(linhas()).toHaveLength(1);
 await preencher('filtro-situacao','encerrados'); expect(linhas()).toHaveLength(2);
 expect(estado.ctx.revisao.tickets).toHaveLength(3); expect(estado.ctx.mutar).not.toHaveBeenCalled();
});
it('mantém busca e filtros após abrir o detalhe e voltar', async () => {
 await preencher('busca-chamados','relatorio'); await preencher('filtro-status','Working');
 await act(async () => botao('IR90000001').click()); expect(host.textContent).toContain('Dados SC3');
 await act(async () => botao('← Voltar para Chamados').click());
 expect(el('busca-chamados').value).toBe('relatorio'); expect(el('filtro-status').value).toBe('Working'); expect(linhas()).toHaveLength(1);
});
it('atalho abre o seletor SC3 e retorna à mesma busca ao cancelar', async () => {
 await preencher('busca-chamados','IR90000001');
 await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Editar SC3 de IR90000001"]')!.click());
 expect(host.textContent).toContain('Editar dados SC3'); expect(host.querySelectorAll('select')[0]!.textContent).toContain('Went On Fulfillment');
 await act(async () => botao('Cancelar').click()); expect(el('busca-chamados').value).toBe('IR90000001'); expect(estado.ctx.mutar).not.toHaveBeenCalled();
});
it('limpar filtros recupera a lista e o período padrão', async () => {
 await preencher('busca-chamados','inexistente'); await preencher('periodo-inicio','2028-01-01');
 expect(host.textContent).toContain('Nenhum resultado'); await act(async () => botao('Limpar filtros').click());
 expect(linhas()).toHaveLength(3); expect(el('busca-chamados').value).toBe(''); expect(el('periodo-inicio').value).toBe('2030-12-01');
});
it('não exibe esforço zero como resultado válido de um período invertido', async () => {
 await preencher('periodo-inicio','2031-01-01'); expect(host.textContent).toContain('Informe um período válido'); expect(host.textContent).toContain('No período: período inválido');
});
it('não transporta filtros para outra base', async () => {
 await preencher('busca-chamados','IR90000001'); estado.ctx.revisao = { ...estado.ctx.revisao, workspace: {...estado.ctx.revisao.workspace,id:'outra-base'} };
 await act(async () => root.render(<App />)); expect(el('busca-chamados').value).toBe('');
});
