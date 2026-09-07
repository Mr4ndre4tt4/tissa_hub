/**
 * Criação e validação de revisões.
 *
 * Uma revisão é um documento de estado **completo e imutável** (secção 16.1).
 * Publicar é trocar um único ponteiro remoto; nada aqui grava em lugar nenhum.
 */

import {
  LIMITE_PONTEIRO_CARACTERES,
  SCHEMA_VERSION,
  type Revision,
  type RevisionPointer,
  type Uuid,
  type Workspace,
} from './tipos';
import { MAPA_STATUS_CS3 } from './celulas';

export function novoWorkspace(nome = 'Central de Chamados', id: Uuid = globalThis.crypto.randomUUID()): Workspace {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    contaHomeId: null,
    driveId: null,
    nome,
    schedule: {
      // Padrão configurável, não inferência do calendário real (secção 6).
      metaPorDiaSemana: [0, 480, 480, 480, 480, 480, 0],
      inicioControle: null,
      fusoTrabalho: 'America/Sao_Paulo',
    },
    excecoesCalendario: [],
    // Null significa "ainda não informado": não se adivinha o fuso da fonte.
    fusoFonteCsv: null,
    regrasFollowUp: { ruleStatus: 'unconfirmed', cadenciaDias: null, limiteTentativas: null },
    mapaStatusCs3: { ...MAPA_STATUS_CS3 },
    criadoEm: new Date().toISOString(),
  };
}

export function revisaoInicial(workspace: Workspace): Revision {
  return {
    revisionId: globalThis.crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    workspaceId: workspace.id,
    parentRevisionId: null,
    criadoEm: new Date().toISOString(),
    workspace,
    tickets: [],
    personalStates: [],
    groups: [],
    notes: [],
    timeEntries: [],
    timeEntryReferences: [],
    allocations: [],
    followUps: [],
    tasks: [],
    statusEvents: [],
    resolutionEvents: [],
    developmentRecords: [],
    openingBalances: [],
    sourceDocuments: [],
    importBatches: [],
    sourceRecordLinks: [],
    issues: [],
    audit: [],
    receipts: [],
  };
}

export interface ProblemaDeInvariante {
  codigo: string;
  detalhe: string;
}

/**
 * Invariantes verificadas antes de publicar qualquer revisão (secção 5.1).
 * Uma revisão que falhe aqui nunca é publicada.
 */
export function validarInvariantes(r: Revision): ProblemaDeInvariante[] {
  const problemas: ProblemaDeInvariante[] = [];

  if (r.schemaVersion !== SCHEMA_VERSION) {
    problemas.push({ codigo: 'schema', detalhe: `Versão de schema inesperada: ${r.schemaVersion}.` });
  }
  if (r.workspaceId !== r.workspace.id) {
    problemas.push({ codigo: 'workspace', detalhe: 'A revisão aponta para um workspace diferente do que carrega.' });
  }

  // Identidade oficial única.
  const vistas = new Set<string>();
  for (const t of r.tickets) {
    if (t.workspaceId !== r.workspace.id) {
      problemas.push({ codigo: 'workspace_ticket', detalhe: `O chamado ${t.id} pertence a outro workspace.` });
    }
    if (!t.sourceSystem || !t.ticketType || !t.sourceTicketId) continue;
    const chave = `${t.sourceSystem}|${t.ticketType}|${t.sourceTicketId.toUpperCase()}`;
    if (vistas.has(chave)) {
      problemas.push({ codigo: 'identidade_duplicada', detalhe: `Identidade oficial repetida: ${chave}.` });
    }
    vistas.add(chave);
  }

  // Duração confirmada é inteiro positivo; null é incompleto.
  for (const e of r.timeEntries) {
    const d = e.duracaoMinutos;
    if (d !== null && (!Number.isInteger(d) || d <= 0)) {
      problemas.push({ codigo: 'duracao', detalhe: `Apontamento ${e.id} tem duração inválida: ${d}.` });
    }
    if (e.estadoOperacional === 'confirmed' && d === null) {
      problemas.push({ codigo: 'confirmado_sem_duracao', detalhe: `Apontamento ${e.id} está confirmado sem duração.` });
    }
  }

  // A soma de um rateio, quando existir, tem de bater com a duração.
  const porEntrada = new Map<Uuid, number>();
  for (const a of r.allocations) {
    porEntrada.set(a.timeEntryId, (porEntrada.get(a.timeEntryId) ?? 0) + a.minutos);
    if (!Number.isInteger(a.minutos) || a.minutos <= 0) {
      problemas.push({ codigo: 'alocacao', detalhe: `Alocação ${a.id} não é um inteiro positivo.` });
    }
  }
  for (const [entradaId, soma] of porEntrada) {
    const e = r.timeEntries.find((x) => x.id === entradaId);
    if (e && e.duracaoMinutos !== null && soma !== e.duracaoMinutos) {
      problemas.push({
        codigo: 'rateio_nao_fecha',
        detalhe: `O rateio do apontamento ${entradaId} soma ${soma} min e a atividade tem ${e.duracaoMinutos} min.`,
      });
    }
  }

  // Nenhuma data pode acumular mais de 1.440 minutos confirmados.
  const porData = new Map<string, number>();
  for (const e of r.timeEntries) {
    if (e.estadoOperacional !== 'confirmed' || e.canceladoEm !== null || !e.workDate || e.duracaoMinutos === null) continue;
    porData.set(e.workDate, (porData.get(e.workDate) ?? 0) + e.duracaoMinutos);
  }
  for (const [data, minutos] of porData) {
    if (minutos > 1440) {
      problemas.push({ codigo: 'dia_acima_de_24h', detalhe: `A data ${data} acumula ${minutos} minutos confirmados.` });
    }
  }

  // Alocações e referências têm de apontar para entidades existentes.
  const idsEntradas = new Set(r.timeEntries.map((e) => e.id));
  const idsTickets = new Set(r.tickets.map((t) => t.id));
  for (const a of r.allocations) {
    if (!idsEntradas.has(a.timeEntryId)) problemas.push({ codigo: 'alocacao_orfa', detalhe: `Alocação ${a.id} sem apontamento.` });
    if (!idsTickets.has(a.ticketId)) problemas.push({ codigo: 'alocacao_orfa', detalhe: `Alocação ${a.id} sem chamado.` });
  }
  for (const ref of r.timeEntryReferences) {
    if (!idsEntradas.has(ref.timeEntryId)) problemas.push({ codigo: 'referencia_orfa', detalhe: `Vínculo ${ref.id} sem apontamento.` });
    if (ref.ticketId !== null && !idsTickets.has(ref.ticketId)) {
      problemas.push({ codigo: 'referencia_orfa', detalhe: `Vínculo ${ref.id} aponta para um chamado inexistente.` });
    }
  }

  return problemas;
}

export function serializarPonteiro(p: RevisionPointer): string {
  const texto = JSON.stringify(p);
  if (texto.length > LIMITE_PONTEIRO_CARACTERES) {
    throw new Error(`O ponteiro tem ${texto.length} caracteres e o limite deste projeto é ${LIMITE_PONTEIRO_CARACTERES}.`);
  }
  return texto;
}

export function lerPonteiro(texto: string | null | undefined): RevisionPointer | null {
  if (!texto || texto.trim().length === 0) return null;
  try {
    const p = JSON.parse(texto) as RevisionPointer;
    if (p?.version !== 1 || !p.revisionId || !p.workspaceId || !p.itemId || !p.sha256) return null;
    return p;
  } catch {
    return null;
  }
}
