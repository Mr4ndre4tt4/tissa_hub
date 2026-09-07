/**
 * Dados SINTÉTICOS para o modo demonstrativo.
 *
 * Nada aqui vem dos insumos reais do cliente: os números de chamado usam a
 * faixa reservada 9xxxxxxx, os nomes são inventados e as descrições são
 * genéricas. Estes dados nunca se misturam a uma pasta real do usuário
 * (secção 20) e existem só para demonstrar a interface sem conexão.
 */

import type { Celula, Revision, Ticket, Uuid } from '../domain/entities/tipos';
import { novoWorkspace, revisaoInicial } from '../domain/entities/revisao';

export const MARCA_SINTETICA = 'Dados de demonstração — inventados, não são registros reais.';

let n = 0;
function id(prefixo: string): Uuid {
  n += 1;
  return `demo-${prefixo}-${String(n).padStart(6, '0')}`;
}

function ticket(ref: string, titulo: string, status: string, tipo: 'incident' | 'request'): Ticket {
  return {
    id: id('tkt'),
    workspaceId: 'demo-ws',
    sourceSystem: 'CS3',
    ticketType: tipo,
    sourceTicketId: ref,
    provisorio: false,
    referencia: { bruto: ref, namespace: ref.startsWith('IR') ? 'IR' : 'RR', normalizado: ref },
    oficial: {
      title: titulo,
      statusBruto: status,
      assignedTo: 'Pessoa Sintética',
      startTimeBruto: '01/09/2026 09:00:00',
      lastUpdateTimeBruto: '04/09/2026 14:00:00',
      priority: tipo === 'incident' ? 'Média' : null,
      impact: tipo === 'incident' ? 'Médio' : null,
      complexity: tipo === 'request' ? 'Média' : null,
      assignmentGroup: 'AMS SAP FI',
      external: null,
      referenceId: null,
      reportedBy: 'usuario.sintetico',
      reportedCi: null,
      deviceCi: null,
      affectedCi: null,
      tags: [null, null, 'BASELINE', null, null, null],
      typeBruto: null,
      escalationStatus: null,
      lastUsedKnowledgeSource: null,
      extras: {},
    },
    versaoFonte: '04/09/2026 14:00:00',
    versaoFonteInstante: '2026-09-07T09:00:00-03:00',
    proveniencia: [{ origem: 'cs3_csv', arquivo: 'demonstracao.csv', natureza: 'literal' }],
    criadoEm: '2026-09-07T09:00:00-03:00',
    atualizadoEm: '2026-09-07T09:00:00-03:00',
    versao: 1,
  };
}

export function revisaoDemonstrativa(): Revision {
  n = 0;
  const ws = novoWorkspace('Central de Chamados (demonstração)', 'demo-ws');
  ws.schedule.inicioControle = '2026-09-01';
  const r = revisaoInicial(ws);
  r.workspaceId = ws.id;

  const t1 = ticket('IR90000001', 'Relatório de faturamento não gera', 'Working', 'incident');
  const t2 = ticket('RR90000002', 'Criar campo adicional no cadastro', 'Wait on User', 'request');
  const t3 = ticket('RR90000003', 'Revisar layout de nota fiscal', 'Updated', 'request');
  r.tickets.push(t1, t2, t3);

  const estados: [Ticket, string, Celula | null, string | null, string | null][] = [
    [t1, 'Erro no relatório do fechamento', 'AMS', 'Cobrar retorno da área', '2026-09-04'],
    [t2, 'Campo novo no cadastro de cliente', 'SQUAD', 'Aguardar validação', null],
    [t3, 'Layout da nota fiscal', 'TASK_FORCE', 'Enviar proposta', '2026-09-02'],
  ];

  for (const [t, titulo, celula, proximaAcao, prazo] of estados) {
    r.personalStates.push({
      id: id('ps'),
      workspaceId: ws.id,
      ticketId: t.id,
      groupId: null,
      tituloPessoal: titulo,
      andamentoPessoal: 'Em andamento',
      andamentoPessoalBruto: 'Em andamento',
      prioridadePessoal: 'Média',
      categoriaFuncional: 'SAP FI',
      celulaManual: celula,
      celulaSugerida: 'AMS',
      proximaAcao,
      prazo,
      estimativaMinutos: null,
      estimativaConfirmada: false,
      rndBruto: t === t3 ? 'RND de 23h aprovada, +3h de análise' : null,
      responsavelPessoal: 'Pessoa Sintética',
      criadoEmPessoal: '2026-08-20',
      atualizadoEmPessoal: '2026-09-04',
      resolvidoEmPessoal: null,
      proveniencia: [{ origem: 'xlsm', aba: 'Chamados', natureza: 'literal' }],
      criadoEm: '2026-09-07T09:00:00-03:00',
      atualizadoEm: '2026-09-07T09:00:00-03:00',
      versao: 1,
    });
  }

  const apont = (data: string, minutos: number | null, celula: Celula, descricao: string, refs: Ticket[]) => {
    const entradaId = id('te');
    r.timeEntries.push({
      id: entradaId,
      workspaceId: ws.id,
      workDate: data,
      descricao,
      duracaoMinutos: minutos,
      tipoAtuacaoBruto: 'Análise',
      tipoAtuacaoNormalizado: 'ANÁLISE',
      celula,
      celulaDefinidaPor: 'importacao',
      estadoOperacional: minutos === null ? 'draft' : 'confirmed',
      estadoImportacao: minutos === null ? 'incomplete' : 'ready',
      elegivelJornada: true,
      lancamentoExterno: null,
      observacao: null,
      referencias: refs.map((t) => t.referencia),
      proveniencia: [{ origem: 'xlsm', aba: 'Apontamentos', natureza: 'literal' }],
      criadoEm: '2026-09-07T09:00:00-03:00',
      atualizadoEm: '2026-09-07T09:00:00-03:00',
      canceladoEm: null,
      motivoCancelamento: null,
      versao: 1,
    });
    for (const t of refs) {
      r.timeEntryReferences.push({ id: id('ref'), timeEntryId: entradaId, ticketId: t.id, groupId: null, referencia: t.referencia });
    }
    return entradaId;
  };

  // 01/09: fecha a meta exatamente.
  apont('2026-09-01', 180, 'AMS', 'Análise do erro do relatório', [t1]);
  apont('2026-09-01', 180, 'SQUAD', 'Especificação do campo novo', [t2]);
  apont('2026-09-01', 120, 'GENERAL', 'Reunião de alinhamento da equipe', []);

  // 02/09: 7h30 — faltam 30 min.
  apont('2026-09-02', 273, 'AMS', 'Depuração do programa de faturamento', [t1]);
  apont('2026-09-02', 177, 'TASK_FORCE', 'Ajuste do layout', [t3]);

  // 03/09: atividade compartilhada, sem rateio.
  apont('2026-09-03', 120, 'AMS', 'Análise conjunta dos dois chamados', [t1, t2]);
  apont('2026-09-03', 240, 'SQUAD', 'Testes da melhoria', [t2]);

  // 04/09: um registro sem duração, preservado como incompleto.
  apont('2026-09-04', 300, 'AMS', 'Correção e validação com o usuário', [t1]);
  apont('2026-09-04', null, 'UNCLASSIFIED', 'Atendimento sem duração registrada', [t3]);

  r.followUps.push({
    id: id('fu'),
    workspaceId: ws.id,
    data: '2026-09-03',
    ticketId: t2.id,
    groupId: null,
    referenciaBruta: 'RR90000002',
    descricao: 'Cobrança de validação',
    tipo: 'FUP',
    tentativa: 1,
    canal: 'E-mail',
    responsavel: 'Pessoa Sintética',
    resultado: null,
    dataResposta: null,
    proximaAcao: 'Reenviar em 3 dias',
    resumo: 'Sem retorno até o momento',
    statusNoMomento: 'Wait on User',
    proveniencia: [{ origem: 'xlsm', aba: 'Follow-ups', natureza: 'literal' }],
    criadoEm: '2026-09-07T09:00:00-03:00',
  });

  r.tasks.push(
    {
      id: id('tk'),
      workspaceId: ws.id,
      titulo: 'Revisar fila de chamados abertos',
      data: '2026-09-08',
      horario: '09:00',
      ticketId: null,
      referenciaBruta: null,
      prioridade: 'Alta',
      status: 'Pendente',
      concluida: false,
      divergenciaStatusCheck: false,
      observacao: null,
      proveniencia: [{ origem: 'xlsm', aba: 'To Do Diário', natureza: 'literal' }],
      criadoEm: '2026-09-07T09:00:00-03:00',
    },
    {
      id: id('tk'),
      workspaceId: ws.id,
      titulo: 'Organizar anotações da semana',
      data: null,
      horario: null,
      ticketId: null,
      referenciaBruta: null,
      prioridade: 'Baixa',
      status: 'Pendente',
      concluida: false,
      divergenciaStatusCheck: false,
      observacao: 'Sem data definida',
      proveniencia: [{ origem: 'xlsm', aba: 'To Do Diário', natureza: 'literal' }],
      criadoEm: '2026-09-07T09:00:00-03:00',
    },
  );

  r.developmentRecords.push(
    {
      id: id('dev'),
      workspaceId: ws.id,
      data: '2026-09-02',
      tipoAtividade: 'Estudo',
      tema: 'SAP FSCM',
      descricao: 'Estudo da documentação do módulo',
      pessoaArea: 'Equipe AMS',
      resultado: 'Consegui explicar o fluxo para a equipe',
      competencia: 'Conhecimento técnico',
      relevanciaOneOnOne: 'Sim',
      proximoPasso: 'Aplicar num chamado real',
      status: 'Concluído',
      incompleto: false,
      proveniencia: [{ origem: 'xlsm', aba: 'Meu desenvolvimento', natureza: 'literal' }],
      criadoEm: '2026-09-07T09:00:00-03:00',
    },
    {
      id: id('dev'),
      workspaceId: ws.id,
      data: null,
      tipoAtividade: 'Mentoria',
      tema: 'Comunicação com o usuário',
      descricao: 'Conversa sobre condução de reuniões — sem data registrada',
      pessoaArea: null,
      resultado: null,
      competencia: null,
      relevanciaOneOnOne: null,
      proximoPasso: null,
      status: null,
      // Preservado com pendência, exatamente como o legado exige.
      incompleto: true,
      proveniencia: [{ origem: 'xlsm', aba: 'Meu desenvolvimento', natureza: 'literal' }],
      criadoEm: '2026-09-07T09:00:00-03:00',
    },
  );

  r.issues.push(
    {
      id: id('iss'),
      workspaceId: ws.id,
      tipo: 'rateio_indefinido',
      titulo: 'Atividade ligada a 2 chamados (linha 6)',
      descricao:
        'Os 120 minutos somam uma vez no dia e aparecem em cada chamado como "Compartilhado — sem rateio". ' +
        'Nenhum chamado recebe o total integral até você definir o rateio.',
      impactoMinutos: 120,
      evidencia: [{ origem: 'xlsm', aba: 'Apontamentos', linha: 6, natureza: 'literal' }],
      opcoes: [
        { chave: 'ratear', rotulo: 'Definir o rateio agora', destrutiva: false },
        { chave: 'manter_compartilhado', rotulo: 'Manter como compartilhado sem rateio', destrutiva: false },
      ],
      decisao: null,
      estado: 'aberta',
      criadoEm: '2026-09-07T09:00:00-03:00',
    },
    {
      id: id('iss'),
      workspaceId: ws.id,
      tipo: 'duracao_ausente',
      titulo: 'Atividade sem duração confirmada (linha 9)',
      descricao:
        'A linha não traz duração. O registro é preservado como incompleto e fica fora do total confirmado — não vira 0 nem 8 horas.',
      impactoMinutos: null,
      evidencia: [{ origem: 'xlsm', aba: 'Apontamentos', linha: 9, natureza: 'empty' }],
      opcoes: [
        { chave: 'informar_duracao', rotulo: 'Informar a duração', destrutiva: false },
        { chave: 'manter_incompleto', rotulo: 'Manter como incompleto', destrutiva: false },
      ],
      decisao: null,
      estado: 'aberta',
      criadoEm: '2026-09-07T09:00:00-03:00',
    },
  );

  r.sourceDocuments.push({
    id: id('doc'),
    tipo: 'xlsm',
    nomeArquivo: 'demonstracao-sintetica.xlsm',
    origem: 'upload_local',
    sha256: '0'.repeat(64),
    tamanhoBytes: 0,
    perfil: 'central-chamados-aprimorado-xlsm-v1',
    lidoEm: '2026-09-07T09:00:00-03:00',
  });

  return r;
}
