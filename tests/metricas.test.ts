import { describe, expect, it } from 'vitest';
import {
  chamadosPorStatus,
  distribuicaoPorCelula,
  esforcoPorChamado,
  naturezaDoZero,
  painelReconciliado,
  proximasAcoesVencidas,
  resolucoesPessoais,
  saudeDaImportacao,
  serieDiaria,
  tempoAteResolucao,
  DEFINICOES,
} from '../src/domain/metrics/indicadores';
import { novoWorkspace, revisaoInicial } from '../src/domain/entities/revisao';
import type { Revision } from '../src/domain/entities/tipos';
import { alocacao, apontamento, idSintetico, referencia } from './apoio/construtores';

function base(): Revision {
  const r = revisaoInicial(novoWorkspace('Métricas'));
  r.workspace.schedule.inicioControle = '2026-09-01';
  return r;
}

const PERIODO = { inicio: '2026-09-01', fim: '2026-09-30' };

describe('AC-049 — o painel fecha nos dois eixos', () => {
  it('classes e células fecham com o mesmo total confirmado', () => {
    const r = base();
    const ticketA = idSintetico('t');
    const ticketB = idSintetico('t');
    r.tickets.push(
      { ...ticketFalso(ticketA, 'RR90000001'), workspaceId: r.workspace.id },
      { ...ticketFalso(ticketB, 'IR90000002'), workspaceId: r.workspace.id },
    );

    const interna = apontamento({ workspaceId: r.workspace.id, workDate: '2026-09-01', duracaoMinutos: 60, celula: 'GENERAL' });
    const doTicket = apontamento({ workspaceId: r.workspace.id, workDate: '2026-09-02', duracaoMinutos: 120, celula: 'AMS' });
    const compartilhada = apontamento({ workspaceId: r.workspace.id, workDate: '2026-09-03', duracaoMinutos: 90, celula: 'SQUAD' });
    const provisoria = apontamento({ workspaceId: r.workspace.id, workDate: '2026-09-04', duracaoMinutos: 30, celula: 'UNCLASSIFIED' });

    r.timeEntries.push(interna, doTicket, compartilhada, provisoria);
    r.timeEntryReferences.push(
      referencia(doTicket.id, 'RR90000001', ticketA),
      referencia(compartilhada.id, 'RR90000001', ticketA),
      referencia(compartilhada.id, 'IR90000002', ticketB),
      referencia(provisoria.id, 'RR90000003', null),
    );

    const p = painelReconciliado(r, PERIODO);
    expect(p.totalConfirmado).toBe(300);
    expect(p.atribuidoATickets + p.compartilhadoSemRateio + p.atividadeInterna + p.referenciaSemVinculoConfirmado).toBe(300);
    expect(p.fechaPorClasse).toBe(true);
    expect(p.fechaPorCelula).toBe(true);
    expect(Object.values(p.porCelula).reduce((a, b) => a + b, 0)).toBe(300);
  });

  it('saldos iniciais aparecem separados e não entram no total', () => {
    const r = base();
    r.timeEntries.push(apontamento({ workspaceId: r.workspace.id, workDate: '2026-09-01', duracaoMinutos: 120 }));
    r.openingBalances.push({
      id: idSintetico('b'),
      ticketId: null,
      referenciaBruta: 'RR90000001',
      minutos: 600,
      dataCorte: '2026-08-31',
      escopo: 'Saldo anterior identificado',
      proveniencia: [],
    });
    const p = painelReconciliado(r, PERIODO);
    expect(p.totalConfirmado).toBe(120);
    expect(p.saldosIniciaisMinutos).toBe(600);
  });

  it('minutos em pendência são informados à parte, não somados', () => {
    const r = base();
    r.timeEntries.push(apontamento({ workspaceId: r.workspace.id, workDate: '2026-09-01', duracaoMinutos: 120 }));
    r.issues.push({
      id: idSintetico('i'),
      workspaceId: r.workspace.id,
      tipo: 'possivel_duplicata',
      titulo: 'Possível repetição',
      descricao: 'Duas linhas equivalentes',
      impactoMinutos: 120,
      evidencia: [],
      opcoes: [],
      decisao: null,
      estado: 'aberta',
      criadoEm: '2026-09-07T10:00:00-03:00',
    });
    const p = painelReconciliado(r, PERIODO);
    expect(p.totalConfirmado).toBe(120);
    expect(p.minutosExcluidosPorPendencia).toBe(120);
  });
});

describe('AC-024 — o dashboard separa compartilhado sem rateio', () => {
  it('nenhum chamado recebe o total integral de uma atividade compartilhada', () => {
    const r = base();
    const a = idSintetico('t');
    const b = idSintetico('t');
    r.tickets.push({ ...ticketFalso(a, 'RR1'), workspaceId: r.workspace.id }, { ...ticketFalso(b, 'IR2'), workspaceId: r.workspace.id });

    const e = apontamento({ workspaceId: r.workspace.id, workDate: '2026-09-02', duracaoMinutos: 120 });
    r.timeEntries.push(e);
    r.timeEntryReferences.push(referencia(e.id, 'RR1', a), referencia(e.id, 'IR2', b));

    const lista = esforcoPorChamado(r, PERIODO);
    expect(lista.every((x) => x.atribuidoMinutos === 0)).toBe(true);
    expect(lista.every((x) => x.compartilhadoSemRateioMinutos === 120)).toBe(true);
  });

  it('com rateio confirmado o esforço aparece dividido', () => {
    const r = base();
    const a = idSintetico('t');
    const b = idSintetico('t');
    r.tickets.push({ ...ticketFalso(a, 'RR1'), workspaceId: r.workspace.id }, { ...ticketFalso(b, 'IR2'), workspaceId: r.workspace.id });

    const e = apontamento({ workspaceId: r.workspace.id, workDate: '2026-09-02', duracaoMinutos: 120 });
    r.timeEntries.push(e);
    r.timeEntryReferences.push(referencia(e.id, 'RR1', a), referencia(e.id, 'IR2', b));
    r.allocations.push(alocacao(e.id, a, 75), alocacao(e.id, b, 45));

    const lista = esforcoPorChamado(r, PERIODO);
    expect(lista.map((x) => x.atribuidoMinutos).sort((x, y) => y - x)).toEqual([75, 45]);
  });
});

describe('secção 13 — gráficos com denominador e definição', () => {
  it('a distribuição por célula traz proporção com denominador explícito', () => {
    const r = base();
    r.timeEntries.push(
      apontamento({ workspaceId: r.workspace.id, workDate: '2026-09-01', duracaoMinutos: 120, celula: 'AMS' }),
      apontamento({ workspaceId: r.workspace.id, workDate: '2026-09-01', duracaoMinutos: 120, celula: 'SQUAD' }),
    );
    const d = distribuicaoPorCelula(r, PERIODO);
    expect(d.total).toBe(240);
    expect(d.itens.find((x) => x.celula === 'AMS')!.proporcao).toBe(0.5);
    expect(d.fecha).toBe(true);
  });

  it('período sem registros não divide por zero', () => {
    const d = distribuicaoPorCelula(base(), PERIODO);
    expect(d.total).toBe(0);
    expect(d.itens.every((x) => x.proporcao === 0)).toBe(true);
  });

  it('a série diária inclui a meta de cada data', () => {
    const r = base();
    r.timeEntries.push(apontamento({ workspaceId: r.workspace.id, workDate: '2026-09-01', duracaoMinutos: 450 }));
    const serie = serieDiaria(r, { inicio: '2026-09-01', fim: '2026-09-06' });
    expect(serie).toHaveLength(6);
    expect(serie[0]).toEqual({ data: '2026-09-01', realizadoMinutos: 450, metaMinutos: 480 });
    // Sábado e domingo com meta zero pelo padrão configurável.
    expect(serie[4]).toEqual({ data: '2026-09-05', realizadoMinutos: 0, metaMinutos: 0 });
  });

  it('todo indicador tem uma definição publicada', () => {
    for (const chave of ['horasDaData', 'horasPorChamado', 'proximasAcoesVencidas', 'tempoAteResolucao']) {
      expect(DEFINICOES[chave]).toBeTruthy();
    }
    expect(DEFINICOES.proximasAcoesVencidas).toMatch(/não é SLA/i);
  });
});

describe('AC-045 — datas incoerentes saem do indicador e são informadas', () => {
  it('intervalo negativo e data futura são excluídos com contagem visível', () => {
    const r = base();
    r.personalStates.push(
      estadoFalso(r, { criadoEmPessoal: '2026-06-01', resolvidoEmPessoal: '2026-06-11' }),
      estadoFalso(r, { criadoEmPessoal: '2026-06-10', resolvidoEmPessoal: '2026-06-01' }),
      estadoFalso(r, { criadoEmPessoal: null, resolvidoEmPessoal: '2026-06-05' }),
      estadoFalso(r, { criadoEmPessoal: '2026-06-01', resolvidoEmPessoal: '2099-01-01' }),
    );

    const t = tempoAteResolucao(r);
    expect(t.casosConsiderados).toBe(1);
    expect(t.casosExcluidos).toBe(3);
    expect(t.motivosDeExclusao.intervalo_negativo).toBe(1);
    expect(t.motivosDeExclusao.sem_data_de_criacao).toBe(1);
    expect(t.motivosDeExclusao.data_futura).toBe(1);
    expect(t.medianaDias).toBe(10);
    // Nenhum atraso calculado desde 1900.
    expect(t.medianaDias).toBeLessThan(1000);
  });
});

describe('AC-051 / secção 13 — status e ações', () => {
  it('status oficial e pessoal são contados separadamente e provisórios à parte', () => {
    const r = base();
    r.tickets.push(
      { ...ticketFalso(idSintetico('t'), 'RR1', 'Working'), workspaceId: r.workspace.id },
      { ...ticketFalso(idSintetico('t'), 'RR2', 'Updated'), workspaceId: r.workspace.id },
      { ...ticketFalso(idSintetico('t'), 'RR3', 'Pending Vendor'), workspaceId: r.workspace.id },
      { ...ticketProvisorio(idSintetico('t'), 'RR4'), workspaceId: r.workspace.id },
    );
    r.personalStates.push(estadoFalso(r, { andamentoPessoal: 'Em andamento ABAP' }));

    const c = chamadosPorStatus(r);
    expect(c.provisorios).toBe(1);
    expect(c.oficial.find((x) => x.bruto === 'Working')!.rotulo).toBe('Em atendimento');
    expect(c.oficial.find((x) => x.bruto === 'Updated')!.rotulo).toBe('Atualizado / revisar');
    expect(c.oficial.find((x) => x.bruto === 'Pending Vendor')!.naoMapeado).toBe(true);
    expect(c.pessoal[0]!.rotulo).toBe('Em andamento ABAP');
  });

  it('próximas ações vencidas usam prazo pessoal, não SLA, e ignoram resolvidos', () => {
    const r = base();
    r.personalStates.push(
      estadoFalso(r, { proximaAcao: 'Cobrar retorno', prazo: '2026-09-01' }),
      estadoFalso(r, { proximaAcao: 'Já resolvido', prazo: '2026-09-01', resolvidoEmPessoal: '2026-09-02' }),
      estadoFalso(r, { proximaAcao: 'Ainda no prazo', prazo: '2026-12-31' }),
    );
    const v = proximasAcoesVencidas(r, '2026-09-07');
    expect(v).toHaveLength(1);
    expect(v[0]!.proximaAcao).toBe('Cobrar retorno');
    expect(v[0]!.diasVencido).toBe(6);
  });

  it('resoluções contam chamados distintos e eventos separadamente', () => {
    const r = base();
    const t = idSintetico('t');
    r.resolutionEvents.push(
      resolucaoFalsa(r, t, '2026-09-02'),
      resolucaoFalsa(r, t, '2026-09-20'), // reabertura seguida de nova resolução
      resolucaoFalsa(r, idSintetico('t'), '2026-09-10'),
      resolucaoFalsa(r, idSintetico('t'), null),
    );
    const res = resolucoesPessoais(r, PERIODO);
    expect(res.eventosDeResolucao).toBe(3);
    expect(res.ticketsDistintos).toBe(2);
    expect(res.semDataConhecida).toBe(1);
  });
});

describe('AC-072 — zero confirmado é diferente de fonte não importada', () => {
  it('base sem nenhuma fonte informa que nada foi importado', () => {
    expect(naturezaDoZero(base(), PERIODO)).toBe('fonte_nao_importada');
  });

  it('base com fonte importada e sem esforço no período informa zero confirmado', () => {
    const r = base();
    r.sourceDocuments.push({
      id: idSintetico('d'),
      tipo: 'csv_incidentes',
      nomeArquivo: 'export.csv',
      origem: 'upload_local',
      sha256: 'h',
      tamanhoBytes: 1,
      perfil: 'incidentes',
      lidoEm: '2026-09-07T10:00:00-03:00',
    });
    expect(naturezaDoZero(r, PERIODO)).toBe('zero_confirmado');
  });
});

describe('saúde da importação', () => {
  it('reporta a última carga por fonte e as pendências restantes', () => {
    const r = base();
    const docId = idSintetico('d');
    r.sourceDocuments.push({
      id: docId,
      tipo: 'xlsm',
      nomeArquivo: 'central.xlsm',
      origem: 'onedrive',
      sha256: 'abc',
      tamanhoBytes: 100,
      perfil: 'central-chamados-aprimorado-xlsm-v1',
      lidoEm: '2026-09-07T10:00:00-03:00',
    });
    r.importBatches.push({
      id: idSintetico('l'),
      sourceDocumentId: docId,
      criadoEm: '2026-09-07T10:00:00-03:00',
      confirmadoEm: '2026-09-07T10:05:00-03:00',
      contagens: { novo: 10, alterado: 2, conflito: 1 },
      revisaoAplicada: r.revisionId,
    });
    r.issues.push({
      id: idSintetico('i'),
      workspaceId: r.workspace.id,
      tipo: 'rateio_indefinido',
      titulo: 'Rateio pendente',
      descricao: '',
      impactoMinutos: 120,
      evidencia: [],
      opcoes: [],
      decisao: null,
      estado: 'aberta',
      criadoEm: '2026-09-07T10:00:00-03:00',
    });

    const s = saudeDaImportacao(r);
    expect(s.porFonte[0]).toMatchObject({ arquivo: 'central.xlsm', aceitos: 12, conflitos: 1, sha256: 'abc' });
    expect(s.pendenciasAbertas).toBe(1);
    expect(s.pendenciasPorTipo.rateio_indefinido).toBe(1);
    expect(s.minutosEmPendencia).toBe(120);
  });
});

/* ---------------- auxiliares ---------------- */

function ticketFalso(id: string, ref: string, status = 'Working') {
  return {
    id,
    workspaceId: 'ws',
    sourceSystem: 'CS3' as const,
    ticketType: 'incident' as const,
    sourceTicketId: ref,
    provisorio: false,
    referencia: { bruto: ref, namespace: 'RR' as const, normalizado: ref.toUpperCase() },
    oficial: {
      title: `Título de ${ref}`,
      statusBruto: status,
      assignedTo: null,
      startTimeBruto: null,
      lastUpdateTimeBruto: '04/09/2026 10:00:00',
      priority: null,
      impact: null,
      complexity: null,
      assignmentGroup: null,
      external: null,
      referenceId: null,
      reportedBy: null,
      reportedCi: null,
      deviceCi: null,
      affectedCi: null,
      tags: [null, null, null, null, null, null],
      typeBruto: null,
      escalationStatus: null,
      lastUsedKnowledgeSource: null,
      extras: {},
    },
    versaoFonte: '04/09/2026 10:00:00',
    versaoFonteInstante: '2026-09-07T10:00:00-03:00',
    proveniencia: [],
    criadoEm: '2026-09-07T10:00:00-03:00',
    atualizadoEm: '2026-09-07T10:00:00-03:00',
    versao: 1,
  };
}

function ticketProvisorio(id: string, ref: string) {
  return { ...ticketFalso(id, ref), sourceSystem: null, ticketType: null, sourceTicketId: null, provisorio: true, oficial: null };
}

function estadoFalso(r: Revision, over: Record<string, unknown> = {}) {
  return {
    id: idSintetico('p'),
    workspaceId: r.workspace.id,
    ticketId: null,
    groupId: null,
    tituloPessoal: 'Título pessoal',
    andamentoPessoal: null,
    andamentoPessoalBruto: null,
    prioridadePessoal: null,
    categoriaFuncional: null,
    celulaManual: null,
    celulaSugerida: null,
    proximaAcao: null,
    prazo: null,
    estimativaMinutos: null,
    estimativaConfirmada: false,
    rndBruto: null,
    responsavelPessoal: null,
    criadoEmPessoal: null,
    atualizadoEmPessoal: null,
    resolvidoEmPessoal: null,
    proveniencia: [],
    criadoEm: '2026-09-07T10:00:00-03:00',
    atualizadoEm: '2026-09-07T10:00:00-03:00',
    versao: 1,
    ...over,
  } as Revision['personalStates'][number];
}

function resolucaoFalsa(r: Revision, ticketId: string, data: string | null) {
  return {
    id: idSintetico('res'),
    workspaceId: r.workspace.id,
    ticketId,
    referenciaBruta: null,
    dataResolucao: data,
    statusFinal: 'Resolvido',
    snapshot: { tempoEmAberto: null, horasApontadas: null, qtdeApontamentos: null, fusRealizados: null },
    observacoes: null,
    proveniencia: [],
  };
}
