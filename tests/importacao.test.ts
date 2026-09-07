import { describe, expect, it } from 'vitest';
import { novoWorkspace, revisaoInicial, validarInvariantes } from '../src/domain/entities/revisao';
import { aplicarPrevia, previaCsv, previaXlsm, validarPrevia, type DecisoesDaCarga, type Previa } from '../src/domain/reconciliation/importacao';
import { lerCsvCs3 } from '../src/domain/sources/csv';
import type { Revision, SourceDocument } from '../src/domain/entities/tipos';
import type { LeituraXlsm } from '../src/domain/sources/xlsm';
import { reconciliarTotais } from '../src/domain/time/alocacao';

const CAB_INC = 'Incident ID;Title;Status;Last Update Time;Assignment Group;Tag 3';
const CAB_REQ = 'Request ID;Title;Status;Last Update Time;Complexity';

function csvIncidentes(linhas: string[]): string {
  return `${CAB_INC}\n${linhas.join('\n')}\n`;
}

function doc(over: Partial<SourceDocument> = {}): SourceDocument {
  return {
    id: crypto.randomUUID(),
    tipo: 'csv_incidentes',
    nomeArquivo: 'export.csv',
    origem: 'upload_local',
    sha256: 'hash-sintetico-1',
    tamanhoBytes: 1000,
    perfil: 'incidentes',
    lidoEm: '2026-09-07T10:00:00-03:00',
    ...over,
  };
}

function baseVazia(): Revision {
  return revisaoInicial(novoWorkspace('Base de teste'));
}

/** Aceita todos os itens marcados por padrão. */
function aceitarPadrao(previa: Previa): DecisoesDaCarga {
  return {
    itensAceitos: new Set(previa.itens.filter((i) => i.incluidoPorPadrao).map((i) => i.id)),
    itensExcluidos: new Set(),
    decisoesDeIssues: new Map(),
  };
}

describe('AC-001 / AC-002 — carga inicial e reimportação de CSV', () => {
  const csv = csvIncidentes([
    'IR32000001;Falha no relatório;Working;04/09/2026 14:00:00;AMS SAP FI;BASELINE',
    'IR32000002;Erro de lançamento;Wait on User;04/09/2026 15:00:00;AMS SAP CO;MELHORIA SQUAD',
    'IR32000003;Ajuste de layout;Updated;04/09/2026 16:00:00;AMS SAP FI;TASK FORCE',
  ]);

  it('AC-001: cria 3 chamados e nenhuma hora', () => {
    const base = baseVazia();
    const previa = previaCsv(base, doc(), lerCsvCs3(csv));
    expect(previa.contagens.novo).toBe(3);
    expect(previa.minutosCandidatos).toBe(0);

    const { revisao } = aplicarPrevia(base, previa, aceitarPadrao(previa), 'op-1');
    expect(revisao.tickets).toHaveLength(3);
    expect(revisao.timeEntries).toHaveLength(0);
    expect(validarInvariantes(revisao)).toEqual([]);
  });

  it('AC-002: reimportar o mesmo arquivo não duplica nem cria notas ou eventos', () => {
    const base = baseVazia();
    const p1 = previaCsv(base, doc(), lerCsvCs3(csv));
    const r1 = aplicarPrevia(base, p1, aceitarPadrao(p1), 'op-1').revisao;

    const p2 = previaCsv(r1, doc(), lerCsvCs3(csv));
    expect(p2.contagens.igual).toBe(3);
    expect(p2.contagens.novo).toBe(0);

    const r2 = aplicarPrevia(r1, p2, aceitarPadrao(p2), 'op-2').revisao;
    expect(r2.tickets).toHaveLength(3);
    expect(r2.notes).toHaveLength(0);
    expect(r2.statusEvents).toHaveLength(0);
  });
});

describe('AC-003 a AC-006 — atualização oficial', () => {
  const inicial = csvIncidentes(['IR32000001;Título original;Working;04/09/2026 14:00:00;AMS;BASELINE']);

  function comBase() {
    const base = baseVazia();
    const p = previaCsv(base, doc(), lerCsvCs3(inicial));
    return aplicarPrevia(base, p, aceitarPadrao(p), 'op-1').revisao;
  }

  it('AC-003: só campos oficiais mudam; registros pessoais permanecem', () => {
    const r1 = comBase();
    // Simula uma anotação pessoal já existente sobre o chamado.
    r1.personalStates.push({
      id: 'ps-1',
      workspaceId: r1.workspace.id,
      ticketId: r1.tickets[0]!.id,
      groupId: null,
      tituloPessoal: 'Meu título',
      andamentoPessoal: 'Em andamento ABAP',
      andamentoPessoalBruto: 'Em andamento ABAP',
      prioridadePessoal: null,
      categoriaFuncional: null,
      celulaManual: 'TASK_FORCE',
      celulaSugerida: null,
      proximaAcao: 'Cobrar retorno',
      prazo: null,
      estimativaMinutos: null,
      estimativaConfirmada: false,
      rndBruto: null,
      responsavelPessoal: null,
      criadoEmPessoal: null,
      atualizadoEmPessoal: null,
      resolvidoEmPessoal: null,
      proveniencia: [],
      criadoEm: '2026-09-01T10:00:00-03:00',
      atualizadoEm: '2026-09-01T10:00:00-03:00',
      versao: 1,
    });

    const novo = csvIncidentes(['IR32000001;Título oficial novo;Wait on User;05/09/2026 09:00:00;AMS;BASELINE']);
    const p = previaCsv(r1, doc({ sha256: 'hash-2' }), lerCsvCs3(novo));
    expect(p.contagens.alterado).toBe(1);

    const r2 = aplicarPrevia(r1, p, aceitarPadrao(p), 'op-2').revisao;
    expect(r2.tickets[0]!.oficial!.title).toBe('Título oficial novo');
    expect(r2.tickets[0]!.oficial!.statusBruto).toBe('Wait on User');
    // Tudo que é pessoal continua exatamente como estava.
    expect(r2.personalStates[0]).toMatchObject({
      tituloPessoal: 'Meu título',
      andamentoPessoal: 'Em andamento ABAP',
      celulaManual: 'TASK_FORCE',
      proximaAcao: 'Cobrar retorno',
    });
  });

  it('AC-004: versão mais antiga não regride e a decisão fica registrada', () => {
    const r1 = comBase();
    const antigo = csvIncidentes(['IR32000001;Título antigo;Working;01/09/2026 08:00:00;AMS;BASELINE']);
    const p = previaCsv(r1, doc({ sha256: 'hash-3' }), lerCsvCs3(antigo));

    expect(p.contagens.versao_antiga).toBe(1);
    const item = p.itens.find((i) => i.classe === 'versao_antiga')!;
    expect(item.incluidoPorPadrao).toBe(false);
    expect(item.descricao).toMatch(/anterior/i);

    const r2 = aplicarPrevia(r1, p, aceitarPadrao(p), 'op-2').revisao;
    expect(r2.tickets[0]!.oficial!.title).toBe('Título original');
  });

  it('AC-005: mesma versão com conteúdo diferente é conflito, não decisão pela ordem', () => {
    const r1 = comBase();
    const empate = csvIncidentes(['IR32000001;Título divergente;Working;04/09/2026 14:00:00;AMS;BASELINE']);
    const p = previaCsv(r1, doc({ sha256: 'hash-4' }), lerCsvCs3(empate));

    expect(p.contagens.conflito).toBe(1);
    const item = p.itens.find((i) => i.classe === 'conflito')!;
    expect(item.incluidoPorPadrao).toBe(false);
    expect(p.issues.some((i) => i.tipo === 'divergencia_manual')).toBe(true);

    // Sem decisão explícita, nada muda.
    const r2 = aplicarPrevia(r1, p, aceitarPadrao(p), 'op-2').revisao;
    expect(r2.tickets[0]!.oficial!.title).toBe('Título original');
  });

  it('AC-006: ausência na carga preserva o chamado, sem encerrá-lo', () => {
    const r1 = comBase();
    const outro = csvIncidentes(['IR32000099;Outro chamado;Working;05/09/2026 09:00:00;AMS;BASELINE']);
    const p = previaCsv(r1, doc({ sha256: 'hash-5' }), lerCsvCs3(outro));

    const ausente = p.itens.find((i) => i.classe === 'ausente_na_carga');
    expect(ausente).toBeDefined();
    expect(ausente!.rotulo).toBe('IR32000001');
    expect(ausente!.descricao).toMatch(/preservad/i);

    const r2 = aplicarPrevia(r1, p, aceitarPadrao(p), 'op-2').revisao;
    expect(r2.tickets).toHaveLength(2);
    expect(r2.tickets.find((t) => t.sourceTicketId === 'IR32000001')!.oficial!.statusBruto).toBe('Working');
  });
});

describe('AC-010 — incidentes e requisições são namespaces separados', () => {
  it('o mesmo número em perfis diferentes são identidades diferentes', () => {
    const base = baseVazia();
    const pInc = previaCsv(base, doc(), lerCsvCs3(csvIncidentes(['IR32000001;T;Working;04/09/2026 14:00:00;;'])));
    const r1 = aplicarPrevia(base, pInc, aceitarPadrao(pInc), 'op-1').revisao;

    const req = `${CAB_REQ}\nIR32000001;T req;Working;04/09/2026 14:00:00;Média\n`;
    const pReq = previaCsv(r1, doc({ tipo: 'csv_requisicoes', perfil: 'requisicoes', sha256: 'h2' }), lerCsvCs3(req));
    expect(pReq.contagens.novo).toBe(1);

    const r2 = aplicarPrevia(r1, pReq, aceitarPadrao(pReq), 'op-2').revisao;
    expect(r2.tickets).toHaveLength(2);
    expect(r2.tickets.map((t) => t.ticketType).sort()).toEqual(['incident', 'request']);
    expect(validarInvariantes(r2)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* XLSM                                                                */
/* ------------------------------------------------------------------ */

function leituraXlsmVazia(): LeituraXlsm {
  return {
    chamados: [],
    apontamentos: [],
    followUps: [],
    tarefas: [],
    resolvidos: [],
    historicoStatus: [],
    desenvolvimento: [],
    planilha1: [],
    filaFollowUp: 0,
    sistemaData: 1900,
    diagnostico: {
      errosChamados: 0,
      errosApontamentos: 0,
      formulasExternas: 0,
      abasEncontradas: [],
      abasAusentes: [],
      contemVba: true,
      vinculosExternos: ['externalLink1.xml'],
      colunasDesconhecidas: {},
    },
  };
}

function apont(over: Partial<LeituraXlsm['apontamentos'][number]> & { linha: number }) {
  return {
    workDate: '2026-06-10',
    dataBruta: '46183',
    problemaData: null,
    referenciaBruta: 'RR90000015',
    descricao: 'Análise do erro',
    descricaoCalculada: false,
    tipoAtuacao: 'Análise',
    duracaoMinutos: 120,
    duracaoBruta: 0.0833333,
    problemaDuracao: null,
    resultadoStatus: { ref: '', texto: null, numero: null, natureza: 'empty' as const, formula: null, formulaExterna: false, erro: null, calculado: false },
    observacoes: null,
    lancamentoExterno: null,
    errosDeFormula: [],
    temVinculoExterno: false,
    ...over,
  };
}

const docXlsm = () =>
  doc({ tipo: 'xlsm', nomeArquivo: 'central.xlsm', perfil: 'central-chamados-aprimorado-xlsm-v1', sha256: 'hash-xlsm-1' });

describe('AC-024 / AC-026 — apontamentos do XLSM', () => {
  it('AC-026: horas sem cadastro criam referência e o CSV posterior completa sem duplicar', () => {
    const base = baseVazia();
    const leitura = { ...leituraXlsmVazia(), apontamentos: [apont({ linha: 10, referenciaBruta: 'IR32000001' })] };
    const p = previaXlsm(base, docXlsm(), leitura);
    const r1 = aplicarPrevia(base, p, aceitarPadrao(p), 'op-1').revisao;

    expect(r1.timeEntries).toHaveLength(1);
    expect(r1.timeEntries[0]!.duracaoMinutos).toBe(120);
    // O vínculo existe, mas ainda não aponta para um ticket oficial.
    expect(r1.timeEntryReferences[0]!.ticketId).toBeNull();

    const csv = csvIncidentes(['IR32000001;Chamado oficial;Working;04/09/2026 14:00:00;AMS;BASELINE']);
    const p2 = previaCsv(r1, doc({ sha256: 'h-csv' }), lerCsvCs3(csv));
    const r2 = aplicarPrevia(r1, p2, aceitarPadrao(p2), 'op-2').revisao;

    expect(r2.tickets).toHaveLength(1);
    expect(r2.timeEntries).toHaveLength(1); // sem duplicar o esforço
    expect(validarInvariantes(r2)).toEqual([]);
  });

  it('AC-024: atividade com dois chamados gera pendência de rateio e não credita nenhum', () => {
    const base = baseVazia();
    const leitura = { ...leituraXlsmVazia(), apontamentos: [apont({ linha: 215, referenciaBruta: 'IR90000013 ; RR90000014', duracaoMinutos: 120 })] };
    const p = previaXlsm(base, docXlsm(), leitura);

    const pendencia = p.issues.find((i) => i.tipo === 'rateio_indefinido');
    expect(pendencia).toBeDefined();
    expect(pendencia!.descricao).toMatch(/sem rateio/i);

    const r = aplicarPrevia(base, p, aceitarPadrao(p), 'op-1').revisao;
    expect(r.timeEntryReferences).toHaveLength(2);
    expect(r.allocations).toHaveLength(0);

    const totais = reconciliarTotais(r.timeEntries, r.timeEntryReferences, r.allocations);
    expect(totais.totalConfirmado).toBe(120);
    expect(totais.compartilhadoSemRateio).toBe(120);
    expect(totais.atribuidoATickets).toBe(0);
  });

  it('AC-019: linha sem duração fica incompleta, fora do total, sem virar 0 nem 8h', () => {
    const base = baseVazia();
    const leitura = {
      ...leituraXlsmVazia(),
      apontamentos: [apont({ linha: 10, duracaoMinutos: null, duracaoBruta: null }), apont({ linha: 11, duracaoMinutos: 90 })],
    };
    const p = previaXlsm(base, docXlsm(), leitura);
    expect(p.issues.some((i) => i.tipo === 'duracao_ausente')).toBe(true);

    const r = aplicarPrevia(base, p, aceitarPadrao(p), 'op-1').revisao;
    // A linha incompleta não é confirmada, mas continua existindo.
    const confirmadas = r.timeEntries.filter((e) => e.estadoOperacional === 'confirmed');
    expect(confirmadas).toHaveLength(1);
    expect(reconciliarTotais(r.timeEntries, r.timeEntryReferences, r.allocations).totalConfirmado).toBe(90);
  });

  it('AC-029: LANÇADO vira anotação pessoal, nunca confirmação de integração', () => {
    const base = baseVazia();
    const leitura = { ...leituraXlsmVazia(), apontamentos: [apont({ linha: 10, observacoes: 'LANÇADO no CS3', lancamentoExterno: 'reported_posted' })] };
    const p = previaXlsm(base, docXlsm(), leitura);
    const r = aplicarPrevia(base, p, aceitarPadrao(p), 'op-1').revisao;

    expect(r.timeEntries[0]!.lancamentoExterno).toBe('reported_posted');
    expect(JSON.stringify(r.timeEntries[0])).not.toContain('verified_by_cs3');
  });

  it('AC-035: linhas repetidas ficam fora dos totais até a escolha', () => {
    const base = baseVazia();
    const repetida = { workDate: '2026-07-15', descricao: 'Mesma atividade', duracaoMinutos: 60 };
    const leitura = { ...leituraXlsmVazia(), apontamentos: [apont({ linha: 263, ...repetida }), apont({ linha: 267, ...repetida })] };
    const p = previaXlsm(base, docXlsm(), leitura);

    expect(p.issues.filter((i) => i.tipo === 'possivel_duplicata')).toHaveLength(1);
    expect(p.contagens.possivel_duplicata).toBe(2);
    // Nenhuma das duas entra marcada.
    expect(p.itens.filter((i) => i.classe === 'possivel_duplicata').every((i) => !i.incluidoPorPadrao)).toBe(true);
    expect(p.minutosExcluidosPorPendencia).toBe(120);
  });

  it('AC-041: coluna F calculada não cria evento de status histórico', () => {
    const base = baseVazia();
    const leitura = {
      ...leituraXlsmVazia(),
      apontamentos: [
        apont({
          linha: 12,
          resultadoStatus: {
            ref: 'F12',
            texto: 'Em andamento',
            numero: null,
            natureza: 'formula_cached' as const,
            formula: 'VLOOKUP(B12,Chamados!A:C,3,FALSE)',
            formulaExterna: false,
            erro: null,
            calculado: true,
          },
        }),
      ],
    };
    const p = previaXlsm(base, docXlsm(), leitura);
    expect(p.issues.some((i) => i.tipo === 'origem_calculada' && i.titulo.includes('Status calculado'))).toBe(true);

    const r = aplicarPrevia(base, p, aceitarPadrao(p), 'op-1').revisao;
    expect(r.statusEvents).toHaveLength(0);
  });

  it('AC-042: vínculo externo é registrado e nunca resolvido', () => {
    const base = baseVazia();
    const leitura = { ...leituraXlsmVazia(), apontamentos: [apont({ linha: 267, temVinculoExterno: true })] };
    const p = previaXlsm(base, docXlsm(), leitura);
    const issue = p.issues.find((i) => i.titulo.includes('arquivo externo'));
    expect(issue).toBeDefined();
    expect(issue!.descricao).toMatch(/Nenhum acesso externo/i);
    expect(p.avisos.join(' ')).toMatch(/vínculo/i);
  });

  it('AC-011: o aviso de VBA deixa claro que nada foi executado', () => {
    const p = previaXlsm(baseVazia(), docXlsm(), leituraXlsmVazia());
    expect(p.avisos.join(' ')).toMatch(/nenhuma macro foi executada/i);
  });

  it('AC-012: a aba de comparação é declarada fora da carga principal', () => {
    const p = previaXlsm(baseVazia(), docXlsm(), leituraXlsmVazia());
    expect(p.avisos.join(' ')).toMatch(/Planilha1.*fora da carga principal/i);
  });
});

describe('AC-050 / AC-053 — follow-ups, tarefas e desenvolvimento não criam horas', () => {
  it('nenhum apontamento é criado a partir dessas abas', () => {
    const base = baseVazia();
    const leitura: LeituraXlsm = {
      ...leituraXlsmVazia(),
      followUps: [
        {
          linha: 6,
          data: { data: '2026-06-10', bruto: '46183', problema: null },
          referenciaBruta: 'RR90000015',
          descricao: 'Cobrança por e-mail',
          tipo: 'FUP',
          tentativa: 1,
          canal: 'E-mail',
          responsavel: 'Fulano',
          resultado: null,
          dataResposta: { data: null, bruto: null, problema: null },
          proximaAcao: null,
          resumo: null,
          statusNoMomento: null,
        },
      ],
      tarefas: [
        {
          linha: 6,
          tarefa: 'Revisar pendências',
          relacionada: 'Não',
          referenciaBruta: null,
          prioridade: 'Alta',
          horario: null,
          status: 'Concluída',
          check: false,
          observacoes: null,
          data: { data: null, bruto: null, problema: null },
          divergenciaStatusCheck: true,
        },
      ],
      desenvolvimento: [
        {
          linha: 8,
          data: { data: null, bruto: null, problema: null },
          tipoAtividade: 'Estudo',
          tema: 'SAP FSCM',
          descricao: 'Li a documentação do módulo',
          pessoaArea: null,
          resultado: null,
          competencia: null,
          relevancia: null,
          proximoPasso: null,
          status: null,
          incompleto: true,
        },
      ],
    };

    const p = previaXlsm(base, docXlsm(), leitura);
    const r = aplicarPrevia(base, p, aceitarPadrao(p), 'op-1').revisao;

    expect(r.timeEntries).toHaveLength(0);
    expect(r.followUps).toHaveLength(1);
    expect(r.tasks).toHaveLength(1);
    expect(r.developmentRecords).toHaveLength(1);
  });

  it('AC-052: resultado vazio é desconhecido, não "sem resposta"', () => {
    const leitura: LeituraXlsm = {
      ...leituraXlsmVazia(),
      followUps: [
        {
          linha: 6,
          data: { data: '2026-06-10', bruto: null, problema: null },
          referenciaBruta: 'RR1',
          descricao: null,
          tipo: null,
          tentativa: 1,
          canal: null,
          responsavel: null,
          resultado: null,
          dataResposta: { data: null, bruto: null, problema: null },
          proximaAcao: null,
          resumo: null,
          statusNoMomento: null,
        },
      ],
    };
    const p = previaXlsm(baseVazia(), docXlsm(), leitura);
    const issue = p.issues.find((i) => i.tipo === 'regra_followup_nao_confirmada')!;
    expect(issue.descricao).toMatch(/desconhecido, não "sem resposta"/i);
  });

  it('AC-053: registro de desenvolvimento sem data é preservado com pendência', () => {
    const leitura: LeituraXlsm = {
      ...leituraXlsmVazia(),
      desenvolvimento: [
        {
          linha: 8,
          data: { data: null, bruto: null, problema: null },
          tipoAtividade: null,
          tema: 'Tema',
          descricao: 'Descrição preservada',
          pessoaArea: null,
          resultado: null,
          competencia: null,
          relevancia: null,
          proximoPasso: null,
          status: null,
          incompleto: true,
        },
      ],
    };
    const base = baseVazia();
    const p = previaXlsm(base, docXlsm(), leitura);
    const r = aplicarPrevia(base, p, aceitarPadrao(p), 'op-1').revisao;
    expect(r.developmentRecords[0]!.descricao).toBe('Descrição preservada');
    expect(r.developmentRecords[0]!.incompleto).toBe(true);
  });
});

describe('AC-038 — prévia invalidada quando a base ou a fonte mudam', () => {
  it('a prévia é rejeitada se a revisão-base mudou', () => {
    const base = baseVazia();
    const p = previaCsv(base, doc(), lerCsvCs3(csvIncidentes(['IR1;T;Working;04/09/2026 14:00:00;;'])));
    const outra = aplicarPrevia(base, p, aceitarPadrao(p), 'op-1').revisao;

    const validade = validarPrevia(p, outra, p.documento.sha256);
    expect(validade.valida).toBe(false);
    expect(validade).toMatchObject({ motivo: 'revisao_mudou' });
  });

  it('a prévia é rejeitada se o arquivo mudou durante a conferência', () => {
    const base = baseVazia();
    const p = previaCsv(base, doc(), lerCsvCs3(csvIncidentes(['IR1;T;Working;04/09/2026 14:00:00;;'])));
    const validade = validarPrevia(p, base, 'outro-hash');
    expect(validade).toMatchObject({ valida: false, motivo: 'fonte_mudou' });
  });

  it('a prévia é aceita quando base e fonte continuam iguais', () => {
    const base = baseVazia();
    const p = previaCsv(base, doc(), lerCsvCs3(csvIncidentes(['IR1;T;Working;04/09/2026 14:00:00;;'])));
    expect(validarPrevia(p, base, p.documento.sha256)).toEqual({ valida: true });
  });
});

describe('secção 11 — excluir candidato não apaga registro existente', () => {
  it('um item excluído da carga não remove o que já estava na base', () => {
    const base = baseVazia();
    const p1 = previaCsv(base, doc(), lerCsvCs3(csvIncidentes(['IR1;Original;Working;04/09/2026 14:00:00;;'])));
    const r1 = aplicarPrevia(base, p1, aceitarPadrao(p1), 'op-1').revisao;

    const p2 = previaCsv(r1, doc({ sha256: 'h2' }), lerCsvCs3(csvIncidentes(['IR1;Novo título;Working;05/09/2026 14:00:00;;'])));
    const decisoes: DecisoesDaCarga = {
      itensAceitos: new Set(),
      itensExcluidos: new Set(p2.itens.map((i) => i.id)),
      decisoesDeIssues: new Map(),
    };
    const r2 = aplicarPrevia(r1, p2, decisoes, 'op-2').revisao;

    expect(r2.tickets).toHaveLength(1);
    expect(r2.tickets[0]!.oficial!.title).toBe('Original');
  });
});

describe('revisão atômica e auditoria', () => {
  it('cada carga confirmada gera uma revisão descendente com recibo de auditoria', () => {
    const base = baseVazia();
    const p = previaCsv(base, doc(), lerCsvCs3(csvIncidentes(['IR1;T;Working;04/09/2026 14:00:00;;'])));
    const r = aplicarPrevia(base, p, aceitarPadrao(p), 'op-unica').revisao;

    expect(r.revisionId).not.toBe(base.revisionId);
    expect(r.parentRevisionId).toBe(base.revisionId);
    expect(r.audit.some((a) => a.operationId === 'op-unica' && a.operacao === 'commitImport')).toBe(true);
    expect(r.importBatches).toHaveLength(1);
    // A revisão-base permanece intacta em memória.
    expect(base.tickets).toHaveLength(0);
  });
});
