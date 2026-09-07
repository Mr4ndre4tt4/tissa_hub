/**
 * Construtores de entidades sintéticas para os testes.
 * Nenhum dado real do cliente entra aqui (secção 20).
 */

import type {
  Celula,
  Schedule,
  TimeAllocation,
  TimeEntry,
  TimeEntryReference,
  Uuid,
} from '../../src/domain/entities/tipos';
import { lerReferencia } from '../../src/domain/entities/identidade';

let contador = 0;
export function idSintetico(prefixo = 'e'): Uuid {
  contador += 1;
  return `00000000-0000-4000-8000-${prefixo}${String(contador).padStart(11, '0')}`;
}

export function apontamento(over: Partial<TimeEntry> = {}): TimeEntry {
  const agora = '2026-09-07T12:00:00-03:00';
  return {
    id: idSintetico('a'),
    workspaceId: 'ws-sintetico',
    workDate: '2026-09-01',
    descricao: 'Atividade sintética',
    duracaoMinutos: 60,
    tipoAtuacaoBruto: null,
    tipoAtuacaoNormalizado: null,
    celula: 'UNCLASSIFIED' as Celula,
    celulaDefinidaPor: 'padrao',
    estadoOperacional: 'confirmed',
    estadoImportacao: 'ready',
    elegivelJornada: true,
    lancamentoExterno: null,
    observacao: null,
    referencias: [],
    proveniencia: [],
    criadoEm: agora,
    atualizadoEm: agora,
    canceladoEm: null,
    motivoCancelamento: null,
    versao: 1,
    ...over,
  };
}

export function referencia(timeEntryId: Uuid, bruto: string, ticketId: Uuid | null = null): TimeEntryReference {
  const leitura = lerReferencia(bruto);
  return {
    id: idSintetico('r'),
    timeEntryId,
    ticketId,
    groupId: null,
    referencia: leitura.candidatos[0] ?? { bruto, namespace: 'OUTRO', normalizado: bruto.toUpperCase() },
  };
}

export function alocacao(timeEntryId: Uuid, ticketId: Uuid, minutos: number): TimeAllocation {
  return {
    id: idSintetico('l'),
    timeEntryId,
    ticketId,
    minutos,
    confirmadaEm: '2026-09-07T12:00:00-03:00',
  };
}

/** Jornada padrão: 480 min de segunda a sexta, fuso America/Sao_Paulo. */
export function jornadaPadrao(inicioControle: string | null = '2026-05-18'): Schedule {
  return {
    metaPorDiaSemana: [0, 480, 480, 480, 480, 480, 0],
    inicioControle,
    fusoTrabalho: 'America/Sao_Paulo',
  };
}
