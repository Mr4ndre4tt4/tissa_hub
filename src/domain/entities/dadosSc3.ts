import type { CamposOficiaisCs3, Revision, Ticket } from './tipos';
import { lerCarimboCs3 } from '../time/datas';

export const CAMPOS_SC3 = [
  ['title', 'Título SC3'], ['statusBruto', 'Status SC3'], ['assignedTo', 'Responsável'],
  ['startTimeBruto', 'Abertura informada'], ['lastUpdateTimeBruto', 'Última atualização'],
  ['priority', 'Prioridade'], ['impact', 'Impacto'], ['complexity', 'Complexidade'],
  ['assignmentGroup', 'Grupo responsável'], ['external', 'Referência externa'], ['referenceId', 'Reference ID'],
  ['reportedBy', 'Relatado por'], ['reportedCi', 'CI relatado'], ['deviceCi', 'CI do dispositivo'], ['affectedCi', 'CI afetado'],
  ['typeBruto', 'Tipo informado'], ['escalationStatus', 'Status de escalonamento'], ['lastUsedKnowledgeSource', 'Última fonte de conhecimento'],
] as const;
export type CampoTextoSc3 = typeof CAMPOS_SC3[number][0];
const OBRIGATORIOS_TEXTO = new Set(['title', 'statusBruto', 'lastUpdateTimeBruto']);
export function camposSc3Vazios(): CamposOficiaisCs3 {
  return Object.fromEntries([...CAMPOS_SC3.map(([c]) => [c, OBRIGATORIOS_TEXTO.has(c) ? '' : null]), ['tags', Array(6).fill(null)], ['extras', {}]]) as unknown as CamposOficiaisCs3;
}
function iguais(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
export function aplicarAjustesSc3(ticket: Ticket, importado: CamposOficiaisCs3): CamposOficiaisCs3 {
  return { ...importado, ...ticket.ajustesSc3 };
}

export function salvarDadosSc3(base: Revision, comando: { ticketId: string; revisaoBase: string; campos: CamposOficiaisCs3; restaurar?: boolean }): Revision {
  if (base.revisionId !== comando.revisaoBase) throw new Error('A base mudou. Reabra o formulário para conferir os dados atuais.');
  const ticket = base.tickets.find(t => t.id === comando.ticketId);
  if (!ticket) throw new Error('Chamado não encontrado.');
  const importado = ticket.ultimoSc3Importado !== undefined ? ticket.ultimoSc3Importado : ticket.oficial;
  if (comando.restaurar && !importado) throw new Error('Este chamado ainda não tem uma extração SC3 para restaurar.');
  const anterior = ticket.oficial ?? camposSc3Vazios();
  const campos = structuredClone(comando.restaurar ? importado! : comando.campos);
  if (!campos.title.trim()) throw new Error('Informe o título SC3.');
  for (const chave of ['startTimeBruto', 'lastUpdateTimeBruto'] as const) {
    if (comando.restaurar || campos[chave] === anterior[chave] || !campos[chave]) continue;
    const valor = campos[chave]!;
    const resultado = lerCarimboCs3(valor);
    const hora = resultado.ok ? resultado.valor.horaLocal?.split(':').map(Number) : null;
    if (!resultado.ok || (hora && (hora[0]! > 23 || hora[1]! > 59 || hora[2]! > 59))) throw new Error('Informe uma data válida: DD/MM/AAAA, com HH:mm:ss se houver horário.');
  }
  const ajustes: Partial<CamposOficiaisCs3> = comando.restaurar ? {} : { ...ticket.ajustesSc3 };
  const comparacao = importado ?? camposSc3Vazios();
  for (const chave of [...CAMPOS_SC3.map(([c]) => c), 'tags', 'extras'] as const) {
    if (comando.restaurar) break;
    // Valores idênticos à fonte deixam de ser exceção manual.
    if (iguais(campos[chave], comparacao[chave])) delete ajustes[chave];
    else if (!iguais(campos[chave], anterior[chave])) Object.assign(ajustes, { [chave]: campos[chave] });
  }
  const agora = new Date().toISOString();
  const atualizado: Ticket = { ...ticket, oficial: campos, ultimoSc3Importado: importado, ajustesSc3: ajustes,
    atualizadoEm: agora, versao: ticket.versao + 1, proveniencia: [...ticket.proveniencia, { origem: 'app', observadoEm: agora, natureza: 'literal' }] };
  return { ...base, revisionId: crypto.randomUUID(), parentRevisionId: base.revisionId, criadoEm: agora,
    tickets: base.tickets.map(t => t.id === ticket.id ? atualizado : t),
    audit: [...base.audit, { id: crypto.randomUUID(), operationId: crypto.randomUUID(), operacao: comando.restaurar ? 'restoreSc3Data' : 'updateSc3Data',
      antes: { ticketId: ticket.id, campos: ticket.oficial, ajustes: ticket.ajustesSc3 }, depois: { ticketId: ticket.id, campos, ajustes }, revisaoBase: base.revisionId, autoria: 'pessoa', horarioTecnico: agora }],
  };
}
