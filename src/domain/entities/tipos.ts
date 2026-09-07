/**
 * Tipos do domínio da Central de Chamados.
 *
 * Regra estrutural da especificação (secção 5): tudo pertence a um único
 * `workspaceId`; IDs internos são UUID; data de trabalho é `YYYY-MM-DD` e
 * timestamps técnicos são ISO 8601 com fuso. Campos oficiais (CS3) e campos
 * pessoais (XLSM / aplicativo) nunca compartilham o mesmo slot.
 */

export type Uuid = string;
/** Data civil de trabalho, `YYYY-MM-DD`. Nunca convertida para UTC. */
export type WorkDate = string;
/** Instante técnico, ISO 8601 com fuso. */
export type Instant = string;

export const CELULAS = ['AMS', 'SQUAD', 'TASK_FORCE', 'GENERAL', 'UNCLASSIFIED'] as const;
export type Celula = (typeof CELULAS)[number];

export const ROTULO_CELULA: Record<Celula, string> = {
  AMS: 'AMS',
  SQUAD: 'Squad de melhoria',
  TASK_FORCE: 'Task Force',
  GENERAL: 'Geral / transversal',
  UNCLASSIFIED: 'Sem classificação',
};

/** Namespaces de identidade externa. Não são intercambiáveis (secção 8.5). */
export const NAMESPACES = ['IR', 'RR', 'INC', 'RITM', 'SCTASK', 'CR', 'OUTRO'] as const;
export type Namespace = (typeof NAMESPACES)[number];

/** Tipo oficial do ticket, determinado pelo esquema do CSV — nunca pelo texto. */
export type TicketType = 'incident' | 'request';

/** Estado de um registro vindo de importação (secção 6.3). */
export type EstadoImportacao = 'ready' | 'incomplete' | 'needs_review' | 'ignored';
/** Estado operacional de um registro (secção 6.3). Não se mistura com o de importação. */
export type EstadoOperacional = 'draft' | 'confirmed' | 'cancelled';

/** Origem de um valor. Guardada para toda informação relevante (secção 5.2). */
export type Origem = 'cs3_csv' | 'xlsm' | 'app' | 'derived';

export interface Proveniencia {
  origem: Origem;
  /** Identificador do lote de importação que trouxe o valor. */
  importBatchId?: Uuid;
  /** Nome do arquivo observado. Rastreabilidade, não identidade. */
  arquivo?: string;
  sha256?: string;
  perfil?: string;
  aba?: string;
  linha?: number;
  celulaPlanilha?: string;
  /** Valor bruto exatamente como lido. */
  valorBruto?: string | number | boolean | null;
  /** Natureza do que estava na célula. */
  natureza?: 'literal' | 'formula_cached' | 'formula_error' | 'empty';
  formula?: string;
  /** Normalização aplicada antes de salvar. */
  normalizacao?: string;
  observadoEm?: Instant;
}

export interface ReferenciaExterna {
  /** Texto exatamente como aparecia na fonte. */
  bruto: string;
  namespace: Namespace;
  /** Identificador normalizado para comparação (maiúsculas, sem espaços externos). */
  normalizado: string;
}

/* ------------------------------------------------------------------ */
/* Entidades                                                           */
/* ------------------------------------------------------------------ */

export interface Ticket {
  id: Uuid;
  workspaceId: Uuid;
  /** Identidade oficial: sourceSystem + ticketType + sourceTicketId. */
  sourceSystem: 'CS3' | null;
  ticketType: TicketType | null;
  sourceTicketId: string | null;
  /** Verdadeiro enquanto só existir referência pessoal, sem linha oficial. */
  provisorio: boolean;
  referencia: ReferenciaExterna;
  /** Campos oficiais, atualizáveis apenas por CSV CS3 mais recente. */
  oficial: CamposOficiaisCs3 | null;
  /** Versão da fonte oficial já aplicada (bruto de `Last Update Time`). */
  versaoFonte: string | null;
  versaoFonteInstante: Instant | null;
  proveniencia: Proveniencia[];
  criadoEm: Instant;
  atualizadoEm: Instant;
  versao: number;
}

export interface CamposOficiaisCs3 {
  title: string;
  statusBruto: string;
  assignedTo: string | null;
  startTimeBruto: string | null;
  lastUpdateTimeBruto: string;
  priority: string | null;
  impact: string | null;
  complexity: string | null;
  assignmentGroup: string | null;
  external: string | null;
  referenceId: string | null;
  reportedBy: string | null;
  reportedCi: string | null;
  deviceCi: string | null;
  affectedCi: string | null;
  tags: (string | null)[];
  typeBruto: string | null;
  escalationStatus: string | null;
  lastUsedKnowledgeSource: string | null;
  /** Colunas desconhecidas preservadas como metadado (secção 8.2). */
  extras: Record<string, string>;
}

/** Estado pessoal. Nunca sobrescrito pelo atualizador CS3 (secção 5.1). */
export interface PersonalTicketState {
  id: Uuid;
  workspaceId: Uuid;
  ticketId: Uuid | null;
  groupId: Uuid | null;
  tituloPessoal: string | null;
  andamentoPessoal: string | null;
  andamentoPessoalBruto: string | null;
  prioridadePessoal: string | null;
  categoriaFuncional: string | null;
  celulaManual: Celula | null;
  celulaSugerida: Celula | null;
  proximaAcao: string | null;
  prazo: WorkDate | null;
  estimativaMinutos: number | null;
  estimativaConfirmada: boolean;
  /** Texto de RND preservado integralmente, sem virar horas (secção 7). */
  rndBruto: string | null;
  responsavelPessoal: string | null;
  criadoEmPessoal: WorkDate | null;
  atualizadoEmPessoal: WorkDate | null;
  resolvidoEmPessoal: WorkDate | null;
  proveniencia: Proveniencia[];
  criadoEm: Instant;
  atualizadoEm: Instant;
  versao: number;
}

/** Agrupamento pessoal quando uma linha traz mais de um ID (secção 10.3). */
export interface TicketGroup {
  id: Uuid;
  workspaceId: Uuid;
  referenciaBruta: string;
  candidatos: ReferenciaExterna[];
  /** Vínculos confirmados pela pessoa; vazio significa decisão pendente. */
  ticketIdsVinculados: Uuid[];
  proveniencia: Proveniencia[];
  criadoEm: Instant;
}

export interface Note {
  id: Uuid;
  workspaceId: Uuid;
  texto: string;
  ticketIds: Uuid[];
  groupIds: Uuid[];
  data: WorkDate | null;
  autoria: 'pessoa' | 'importacao';
  proveniencia: Proveniencia[];
  criadoEm: Instant;
}

export interface TimeEntry {
  id: Uuid;
  workspaceId: Uuid;
  workDate: WorkDate | null;
  descricao: string | null;
  /** Minutos inteiros positivos, ou null quando incompleto. */
  duracaoMinutos: number | null;
  tipoAtuacaoBruto: string | null;
  tipoAtuacaoNormalizado: string | null;
  /** Fotografia histórica: pertence ao apontamento, não ao ticket (secção 5.1). */
  celula: Celula;
  celulaDefinidaPor: 'importacao' | 'pessoa' | 'padrao';
  estadoOperacional: EstadoOperacional;
  estadoImportacao: EstadoImportacao;
  /** Falso exclui o registro da jornada, mas não o apaga. */
  elegivelJornada: boolean;
  /** Anotação pessoal `LANÇADO`. Nunca confirmação técnica (secção 6.3). */
  lancamentoExterno: 'reported_posted' | null;
  observacao: string | null;
  /** Referências informativas; não implicam horas por ticket. */
  referencias: ReferenciaExterna[];
  proveniencia: Proveniencia[];
  criadoEm: Instant;
  atualizadoEm: Instant;
  canceladoEm: Instant | null;
  motivoCancelamento: string | null;
  versao: number;
}

/** Vínculo informativo entre atividade e referência. Sem horas implícitas. */
export interface TimeEntryReference {
  id: Uuid;
  timeEntryId: Uuid;
  ticketId: Uuid | null;
  groupId: Uuid | null;
  referencia: ReferenciaExterna;
}

/** Alocação explícita de minutos a um ticket (secção 6.2). */
export interface TimeAllocation {
  id: Uuid;
  timeEntryId: Uuid;
  ticketId: Uuid;
  minutos: number;
  confirmadaEm: Instant;
}

export interface FollowUp {
  id: Uuid;
  workspaceId: Uuid;
  data: WorkDate | null;
  ticketId: Uuid | null;
  groupId: Uuid | null;
  referenciaBruta: string | null;
  descricao: string | null;
  tipo: string | null;
  tentativa: number | null;
  canal: string | null;
  responsavel: string | null;
  /** Vazio significa desconhecido — nunca "sem resposta" (secção 10.5). */
  resultado: string | null;
  dataResposta: WorkDate | null;
  proximaAcao: string | null;
  resumo: string | null;
  statusNoMomento: string | null;
  proveniencia: Proveniencia[];
  criadoEm: Instant;
}

export interface Task {
  id: Uuid;
  workspaceId: Uuid;
  titulo: string;
  data: WorkDate | null;
  horario: string | null;
  ticketId: Uuid | null;
  referenciaBruta: string | null;
  prioridade: string | null;
  status: string | null;
  concluida: boolean;
  /** Verdadeiro quando status e check divergiam na origem (secção 10.5). */
  divergenciaStatusCheck: boolean;
  observacao: string | null;
  proveniencia: Proveniencia[];
  criadoEm: Instant;
}

export interface StatusEvent {
  id: Uuid;
  workspaceId: Uuid;
  ticketId: Uuid | null;
  referenciaBruta: string | null;
  dataHoraBruta: string | null;
  data: WorkDate | null;
  statusAnterior: string | null;
  novoStatus: string | null;
  /** Usuário registrado no legado, distinto de quem importou. */
  usuarioLegado: string | null;
  observacao: string | null;
  origemEvento: 'pessoal_observado' | 'oficial_observado';
  proveniencia: Proveniencia[];
}

export interface ResolutionEvent {
  id: Uuid;
  workspaceId: Uuid;
  ticketId: Uuid | null;
  referenciaBruta: string | null;
  dataResolucao: WorkDate | null;
  statusFinal: string | null;
  /** Snapshots do legado. Derivados: nunca somam esforço (secção 10.5). */
  snapshot: {
    tempoEmAberto: string | null;
    horasApontadas: number | null;
    qtdeApontamentos: number | null;
    fusRealizados: number | null;
  };
  observacoes: string | null;
  proveniencia: Proveniencia[];
}

export interface DevelopmentRecord {
  id: Uuid;
  workspaceId: Uuid;
  data: WorkDate | null;
  tipoAtividade: string | null;
  tema: string | null;
  descricao: string | null;
  pessoaArea: string | null;
  resultado: string | null;
  competencia: string | null;
  relevanciaOneOnOne: string | null;
  proximoPasso: string | null;
  status: string | null;
  /** Registro sem data continua armazenado, com pendência (secção 4.8). */
  incompleto: boolean;
  proveniencia: Proveniencia[];
  criadoEm: Instant;
}

export interface Schedule {
  /** Minutos-meta por dia da semana, 0 = domingo. */
  metaPorDiaSemana: [number, number, number, number, number, number, number];
  /** Antes desta data não se gera pendência de jornada (secção 6). */
  inicioControle: WorkDate | null;
  fusoTrabalho: string;
}

export interface CalendarException {
  data: WorkDate;
  metaMinutos: number;
  motivo: string;
}

/** Saldo anterior identificado. Nunca entra na jornada (secção 6.2). */
export interface OpeningBalance {
  id: Uuid;
  ticketId: Uuid | null;
  referenciaBruta: string | null;
  minutos: number;
  dataCorte: WorkDate | null;
  escopo: string;
  proveniencia: Proveniencia[];
}

export interface SourceDocument {
  id: Uuid;
  tipo: 'csv_incidentes' | 'csv_requisicoes' | 'xlsm';
  nomeArquivo: string;
  origem: 'upload_local' | 'onedrive';
  driveId?: string;
  itemId?: string;
  sha256: string;
  tamanhoBytes: number;
  perfil: string;
  lidoEm: Instant;
}

export interface ImportBatch {
  id: Uuid;
  sourceDocumentId: Uuid;
  criadoEm: Instant;
  confirmadoEm: Instant | null;
  contagens: Record<string, number>;
  revisaoAplicada: string | null;
}

/** Identidade de um registro importado e sua última versão conhecida. */
export interface SourceRecordLink {
  id: Uuid;
  sourceDocumentTipo: SourceDocument['tipo'];
  /** Chave de identidade estável dentro daquela fonte. */
  chaveFonte: string;
  entidade: 'ticket' | 'time_entry' | 'follow_up' | 'task' | 'status_event' | 'resolution' | 'development' | 'personal_state';
  entidadeId: Uuid;
  /** Estado B da comparação em três estados (secção 8.4). */
  ultimoValorImportado: Record<string, unknown>;
  /** Ordinal quando a mesma chave aparece mais de uma vez (multiplicidade). */
  ocorrencia: number;
  linhaOrigem: number | null;
  atualizadoEm: Instant;
}

export type TipoPendencia =
  | 'identidade_composta'
  | 'referencia_sem_cadastro'
  | 'possivel_duplicata'
  | 'duracao_ausente'
  | 'duracao_invalida'
  | 'rateio_indefinido'
  | 'data_incoerente'
  | 'status_desconhecido'
  | 'divergencia_manual'
  | 'origem_calculada'
  | 'erro_formula'
  | 'regra_followup_nao_confirmada'
  | 'coluna_desconhecida'
  | 'resolucao_sem_registro'
  | 'conflito_snapshot_resolucao';

export interface ReconciliationIssue {
  id: Uuid;
  workspaceId: Uuid;
  tipo: TipoPendencia;
  titulo: string;
  /** O que ocorreu, em português, sem exceção técnica bruta. */
  descricao: string;
  /** Impacto no total: minutos excluídos dos confirmados, quando houver. */
  impactoMinutos: number | null;
  evidencia: Proveniencia[];
  entidade?: { tipo: string; id: Uuid };
  opcoes: OpcaoDecisao[];
  decisao: DecisaoPendencia | null;
  estado: 'aberta' | 'decidida' | 'adiada' | 'ignorada';
  criadoEm: Instant;
}

export interface OpcaoDecisao {
  chave: string;
  rotulo: string;
  /** Verdadeiro quando a opção descarta informação. Nunca aplicada em lote cego. */
  destrutiva: boolean;
}

export interface DecisaoPendencia {
  chave: string;
  motivo: string | null;
  autoria: 'pessoa';
  decididoEm: Instant;
  /** Valor descartado, guardado na auditoria (secção 8.4). */
  valorDescartado?: unknown;
}

export interface AuditEvent {
  id: Uuid;
  operationId: string;
  operacao: string;
  antes: unknown;
  depois: unknown;
  revisaoBase: string | null;
  autoria: string;
  horarioTecnico: Instant;
}

export interface OperationReceipt {
  operationId: string;
  operacao: string;
  resultado: 'confirmado' | 'conflito' | 'invalido';
  revisaoPublicada: string | null;
  em: Instant;
}

export interface Workspace {
  id: Uuid;
  schemaVersion: number;
  /** Identidade Microsoft associada. Uma segunda conta nunca lê esta base. */
  contaHomeId: string | null;
  driveId: string | null;
  nome: string;
  schedule: Schedule;
  excecoesCalendario: CalendarException[];
  /** Fuso das fontes CSV. Null = ainda não informado; não adivinhar. */
  fusoFonteCsv: string | null;
  regrasFollowUp: { ruleStatus: 'unconfirmed' | 'confirmed'; cadenciaDias: number | null; limiteTentativas: number | null };
  mapaStatusCs3: Record<string, string>;
  criadoEm: Instant;
}

/** Documento de estado completo e imutável (secção 16.1). */
export interface Revision {
  revisionId: Uuid;
  schemaVersion: number;
  workspaceId: Uuid;
  /** Revisão de que esta descende. Null apenas na inicialização. */
  parentRevisionId: Uuid | null;
  criadoEm: Instant;
  workspace: Workspace;
  tickets: Ticket[];
  personalStates: PersonalTicketState[];
  groups: TicketGroup[];
  notes: Note[];
  timeEntries: TimeEntry[];
  timeEntryReferences: TimeEntryReference[];
  allocations: TimeAllocation[];
  followUps: FollowUp[];
  tasks: Task[];
  statusEvents: StatusEvent[];
  resolutionEvents: ResolutionEvent[];
  developmentRecords: DevelopmentRecord[];
  openingBalances: OpeningBalance[];
  sourceDocuments: SourceDocument[];
  importBatches: ImportBatch[];
  sourceRecordLinks: SourceRecordLink[];
  issues: ReconciliationIssue[];
  audit: AuditEvent[];
  receipts: OperationReceipt[];
}

/** Ponteiro curto guardado no `description` da pasta `state-head` (secção 16.1). */
export interface RevisionPointer {
  version: 1;
  workspaceId: Uuid;
  revisionId: Uuid;
  itemId: string;
  sha256: string;
}

export const LIMITE_PONTEIRO_CARACTERES = 768;
export const SCHEMA_VERSION = 1;
