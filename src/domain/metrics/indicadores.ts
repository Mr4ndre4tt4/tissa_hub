/**
 * Indicadores do dashboard (secção 13).
 *
 * Cada indicador declara a sua definição e as suas exclusões, e todos são
 * calculados a partir dos detalhes — nunca de snapshots derivados do legado.
 * Números confirmados e prévia bruta não se misturam.
 */

import type {
  Celula,
  ReconciliationIssue,
  Revision,
  Ticket,
  Uuid,
  WorkDate,
} from '../entities/tipos';
import { contaParaJornada, metaDaData, saldoDoDia, type SaldoDoDia } from '../time/jornada';
import { esforcoDoTicket, reconciliarTotais, totaisPorCelula } from '../time/alocacao';
import { diferencaEmDias, enumerarPeriodo } from '../time/datas';
import { exibirStatusCs3 } from '../entities/celulas';

export interface Periodo {
  inicio: WorkDate;
  fim: WorkDate;
}

export function noPeriodo(data: WorkDate | null, p: Periodo): boolean {
  if (!data) return false;
  return diferencaEmDias(p.inicio, data) >= 0 && diferencaEmDias(data, p.fim) >= 0;
}

/** Definição textual exibida junto de cada indicador, como exige a secção 4.5. */
export const DEFINICOES: Record<string, string> = {
  horasDaData: 'Minutos confirmados e elegíveis atribuídos à data de trabalho. Não usa o horário em que o registro foi digitado.',
  faltanteExcedente: 'Diferença em relação à meta específica da data. Faltante e excedente nunca são positivos ao mesmo tempo.',
  diasVencidos: 'Datas anteriores a hoje, depois do início do controle, com meta maior que zero e esforço abaixo da meta.',
  horasPorCelula: 'Célula histórica registrada em cada apontamento. Geral e Sem classificação entram na reconciliação.',
  horasPorChamado: 'Apenas alocações confirmadas. O esforço compartilhado sem rateio aparece separado.',
  maiorConsumo: 'Ordena o esforço do período mantendo acesso aos eventos e às suas alocações.',
  estimadoRealizado: 'Só quando a estimativa foi confirmada. Aprovação de RND é separada; "sem estimativa" não é zero.',
  chamadosPorStatus: 'IDs distintos, separando status oficial e pessoal. Provisórios são contados à parte.',
  resolucoesPessoais: 'Eventos de resolução conhecidos. Chamados distintos e eventos são contados separadamente.',
  tempoAteResolucao: 'Intervalo entre datas pessoais válidas. Informa quantos casos foram excluídos por falta ou incoerência de data.',
  ultimaAtualizacaoCs3: 'Data da origem do chamado, separada da data da última importação.',
  proximasAcoesVencidas: 'Prazo pessoal vencido com ação pendente. Não é SLA.',
  saudeImportacao: 'Última carga por fonte, versões, aceitos, rejeitados, conflitos e pendências restantes.',
};

/* ------------------------------------------------------------------ */

export interface ResumoDoDia extends SaldoDoDia {
  definicao: string;
}

export function resumoDoDia(r: Revision, data: WorkDate): ResumoDoDia {
  return {
    ...saldoDoDia(data, r.timeEntries, r.workspace.schedule, r.workspace.excecoesCalendario),
    definicao: DEFINICOES.horasDaData!,
  };
}

export interface SerieDiaria {
  data: WorkDate;
  realizadoMinutos: number;
  metaMinutos: number;
}

/** Barras diárias com linha de meta. Datas sem registro aparecem com zero. */
export function serieDiaria(r: Revision, p: Periodo): SerieDiaria[] {
  return enumerarPeriodo(p.inicio, p.fim).map((data) => {
    const s = saldoDoDia(data, r.timeEntries, r.workspace.schedule, r.workspace.excecoesCalendario);
    return { data, realizadoMinutos: s.realizadoMinutos, metaMinutos: s.metaMinutos };
  });
}

export interface DistribuicaoPorCelula {
  celula: Celula;
  minutos: number;
  /** Proporção com denominador explícito; nunca uma fatia sem total. */
  proporcao: number;
}

export function distribuicaoPorCelula(r: Revision, p: Periodo): { itens: DistribuicaoPorCelula[]; total: number; fecha: boolean } {
  const entradas = r.timeEntries.filter((e) => noPeriodo(e.workDate, p));
  const totais = totaisPorCelula(entradas);
  const itens = (Object.keys(totais.porCelula) as Celula[]).map((celula) => ({
    celula,
    minutos: totais.porCelula[celula],
    proporcao: totais.totalConfirmado === 0 ? 0 : totais.porCelula[celula] / totais.totalConfirmado,
  }));
  return { itens, total: totais.totalConfirmado, fecha: totais.fecha };
}

export interface EsforcoPorChamado {
  ticketId: Uuid;
  referencia: string;
  titulo: string;
  atribuidoMinutos: number;
  compartilhadoSemRateioMinutos: number;
  entradas: Uuid[];
}

/** Maior consumo de esforço, mantendo acesso aos eventos que o compõem. */
export function esforcoPorChamado(r: Revision, p: Periodo): EsforcoPorChamado[] {
  const entradas = r.timeEntries.filter((e) => noPeriodo(e.workDate, p));
  const idsEntradas = new Set(entradas.map((e) => e.id));
  const refs = r.timeEntryReferences.filter((x) => idsEntradas.has(x.timeEntryId));
  const alocs = r.allocations.filter((x) => idsEntradas.has(x.timeEntryId));

  const saida: EsforcoPorChamado[] = [];
  for (const t of r.tickets) {
    const e = esforcoDoTicket(t.id, entradas, refs, alocs);
    if (e.atribuidoMinutos === 0 && e.compartilhadoSemRateioMinutos === 0) continue;
    saida.push({
      ticketId: t.id,
      referencia: t.referencia.bruto,
      titulo: t.oficial?.title ?? r.personalStates.find((s) => s.ticketId === t.id)?.tituloPessoal ?? '',
      atribuidoMinutos: e.atribuidoMinutos,
      compartilhadoSemRateioMinutos: e.compartilhadoSemRateioMinutos,
      entradas: e.entradasCompartilhadas,
    });
  }
  return saida.sort((a, b) => b.atribuidoMinutos - a.atribuidoMinutos);
}

export interface ContagemPorStatus {
  rotulo: string;
  bruto: string;
  quantidade: number;
  naoMapeado: boolean;
}

export interface ChamadosPorStatus {
  oficial: ContagemPorStatus[];
  pessoal: ContagemPorStatus[];
  /** Referências provisórias, contadas à parte (secção 13). */
  provisorios: number;
}

export function chamadosPorStatus(r: Revision): ChamadosPorStatus {
  const oficial = new Map<string, number>();
  let provisorios = 0;

  for (const t of r.tickets) {
    if (t.provisorio) {
      provisorios += 1;
      continue;
    }
    const bruto = t.oficial?.statusBruto ?? '';
    oficial.set(bruto, (oficial.get(bruto) ?? 0) + 1);
  }

  const pessoal = new Map<string, number>();
  for (const s of r.personalStates) {
    const bruto = s.andamentoPessoal ?? '';
    pessoal.set(bruto, (pessoal.get(bruto) ?? 0) + 1);
  }

  const mapear = (m: Map<string, number>, comMapa: boolean): ContagemPorStatus[] =>
    [...m.entries()]
      .map(([bruto, quantidade]) => {
        if (!comMapa) return { rotulo: bruto || 'Sem andamento', bruto, quantidade, naoMapeado: false };
        const s = exibirStatusCs3(bruto, r.workspace.mapaStatusCs3);
        return { rotulo: s.amigavel, bruto, quantidade, naoMapeado: s.naoMapeado };
      })
      .sort((a, b) => b.quantidade - a.quantidade);

  return { oficial: mapear(oficial, true), pessoal: mapear(pessoal, false), provisorios };
}

export interface ResolucoesPessoais {
  ticketsDistintos: number;
  eventosDeResolucao: number;
  /** Chamados marcados como resolvidos sem data conhecida. */
  semDataConhecida: number;
}

export function resolucoesPessoais(r: Revision, p: Periodo): ResolucoesPessoais {
  // O filtro de período das resoluções usa a data de resolução, não a data
  // trabalhada — semânticas diferentes não compartilham o mesmo filtro.
  const eventos = r.resolutionEvents.filter((e) => e.dataResolucao !== null && noPeriodo(e.dataResolucao, p));
  const distintos = new Set(eventos.map((e) => e.ticketId ?? e.referenciaBruta ?? ''));
  return {
    ticketsDistintos: distintos.size,
    eventosDeResolucao: eventos.length,
    semDataConhecida: r.resolutionEvents.filter((e) => e.dataResolucao === null).length,
  };
}

export interface TempoAteResolucao {
  casosConsiderados: number;
  casosExcluidos: number;
  motivosDeExclusao: Record<string, number>;
  medianaDias: number | null;
}

/**
 * Intervalo entre datas pessoais válidas. Datas incoerentes são excluídas do
 * indicador — e a quantidade excluída é sempre informada (secção 13).
 */
export function tempoAteResolucao(r: Revision): TempoAteResolucao {
  const dias: number[] = [];
  const motivos: Record<string, number> = { sem_data_de_criacao: 0, sem_data_de_resolucao: 0, intervalo_negativo: 0, data_futura: 0 };
  const hoje = new Date().toISOString().slice(0, 10);

  for (const s of r.personalStates) {
    if (s.resolvidoEmPessoal === null) continue;
    if (s.criadoEmPessoal === null) {
      motivos.sem_data_de_criacao! += 1;
      continue;
    }
    const delta = diferencaEmDias(s.criadoEmPessoal, s.resolvidoEmPessoal);
    if (delta < 0) {
      motivos.intervalo_negativo! += 1;
      continue;
    }
    if (diferencaEmDias(hoje, s.resolvidoEmPessoal) > 0) {
      motivos.data_futura! += 1;
      continue;
    }
    dias.push(delta);
  }

  const excluidos = Object.values(motivos).reduce((a, b) => a + b, 0);
  const ordenado = dias.slice().sort((a, b) => a - b);
  const mediana =
    ordenado.length === 0
      ? null
      : ordenado.length % 2 === 1
        ? ordenado[(ordenado.length - 1) / 2]!
        : (ordenado[ordenado.length / 2 - 1]! + ordenado[ordenado.length / 2]!) / 2;

  return { casosConsiderados: dias.length, casosExcluidos: excluidos, motivosDeExclusao: motivos, medianaDias: mediana };
}

export interface AcaoVencida {
  ticketId: Uuid | null;
  referencia: string;
  proximaAcao: string;
  prazo: WorkDate;
  diasVencido: number;
}

/** Prazo pessoal vencido com ação pendente. Nunca chamado de SLA. */
export function proximasAcoesVencidas(r: Revision, hoje: WorkDate): AcaoVencida[] {
  const saida: AcaoVencida[] = [];
  for (const s of r.personalStates) {
    if (!s.prazo || !s.proximaAcao) continue;
    if (s.resolvidoEmPessoal !== null) continue;
    const atraso = diferencaEmDias(s.prazo, hoje);
    if (atraso <= 0) continue;
    const t = r.tickets.find((x) => x.id === s.ticketId);
    saida.push({
      ticketId: s.ticketId,
      referencia: t?.referencia.bruto ?? s.tituloPessoal ?? '—',
      proximaAcao: s.proximaAcao,
      prazo: s.prazo,
      diasVencido: atraso,
    });
  }
  return saida.sort((a, b) => b.diasVencido - a.diasVencido);
}

export interface SaudeDaImportacao {
  porFonte: {
    tipo: string;
    arquivo: string;
    lidoEm: string;
    sha256: string;
    aceitos: number;
    conflitos: number;
  }[];
  pendenciasAbertas: number;
  pendenciasPorTipo: Record<string, number>;
  /** Minutos que estão fora dos totais confirmados por causa de pendência. */
  minutosEmPendencia: number;
}

export function saudeDaImportacao(r: Revision): SaudeDaImportacao {
  const porFonte = r.sourceDocuments.map((d) => {
    const lote = r.importBatches.find((b) => b.sourceDocumentId === d.id);
    return {
      tipo: d.tipo,
      arquivo: d.nomeArquivo,
      lidoEm: d.lidoEm,
      sha256: d.sha256,
      aceitos: (lote?.contagens.novo ?? 0) + (lote?.contagens.alterado ?? 0),
      conflitos: lote?.contagens.conflito ?? 0,
    };
  });

  const abertas = r.issues.filter((i) => i.estado === 'aberta' || i.estado === 'adiada');
  const porTipo: Record<string, number> = {};
  for (const i of abertas) porTipo[i.tipo] = (porTipo[i.tipo] ?? 0) + 1;

  return {
    porFonte,
    pendenciasAbertas: abertas.length,
    pendenciasPorTipo: porTipo,
    minutosEmPendencia: abertas.reduce((s, i) => s + (i.impactoMinutos ?? 0), 0),
  };
}

/* ------------------------------------------------------------------ */

export interface PainelReconciliado {
  totalConfirmado: number;
  atribuidoATickets: number;
  compartilhadoSemRateio: number;
  atividadeInterna: number;
  referenciaSemVinculoConfirmado: number;
  fechaPorClasse: boolean;
  porCelula: Record<Celula, number>;
  fechaPorCelula: boolean;
  /** Minutos excluídos dos totais por pendência, informados à parte (secção 11). */
  minutosExcluidosPorPendencia: number;
  /** Saldos iniciais aparecem separados e não entram na jornada. */
  saldosIniciaisMinutos: number;
}

/**
 * Painel que fecha nos dois eixos. Se qualquer um não fechar, a interface
 * mostra o desvio em vez de esconder a diferença.
 */
export function painelReconciliado(r: Revision, p: Periodo): PainelReconciliado {
  const entradas = r.timeEntries.filter((e) => noPeriodo(e.workDate, p));
  const idsEntradas = new Set(entradas.map((e) => e.id));
  const classes = reconciliarTotais(
    entradas,
    r.timeEntryReferences.filter((x) => idsEntradas.has(x.timeEntryId)),
    r.allocations.filter((x) => idsEntradas.has(x.timeEntryId)),
  );
  const celulas = totaisPorCelula(entradas);

  return {
    totalConfirmado: classes.totalConfirmado,
    atribuidoATickets: classes.atribuidoATickets,
    compartilhadoSemRateio: classes.compartilhadoSemRateio,
    atividadeInterna: classes.atividadeInterna,
    referenciaSemVinculoConfirmado: classes.referenciaSemVinculoConfirmado,
    fechaPorClasse: classes.fecha,
    porCelula: celulas.porCelula,
    fechaPorCelula: celulas.fecha && celulas.totalConfirmado === classes.totalConfirmado,
    minutosExcluidosPorPendencia: r.issues
      .filter((i) => i.estado === 'aberta' || i.estado === 'adiada')
      .reduce((s, i) => s + (i.impactoMinutos ?? 0), 0),
    saldosIniciaisMinutos: r.openingBalances.reduce((s, b) => s + b.minutos, 0),
  };
}

/**
 * Distingue "zero confirmado" de "fonte ainda não importada" (secção 13).
 */
export function naturezaDoZero(r: Revision, p: Periodo): 'com_registros' | 'zero_confirmado' | 'fonte_nao_importada' {
  if (r.sourceDocuments.length === 0 && r.timeEntries.length === 0) return 'fonte_nao_importada';
  const houve = r.timeEntries.some((e) => noPeriodo(e.workDate, p) && contaParaJornada(e));
  return houve ? 'com_registros' : 'zero_confirmado';
}

/** Pendências agrupadas para a caixa de conciliação. */
export function pendenciasAbertas(r: Revision): ReconciliationIssue[] {
  return r.issues.filter((i) => i.estado === 'aberta' || i.estado === 'adiada');
}

export function metaDaDataDe(r: Revision, data: WorkDate): number {
  return metaDaData(data, r.workspace.schedule, r.workspace.excecoesCalendario);
}

export function ticketPorId(r: Revision, id: Uuid): Ticket | undefined {
  return r.tickets.find((t) => t.id === id);
}
