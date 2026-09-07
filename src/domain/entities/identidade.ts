/**
 * Identidade de tickets e referências externas.
 *
 * Regras fixadas pela especificação:
 *  - Identidade oficial única = workspaceId + sourceSystem + ticketType + sourceTicketId (5.1).
 *  - Título, linha, nome de arquivo, `External` e `Reference ID` NUNCA são chave (5.1).
 *  - `IR`, `RR`, `INC`, `RITM`, `SCTASK` e `CR` são namespaces distintos (8.5).
 *  - Uma linha com vários IDs vira grupo pessoal com candidatos, sem fundir
 *    identidades oficiais (10.3).
 *  - Preservar a grafia original; normalizar apenas para comparar (7).
 */

import type { Namespace, ReferenciaExterna, TicketType } from './tipos';

/** Separadores observados no legado entre dois IDs de uma mesma célula. */
const SEPARADORES = /[;,/]|\s+e\s+|\s{2,}/i;

/** Prefixos reconhecidos, do mais longo para o mais curto para não colidir. */
const PREFIXOS: { prefixo: string; namespace: Namespace }[] = [
  { prefixo: 'SCTASK', namespace: 'SCTASK' },
  { prefixo: 'RITM', namespace: 'RITM' },
  { prefixo: 'INC', namespace: 'INC' },
  { prefixo: 'CR', namespace: 'CR' },
  { prefixo: 'IR', namespace: 'IR' },
  { prefixo: 'RR', namespace: 'RR' },
];

/**
 * Normaliza para comparação: remove espaços externos e NBSP, colapsa espaços
 * internos e passa a maiúsculas. O texto original é sempre preservado à parte.
 */
export function normalizarParaComparacao(texto: string): string {
  return texto
    .replace(/ /g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/** Normaliza um status/rótulo preservando caixa original mas sem espaços externos. */
export function aparar(texto: string | null | undefined): string | null {
  if (texto == null) return null;
  const limpo = texto.replace(/ /g, ' ').trim();
  return limpo.length === 0 ? null : limpo;
}

function classificar(token: string): Namespace {
  const alvo = token.toUpperCase();
  for (const { prefixo, namespace } of PREFIXOS) {
    if (alvo.startsWith(prefixo)) return namespace;
  }
  return 'OUTRO';
}

/**
 * Interpreta um token único como referência externa.
 * Não fabrica ticket: apenas descreve o que o texto é.
 */
export function interpretarToken(bruto: string): ReferenciaExterna | null {
  const limpo = bruto.replace(/ /g, ' ').trim();
  if (limpo.length === 0) return null;
  return {
    bruto: limpo,
    namespace: classificar(limpo),
    normalizado: normalizarParaComparacao(limpo),
  };
}

/**
 * Referências compostas por `_` (ex.: `IR32064696_INC3408222`, `CR2238_RR23563421`).
 * São namespaces distintos relacionados, não um único ticket: devolvemos as
 * partes como candidatos e mantemos o texto completo como referência bruta.
 */
export function separarComposto(bruto: string): ReferenciaExterna[] {
  const partes = bruto.split('_').map((p) => p.trim()).filter((p) => p.length > 0);
  if (partes.length < 2) return [];
  const refs = partes.map(interpretarToken).filter((r): r is ReferenciaExterna => r !== null);
  // Só é composto de verdade quando cada parte é reconhecível como namespace.
  return refs.length === partes.length && refs.every((r) => r.namespace !== 'OUTRO') ? refs : [];
}

export interface LeituraReferencia {
  /** Texto original completo da célula, sem alteração. */
  bruto: string;
  /** Candidatos identificados. Vazio quando a célula não trazia referência. */
  candidatos: ReferenciaExterna[];
  /** Verdadeiro quando a célula continha mais de uma identidade. */
  multiplo: boolean;
  /** Verdadeiro quando as partes vieram de uma referência unida por `_`. */
  composto: boolean;
}

/**
 * Lê uma célula de referência do legado.
 *
 * Exemplos cobertos pelo baseline:
 *  - `RR22112787/RR23581261`   → dois candidatos, múltiplo
 *  - `IR32043578 ; RR23811390` → dois candidatos, múltiplo
 *  - `IR32064696_INC3408222`   → dois candidatos, composto
 *  - `SCTASK1257370`           → um candidato, namespace próprio
 */
export function lerReferencia(bruto: string | null | undefined): LeituraReferencia {
  const texto = (bruto ?? '').replace(/ /g, ' ').trim();
  if (texto.length === 0) {
    return { bruto: '', candidatos: [], multiplo: false, composto: false };
  }

  const tokens = texto.split(SEPARADORES).map((t) => t.trim()).filter((t) => t.length > 0);

  if (tokens.length > 1) {
    const candidatos = tokens.flatMap((t) => {
      const composto = separarComposto(t);
      if (composto.length > 0) return composto;
      const ref = interpretarToken(t);
      return ref ? [ref] : [];
    });
    return { bruto: texto, candidatos, multiplo: candidatos.length > 1, composto: false };
  }

  const composto = separarComposto(texto);
  if (composto.length > 0) {
    return { bruto: texto, candidatos: composto, multiplo: true, composto: true };
  }

  const unico = interpretarToken(texto);
  return {
    bruto: texto,
    candidatos: unico ? [unico] : [],
    multiplo: false,
    composto: false,
  };
}

/**
 * Chave de identidade oficial. Só existe quando os três componentes existem.
 * `Reference ID` e `External` jamais participam desta chave.
 */
export function chaveOficial(
  workspaceId: string,
  sourceSystem: string,
  ticketType: TicketType,
  sourceTicketId: string,
): string {
  return [workspaceId, sourceSystem, ticketType, normalizarParaComparacao(sourceTicketId)].join('|');
}

/**
 * Extrai referências citadas dentro de um texto livre (ex.: descrição C194 do
 * baseline, que cita dois incidentes). Devolve sugestões — a escolha é da
 * pessoa, nunca automática.
 */
export function referenciasCitadasEmTexto(texto: string | null | undefined): ReferenciaExterna[] {
  if (!texto) return [];
  const padrao = /\b(SCTASK|RITM|INC|CR|IR|RR)\s?(\d{3,})\b/gi;
  const vistos = new Set<string>();
  const achados: ReferenciaExterna[] = [];
  for (const m of texto.matchAll(padrao)) {
    const bruto = `${m[1]}${m[2]}`;
    const ref = interpretarToken(bruto);
    if (ref && !vistos.has(ref.normalizado)) {
      vistos.add(ref.normalizado);
      achados.push(ref);
    }
  }
  return achados;
}
