import { CELULAS, type Celula, type PersonalTicketState, type Revision, type Ticket, type TicketType } from './tipos';
import { lerReferencia } from './identidade';
import { ehDataValida } from '../time/datas';

export interface DadosChamado {
  referencia: string;
  tipo: TicketType | '';
  titulo: string;
  andamento: string;
  prioridade: string;
  responsavel: string;
  celula: Celula | '';
  proximaAcao: string;
  prazo: string;
  estimativa: string;
}
export function dadosDoChamado(base: Revision, ticket?: Ticket): DadosChamado {
  const p = ticket && base.personalStates.find(p => p.ticketId === ticket.id);
  return {
    referencia: ticket?.referencia.bruto ?? '', tipo: ticket?.ticketType ?? '',
    titulo: p?.tituloPessoal ?? ticket?.oficial?.title ?? '', andamento: p?.andamentoPessoal ?? '',
    prioridade: p?.prioridadePessoal ?? '', responsavel: p?.responsavelPessoal ?? '',
    celula: p?.celulaManual ?? '', proximaAcao: p?.proximaAcao ?? '', prazo: p?.prazo ?? '',
    estimativa: p?.estimativaMinutos == null ? '' : String(p.estimativaMinutos),
  };
}
export function validarDadosChamado(d: DadosChamado): void {
  if (!d.titulo.trim()) throw new Error('Informe o título do chamado.');
  if (d.tipo !== 'incident' && d.tipo !== 'request' && d.tipo !== '') throw new Error('Escolha um tipo válido.');
  const ref = lerReferencia(d.referencia);
  if (ref.multiplo) throw new Error('Informe somente uma referência por chamado.');
  if ((ref.candidatos[0]?.namespace === 'IR' && d.tipo === 'request') || (ref.candidatos[0]?.namespace === 'RR' && d.tipo === 'incident')) {
    throw new Error('O tipo deve corresponder à referência: IR é incidente e RR é requisição.');
  }
  if (d.prazo && !ehDataValida(d.prazo)) throw new Error('Informe um prazo válido.');
  if (d.estimativa !== '' && (!/^\d+$/.test(d.estimativa) || !Number.isSafeInteger(Number(d.estimativa)))) throw new Error('A estimativa deve ser um número inteiro de minutos, a partir de zero.');
  if (d.celula && !CELULAS.includes(d.celula)) throw new Error('Escolha uma célula válida.');
}

/** Campos pessoais ficam separados da fonte: um CSV posterior não desfaz a edição. */
export function salvarChamado(base: Revision, comando: { id: string; editando: boolean; revisaoBase: string; dados: DadosChamado }): Revision {
  const { id, editando, revisaoBase, dados: d } = comando;
  if (base.revisionId !== revisaoBase) throw new Error('A base mudou. Feche e abra o formulário novamente para revisar os dados atuais.');
  validarDadosChamado(d);
  const existente = base.tickets.find(t => t.id === id);
  if (editando && !existente) throw new Error('Chamado não encontrado.');
  if (!editando && existente) throw new Error('Este chamado já existe. Reabra a lista para conferir a gravação.');
  if (existente && (d.referencia !== existente.referencia.bruto || d.tipo !== (existente.ticketType ?? ''))) throw new Error('A referência e o tipo identificam o chamado e não podem ser trocados na edição.');
  if (!editando && !d.tipo) throw new Error('Escolha o tipo do chamado.');
  const ref = lerReferencia(d.referencia.trim() || `MANUAL-${id.slice(0, 8).toUpperCase()}`).candidatos[0]!;
  if (!editando && base.tickets.some(t => t.referencia.normalizado === ref.normalizado)) throw new Error('Já existe um chamado com esta referência. Abra o registro existente para editar.');
  const agora = new Date().toISOString();
  const origem = { origem: 'app' as const, observadoEm: agora, natureza: 'literal' as const };
  const ticket: Ticket = existente ?? {
    id, workspaceId: base.workspace.id, sourceSystem: null, sourceTicketId: null, ticketType: d.tipo || null,
    provisorio: true, referencia: ref, oficial: null, versaoFonte: null, versaoFonteInstante: null,
    proveniencia: [origem], criadoEm: agora, atualizadoEm: agora, versao: 1,
  };
  const anterior = base.personalStates.find(p => p.ticketId === id);
  const inicial: PersonalTicketState = anterior ?? {
    id: crypto.randomUUID(), workspaceId: base.workspace.id, ticketId: id, groupId: null,
    tituloPessoal: null, andamentoPessoal: null, andamentoPessoalBruto: null, prioridadePessoal: null,
    categoriaFuncional: null, celulaManual: null, celulaSugerida: null, proximaAcao: null, prazo: null,
    estimativaMinutos: null, estimativaConfirmada: false, rndBruto: null, responsavelPessoal: null,
    criadoEmPessoal: null, atualizadoEmPessoal: null, resolvidoEmPessoal: null,
    proveniencia: [], criadoEm: agora, atualizadoEm: agora, versao: 0,
  };
  const pessoal: PersonalTicketState = {
    ...inicial, tituloPessoal: d.titulo.trim(), andamentoPessoal: d.andamento.trim() || null,
    prioridadePessoal: d.prioridade.trim() || null, responsavelPessoal: d.responsavel.trim() || null,
    celulaManual: d.celula || null, proximaAcao: d.proximaAcao.trim() || null, prazo: d.prazo || null,
    estimativaMinutos: d.estimativa === '' ? null : Number(d.estimativa), estimativaConfirmada: d.estimativa !== '',
    proveniencia: [...inicial.proveniencia, origem], atualizadoEm: agora, versao: inicial.versao + 1,
  };
  return {
    ...base, revisionId: crypto.randomUUID(), parentRevisionId: base.revisionId, criadoEm: agora,
    tickets: existente ? base.tickets : [...base.tickets, ticket],
    personalStates: anterior ? base.personalStates.map(p => p.id === anterior.id ? pessoal : p) : [...base.personalStates, pessoal],
    audit: [...base.audit, { id: crypto.randomUUID(), operationId: crypto.randomUUID(), operacao: editando ? 'updateTicket' : 'createTicket',
      antes: anterior ?? null, depois: { ticketId: id, acompanhamento: pessoal }, revisaoBase: base.revisionId, autoria: 'pessoa', horarioTecnico: agora }],
  };
}
