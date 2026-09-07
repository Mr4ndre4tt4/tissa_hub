/**
 * Assistente de importação: prévia, conciliação e commit (secções 8 e 11).
 *
 * Princípios que este módulo garante:
 *  - nada é gravado na base principal enquanto a prévia não for confirmada;
 *  - a prévia carrega a revisão-base e a assinatura da fonte; se qualquer uma
 *    mudou, a prévia é invalidada e recalculada, nunca aplicada por cima;
 *  - registros sem impedimento podem ser aceitos separadamente; os demais
 *    ficam como candidatos com a sua evidência;
 *  - ausência numa carga jamais apaga horas, notas, vínculo ou estado;
 *  - um conjunto confirmado vira **uma** revisão atômica.
 */

import type {
  Celula,
  ImportBatch,
  Proveniencia,
  ReconciliationIssue,
  Revision,
  SourceDocument,
  SourceRecordLink,
  Ticket,
  TipoPendencia,
  Uuid,
} from '../entities/tipos';
import { chaveOficial, lerReferencia, normalizarParaComparacao, referenciasCitadasEmTexto } from '../entities/identidade';
import { celulaEfetiva, normalizarAndamentoPessoal, sugerirCelulaPorTag3 } from '../entities/celulas';
import { compararCarimbos, diferencaEmDias, lerCarimboCs3 } from '../time/datas';
import { conciliarCampos, type CampoConciliado } from './tresEstados';
import { casarPorMultiplicidade, detectarRepeticoesNaCarga, type CandidatoOrigem, type RegistroConhecido } from './multiplicidade';
import type { ResultadoLeituraCsv } from '../sources/csv';
import type { LeituraXlsm } from '../sources/xlsm';

export function novoId(): Uuid {
  return globalThis.crypto.randomUUID();
}

function agora(): string {
  return new Date().toISOString();
}

export type ClasseItem =
  | 'novo'
  | 'alterado'
  | 'igual'
  | 'versao_antiga'
  | 'incompleto'
  | 'conflito'
  | 'possivel_duplicata'
  | 'ausente_na_carga';

export type OperacaoProposta =
  | { tipo: 'criar_ticket'; ticket: Ticket }
  | { tipo: 'atualizar_ticket'; ticketId: Uuid; oficial: Ticket['oficial']; versaoFonte: string }
  | { tipo: 'criar_apontamento'; dados: DadosApontamento }
  | { tipo: 'atualizar_apontamento'; timeEntryId: Uuid; dados: DadosApontamento }
  | { tipo: 'criar_estado_pessoal'; dados: DadosEstadoPessoal }
  | { tipo: 'atualizar_estado_pessoal'; personalStateId: Uuid; campos: CampoConciliado[] }
  | { tipo: 'criar_followup'; dados: Record<string, unknown> }
  | { tipo: 'criar_tarefa'; dados: Record<string, unknown> }
  | { tipo: 'criar_evento_status'; dados: Record<string, unknown> }
  | { tipo: 'criar_resolucao'; dados: Record<string, unknown> }
  | { tipo: 'criar_desenvolvimento'; dados: Record<string, unknown> }
  | { tipo: 'nenhuma' };

export interface DadosApontamento {
  workDate: string | null;
  descricao: string | null;
  duracaoMinutos: number | null;
  tipoAtuacaoBruto: string | null;
  celula: Celula;
  observacao: string | null;
  lancamentoExterno: 'reported_posted' | null;
  referenciaBruta: string | null;
  estadoImportacao: 'ready' | 'incomplete' | 'needs_review';
  proveniencia: Proveniencia;
}

export interface DadosEstadoPessoal {
  referenciaBruta: string | null;
  tituloPessoal: string | null;
  andamentoPessoal: string | null;
  andamentoPessoalBruto: string | null;
  prioridadePessoal: string | null;
  categoriaFuncional: string | null;
  proximaAcao: string | null;
  criadoEmPessoal: string | null;
  atualizadoEmPessoal: string | null;
  resolvidoEmPessoal: string | null;
  rndBruto: string | null;
  responsavelPessoal: string | null;
  observacoes: string | null;
  proveniencia: Proveniencia;
}

export interface ItemPrevia {
  id: string;
  classe: ClasseItem;
  entidade: string;
  rotulo: string;
  descricao: string;
  linhaOrigem: number | null;
  campos: CampoConciliado[];
  operacao: OperacaoProposta;
  /** Itens sem impedimento entram marcados; conflitos e incompletos, não. */
  incluidoPorPadrao: boolean;
  /** Pendências geradas por este item. */
  issueIds: Uuid[];
}

export interface Previa {
  id: Uuid;
  criadaEm: string;
  /** Revisão sobre a qual as diferenças foram calculadas (secção 8.1). */
  revisaoBase: Uuid | null;
  documento: SourceDocument;
  itens: ItemPrevia[];
  issues: ReconciliationIssue[];
  contagens: Record<ClasseItem, number>;
  /** Minutos que a carga acrescentaria caso tudo marcado fosse confirmado. */
  minutosCandidatos: number;
  /** Minutos que ficam de fora por pendência (secção 11). */
  minutosExcluidosPorPendencia: number;
  avisos: string[];
}

function contarClasses(itens: ItemPrevia[]): Record<ClasseItem, number> {
  const base: Record<ClasseItem, number> = {
    novo: 0,
    alterado: 0,
    igual: 0,
    versao_antiga: 0,
    incompleto: 0,
    conflito: 0,
    possivel_duplicata: 0,
    ausente_na_carga: 0,
  };
  for (const i of itens) base[i.classe] += 1;
  return base;
}

function criarIssue(
  workspaceId: Uuid,
  tipo: TipoPendencia,
  titulo: string,
  descricao: string,
  evidencia: Proveniencia[],
  opcoes: { chave: string; rotulo: string; destrutiva: boolean }[],
  impactoMinutos: number | null = null,
): ReconciliationIssue {
  return {
    id: novoId(),
    workspaceId,
    tipo,
    titulo,
    descricao,
    impactoMinutos,
    evidencia,
    opcoes,
    decisao: null,
    estado: 'aberta',
    criadoEm: agora(),
  };
}

/* ================================================================== */
/* Prévia de CSV CS3                                                   */
/* ================================================================== */

/**
 * Compara a carga oficial com o que a base já conhece (secção 8.3).
 * Só a lista permitida de campos oficiais é atualizada; nenhum campo pessoal é
 * tocado por esta rotina.
 */
export function previaCsv(revisao: Revision, documento: SourceDocument, leitura: ResultadoLeituraCsv): Previa {
  const itens: ItemPrevia[] = [];
  const issues: ReconciliationIssue[] = [];
  const avisos: string[] = [];
  const ws = revisao.workspace.id;

  if (leitura.colunasDesconhecidas.length > 0) {
    avisos.push(
      `A extração traz ${leitura.colunasDesconhecidas.length} coluna(s) que o perfil não conhece: ` +
        `${leitura.colunasDesconhecidas.join(', ')}. Os valores foram preservados como metadado.`,
    );
  }

  const porChave = new Map<string, Ticket>();
  for (const t of revisao.tickets) {
    if (t.sourceSystem && t.ticketType && t.sourceTicketId) {
      porChave.set(chaveOficial(ws, t.sourceSystem, t.ticketType, t.sourceTicketId), t);
    }
  }
  // Referências provisórias, criadas por horas sem cadastro (secção 8.5).
  const provisoriosPorRef = new Map<string, Ticket>();
  for (const t of revisao.tickets) {
    if (t.provisorio) provisoriosPorRef.set(t.referencia.normalizado, t);
  }

  for (const registro of leitura.registros) {
    const proveniencia: Proveniencia = {
      origem: 'cs3_csv',
      arquivo: documento.nomeArquivo,
      sha256: documento.sha256,
      perfil: leitura.perfil.id,
      linha: registro.linha,
      natureza: 'literal',
      observadoEm: documento.lidoEm,
    };

    if (registro.estado === 'incomplete') {
      itens.push({
        id: novoId(),
        classe: 'incompleto',
        entidade: 'ticket',
        rotulo: registro.sourceTicketId || `linha ${registro.linha}`,
        descricao: registro.problemas.join(' '),
        linhaOrigem: registro.linha,
        campos: [],
        operacao: { tipo: 'nenhuma' },
        incluidoPorPadrao: false,
        issueIds: [],
      });
      continue;
    }

    const chave = chaveOficial(ws, 'CS3', registro.ticketType, registro.sourceTicketId);
    const existente = porChave.get(chave);
    const issueIds: Uuid[] = [];

    // Uma referência provisória com horas é completada, sem duplicar (AC-026).
    const refNormalizada = normalizarParaComparacao(registro.sourceTicketId);
    const provisorio = !existente ? provisoriosPorRef.get(refNormalizada) : undefined;

    if (!existente && !provisorio) {
      const leituraRef = lerReferencia(registro.sourceTicketId);
      const ticket: Ticket = {
        id: novoId(),
        workspaceId: ws,
        sourceSystem: 'CS3',
        ticketType: registro.ticketType,
        sourceTicketId: registro.sourceTicketId,
        provisorio: false,
        referencia: leituraRef.candidatos[0] ?? {
          bruto: registro.sourceTicketId,
          namespace: 'OUTRO',
          normalizado: refNormalizada,
        },
        oficial: registro.oficial,
        versaoFonte: registro.oficial.lastUpdateTimeBruto,
        versaoFonteInstante: documento.lidoEm,
        proveniencia: [proveniencia],
        criadoEm: agora(),
        atualizadoEm: agora(),
        versao: 1,
      };

      if (registro.problemas.length > 0) {
        const issue = criarIssue(
          ws,
          'data_incoerente',
          `Cronologia do chamado ${registro.sourceTicketId}`,
          registro.problemas.join(' '),
          [proveniencia],
          [
            { chave: 'aceitar_sem_abertura', rotulo: 'Importar sem data de abertura', destrutiva: false },
            { chave: 'adiar', rotulo: 'Adiar decisão', destrutiva: false },
          ],
        );
        issues.push(issue);
        issueIds.push(issue.id);
      }

      itens.push({
        id: novoId(),
        classe: 'novo',
        entidade: 'ticket',
        rotulo: registro.sourceTicketId,
        descricao: registro.oficial.title,
        linhaOrigem: registro.linha,
        campos: [],
        operacao: { tipo: 'criar_ticket', ticket },
        incluidoPorPadrao: true,
        issueIds,
      });
      continue;
    }

    const alvo = existente ?? provisorio!;

    // Comparação de versão da origem: nunca por horário de upload (secção 8.3).
    const novoCarimbo = lerCarimboCs3(registro.oficial.lastUpdateTimeBruto);
    const carimboConhecido = alvo.versaoFonte ? lerCarimboCs3(alvo.versaoFonte) : null;

    let ordem: number | null = null;
    if (novoCarimbo.ok && carimboConhecido?.ok) ordem = compararCarimbos(novoCarimbo.valor, carimboConhecido.valor);
    else if (!carimboConhecido) ordem = 1; // provisório ainda sem versão oficial

    const conteudoIgual = JSON.stringify(alvo.oficial) === JSON.stringify(registro.oficial);

    if (ordem === null) {
      const issue = criarIssue(
        ws,
        'data_incoerente',
        `Versão não comparável em ${registro.sourceTicketId}`,
        'As datas de atualização das duas versões não são comparáveis. A decisão não é tomada pela ordem do upload.',
        [proveniencia],
        [
          { chave: 'aceitar_origem', rotulo: 'Aceitar a versão da extração', destrutiva: true },
          { chave: 'manter_aplicativo', rotulo: 'Manter o que está no aplicativo', destrutiva: false },
        ],
      );
      issues.push(issue);
      itens.push({
        id: novoId(),
        classe: 'conflito',
        entidade: 'ticket',
        rotulo: registro.sourceTicketId,
        descricao: 'Versões não comparáveis: exige revisão.',
        linhaOrigem: registro.linha,
        campos: [],
        operacao: { tipo: 'atualizar_ticket', ticketId: alvo.id, oficial: registro.oficial, versaoFonte: registro.oficial.lastUpdateTimeBruto },
        incluidoPorPadrao: false,
        issueIds: [issue.id],
      });
      continue;
    }

    if (ordem < 0) {
      itens.push({
        id: novoId(),
        classe: 'versao_antiga',
        entidade: 'ticket',
        rotulo: registro.sourceTicketId,
        descricao: `A extração traz uma versão anterior à conhecida (${alvo.versaoFonte}). Nada é regredido.`,
        linhaOrigem: registro.linha,
        campos: [],
        operacao: { tipo: 'nenhuma' },
        incluidoPorPadrao: false,
        issueIds: [],
      });
      continue;
    }

    if (ordem === 0 && conteudoIgual) {
      itens.push({
        id: novoId(),
        classe: 'igual',
        entidade: 'ticket',
        rotulo: registro.sourceTicketId,
        descricao: 'Sem alteração desde a última importação.',
        linhaOrigem: registro.linha,
        campos: [],
        operacao: { tipo: 'nenhuma' },
        incluidoPorPadrao: false,
        issueIds: [],
      });
      continue;
    }

    if (ordem === 0 && !conteudoIgual) {
      // Mesma versão declarada, conteúdo diferente: conflito explícito (AC-005).
      const issue = criarIssue(
        ws,
        'divergencia_manual',
        `Conteúdo divergente com a mesma versão em ${registro.sourceTicketId}`,
        'A extração declara a mesma data de atualização, mas com conteúdo diferente. Nenhuma decisão é tomada pela ordem do upload.',
        [proveniencia],
        [
          { chave: 'aceitar_origem', rotulo: 'Aceitar a versão da extração', destrutiva: true },
          { chave: 'manter_aplicativo', rotulo: 'Manter o que está no aplicativo', destrutiva: false },
        ],
      );
      issues.push(issue);
      itens.push({
        id: novoId(),
        classe: 'conflito',
        entidade: 'ticket',
        rotulo: registro.sourceTicketId,
        descricao: 'Mesma versão com conteúdo diferente.',
        linhaOrigem: registro.linha,
        campos: camposOficiais(alvo, registro.oficial),
        operacao: { tipo: 'atualizar_ticket', ticketId: alvo.id, oficial: registro.oficial, versaoFonte: registro.oficial.lastUpdateTimeBruto },
        incluidoPorPadrao: false,
        issueIds: [issue.id],
      });
      continue;
    }

    itens.push({
      id: novoId(),
      classe: 'alterado',
      entidade: 'ticket',
      rotulo: registro.sourceTicketId,
      descricao: provisorio
        ? 'A extração oficial completa uma referência provisória, sem duplicar o chamado.'
        : 'Campos oficiais atualizados. Registros pessoais permanecem.',
      linhaOrigem: registro.linha,
      campos: camposOficiais(alvo, registro.oficial),
      operacao: { tipo: 'atualizar_ticket', ticketId: alvo.id, oficial: registro.oficial, versaoFonte: registro.oficial.lastUpdateTimeBruto },
      incluidoPorPadrao: true,
      issueIds: [],
    });
  }

  // Tickets conhecidos que não vieram nesta carga: informação de ausência.
  const idsNaCarga = new Set(leitura.registros.map((r) => chaveOficial(ws, 'CS3', r.ticketType, r.sourceTicketId)));
  for (const t of revisao.tickets) {
    if (!t.sourceSystem || !t.ticketType || !t.sourceTicketId || t.provisorio) continue;
    if (t.ticketType !== leitura.perfil.tipo) continue; // outra extração cuida do outro tipo
    if (idsNaCarga.has(chaveOficial(ws, 'CS3', t.ticketType, t.sourceTicketId))) continue;
    itens.push({
      id: novoId(),
      classe: 'ausente_na_carga',
      entidade: 'ticket',
      rotulo: t.sourceTicketId,
      descricao: 'Não veio nesta extração. Chamado, horas, notas e estado são preservados; nada é encerrado por ausência.',
      linhaOrigem: null,
      campos: [],
      operacao: { tipo: 'nenhuma' },
      incluidoPorPadrao: false,
      issueIds: [],
    });
  }

  return {
    id: novoId(),
    criadaEm: agora(),
    revisaoBase: revisao.revisionId,
    documento,
    itens,
    issues,
    contagens: contarClasses(itens),
    // O CSV oficial nunca cria horas (AC-001).
    minutosCandidatos: 0,
    minutosExcluidosPorPendencia: 0,
    avisos,
  };
}

const ROTULOS_OFICIAIS: Record<string, string> = {
  title: 'Título oficial',
  statusBruto: 'Status oficial',
  assignedTo: 'Responsável oficial',
  startTimeBruto: 'Abertura informada',
  lastUpdateTimeBruto: 'Última atualização',
  priority: 'Prioridade',
  impact: 'Impacto',
  complexity: 'Complexidade',
  assignmentGroup: 'Grupo responsável',
  external: 'Referência externa',
  referenceId: 'Reference ID',
};

function camposOficiais(alvo: Ticket, novo: NonNullable<Ticket['oficial']>): CampoConciliado[] {
  const atual = alvo.oficial;
  return conciliarCampos(
    Object.keys(ROTULOS_OFICIAIS).map((campo) => ({
      campo,
      rotulo: ROTULOS_OFICIAIS[campo]!,
      // Para campos oficiais, a base é o próprio último valor importado.
      base: atual ? (atual as unknown as Record<string, unknown>)[campo] ?? null : null,
      origem: (novo as unknown as Record<string, unknown>)[campo] ?? null,
      aplicativo: atual ? (atual as unknown as Record<string, unknown>)[campo] ?? null : null,
    })),
  );
}

/* ================================================================== */
/* Prévia do XLSM                                                      */
/* ================================================================== */

export interface OpcoesPreviaXlsm {
  /** Célula sugerida por referência, vinda das Tags do CSV, quando conhecida. */
  sugestoesDeCelula?: Map<string, ReturnType<typeof sugerirCelulaPorTag3>>;
}

export function previaXlsm(
  revisao: Revision,
  documento: SourceDocument,
  leitura: LeituraXlsm,
  opcoes: OpcoesPreviaXlsm = {},
): Previa {
  const itens: ItemPrevia[] = [];
  const issues: ReconciliationIssue[] = [];
  const avisos: string[] = [];
  const ws = revisao.workspace.id;
  let minutosCandidatos = 0;
  let minutosExcluidos = 0;

  const prov = (aba: string, linha: number, celula?: string, extra?: Partial<Proveniencia>): Proveniencia => ({
    origem: 'xlsm',
    arquivo: documento.nomeArquivo,
    sha256: documento.sha256,
    perfil: 'central-chamados-aprimorado-xlsm-v1',
    aba,
    linha,
    celulaPlanilha: celula,
    natureza: 'literal',
    observadoEm: documento.lidoEm,
    ...extra,
  });

  if (leitura.diagnostico.contemVba) {
    avisos.push('O arquivo contém um projeto VBA. Ele foi apenas detectado: nenhuma macro foi executada.');
  }
  if (leitura.diagnostico.vinculosExternos.length > 0) {
    avisos.push(
      `O arquivo declara ${leitura.diagnostico.vinculosExternos.length} vínculo(s) externo(s). ` +
        'Nenhum foi aberto ou resolvido; os valores usados são os que estavam salvos.',
    );
  }
  avisos.push('A aba Planilha1 é uma cópia de comparação e fica fora da carga principal.');
  avisos.push('Fila Follow-up, Dashboard e Produtividade são visões derivadas: os indicadores são recalculados pelo aplicativo.');

  /* -------- Chamados: estado pessoal -------- */
  const estadosPorRef = new Map<string, (typeof revisao.personalStates)[number]>();
  for (const p of revisao.personalStates) {
    const ticket = revisao.tickets.find((t) => t.id === p.ticketId);
    const ref = ticket?.referencia.normalizado;
    if (ref) estadosPorRef.set(ref, p);
  }
  const linksAnteriores = new Map(revisao.sourceRecordLinks.filter((l) => l.entidade === 'personal_state').map((l) => [l.chaveFonte, l]));

  for (const c of leitura.chamados) {
    const leituraRef = lerReferencia(c.referenciaBruta);
    const p = prov('Chamados', c.linha, `A${c.linha}`);
    const issueIds: Uuid[] = [];

    if (leituraRef.multiplo) {
      const issue = criarIssue(
        ws,
        'identidade_composta',
        `Linha com mais de um chamado: ${c.referenciaBruta}`,
        `A célula A${c.linha} traz ${leituraRef.candidatos.length} identidades. O texto pessoal fica no grupo até a decisão de vinculação; ` +
          'os tickets oficiais não são fundidos e as notas não são duplicadas automaticamente.',
        [p],
        [
          ...leituraRef.candidatos.map((cand) => ({ chave: `vincular:${cand.normalizado}`, rotulo: `Vincular a ${cand.bruto}`, destrutiva: false })),
          { chave: 'manter_grupo', rotulo: 'Manter como grupo pessoal, sem vincular', destrutiva: false },
        ],
      );
      issues.push(issue);
      issueIds.push(issue.id);
    }

    const andamento = normalizarAndamentoPessoal(c.statusBruto);
    const dados: DadosEstadoPessoal = {
      referenciaBruta: c.referenciaBruta,
      tituloPessoal: c.tituloPessoal,
      andamentoPessoal: andamento.normalizado,
      andamentoPessoalBruto: andamento.bruto,
      prioridadePessoal: c.prioridade,
      categoriaFuncional: c.categoria,
      proximaAcao: c.proximaAcao,
      criadoEmPessoal: c.dataCriacao.data,
      atualizadoEmPessoal: c.ultimaAtualizacao.data,
      resolvidoEmPessoal: c.dataResolucao.data,
      rndBruto: c.rndBruto,
      responsavelPessoal: c.responsavel,
      observacoes: c.observacoes,
      proveniencia: p,
    };

    // Cronologia impossível vira pendência, sem excluir o registro (AC-045).
    if (c.dataCriacao.data && c.dataResolucao.data && diferencaEmDias(c.dataCriacao.data, c.dataResolucao.data) < 0) {
      const issue = criarIssue(
        ws,
        'data_incoerente',
        `Resolução anterior à criação em ${c.referenciaBruta}`,
        `A data de resolução (${c.dataResolucao.data}) é anterior à de criação (${c.dataCriacao.data}). ` +
          'O registro é preservado, mas fica fora dos indicadores de prazo até revisão.',
        [p],
        [
          { chave: 'excluir_do_indicador', rotulo: 'Manter o registro e excluir do indicador de prazo', destrutiva: false },
          { chave: 'corrigir_manual', rotulo: 'Corrigir manualmente', destrutiva: false },
        ],
      );
      issues.push(issue);
      issueIds.push(issue.id);
    }

    if (c.errosDeFormula.length > 0) {
      const issue = criarIssue(
        ws,
        'erro_formula',
        `Colunas calculadas com erro em ${c.referenciaBruta}`,
        `As células ${c.errosDeFormula.join(', ')} estavam com erro na planilha. Os campos digitados da linha continuam válidos e os ` +
          'indicadores derivados são recalculados pelo aplicativo.',
        [prov('Chamados', c.linha, undefined, { natureza: 'formula_error' })],
        [{ chave: 'recalcular', rotulo: 'Recalcular a partir das regras confirmadas', destrutiva: false }],
      );
      issues.push(issue);
      issueIds.push(issue.id);
    }

    const chaveFonte = `Chamados|${normalizarParaComparacao(c.referenciaBruta ?? '')}`;
    const anterior = linksAnteriores.get(chaveFonte);
    const atual = leituraRef.candidatos[0] ? estadosPorRef.get(leituraRef.candidatos[0].normalizado) : undefined;

    if (!atual) {
      itens.push({
        id: novoId(),
        classe: 'novo',
        entidade: 'personal_state',
        rotulo: c.referenciaBruta ?? `linha ${c.linha}`,
        descricao: c.tituloPessoal ?? 'Registro pessoal do cadastro',
        linhaOrigem: c.linha,
        campos: [],
        operacao: { tipo: 'criar_estado_pessoal', dados },
        incluidoPorPadrao: issueIds.length === 0,
        issueIds,
      });
      continue;
    }

    const base = (anterior?.ultimoValorImportado ?? {}) as Record<string, unknown>;
    const campos = conciliarCampos([
      { campo: 'tituloPessoal', rotulo: 'Título pessoal', base: base.tituloPessoal ?? null, origem: dados.tituloPessoal, aplicativo: atual.tituloPessoal, local: { aba: 'Chamados', linha: c.linha, celula: `B${c.linha}` } },
      { campo: 'andamentoPessoal', rotulo: 'Andamento pessoal', base: base.andamentoPessoal ?? null, origem: dados.andamentoPessoal, aplicativo: atual.andamentoPessoal, local: { aba: 'Chamados', linha: c.linha, celula: `C${c.linha}` } },
      { campo: 'prioridadePessoal', rotulo: 'Prioridade pessoal', base: base.prioridadePessoal ?? null, origem: dados.prioridadePessoal, aplicativo: atual.prioridadePessoal },
      { campo: 'proximaAcao', rotulo: 'Próxima ação', base: base.proximaAcao ?? null, origem: dados.proximaAcao, aplicativo: atual.proximaAcao, local: { aba: 'Chamados', linha: c.linha, celula: `I${c.linha}` } },
      { campo: 'categoriaFuncional', rotulo: 'Categoria', base: base.categoriaFuncional ?? null, origem: dados.categoriaFuncional, aplicativo: atual.categoriaFuncional },
      { campo: 'resolvidoEmPessoal', rotulo: 'Data de resolução pessoal', base: base.resolvidoEmPessoal ?? null, origem: dados.resolvidoEmPessoal, aplicativo: atual.resolvidoEmPessoal, local: { aba: 'Chamados', linha: c.linha, celula: `AG${c.linha}` } },
    ]);

    const conflito = campos.some((x) => x.resultado.conflito);
    const mudou = campos.some((x) => x.resultado.tipo === 'proposta_da_origem' || x.resultado.conflito);

    if (conflito) {
      const issue = criarIssue(
        ws,
        'divergencia_manual',
        `Divergência entre planilha e aplicativo em ${c.referenciaBruta}`,
        'A planilha e o aplicativo mudaram o mesmo campo de formas diferentes desde a última importação. A decisão é sua; o valor descartado fica na auditoria.',
        [p],
        [
          { chave: 'aceitar_origem', rotulo: 'Aceitar o valor da planilha', destrutiva: true },
          { chave: 'manter_aplicativo', rotulo: 'Manter o valor do aplicativo', destrutiva: true },
          { chave: 'adiar', rotulo: 'Adiar decisão', destrutiva: false },
        ],
      );
      issues.push(issue);
      issueIds.push(issue.id);
    }

    itens.push({
      id: novoId(),
      classe: conflito ? 'conflito' : mudou ? 'alterado' : 'igual',
      entidade: 'personal_state',
      rotulo: c.referenciaBruta ?? `linha ${c.linha}`,
      descricao: c.tituloPessoal ?? '',
      linhaOrigem: c.linha,
      campos,
      operacao: { tipo: 'atualizar_estado_pessoal', personalStateId: atual.id, campos },
      incluidoPorPadrao: mudou && !conflito,
      issueIds,
    });
  }

  /* -------- Apontamentos -------- */
  const candidatos: CandidatoOrigem[] = leitura.apontamentos.map((a) => ({
    linha: a.linha,
    workDate: a.workDate,
    referenciaBruta: a.referenciaBruta,
    descricao: a.descricao,
    duracaoMinutos: a.duracaoMinutos,
    tipoAtuacao: a.tipoAtuacao,
    observacoes: a.observacoes,
  }));

  const conhecidos: RegistroConhecido[] = revisao.sourceRecordLinks
    .filter((l) => l.entidade === 'time_entry')
    .map((l) => ({
      id: l.entidadeId,
      ultimoValorImportado: l.ultimoValorImportado as unknown as CandidatoOrigem,
      ocorrencia: l.ocorrencia,
    }));

  const correspondencias = casarPorMultiplicidade(candidatos, conhecidos);
  const repeticoes = detectarRepeticoesNaCarga(candidatos);
  const linhasRepetidas = new Set(repeticoes.flatMap((p) => [p.a.linha, p.b.linha]));

  for (const par of repeticoes) {
    issues.push(
      criarIssue(
        ws,
        'possivel_duplicata',
        `Possível repetição entre as linhas ${par.a.linha} e ${par.b.linha}`,
        `As duas linhas têm a mesma data, referência, descrição e duração (${par.a.duracaoMinutos} min). ` +
          'Enquanto a escolha não for feita, as duas ficam fora dos totais confirmados.',
        [prov('Apontamentos', par.a.linha), prov('Apontamentos', par.b.linha)],
        [
          { chave: 'manter_ambos', rotulo: 'Manter as duas (trabalho realmente repetido)', destrutiva: false },
          { chave: 'vincular_unico', rotulo: 'Tratar como um único evento', destrutiva: true },
          { chave: 'ignorar_segundo', rotulo: 'Ignorar a segunda ocorrência', destrutiva: true },
        ],
        (par.a.duracaoMinutos ?? 0) + (par.b.duracaoMinutos ?? 0),
      ),
    );
  }

  const porLinha = new Map(leitura.apontamentos.map((a) => [a.linha, a]));

  for (const corr of correspondencias) {
    if (corr.classe === 'ausente_na_carga') {
      itens.push({
        id: novoId(),
        classe: 'ausente_na_carga',
        entidade: 'time_entry',
        rotulo: corr.conhecido?.ultimoValorImportado.referenciaBruta ?? 'Atividade',
        descricao: corr.motivo,
        linhaOrigem: null,
        campos: [],
        operacao: { tipo: 'nenhuma' },
        incluidoPorPadrao: false,
        issueIds: [],
      });
      continue;
    }

    const a = porLinha.get(corr.candidato!.linha)!;
    const issueIds: Uuid[] = [];
    const p = prov('Apontamentos', a.linha, `A${a.linha}`, {
      valorBruto: a.duracaoBruta,
      natureza: a.descricaoCalculada ? 'formula_cached' : 'literal',
    });

    const leituraRef = lerReferencia(a.referenciaBruta);

    if (leituraRef.multiplo) {
      const issue = criarIssue(
        ws,
        'rateio_indefinido',
        `Atividade ligada a ${leituraRef.candidatos.length} chamados (linha ${a.linha})`,
        `Os ${a.duracaoMinutos ?? 0} minutos somam uma vez no dia e aparecem em cada chamado como "Compartilhado — sem rateio". ` +
          'Nenhum chamado recebe o total integral até você definir o rateio.',
        [p],
        [
          { chave: 'ratear', rotulo: 'Definir o rateio agora', destrutiva: false },
          { chave: 'manter_compartilhado', rotulo: 'Manter como compartilhado sem rateio', destrutiva: false },
        ],
      );
      issues.push(issue);
      issueIds.push(issue.id);
    }

    if (a.duracaoMinutos === null) {
      const issue = criarIssue(
        ws,
        a.problemaDuracao ? 'duracao_invalida' : 'duracao_ausente',
        `Atividade sem duração confirmada (linha ${a.linha})`,
        a.problemaDuracao ??
          'A linha não traz duração. O registro é preservado como incompleto e fica fora do total confirmado — não vira 0 nem 8 horas.',
        [p],
        [
          { chave: 'informar_duracao', rotulo: 'Informar a duração', destrutiva: false },
          { chave: 'manter_incompleto', rotulo: 'Manter como incompleto', destrutiva: false },
        ],
      );
      issues.push(issue);
      issueIds.push(issue.id);
    }

    if (a.referenciaBruta === null && a.duracaoMinutos !== null) {
      const citadas = referenciasCitadasEmTexto(a.descricao);
      const issue = criarIssue(
        ws,
        'referencia_sem_cadastro',
        `Esforço sem chamado informado (linha ${a.linha})`,
        citadas.length > 0
          ? `A descrição cita ${citadas.map((r) => r.bruto).join(' e ')}. São sugestões de vínculo — nenhuma é escolhida automaticamente.`
          : 'A linha tem duração válida e nenhuma referência. O esforço é preservado como atividade interna.',
        [p],
        [
          ...citadas.map((r) => ({ chave: `vincular:${r.normalizado}`, rotulo: `Vincular a ${r.bruto}`, destrutiva: false })),
          { chave: 'atividade_interna', rotulo: 'Manter como atividade interna', destrutiva: false },
        ],
      );
      issues.push(issue);
      issueIds.push(issue.id);
    }

    if (a.problemaData) {
      const issue = criarIssue(
        ws,
        'data_incoerente',
        `Data não reconhecida (linha ${a.linha})`,
        a.problemaData,
        [p],
        [{ chave: 'informar_data', rotulo: 'Informar a data de trabalho', destrutiva: false }],
        a.duracaoMinutos,
      );
      issues.push(issue);
      issueIds.push(issue.id);
    }

    if (a.errosDeFormula.length > 0) {
      const issue = criarIssue(
        ws,
        'erro_formula',
        `Agrupamentos com erro na linha ${a.linha}`,
        `As células ${a.errosDeFormula.join(', ')} estavam com erro. A data e a duração digitadas continuam válidas; ` +
          'mês, semana e ano são recalculados pelo aplicativo.',
        [prov('Apontamentos', a.linha, undefined, { natureza: 'formula_error' })],
        [{ chave: 'recalcular', rotulo: 'Recalcular agrupamentos', destrutiva: false }],
      );
      issues.push(issue);
      issueIds.push(issue.id);
    }

    if (a.temVinculoExterno) {
      const issue = criarIssue(
        ws,
        'origem_calculada',
        `Linha ${a.linha} depende de um arquivo externo`,
        'Esta linha tinha fórmula apontando para outro arquivo. Nenhum acesso externo foi feito; o valor usado é o que estava salvo.',
        [prov('Apontamentos', a.linha, undefined, { natureza: 'formula_cached', formula: '[vínculo externo]' })],
        [{ chave: 'aceitar_valor_salvo', rotulo: 'Aceitar o valor salvo', destrutiva: false }],
      );
      issues.push(issue);
      issueIds.push(issue.id);
    }

    if (a.descricaoCalculada) {
      const issue = criarIssue(
        ws,
        'origem_calculada',
        `Descrição calculada na linha ${a.linha}`,
        'A coluna C era uma fórmula de busca que devolvia o título do chamado, não uma descrição digitada do trabalho. ' +
          'O título de origem é preservado; a descrição do que foi feito pode ser complementada.',
        [prov('Apontamentos', a.linha, `C${a.linha}`, { natureza: 'formula_cached' })],
        [{ chave: 'confirmar_historico', rotulo: 'Confirmar como registro histórico', destrutiva: false }],
      );
      issues.push(issue);
      issueIds.push(issue.id);
    }

    // A consulta em F é status atual, não evento histórico daquele dia (AC-041).
    if (a.resultadoStatus.calculado) {
      const issue = criarIssue(
        ws,
        'origem_calculada',
        `Status calculado na linha ${a.linha}`,
        'A coluna F era uma consulta ao cadastro, portanto não representa o status daquele dia. Guardada como consulta calculada; ' +
          'nenhum evento de status histórico foi criado.',
        [prov('Apontamentos', a.linha, `F${a.linha}`, { natureza: 'formula_cached', formula: a.resultadoStatus.formula ?? undefined })],
        [{ chave: 'guardar_como_consulta', rotulo: 'Guardar como consulta calculada', destrutiva: false }],
      );
      issues.push(issue);
      issueIds.push(issue.id);
    }

    const sugestao = leituraRef.candidatos[0]
      ? opcoes.sugestoesDeCelula?.get(leituraRef.candidatos[0].normalizado)
      : undefined;
    // Sem evidência, o histórico vai para Sem classificação; nunca recebe a
    // célula de hoje retroativamente (secção 5.1).
    const celula: Celula = celulaEfetiva(null, sugestao?.forca === 'definida' ? sugestao.celula : null);

    const linhaDuplicada = linhasRepetidas.has(a.linha);
    const bloqueado = a.duracaoMinutos === null || a.workDate === null || linhaDuplicada;

    const dados: DadosApontamento = {
      workDate: a.workDate,
      descricao: a.descricao,
      duracaoMinutos: a.duracaoMinutos,
      tipoAtuacaoBruto: a.tipoAtuacao,
      celula,
      observacao: a.observacoes,
      lancamentoExterno: a.lancamentoExterno,
      referenciaBruta: a.referenciaBruta,
      estadoImportacao: bloqueado ? (a.duracaoMinutos === null ? 'incomplete' : 'needs_review') : 'ready',
      proveniencia: p,
    };

    if (!bloqueado && (corr.classe === 'novo' || corr.classe === 'alterado')) {
      minutosCandidatos += a.duracaoMinutos ?? 0;
    } else if (a.duracaoMinutos !== null && corr.classe !== 'igual') {
      minutosExcluidos += a.duracaoMinutos;
    }

    const classe: ClasseItem = linhaDuplicada
      ? 'possivel_duplicata'
      : corr.classe === 'ambiguo'
        ? 'conflito'
        : a.duracaoMinutos === null
          ? 'incompleto'
          : (corr.classe as ClasseItem);

    itens.push({
      id: novoId(),
      classe,
      entidade: 'time_entry',
      rotulo: a.referenciaBruta ?? `Atividade interna (linha ${a.linha})`,
      descricao: a.descricao ?? '',
      linhaOrigem: a.linha,
      campos: [],
      operacao:
        corr.classe === 'alterado' && corr.conhecido
          ? { tipo: 'atualizar_apontamento', timeEntryId: corr.conhecido.id, dados }
          : { tipo: 'criar_apontamento', dados },
      incluidoPorPadrao: !bloqueado && corr.classe !== 'igual' && corr.classe !== 'ambiguo',
      issueIds,
    });
  }

  /* -------- Abas complementares -------- */
  for (const f of leitura.followUps) {
    // Resultado vazio é desconhecido, nunca "sem resposta" (AC-052).
    const resultadoDesconhecido = f.resultado === null;
    if (resultadoDesconhecido) {
      issues.push(
        criarIssue(
          ws,
          'regra_followup_nao_confirmada',
          `Follow-up sem resultado registrado (linha ${f.linha})`,
          'O resultado está em branco: isso significa desconhecido, não "sem resposta". A tentativa não é contada como sem retorno.',
          [prov('Follow-ups', f.linha)],
          [{ chave: 'manter_desconhecido', rotulo: 'Manter como desconhecido', destrutiva: false }],
        ),
      );
    }
    itens.push({
      id: novoId(),
      classe: 'novo',
      entidade: 'follow_up',
      rotulo: f.referenciaBruta ?? `linha ${f.linha}`,
      descricao: f.descricao ?? 'Follow-up importado',
      linhaOrigem: f.linha,
      campos: [],
      operacao: { tipo: 'criar_followup', dados: { ...f, proveniencia: prov('Follow-ups', f.linha) } },
      incluidoPorPadrao: true,
      issueIds: [],
    });
  }

  for (const t of leitura.tarefas) {
    if (t.divergenciaStatusCheck) {
      issues.push(
        criarIssue(
          ws,
          'divergencia_manual',
          `Status e check divergentes na tarefa da linha ${t.linha}`,
          `O status diz "${t.status}" e o check de conclusão diz o contrário. Os dois valores originais são preservados.`,
          [prov('To Do Diário', t.linha)],
          [
            { chave: 'usar_status', rotulo: 'Considerar o status', destrutiva: false },
            { chave: 'usar_check', rotulo: 'Considerar o check', destrutiva: false },
          ],
        ),
      );
    }
    itens.push({
      id: novoId(),
      classe: 'novo',
      entidade: 'task',
      rotulo: t.tarefa ?? `linha ${t.linha}`,
      descricao: t.data.data ? `Para ${t.data.data}` : 'Sem data',
      linhaOrigem: t.linha,
      campos: [],
      operacao: { tipo: 'criar_tarefa', dados: { ...t, proveniencia: prov('To Do Diário', t.linha) } },
      incluidoPorPadrao: true,
      issueIds: [],
    });
  }

  for (const e of leitura.historicoStatus) {
    itens.push({
      id: novoId(),
      classe: 'novo',
      entidade: 'status_event',
      rotulo: e.referenciaBruta ?? `linha ${e.linha}`,
      descricao: `${e.statusAnterior ?? '—'} → ${e.novoStatus ?? '—'}`,
      linhaOrigem: e.linha,
      campos: [],
      operacao: { tipo: 'criar_evento_status', dados: { ...e, proveniencia: prov('Histórico Status', e.linha) } },
      incluidoPorPadrao: true,
      issueIds: [],
    });
  }

  const refsResolvidas = new Set(leitura.resolvidos.map((r) => normalizarParaComparacao(r.referenciaBruta ?? '')));
  for (const r of leitura.resolvidos) {
    itens.push({
      id: novoId(),
      classe: 'novo',
      entidade: 'resolution',
      rotulo: r.referenciaBruta ?? `linha ${r.linha}`,
      descricao: r.dataResolucao.data ? `Resolvido em ${r.dataResolucao.data}` : 'Resolução sem data conhecida',
      linhaOrigem: r.linha,
      campos: [],
      operacao: { tipo: 'criar_resolucao', dados: { ...r, proveniencia: prov('Resolvidos', r.linha) } },
      incluidoPorPadrao: true,
      issueIds: [],
    });
  }

  // Resolvido no cadastro sem registro correspondente: sem data fabricada (AC-043).
  const semRegistro = leitura.chamados.filter(
    (c) => (c.statusBruto ?? '').trim() === 'Resolvido' && !refsResolvidas.has(normalizarParaComparacao(c.referenciaBruta ?? '')),
  );
  if (semRegistro.length > 0) {
    issues.push(
      criarIssue(
        ws,
        'resolucao_sem_registro',
        `${semRegistro.length} chamados marcados como resolvidos sem registro de resolução`,
        `Estes chamados aparecem como Resolvido no cadastro, mas não têm linha correspondente na aba Resolvidos: ` +
          `${semRegistro.slice(0, 12).map((c) => c.referenciaBruta).join(', ')}${semRegistro.length > 12 ? '…' : ''}. ` +
          'Nenhuma data de resolução foi inventada.',
        semRegistro.slice(0, 12).map((c) => prov('Chamados', c.linha)),
        [
          { chave: 'informar_datas', rotulo: 'Informar as datas manualmente', destrutiva: false },
          { chave: 'manter_sem_data', rotulo: 'Manter como resolução sem data conhecida', destrutiva: false },
        ],
      ),
    );
  }

  for (const d of leitura.desenvolvimento) {
    itens.push({
      id: novoId(),
      classe: d.incompleto ? 'incompleto' : 'novo',
      entidade: 'development',
      rotulo: d.tema ?? `linha ${d.linha}`,
      descricao: d.descricao ?? '',
      linhaOrigem: d.linha,
      campos: [],
      // Registro sem data continua armazenado, com pendência (secção 4.8).
      operacao: { tipo: 'criar_desenvolvimento', dados: { ...d, proveniencia: prov('Meu desenvolvimento', d.linha) } },
      incluidoPorPadrao: true,
      issueIds: [],
    });
  }

  return {
    id: novoId(),
    criadaEm: agora(),
    revisaoBase: revisao.revisionId,
    documento,
    itens,
    issues,
    contagens: contarClasses(itens),
    minutosCandidatos,
    minutosExcluidosPorPendencia: minutosExcluidos,
    avisos,
  };
}

/* ================================================================== */
/* Validade da prévia                                                  */
/* ================================================================== */

export type ValidadeDaPrevia =
  | { valida: true }
  | { valida: false; motivo: 'revisao_mudou' | 'fonte_mudou'; detalhe: string };

/**
 * Antes de confirmar, revalida a fonte e a revisão-base (secção 8.1).
 * Se qualquer uma mudou, a prévia é invalidada — nunca aplicada por cima.
 */
export function validarPrevia(previa: Previa, revisaoAtual: Revision, hashFonteAtual: string): ValidadeDaPrevia {
  if (previa.revisaoBase !== revisaoAtual.revisionId) {
    return {
      valida: false,
      motivo: 'revisao_mudou',
      detalhe: 'A base mudou desde que esta prévia foi calculada. As diferenças precisam ser recalculadas antes de confirmar.',
    };
  }
  if (previa.documento.sha256 !== hashFonteAtual) {
    return {
      valida: false,
      motivo: 'fonte_mudou',
      detalhe: 'O arquivo de origem mudou durante a conferência. A prévia anterior foi descartada e será recalculada.',
    };
  }
  return { valida: true };
}

/* ================================================================== */
/* Aplicação: uma revisão atômica                                      */
/* ================================================================== */

export interface DecisoesDaCarga {
  /** IDs dos itens da prévia explicitamente aceitos. */
  itensAceitos: Set<string>;
  /** IDs de itens que a pessoa excluiu da carga. Não apaga registro existente. */
  itensExcluidos: Set<string>;
  /** Decisões por pendência. */
  decisoesDeIssues: Map<Uuid, { chave: string; motivo: string | null }>;
}

export interface ResultadoAplicacao {
  revisao: Revision;
  batch: ImportBatch;
  aplicados: number;
  ignorados: number;
  pendentes: number;
}

/**
 * Aplica a prévia sobre a revisão-base **em memória**, devolvendo uma revisão
 * nova. Nada é publicado aqui: a publicação é do adaptador de persistência.
 */
export function aplicarPrevia(
  revisaoBase: Revision,
  previa: Previa,
  decisoes: DecisoesDaCarga,
  operationId: string,
): ResultadoAplicacao {
  const r: Revision = estruturaClonada(revisaoBase);
  const instante = agora();

  r.revisionId = novoId();
  r.parentRevisionId = revisaoBase.revisionId;
  r.criadoEm = instante;

  if (!r.sourceDocuments.some((d) => d.sha256 === previa.documento.sha256 && d.tipo === previa.documento.tipo)) {
    r.sourceDocuments.push(previa.documento);
  }

  const batch: ImportBatch = {
    id: novoId(),
    sourceDocumentId: previa.documento.id,
    criadoEm: previa.criadaEm,
    confirmadoEm: instante,
    contagens: { ...previa.contagens },
    revisaoAplicada: r.revisionId,
  };

  let aplicados = 0;
  let ignorados = 0;

  const refParaTicket = new Map<string, Uuid>();
  for (const t of r.tickets) refParaTicket.set(t.referencia.normalizado, t.id);

  for (const item of previa.itens) {
    const aceito = decisoes.itensAceitos.has(item.id) && !decisoes.itensExcluidos.has(item.id);
    if (!aceito) {
      ignorados += 1;
      continue;
    }

    switch (item.operacao.tipo) {
      case 'criar_ticket': {
        r.tickets.push(item.operacao.ticket);
        refParaTicket.set(item.operacao.ticket.referencia.normalizado, item.operacao.ticket.id);
        aplicados += 1;
        break;
      }
      case 'atualizar_ticket': {
        const t = r.tickets.find((x) => x.id === (item.operacao as { ticketId: Uuid }).ticketId);
        if (t) {
          // Somente campos oficiais; nada pessoal é tocado (secção 5.1).
          t.oficial = item.operacao.oficial;
          t.versaoFonte = item.operacao.versaoFonte;
          t.versaoFonteInstante = instante;
          t.provisorio = false;
          t.atualizadoEm = instante;
          t.versao += 1;
          aplicados += 1;
        }
        break;
      }
      case 'criar_apontamento': {
        const d = item.operacao.dados;
        const id = novoId();
        const leituraRef = lerReferencia(d.referenciaBruta);
        r.timeEntries.push({
          id,
          workspaceId: r.workspace.id,
          workDate: d.workDate,
          descricao: d.descricao,
          duracaoMinutos: d.duracaoMinutos,
          tipoAtuacaoBruto: d.tipoAtuacaoBruto,
          tipoAtuacaoNormalizado: d.tipoAtuacaoBruto ? normalizarParaComparacao(d.tipoAtuacaoBruto) : null,
          celula: d.celula,
          celulaDefinidaPor: 'importacao',
          estadoOperacional: d.estadoImportacao === 'ready' ? 'confirmed' : 'draft',
          estadoImportacao: d.estadoImportacao,
          elegivelJornada: true,
          lancamentoExterno: d.lancamentoExterno,
          observacao: d.observacao,
          referencias: leituraRef.candidatos,
          proveniencia: [d.proveniencia],
          criadoEm: instante,
          atualizadoEm: instante,
          canceladoEm: null,
          motivoCancelamento: null,
          versao: 1,
        });

        for (const cand of leituraRef.candidatos) {
          r.timeEntryReferences.push({
            id: novoId(),
            timeEntryId: id,
            ticketId: refParaTicket.get(cand.normalizado) ?? null,
            groupId: null,
            referencia: cand,
          });
        }

        r.sourceRecordLinks.push(vinculoDeOrigem('time_entry', id, d, item.linhaOrigem, r));
        aplicados += 1;
        break;
      }
      case 'atualizar_apontamento': {
        const alvo = r.timeEntries.find((x) => x.id === (item.operacao as { timeEntryId: Uuid }).timeEntryId);
        const d = item.operacao.dados;
        if (alvo) {
          alvo.duracaoMinutos = d.duracaoMinutos;
          alvo.descricao = d.descricao;
          alvo.workDate = d.workDate;
          alvo.observacao = d.observacao;
          alvo.atualizadoEm = instante;
          alvo.versao += 1;
          alvo.proveniencia.push(d.proveniencia);
          const vinculo = r.sourceRecordLinks.find((l) => l.entidade === 'time_entry' && l.entidadeId === alvo.id);
          if (vinculo) {
            vinculo.ultimoValorImportado = paraValorImportado(d, item.linhaOrigem);
            vinculo.atualizadoEm = instante;
          }
          aplicados += 1;
        }
        break;
      }
      case 'criar_estado_pessoal': {
        const d = item.operacao.dados;
        const leituraRef = lerReferencia(d.referenciaBruta);
        const primeira = leituraRef.candidatos[0];
        const id = novoId();

        let groupId: Uuid | null = null;
        if (leituraRef.multiplo) {
          groupId = novoId();
          r.groups.push({
            id: groupId,
            workspaceId: r.workspace.id,
            referenciaBruta: leituraRef.bruto,
            candidatos: leituraRef.candidatos,
            // Sem vínculo automático: a fusão de identidades é decisão da pessoa.
            ticketIdsVinculados: [],
            proveniencia: [d.proveniencia],
            criadoEm: instante,
          });
        }

        r.personalStates.push({
          id,
          workspaceId: r.workspace.id,
          ticketId: !leituraRef.multiplo && primeira ? refParaTicket.get(primeira.normalizado) ?? null : null,
          groupId,
          tituloPessoal: d.tituloPessoal,
          andamentoPessoal: d.andamentoPessoal,
          andamentoPessoalBruto: d.andamentoPessoalBruto,
          prioridadePessoal: d.prioridadePessoal,
          categoriaFuncional: d.categoriaFuncional,
          celulaManual: null,
          celulaSugerida: null,
          proximaAcao: d.proximaAcao,
          prazo: null,
          estimativaMinutos: null,
          estimativaConfirmada: false,
          rndBruto: d.rndBruto,
          responsavelPessoal: d.responsavelPessoal,
          criadoEmPessoal: d.criadoEmPessoal,
          atualizadoEmPessoal: d.atualizadoEmPessoal,
          resolvidoEmPessoal: d.resolvidoEmPessoal,
          proveniencia: [d.proveniencia],
          criadoEm: instante,
          atualizadoEm: instante,
          versao: 1,
        });

        if (d.observacoes) {
          r.notes.push({
            id: novoId(),
            workspaceId: r.workspace.id,
            texto: d.observacoes,
            ticketIds: [],
            groupIds: groupId ? [groupId] : [],
            data: d.atualizadoEmPessoal,
            autoria: 'importacao',
            proveniencia: [d.proveniencia],
            criadoEm: instante,
          });
        }

        r.sourceRecordLinks.push({
          id: novoId(),
          sourceDocumentTipo: 'xlsm',
          chaveFonte: `Chamados|${normalizarParaComparacao(d.referenciaBruta ?? '')}`,
          entidade: 'personal_state',
          entidadeId: id,
          ultimoValorImportado: { ...d, proveniencia: undefined } as unknown as Record<string, unknown>,
          ocorrencia: 0,
          linhaOrigem: item.linhaOrigem,
          atualizadoEm: instante,
        });
        aplicados += 1;
        break;
      }
      case 'atualizar_estado_pessoal': {
        const alvo = r.personalStates.find((x) => x.id === (item.operacao as { personalStateId: Uuid }).personalStateId);
        if (alvo) {
          for (const campo of item.operacao.campos) {
            const res = campo.resultado;
            // Só propostas limpas são aplicadas; conflito exige decisão à parte.
            if (res.tipo === 'proposta_da_origem') {
              (alvo as unknown as Record<string, unknown>)[campo.campo] = (res as { valor: unknown }).valor;
            }
          }
          alvo.atualizadoEm = instante;
          alvo.versao += 1;
          aplicados += 1;
        }
        break;
      }
      case 'criar_followup': {
        const d = item.operacao.dados as Record<string, unknown>;
        r.followUps.push({
          id: novoId(),
          workspaceId: r.workspace.id,
          data: (d.data as { data: string | null })?.data ?? null,
          ticketId: null,
          groupId: null,
          referenciaBruta: (d.referenciaBruta as string) ?? null,
          descricao: (d.descricao as string) ?? null,
          tipo: (d.tipo as string) ?? null,
          tentativa: (d.tentativa as number) ?? null,
          canal: (d.canal as string) ?? null,
          responsavel: (d.responsavel as string) ?? null,
          resultado: (d.resultado as string) ?? null,
          dataResposta: (d.dataResposta as { data: string | null })?.data ?? null,
          proximaAcao: (d.proximaAcao as string) ?? null,
          resumo: (d.resumo as string) ?? null,
          statusNoMomento: (d.statusNoMomento as string) ?? null,
          proveniencia: [d.proveniencia as Proveniencia],
          criadoEm: instante,
        });
        aplicados += 1;
        break;
      }
      case 'criar_tarefa': {
        const d = item.operacao.dados as Record<string, unknown>;
        r.tasks.push({
          id: novoId(),
          workspaceId: r.workspace.id,
          titulo: (d.tarefa as string) ?? '',
          data: (d.data as { data: string | null })?.data ?? null,
          horario: (d.horario as string) ?? null,
          ticketId: null,
          referenciaBruta: (d.referenciaBruta as string) ?? null,
          prioridade: (d.prioridade as string) ?? null,
          status: (d.status as string) ?? null,
          concluida: (d.check as boolean) === true,
          divergenciaStatusCheck: (d.divergenciaStatusCheck as boolean) === true,
          observacao: (d.observacoes as string) ?? null,
          proveniencia: [d.proveniencia as Proveniencia],
          criadoEm: instante,
        });
        aplicados += 1;
        break;
      }
      case 'criar_evento_status': {
        const d = item.operacao.dados as Record<string, unknown>;
        r.statusEvents.push({
          id: novoId(),
          workspaceId: r.workspace.id,
          ticketId: null,
          referenciaBruta: (d.referenciaBruta as string) ?? null,
          dataHoraBruta: (d.dataHoraBruta as string) ?? null,
          data: (d.data as string) ?? null,
          statusAnterior: (d.statusAnterior as string) ?? null,
          novoStatus: (d.novoStatus as string) ?? null,
          usuarioLegado: (d.usuarioLegado as string) ?? null,
          observacao: (d.observacao as string) ?? null,
          origemEvento: 'pessoal_observado',
          proveniencia: [d.proveniencia as Proveniencia],
        });
        aplicados += 1;
        break;
      }
      case 'criar_resolucao': {
        const d = item.operacao.dados as Record<string, unknown>;
        r.resolutionEvents.push({
          id: novoId(),
          workspaceId: r.workspace.id,
          ticketId: null,
          referenciaBruta: (d.referenciaBruta as string) ?? null,
          dataResolucao: (d.dataResolucao as { data: string | null })?.data ?? null,
          statusFinal: (d.statusFinal as string) ?? null,
          // Snapshots derivados: guardados, nunca somados ao esforço (AC-028).
          snapshot: {
            tempoEmAberto: (d.tempoEmAberto as string) ?? null,
            horasApontadas: (d.horasApontadas as number) ?? null,
            qtdeApontamentos: (d.qtdeApontamentos as number) ?? null,
            fusRealizados: (d.fusRealizados as number) ?? null,
          },
          observacoes: (d.observacoes as string) ?? null,
          proveniencia: [d.proveniencia as Proveniencia],
        });
        aplicados += 1;
        break;
      }
      case 'criar_desenvolvimento': {
        const d = item.operacao.dados as Record<string, unknown>;
        r.developmentRecords.push({
          id: novoId(),
          workspaceId: r.workspace.id,
          data: (d.data as { data: string | null })?.data ?? null,
          tipoAtividade: (d.tipoAtividade as string) ?? null,
          tema: (d.tema as string) ?? null,
          descricao: (d.descricao as string) ?? null,
          pessoaArea: (d.pessoaArea as string) ?? null,
          resultado: (d.resultado as string) ?? null,
          competencia: (d.competencia as string) ?? null,
          relevanciaOneOnOne: (d.relevancia as string) ?? null,
          proximoPasso: (d.proximoPasso as string) ?? null,
          status: (d.status as string) ?? null,
          incompleto: (d.incompleto as boolean) === true,
          proveniencia: [d.proveniencia as Proveniencia],
          criadoEm: instante,
        });
        aplicados += 1;
        break;
      }
      case 'nenhuma':
        ignorados += 1;
        break;
    }
  }

  // Pendências entram na revisão; as decididas guardam a decisão e o descartado.
  for (const issue of previa.issues) {
    const decisao = decisoes.decisoesDeIssues.get(issue.id);
    r.issues.push(
      decisao
        ? {
            ...issue,
            estado: decisao.chave === 'adiar' ? 'adiada' : 'decidida',
            decisao: { chave: decisao.chave, motivo: decisao.motivo, autoria: 'pessoa', decididoEm: instante },
          }
        : issue,
    );
  }

  r.importBatches.push(batch);
  r.audit.push({
    id: novoId(),
    operationId,
    operacao: 'commitImport',
    antes: { revisionId: revisaoBase.revisionId, tickets: revisaoBase.tickets.length, apontamentos: revisaoBase.timeEntries.length },
    depois: { revisionId: r.revisionId, tickets: r.tickets.length, apontamentos: r.timeEntries.length },
    revisaoBase: revisaoBase.revisionId,
    autoria: 'pessoa',
    horarioTecnico: instante,
  });

  return {
    revisao: r,
    batch,
    aplicados,
    ignorados,
    pendentes: previa.issues.filter((i) => !decisoes.decisoesDeIssues.has(i.id)).length,
  };
}

function paraValorImportado(d: DadosApontamento, linha: number | null): Record<string, unknown> {
  return {
    linha,
    workDate: d.workDate,
    referenciaBruta: d.referenciaBruta,
    descricao: d.descricao,
    duracaoMinutos: d.duracaoMinutos,
    tipoAtuacao: d.tipoAtuacaoBruto,
    observacoes: d.observacao,
  };
}

function vinculoDeOrigem(
  entidade: SourceRecordLink['entidade'],
  entidadeId: Uuid,
  d: DadosApontamento,
  linha: number | null,
  r: Revision,
): SourceRecordLink {
  const valor = paraValorImportado(d, linha);
  const chave = [
    d.workDate ?? '',
    normalizarParaComparacao(d.referenciaBruta ?? ''),
    normalizarParaComparacao(d.descricao ?? ''),
    normalizarParaComparacao(d.tipoAtuacaoBruto ?? ''),
  ].join('|');
  // Multiplicidade: a n-ésima ocorrência da mesma chave recebe o ordinal n.
  const ocorrencia = r.sourceRecordLinks.filter((l) => l.entidade === entidade && l.chaveFonte === chave).length;
  return {
    id: novoId(),
    sourceDocumentTipo: 'xlsm',
    chaveFonte: chave,
    entidade,
    entidadeId,
    ultimoValorImportado: valor,
    ocorrencia,
    linhaOrigem: linha,
    atualizadoEm: agora(),
  };
}

function estruturaClonada<T>(valor: T): T {
  return typeof structuredClone === 'function' ? structuredClone(valor) : (JSON.parse(JSON.stringify(valor)) as T);
}
