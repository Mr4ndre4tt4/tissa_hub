/**
 * Rateio de esforço entre chamados e reconciliação de totais.
 *
 * Regras da secção 6.2:
 *  - Uma atividade de 120 min ligada a dois chamados soma **120** no dia.
 *  - Sem rateio confirmado, nenhum dos tickets recebe os 120: o evento aparece
 *    em cada detalhe com a etiqueta "Compartilhado — sem rateio".
 *  - Com rateio, a soma das alocações tem de ser exatamente a duração.
 *  - As cinco classes de reconciliação são mutuamente exclusivas.
 */

import type { Celula, TimeAllocation, TimeEntry, TimeEntryReference, Uuid } from '../entities/tipos';
import { contaParaJornada } from './jornada';

export type ErroAlocacao = 'allocation_sum_mismatch' | 'allocation_not_positive' | 'allocation_duplicate_ticket';

export interface ValidacaoAlocacao {
  ok: boolean;
  erro?: ErroAlocacao;
  detalhe?: string;
  somaMinutos: number;
}

/**
 * Valida um conjunto de alocações contra a duração da atividade.
 * 75 + 45 = 120 é aceito; 75 + 60 é rejeitado com `allocation_sum_mismatch`.
 */
export function validarAlocacoes(duracaoMinutos: number, alocacoes: { ticketId: Uuid; minutos: number }[]): ValidacaoAlocacao {
  const soma = alocacoes.reduce((s, a) => s + a.minutos, 0);

  for (const a of alocacoes) {
    if (!Number.isInteger(a.minutos) || a.minutos <= 0) {
      return { ok: false, erro: 'allocation_not_positive', detalhe: `Alocação inválida de ${a.minutos} minutos.`, somaMinutos: soma };
    }
  }

  const vistos = new Set<Uuid>();
  for (const a of alocacoes) {
    if (vistos.has(a.ticketId)) {
      return { ok: false, erro: 'allocation_duplicate_ticket', detalhe: 'O mesmo chamado aparece duas vezes no rateio.', somaMinutos: soma };
    }
    vistos.add(a.ticketId);
  }

  if (soma !== duracaoMinutos) {
    return {
      ok: false,
      erro: 'allocation_sum_mismatch',
      detalhe: `A soma do rateio (${soma} min) precisa ser igual à duração da atividade (${duracaoMinutos} min).`,
      somaMinutos: soma,
    };
  }
  return { ok: true, somaMinutos: soma };
}

/** Classes mutuamente exclusivas do total confirmado (secção 6.2). */
export interface ReconciliacaoDeTotais {
  atribuidoATickets: number;
  compartilhadoSemRateio: number;
  atividadeInterna: number;
  referenciaSemVinculoConfirmado: number;
  totalConfirmado: number;
  /** Verdadeiro quando as quatro classes somam exatamente o total. */
  fecha: boolean;
}

/**
 * Classifica cada atividade confirmada em exatamente uma classe.
 *
 * - `atribuidoATickets`: existe rateio confirmado cobrindo a duração.
 * - `compartilhadoSemRateio`: há mais de uma referência e nenhum rateio válido.
 * - `referenciaSemVinculoConfirmado`: há uma referência, mas ela ainda não
 *   corresponde a um ticket cadastrado (referência provisória).
 * - `atividadeInterna`: nenhuma referência.
 */
export function reconciliarTotais(
  entradas: TimeEntry[],
  referencias: TimeEntryReference[],
  alocacoes: TimeAllocation[],
): ReconciliacaoDeTotais {
  const refsPorEntrada = agruparPor(referencias, (r) => r.timeEntryId);
  const alocPorEntrada = agruparPor(alocacoes, (a) => a.timeEntryId);

  let atribuido = 0;
  let compartilhado = 0;
  let interna = 0;
  let semVinculo = 0;
  let total = 0;

  for (const e of entradas) {
    if (!contaParaJornada(e)) continue;
    const minutos = e.duracaoMinutos ?? 0;
    total += minutos;

    const refs = refsPorEntrada.get(e.id) ?? [];
    const alocs = alocPorEntrada.get(e.id) ?? [];
    const somaAloc = alocs.reduce((s, a) => s + a.minutos, 0);

    if (alocs.length > 0 && somaAloc === minutos) {
      atribuido += minutos;
    } else if (refs.length === 0) {
      interna += minutos;
    } else if (refs.length > 1) {
      compartilhado += minutos;
    } else if (refs[0]!.ticketId === null) {
      semVinculo += minutos;
    } else {
      // Uma referência resolvida para um ticket, sem rateio explícito: o esforço
      // é integralmente daquele ticket, portanto atribuído.
      atribuido += minutos;
    }
  }

  return {
    atribuidoATickets: atribuido,
    compartilhadoSemRateio: compartilhado,
    atividadeInterna: interna,
    referenciaSemVinculoConfirmado: semVinculo,
    totalConfirmado: total,
    fecha: atribuido + compartilhado + interna + semVinculo === total,
  };
}

export interface TotaisPorCelula {
  porCelula: Record<Celula, number>;
  totalConfirmado: number;
  fecha: boolean;
}

/**
 * Eixo de células, separado do rateio por ticket.
 * AMS + Squad + Task Force + Geral + Sem classificação = total confirmado.
 */
export function totaisPorCelula(entradas: TimeEntry[]): TotaisPorCelula {
  const porCelula: Record<Celula, number> = { AMS: 0, SQUAD: 0, TASK_FORCE: 0, GENERAL: 0, UNCLASSIFIED: 0 };
  let total = 0;
  for (const e of entradas) {
    if (!contaParaJornada(e)) continue;
    const minutos = e.duracaoMinutos ?? 0;
    porCelula[e.celula] += minutos;
    total += minutos;
  }
  const soma = Object.values(porCelula).reduce((s, v) => s + v, 0);
  return { porCelula, totalConfirmado: total, fecha: soma === total };
}

/**
 * Minutos de um ticket. Considera apenas alocações confirmadas; o esforço
 * compartilhado sem rateio é devolvido à parte e nunca somado no principal.
 */
export interface EsforcoDoTicket {
  atribuidoMinutos: number;
  compartilhadoSemRateioMinutos: number;
  entradasCompartilhadas: Uuid[];
}

export function esforcoDoTicket(
  ticketId: Uuid,
  entradas: TimeEntry[],
  referencias: TimeEntryReference[],
  alocacoes: TimeAllocation[],
): EsforcoDoTicket {
  const porId = new Map(entradas.map((e) => [e.id, e]));
  const alocPorEntrada = agruparPor(alocacoes, (a) => a.timeEntryId);
  const refsPorEntrada = agruparPor(referencias, (r) => r.timeEntryId);

  let atribuido = 0;
  let compartilhado = 0;
  const compartilhadas: Uuid[] = [];

  const entradasDoTicket = new Set<Uuid>();
  for (const r of referencias) if (r.ticketId === ticketId) entradasDoTicket.add(r.timeEntryId);
  for (const a of alocacoes) if (a.ticketId === ticketId) entradasDoTicket.add(a.timeEntryId);

  for (const entradaId of entradasDoTicket) {
    const e = porId.get(entradaId);
    if (!e || !contaParaJornada(e)) continue;

    const alocs = alocPorEntrada.get(e.id) ?? [];
    const somaAloc = alocs.reduce((s, a) => s + a.minutos, 0);
    const minutos = e.duracaoMinutos ?? 0;

    if (alocs.length > 0 && somaAloc === minutos) {
      // Um apontamento compartilhado nunca entra duas vezes: apenas a fatia dele.
      atribuido += alocs.filter((a) => a.ticketId === ticketId).reduce((s, a) => s + a.minutos, 0);
      continue;
    }

    const refs = refsPorEntrada.get(e.id) ?? [];
    if (refs.length > 1) {
      compartilhado += minutos;
      compartilhadas.push(e.id);
    } else {
      atribuido += minutos;
    }
  }

  return { atribuidoMinutos: atribuido, compartilhadoSemRateioMinutos: compartilhado, entradasCompartilhadas: compartilhadas };
}

function agruparPor<T, K>(itens: T[], chave: (t: T) => K): Map<K, T[]> {
  const mapa = new Map<K, T[]>();
  for (const item of itens) {
    const k = chave(item);
    const lista = mapa.get(k);
    if (lista) lista.push(item);
    else mapa.set(k, [item]);
  }
  return mapa;
}
