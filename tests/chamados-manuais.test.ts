import { expect, it } from 'vitest';
import { novoWorkspace, revisaoInicial, validarInvariantes } from '../src/domain/entities/revisao';
import { salvarChamado, type DadosChamado } from '../src/domain/entities/chamados';
import { aplicarPrevia, previaCsv } from '../src/domain/reconciliation/importacao';
import { lerCsvCs3 } from '../src/domain/sources/csv';
import type { Revision, SourceDocument } from '../src/domain/entities/tipos';
const dados: DadosChamado = { referencia: 'IR90008888', tipo: 'incident', titulo: 'Atendimento manual', andamento: 'Em atendimento', prioridade: 'Alta', responsavel: 'Pessoa de teste', celula: 'AMS', proximaAcao: 'Validar retorno', prazo: '2026-09-20', estimativa: '60' };
const nova = () => revisaoInicial(novoWorkspace());
function salvar(base: Revision, d = dados, id: string = crypto.randomUUID(), editando = false) { return salvarChamado(base, { id, editando, revisaoBase: base.revisionId, dados: d }); }
function importar(base: Revision) {
 const doc: SourceDocument = { id: crypto.randomUUID(), tipo: 'csv_incidentes', nomeArquivo: 'sintetico.csv', origem: 'upload_local', sha256: 'sintetico', tamanhoBytes: 100, perfil: 'incidentes', lidoEm: '2026-09-14T15:00:00Z' };
 const p = previaCsv(base, doc, lerCsvCs3('Incident ID;Title;Status;Last Update Time\nIR90008888;Título CS3;Working;14/09/2026 09:00:00'));
 return aplicarPrevia(base, p, { itensAceitos: new Set(p.itens.filter(i => i.incluidoPorPadrao).map(i => i.id)), itensExcluidos: new Set(), decisoesDeIssues: new Map() }, crypto.randomUUID()).revisao;
}
it('cria chamado e acompanhamento sem inventar dados oficiais nem horas', () => {
 const base = nova(); const r = salvar(base);
 expect(base.tickets).toHaveLength(0); expect(r.tickets).toHaveLength(1);
 expect(r.tickets[0]!.oficial).toBeNull(); expect(r.tickets[0]!.ticketType).toBe('incident');
 expect(r.personalStates[0]).toMatchObject({ tituloPessoal: dados.titulo, prioridadePessoal: 'Alta', estimativaMinutos: 60 });
 expect(r.timeEntries).toHaveLength(0); expect(validarInvariantes(r)).toEqual([]);
 expect(r.audit.at(-1)?.operacao).toBe('createTicket');
});
it('gera referência quando ainda não existe número externo', () => {
 const r = salvar(nova(), { ...dados, referencia: '' });
 expect(r.tickets[0]!.referencia.bruto).toMatch(/^MANUAL-/);
});
it('recusa referência duplicada ignorando caixa e espaços externos', () => {
 const r = salvar(nova()); expect(() => salvar(r, { ...dados, referencia: ' ir90008888 ' })).toThrow(/já existe/i);
});
it.each([{ titulo: ' ' }, { referencia: 'IR90008888/RR90008889' }, { prazo: '2026-02-30' }, { estimativa: '-1' }, { estimativa: '0.5' }, { estimativa: 'abc' }, { tipo: 'request' }])('recusa cadastro inválido %j', (over) => {
 expect(() => salvar(nova(), { ...dados, ...over } as DadosChamado)).toThrow();
});
it('edita chamado importado sem acompanhamento e preserva o conteúdo da fonte', () => {
 const base = importar(nova()); const id = base.tickets[0]!.id;
 const r = salvar(base, { ...dados, titulo: 'Título corrigido', andamento: 'Resolvido' }, id, true);
 expect(r.personalStates).toHaveLength(1); expect(r.personalStates[0]!.tituloPessoal).toBe('Título corrigido');
 expect(r.tickets[0]!.oficial).toEqual(base.tickets[0]!.oficial);
 expect(r.tickets[0]!.versaoFonte).toBe(base.tickets[0]!.versaoFonte);
 expect(validarInvariantes(r)).toEqual([]);
});
it('não apaga notas nem duplica o acompanhamento ao editar de novo', () => {
 const base = salvar(nova()); const id = base.tickets[0]!.id;
 const r = salvar(base, { ...dados, titulo: 'Ajustado' }, id, true);
 expect(r.personalStates).toHaveLength(1); expect(r.personalStates[0]!.versao).toBe(2);
 expect(r.personalStates[0]!.tituloPessoal).toBe('Ajustado');
});
it('CSV completa manual e segunda importação não duplica nem perde edição', () => {
 const manual = salvar(nova()); const r = importar(manual); const repetida = importar(r);
 expect(repetida.tickets).toHaveLength(1); expect(repetida.tickets[0]!.id).toBe(manual.tickets[0]!.id);
 expect(repetida.tickets[0]).toMatchObject({ provisorio: false, sourceSystem: 'CS3', sourceTicketId: 'IR90008888', ticketType: 'incident' });
 expect(repetida.personalStates[0]!.tituloPessoal).toBe(dados.titulo);
});
it('recusa formulário baseado em revisão antiga e registro removido', () => {
 const base = nova(); expect(() => salvarChamado(base, { id: 'novo', editando: false, revisaoBase: 'antiga', dados })).toThrow(/base mudou/i);
 expect(() => salvar(base, dados, 'ausente', true)).toThrow(/encontrado/i);
});
