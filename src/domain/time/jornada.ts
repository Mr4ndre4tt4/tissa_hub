/**
 * Jornada, meta diária e saldo.
 *
 * Regras da secção 6:
 *  - Meta padrão de 480 min por dia útil, no conjunto das atividades — nunca por célula.
 *  - Horas confirmadas somam apenas atividades `confirmed`, elegíveis, não
 *    canceladas e com duração inteira, atribuídas à data de trabalho.
 *  - faltante = máx(meta − realizado, 0); excedente = máx(realizado − meta, 0).
 *    Nunca ambos positivos; nunca completar, arredondar ou compensar outro dia.
 *  - Antes do início do controle não se gera pendência de jornada.
 *  - Dias futuros não são atraso.
 */

import type { CalendarException, Schedule, TimeEntry, WorkDate } from '../entities/tipos';
import { diaDaSemana, diferencaEmDias } from './datas';

export interface SaldoDoDia {
  data: WorkDate;
  metaMinutos: number;
  realizadoMinutos: number;
  faltanteMinutos: number;
  excedenteMinutos: number;
  /** Registros da data que ficaram fora do total por estarem incompletos. */
  incompletos: number;
}

/** Meta da data: exceção de calendário vence o padrão semanal. */
export function metaDaData(data: WorkDate, schedule: Schedule, excecoes: CalendarException[]): number {
  const excecao = excecoes.find((e) => e.data === data);
  if (excecao) return Math.max(0, Math.trunc(excecao.metaMinutos));
  const dia = diaDaSemana(data);
  return Math.max(0, Math.trunc(schedule.metaPorDiaSemana[dia] ?? 0));
}

/**
 * Um apontamento conta para a jornada da data?
 *
 * Excluídos: rascunho, cancelado, duração ausente/não inteira, marcado como
 * não elegível e candidatos em quarentena (`needs_review` / `ignored`).
 */
export function contaParaJornada(entrada: TimeEntry): boolean {
  if (entrada.estadoOperacional !== 'confirmed') return false;
  if (entrada.canceladoEm !== null) return false;
  if (!entrada.elegivelJornada) return false;
  if (entrada.estadoImportacao === 'needs_review' || entrada.estadoImportacao === 'ignored') return false;
  if (entrada.workDate === null) return false;
  const d = entrada.duracaoMinutos;
  return typeof d === 'number' && Number.isInteger(d) && d > 0;
}

/** Registro que existe e tem data, mas não pôde entrar no total. */
export function ehIncompleto(entrada: TimeEntry): boolean {
  if (entrada.canceladoEm !== null) return false;
  if (entrada.estadoOperacional === 'cancelled') return false;
  return !contaParaJornada(entrada) && entrada.estadoOperacional !== 'draft';
}

export function saldoDoDia(
  data: WorkDate,
  entradas: TimeEntry[],
  schedule: Schedule,
  excecoes: CalendarException[],
): SaldoDoDia {
  const doDia = entradas.filter((e) => e.workDate === data);
  const realizadoMinutos = doDia.filter(contaParaJornada).reduce((s, e) => s + (e.duracaoMinutos ?? 0), 0);
  const metaMinutos = metaDaData(data, schedule, excecoes);

  return {
    data,
    metaMinutos,
    realizadoMinutos,
    faltanteMinutos: Math.max(metaMinutos - realizadoMinutos, 0),
    excedenteMinutos: Math.max(realizadoMinutos - metaMinutos, 0),
    incompletos: doDia.filter(ehIncompleto).length,
  };
}

/**
 * Datas anteriores a hoje, após o início do controle, com meta > 0 e esforço
 * abaixo da meta. Dias futuros nunca aparecem; sem início definido, nada é
 * cobrado retroativamente.
 */
export function diasVencidosIncompletos(
  hoje: WorkDate,
  entradas: TimeEntry[],
  schedule: Schedule,
  excecoes: CalendarException[],
): SaldoDoDia[] {
  const inicio = schedule.inicioControle;
  if (!inicio) return [];

  const datas = new Set<WorkDate>();
  for (const e of entradas) if (e.workDate) datas.add(e.workDate);

  // Também considera datas sem nenhum registro dentro da janela de controle.
  let cursor = inicio;
  while (diferencaEmDias(cursor, hoje) > 0) {
    datas.add(cursor);
    cursor = somarUmDia(cursor);
  }

  const saidas: SaldoDoDia[] = [];
  for (const data of [...datas].sort()) {
    if (diferencaEmDias(inicio, data) < 0) continue; // antes do início do controle
    if (diferencaEmDias(data, hoje) <= 0) continue; // hoje e futuro não são atraso
    const saldo = saldoDoDia(data, entradas, schedule, excecoes);
    if (saldo.metaMinutos > 0 && saldo.realizadoMinutos < saldo.metaMinutos) saidas.push(saldo);
  }
  return saidas;
}

function somarUmDia(data: WorkDate): WorkDate {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(a, m - 1, d + 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export interface MetaDoPeriodo {
  metaVencidaAteOntem: number;
  metaDeHoje: number;
  metaTotalPeriodo: number;
  realizadoPeriodo: number;
}

/** Meta do período: soma das metas das datas, separando vencida, hoje e total. */
export function metaDoPeriodo(
  inicio: WorkDate,
  fim: WorkDate,
  hoje: WorkDate,
  entradas: TimeEntry[],
  schedule: Schedule,
  excecoes: CalendarException[],
): MetaDoPeriodo {
  let vencida = 0;
  let deHoje = 0;
  let total = 0;
  let realizado = 0;

  let cursor = inicio;
  while (diferencaEmDias(cursor, fim) >= 0) {
    const meta = metaDaData(cursor, schedule, excecoes);
    total += meta;
    if (diferencaEmDias(cursor, hoje) > 0) vencida += meta;
    if (cursor === hoje) deHoje += meta;
    cursor = somarUmDia(cursor);
  }

  for (const e of entradas) {
    if (!contaParaJornada(e) || !e.workDate) continue;
    if (diferencaEmDias(inicio, e.workDate) >= 0 && diferencaEmDias(e.workDate, fim) >= 0) {
      realizado += e.duracaoMinutos ?? 0;
    }
  }

  return { metaVencidaAteOntem: vencida, metaDeHoje: deHoje, metaTotalPeriodo: total, realizadoPeriodo: realizado };
}
