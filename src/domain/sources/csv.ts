/**
 * Parser de CSV e perfil das extrações CS3.
 *
 * Regras da secção 9:
 *  - Reconhecimento por **cabeçalho**, nunca por nome de arquivo ou título.
 *  - UTF-8 com BOM; ponto e vírgula; campos entre aspas; aspas escapadas
 *    duplicando; quebra de linha dentro de campo.
 *  - Aceitar mudança de ordem das colunas.
 *  - Cabeçalhos duplicados ou obrigatórios ausentes **bloqueiam** a carga.
 *  - Falha num formato não autoriza tratar o arquivo como o outro.
 *
 * O arquivo é dado não confiável: nada aqui executa, resolve ou segue conteúdo.
 */

import type { CamposOficiaisCs3, TicketType } from '../entities/tipos';
import { lerCarimboCs3 } from '../time/datas';
import { normalizarParaComparacao } from '../entities/identidade';

export interface LinhaCsv {
  /** Número da linha física no arquivo, 1-based. Rastreabilidade, não identidade. */
  linha: number;
  campos: string[];
}

/**
 * Parser de verdade: percorre caractere a caractere respeitando aspas.
 * `split(';')` quebraria em qualquer campo com ponto e vírgula ou quebra de linha.
 */
export function analisarCsv(texto: string, delimitador = ';'): LinhaCsv[] {
  // Remove o BOM UTF-8, se presente.
  const conteudo = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;

  const linhas: LinhaCsv[] = [];
  let campos: string[] = [];
  let atual = '';
  let dentroDeAspas = false;
  let linhaFisica = 1;
  let linhaInicioRegistro = 1;
  let temConteudo = false;

  for (let i = 0; i < conteudo.length; i += 1) {
    const c = conteudo[i]!;

    if (dentroDeAspas) {
      if (c === '"') {
        if (conteudo[i + 1] === '"') {
          atual += '"'; // aspas escapadas por duplicação
          i += 1;
        } else {
          dentroDeAspas = false;
        }
      } else {
        if (c === '\n') linhaFisica += 1; // quebra de linha dentro do campo
        atual += c;
      }
      continue;
    }

    if (c === '"' && atual.length === 0) {
      dentroDeAspas = true;
      temConteudo = true;
      continue;
    }
    if (c === delimitador) {
      campos.push(atual);
      atual = '';
      temConteudo = true;
      continue;
    }
    if (c === '\r') continue;
    if (c === '\n') {
      campos.push(atual);
      if (temConteudo || campos.length > 1 || campos[0] !== '') {
        linhas.push({ linha: linhaInicioRegistro, campos });
      }
      campos = [];
      atual = '';
      linhaFisica += 1;
      linhaInicioRegistro = linhaFisica;
      temConteudo = false;
      continue;
    }
    atual += c;
    temConteudo = true;
  }

  if (dentroDeAspas) {
    throw new ErroDeCsv('O arquivo termina com um campo entre aspas que nunca foi fechado.');
  }
  if (temConteudo || campos.length > 0) {
    campos.push(atual);
    if (campos.some((v) => v !== '')) linhas.push({ linha: linhaInicioRegistro, campos });
  }

  return linhas;
}

export class ErroDeCsv extends Error {}

/* ------------------------------------------------------------------ */
/* Perfis CS3                                                          */
/* ------------------------------------------------------------------ */

/** Colunas que identificam cada perfil. A chave define o tipo do ticket. */
export const PERFIL_INCIDENTES = {
  id: 'incidentes' as const,
  tipo: 'incident' as TicketType,
  chave: 'Incident ID',
  rotulo: 'CSV de incidentes',
  obrigatorias: ['Incident ID', 'Title', 'Status', 'Last Update Time'],
  responsavel: 'Assigned to',
};

export const PERFIL_REQUISICOES = {
  id: 'requisicoes' as const,
  tipo: 'request' as TicketType,
  chave: 'Request ID',
  rotulo: 'CSV de requisições',
  obrigatorias: ['Request ID', 'Title', 'Status', 'Last Update Time'],
  responsavel: 'Assignee',
};

export type PerfilCsv = typeof PERFIL_INCIDENTES | typeof PERFIL_REQUISICOES;

export type DeteccaoPerfil =
  | { ok: true; perfil: PerfilCsv }
  | { ok: false; motivo: 'ambiguo' | 'desconhecido' | 'cabecalho_duplicado' | 'obrigatoria_ausente'; detalhe: string };

/**
 * Detecta o perfil pelo conteúdo do cabeçalho.
 * Um arquivo que não bate com nenhum perfil é bloqueado — nunca reinterpretado
 * como o outro formato (AC-009).
 */
export function detectarPerfil(cabecalho: string[]): DeteccaoPerfil {
  const nomes = cabecalho.map((c) => c.replace(/﻿/g, '').trim());

  const vistos = new Map<string, number>();
  for (const n of nomes) {
    if (n.length === 0) continue;
    const k = normalizarParaComparacao(n);
    vistos.set(k, (vistos.get(k) ?? 0) + 1);
  }
  const duplicadas = [...vistos.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  if (duplicadas.length > 0) {
    return { ok: false, motivo: 'cabecalho_duplicado', detalhe: `Cabeçalhos repetidos: ${duplicadas.join(', ')}.` };
  }

  const tem = (nome: string) => vistos.has(normalizarParaComparacao(nome));
  const ehIncidente = tem(PERFIL_INCIDENTES.chave);
  const ehRequisicao = tem(PERFIL_REQUISICOES.chave);

  if (ehIncidente && ehRequisicao) {
    return { ok: false, motivo: 'ambiguo', detalhe: 'O cabeçalho traz "Incident ID" e "Request ID" ao mesmo tempo.' };
  }
  if (!ehIncidente && !ehRequisicao) {
    return {
      ok: false,
      motivo: 'desconhecido',
      detalhe: 'O cabeçalho não contém "Incident ID" nem "Request ID". O perfil não pode ser deduzido pelo nome do arquivo.',
    };
  }

  const perfil = ehIncidente ? PERFIL_INCIDENTES : PERFIL_REQUISICOES;
  const faltando = perfil.obrigatorias.filter((c) => !tem(c));
  if (faltando.length > 0) {
    return { ok: false, motivo: 'obrigatoria_ausente', detalhe: `Colunas obrigatórias ausentes: ${faltando.join(', ')}.` };
  }
  return { ok: true, perfil };
}

export interface RegistroCs3 {
  linha: number;
  sourceTicketId: string;
  ticketType: TicketType;
  oficial: CamposOficiaisCs3;
  /** Estados de validação por linha; `incomplete` não entra na base confirmada. */
  estado: 'ready' | 'incomplete' | 'needs_review';
  problemas: string[];
}

export interface ResultadoLeituraCsv {
  perfil: PerfilCsv;
  registros: RegistroCs3[];
  /** Colunas presentes no arquivo que o perfil não conhece, preservadas como extras. */
  colunasDesconhecidas: string[];
  totalLinhas: number;
}

/** Nomes que o perfil conhece e mapeia para campos nomeados. */
const CONHECIDAS = new Set(
  [
    'Incident ID', 'Request ID', 'Title', 'Status', 'Assigned to', 'Assignee', 'Start Time',
    'Last Update Time', 'Priority', 'Impact', 'Complexity', 'Assignment Group', 'External',
    'Reference ID', 'Reported By', 'Reported CI', 'Device CI', 'Affected CI',
    'Tag 1', 'Tag 2', 'Tag 3', 'Tag 4', 'Tag 5', 'Tag 6',
    'Type (M/V)', 'Type (V)', 'Escalation Status', 'Last Used Knowledge Source',
  ].map(normalizarParaComparacao),
);

/**
 * Lê um CSV CS3 já validado quanto ao perfil.
 * Um campo ausente do arquivo não é o mesmo que um campo presente e vazio: o
 * primeiro nem chega ao registro (secção 8.2).
 */
export function lerCsvCs3(texto: string): ResultadoLeituraCsv {
  const linhas = analisarCsv(texto);
  if (linhas.length === 0) throw new ErroDeCsv('O arquivo não contém nenhuma linha.');

  const cabecalho = linhas[0]!.campos.map((c) => c.replace(/﻿/g, '').trim());
  const deteccao = detectarPerfil(cabecalho);
  if (!deteccao.ok) throw new ErroDeCsv(deteccao.detalhe);
  const perfil = deteccao.perfil;

  const indice = new Map<string, number>();
  cabecalho.forEach((nome, i) => {
    if (nome.length > 0) indice.set(normalizarParaComparacao(nome), i);
  });

  const colunasDesconhecidas = cabecalho.filter((n) => n.length > 0 && !CONHECIDAS.has(normalizarParaComparacao(n)));

  /** Devolve `undefined` quando a coluna não existe; `''` quando existe e está vazia. */
  const ler = (campos: string[], nome: string): string | undefined => {
    const i = indice.get(normalizarParaComparacao(nome));
    if (i === undefined) return undefined;
    return campos[i] ?? '';
  };
  const texto0 = (campos: string[], nome: string): string | null => {
    const v = ler(campos, nome);
    if (v === undefined) return null;
    const t = v.replace(/ /g, ' ').trim();
    return t.length === 0 ? null : t;
  };

  const registros: RegistroCs3[] = [];

  for (const { linha, campos } of linhas.slice(1)) {
    if (campos.every((c) => c.trim() === '')) continue;

    const problemas: string[] = [];
    const id = texto0(campos, perfil.chave);
    const title = texto0(campos, 'Title');
    const status = texto0(campos, 'Status');
    const lastUpdate = texto0(campos, 'Last Update Time');

    if (!id) problemas.push(`Coluna "${perfil.chave}" vazia.`);
    if (!title) problemas.push('Coluna "Title" vazia.');
    if (!status) problemas.push('Coluna "Status" vazia.');
    if (!lastUpdate) problemas.push('Coluna "Last Update Time" vazia.');
    else if (!lerCarimboCs3(lastUpdate).ok) problemas.push(`"Last Update Time" não é uma data válida: "${lastUpdate}".`);

    const startTime = texto0(campos, 'Start Time');
    if (startTime && !lerCarimboCs3(startTime).ok) {
      // Pendência de cronologia; não se inventa uma abertura (secção 9).
      problemas.push(`"Start Time" não é uma data válida: "${startTime}".`);
    }

    const extras: Record<string, string> = {};
    for (const nome of colunasDesconhecidas) {
      const v = ler(campos, nome);
      if (v !== undefined && v.trim() !== '') extras[nome] = v;
    }

    const oficial: CamposOficiaisCs3 = {
      title: title ?? '',
      statusBruto: status ?? '',
      assignedTo: texto0(campos, perfil.responsavel),
      startTimeBruto: startTime,
      lastUpdateTimeBruto: lastUpdate ?? '',
      priority: texto0(campos, 'Priority'),
      impact: texto0(campos, 'Impact'),
      complexity: texto0(campos, 'Complexity'),
      assignmentGroup: texto0(campos, 'Assignment Group'),
      external: texto0(campos, 'External'),
      referenceId: texto0(campos, 'Reference ID'),
      reportedBy: texto0(campos, 'Reported By'),
      reportedCi: texto0(campos, 'Reported CI'),
      deviceCi: texto0(campos, 'Device CI'),
      affectedCi: texto0(campos, 'Affected CI'),
      tags: [1, 2, 3, 4, 5, 6].map((n) => texto0(campos, `Tag ${n}`)),
      typeBruto: texto0(campos, 'Type (M/V)') ?? texto0(campos, 'Type (V)'),
      escalationStatus: texto0(campos, 'Escalation Status'),
      lastUsedKnowledgeSource: texto0(campos, 'Last Used Knowledge Source'),
      extras,
    };

    const obrigatorioFaltando = !id || !title || !status || !lastUpdate || !lerCarimboCs3(lastUpdate ?? '').ok;

    registros.push({
      linha,
      sourceTicketId: id ?? '',
      ticketType: perfil.tipo,
      oficial,
      estado: obrigatorioFaltando ? 'incomplete' : problemas.length > 0 ? 'needs_review' : 'ready',
      problemas,
    });
  }

  return { perfil, registros, colunasDesconhecidas, totalLinhas: linhas.length - 1 };
}
