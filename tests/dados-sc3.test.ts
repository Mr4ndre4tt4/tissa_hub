import { expect, it } from 'vitest';
import { novoWorkspace, revisaoInicial } from '../src/domain/entities/revisao';
import { aplicarPrevia, previaCsv } from '../src/domain/reconciliation/importacao';
import { lerCsvCs3 } from '../src/domain/sources/csv';
import { salvarDadosSc3 } from '../src/domain/entities/dadosSc3';
import type { CamposOficiaisCs3, Revision, SourceDocument } from '../src/domain/entities/tipos';
function previa(base: Revision, title = 'Título da extração', status = 'Working', data = '14/09/2026 09:00:00') {
 const doc: SourceDocument = { id: crypto.randomUUID(), tipo: 'csv_incidentes', nomeArquivo: 'sintetico.csv', origem: 'upload_local', sha256: 'sintetico', tamanhoBytes: 100, perfil: 'incidentes', lidoEm: '2026-09-14T15:00:00Z' };
 return previaCsv(base, doc, lerCsvCs3(`Incident ID;Title;Status;Last Update Time\nIR90005555;${title};${status};${data}`));
}
function importar(base: Revision, title?: string, status?: string, data?: string) {
 const p = previa(base, title, status, data);
 return aplicarPrevia(base, p, { itensAceitos: new Set(p.itens.filter(i => i.incluidoPorPadrao).map(i => i.id)), itensExcluidos: new Set(), decisoesDeIssues: new Map() }, crypto.randomUUID()).revisao;
}
function base() { return importar(revisaoInicial(novoWorkspace())); }
function editar(r: Revision, campos: Partial<CamposOficiaisCs3>, restaurar = false) {
 return salvarDadosSc3(r, { ticketId: r.tickets[0]!.id, revisaoBase: r.revisionId, campos: { ...r.tickets[0]!.oficial!, ...campos }, restaurar });
}
it('edita os dados SC3 sem modificar a versão importada nem o acompanhamento', () => {
 const r = base(); const novo = editar(r, { title: 'Corrigido', statusBruto: 'Wait on User', assignedTo: 'Pessoa teste', priority: 'Alta', tags: ['A', null, 'B'] });
 expect(novo.tickets[0]!.oficial).toMatchObject({ title: 'Corrigido', statusBruto: 'Wait on User', priority: 'Alta' });
 expect(novo.tickets[0]!.ultimoSc3Importado).toEqual(r.tickets[0]!.oficial);
 expect(novo.tickets[0]!.versaoFonte).toBe(r.tickets[0]!.versaoFonte);
 expect(novo.personalStates).toEqual(r.personalStates); expect(r.tickets[0]!.oficial!.title).toBe('Título da extração');
 expect(novo.audit.at(-1)?.operacao).toBe('updateSc3Data');
});
it('reimportar o CSV original mantém a edição sem conflito nem duplicação', () => {
 const editada = editar(base(), { title: 'Corrigido' }); const p = previa(editada);
 expect(p.contagens.igual).toBe(1); expect(p.contagens.conflito).toBe(0);
 const r = importar(editada); expect(r.tickets).toHaveLength(1); expect(r.tickets[0]!.oficial!.title).toBe('Corrigido');
});
it('CSV novo atualiza campos não editados e preserva inclusive valores removidos manualmente', () => {
 const editada = editar(base(), { title: 'Corrigido', statusBruto: '' });
 const r = importar(editada, 'Novo título na origem', 'Updated', '14/09/2026 10:00:00');
 expect(r.tickets[0]!.oficial).toMatchObject({ title: 'Corrigido', statusBruto: '', lastUpdateTimeBruto: '14/09/2026 10:00:00' });
 expect(r.tickets[0]!.ultimoSc3Importado!.title).toBe('Novo título na origem');
});
it('restaura o último CSV e libera as próximas atualizações', () => {
 const editada = editar(base(), { title: 'Corrigido' });
 const atual = importar(editada, 'Novo na origem', 'Updated', '14/09/2026 10:00:00');
 const restaurada = editar(atual, {}, true);
 expect(restaurada.tickets[0]!.oficial!.title).toBe('Novo na origem'); expect(restaurada.tickets[0]!.ajustesSc3).toEqual({});
 const proxima = importar(restaurada, 'Terceiro título', 'Working', '14/09/2026 11:00:00'); expect(proxima.tickets[0]!.oficial!.title).toBe('Terceiro título');
});
it('desfaz a prioridade manual ao digitar novamente o valor do último CSV', () => {
 const r = editar(editar(base(), { title: 'Corrigido' }), { title: 'Título da extração' });
 expect(r.tickets[0]!.ajustesSc3).not.toHaveProperty('title');
});
it.each(['31/02/2026', '14/09/2026 28:00:00', 'inválida'])('recusa data nova inválida %s', data => {
 expect(() => editar(base(), { startTimeBruto: data })).toThrow(/data/i);
});
it('não transforma última atualização editada em versão mais recente da fonte', () => {
 const r = editar(base(), { lastUpdateTimeBruto: '15/09/2026 09:00:00' });
 expect(previa(r).contagens.igual).toBe(1); expect(r.tickets[0]!.versaoFonte).toBe('14/09/2026 09:00:00');
});
it('recusa título vazio e revisão concorrente', () => {
 const r = base(); expect(() => editar(r, { title: ' ' })).toThrow(/título/i);
 expect(() => salvarDadosSc3(r, { ticketId: r.tickets[0]!.id, revisaoBase: 'antiga', campos: r.tickets[0]!.oficial! })).toThrow(/base mudou/i);
});
