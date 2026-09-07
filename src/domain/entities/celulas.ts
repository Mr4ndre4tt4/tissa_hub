/**
 * Sugestão de célula e mapeamento de status.
 *
 * Regras da secção 7:
 *  - `Tag 3` sugere: `MELHORIA SQUAD` → Squad; `TASK FORCE` → Task Force;
 *    `BASELINE` sem `EXTRABASELINE` → AMS **a confirmar**; `EXTRABASELINE` ou
 *    vazio → revisão. EXTRABASELINE é avaliado ANTES de BASELINE.
 *  - `Assignment Group` contendo AMS **não** determina a célula. Categoria SAP,
 *    tipo IR/RR, tipo de atuação e RND também não.
 *  - Célula sugerida e célula manual são campos distintos; a manual prevalece.
 *  - Uma tag posterior divergente gera aviso, não reclassificação automática.
 */

import type { Celula } from './tipos';
import { normalizarParaComparacao } from './identidade';

export type ForcaSugestao = 'definida' | 'a_confirmar' | 'revisao';

export interface SugestaoCelula {
  celula: Celula | null;
  forca: ForcaSugestao;
  motivo: string;
  /** Grafia original da tag avaliada, preservada. */
  tagBruta: string | null;
}

export function sugerirCelulaPorTag3(tag3: string | null | undefined): SugestaoCelula {
  const bruta = tag3 ?? null;
  const alvo = normalizarParaComparacao(tag3 ?? '');

  if (alvo.length === 0) {
    return { celula: null, forca: 'revisao', motivo: 'Tag 3 vazia: classificação depende de revisão manual.', tagBruta: bruta };
  }
  if (alvo.includes('MELHORIA SQUAD')) {
    return { celula: 'SQUAD', forca: 'definida', motivo: 'Tag 3 contém MELHORIA SQUAD.', tagBruta: bruta };
  }
  if (alvo.includes('TASK FORCE')) {
    return { celula: 'TASK_FORCE', forca: 'definida', motivo: 'Tag 3 contém TASK FORCE.', tagBruta: bruta };
  }
  // EXTRABASELINE é avaliado antes de BASELINE, pois contém a palavra.
  if (alvo.includes('EXTRABASELINE')) {
    return { celula: null, forca: 'revisao', motivo: 'Tag 3 contém EXTRABASELINE: exige revisão manual, não AMS.', tagBruta: bruta };
  }
  if (alvo.includes('BASELINE')) {
    return { celula: 'AMS', forca: 'a_confirmar', motivo: 'Tag 3 contém BASELINE: sugestão AMS a confirmar.', tagBruta: bruta };
  }
  return { celula: null, forca: 'revisao', motivo: `Tag 3 "${bruta}" não corresponde a nenhuma regra conhecida.`, tagBruta: bruta };
}

/**
 * Célula efetiva de um estado pessoal: a manual sempre prevalece sobre a
 * sugerida. Sem nenhuma das duas, o registro fica em `UNCLASSIFIED` — a
 * ausência de célula nunca elimina esforço (secção 11).
 */
export function celulaEfetiva(manual: Celula | null, sugerida: Celula | null): Celula {
  return manual ?? sugerida ?? 'UNCLASSIFIED';
}

/** Divergência entre a célula manual e uma sugestão posterior: aviso, não troca. */
export function divergenciaDeCelula(manual: Celula | null, sugestao: SugestaoCelula): string | null {
  if (manual === null) return null;
  if (sugestao.celula === null) return null;
  if (sugestao.celula === manual) return null;
  return `A célula manual é ${manual}, mas a Tag 3 atual sugere ${sugestao.celula}. A classificação manual foi mantida.`;
}

/* ------------------------------------------------------------------ */
/* Status CS3                                                          */
/* ------------------------------------------------------------------ */

/**
 * Mapa amigável do status oficial. O valor bruto é sempre preservado ao lado.
 * `Updated` significa "atualizado / revisar", nunca encerrado.
 */
export const MAPA_STATUS_CS3: Record<string, string> = {
  WORKING: 'Em atendimento',
  'WAIT ON USER': 'Aguardando usuário',
  'WAIT ON EXTERNAL': 'Aguardando terceiro',
  UPDATED: 'Atualizado / revisar',
};

export interface StatusExibido {
  bruto: string;
  amigavel: string;
  /** Verdadeiro quando o valor não consta do mapa: fica visível como não mapeado. */
  naoMapeado: boolean;
}

export function exibirStatusCs3(bruto: string | null | undefined, mapaExtra: Record<string, string> = {}): StatusExibido {
  const texto = (bruto ?? '').replace(/ /g, ' ').trim();
  if (texto.length === 0) return { bruto: '', amigavel: 'Sem status', naoMapeado: true };
  const chave = normalizarParaComparacao(texto);
  const amigavel = mapaExtra[chave] ?? MAPA_STATUS_CS3[chave];
  return amigavel
    ? { bruto: texto, amigavel, naoMapeado: false }
    : { bruto: texto, amigavel: `${texto} (não mapeado)`, naoMapeado: true };
}

/**
 * Catálogo pessoal do legado, preservado integralmente (secção 7).
 * A normalização remove apenas espaços externos — `"Transferido "` e
 * `"Transferido"` são a mesma identidade, com o texto original guardado.
 */
export const ANDAMENTOS_PESSOAIS_LEGADO = [
  'Em andamento',
  'Em andamento ABAP',
  'Aguardando usuário',
  'Aguardando terceiros',
  'Transferido',
  'Resolvido',
] as const;

export function normalizarAndamentoPessoal(bruto: string | null | undefined): { normalizado: string | null; bruto: string | null; aparado: boolean } {
  if (bruto == null) return { normalizado: null, bruto: null, aparado: false };
  const limpo = bruto.replace(/ /g, ' ').trim();
  if (limpo.length === 0) return { normalizado: null, bruto, aparado: bruto.length > 0 };
  const conhecido = ANDAMENTOS_PESSOAIS_LEGADO.find(
    (a) => normalizarParaComparacao(a) === normalizarParaComparacao(limpo),
  );
  return { normalizado: conhecido ?? limpo, bruto, aparado: limpo !== bruto };
}
