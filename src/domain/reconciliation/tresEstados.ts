/**
 * Comparação em três estados (secção 8.4).
 *
 *  B = último valor importado da origem;
 *  S = novo valor vindo da planilha;
 *  A = valor atual no aplicativo.
 *
 * Regras:
 *  - S = B  → a origem não mudou: **manter A** (a edição local sobrevive).
 *  - A = B e S ≠ B → propor a alteração da origem.
 *  - A = S  → conciliar sem conflito.
 *  - A ≠ B, S ≠ B e A ≠ S → conflito: exige decisão.
 *
 * A decisão confirmada define o novo B, e o valor descartado vai para a
 * auditoria — nunca se perde silenciosamente.
 */

export type ResultadoTresEstados<T> =
  | { tipo: 'sem_mudanca_na_origem'; valor: T; conflito: false }
  | { tipo: 'proposta_da_origem'; valor: T; anterior: T; conflito: false }
  | { tipo: 'ja_conciliado'; valor: T; conflito: false }
  | { tipo: 'conflito'; base: T; origem: T; aplicativo: T; conflito: true };

/** Igualdade por valor, tolerante a espaços externos em texto. */
export function iguais(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.replace(/ /g, ' ').trim() === b.replace(/ /g, ' ').trim();
  }
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  if (typeof a === 'object' && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

export function compararTresEstados<T>(base: T, origem: T, aplicativo: T): ResultadoTresEstados<T> {
  const origemMudou = !iguais(origem, base);
  const appMudou = !iguais(aplicativo, base);

  // A origem não mudou: nada a propor, a edição local permanece.
  if (!origemMudou) return { tipo: 'sem_mudanca_na_origem', valor: aplicativo, conflito: false };

  // Origem e aplicativo já chegaram ao mesmo valor.
  if (iguais(aplicativo, origem)) return { tipo: 'ja_conciliado', valor: aplicativo, conflito: false };

  // Só a origem mudou: proposta limpa.
  if (!appMudou) return { tipo: 'proposta_da_origem', valor: origem, anterior: aplicativo, conflito: false };

  // Ambos mudaram de formas diferentes.
  return { tipo: 'conflito', base, origem, aplicativo, conflito: true };
}

export interface CampoConciliado {
  campo: string;
  rotulo: string;
  base: unknown;
  origem: unknown;
  aplicativo: unknown;
  resultado: ResultadoTresEstados<unknown>;
  /** Aba/linha/célula observadas, para a tela de conciliação (secção 4.7). */
  local?: { aba?: string; linha?: number; celula?: string };
}

/**
 * Concilia um conjunto de campos de um mesmo registro.
 * `ausentesNaOrigem` lista campos que a origem simplesmente não trouxe: coluna
 * ausente preserva o valor anterior e nem entra na comparação (secção 8.2).
 */
export function conciliarCampos(
  campos: { campo: string; rotulo: string; base: unknown; origem: unknown; aplicativo: unknown; local?: CampoConciliado['local'] }[],
  ausentesNaOrigem: Set<string> = new Set(),
): CampoConciliado[] {
  return campos
    .filter((c) => !ausentesNaOrigem.has(c.campo))
    .map((c) => ({ ...c, resultado: compararTresEstados(c.base, c.origem, c.aplicativo) }));
}

export function temConflito(campos: CampoConciliado[]): boolean {
  return campos.some((c) => c.resultado.conflito);
}

/** Campos que a origem propõe alterar e que não estão em conflito. */
export function propostasAceitaveis(campos: CampoConciliado[]): CampoConciliado[] {
  return campos.filter((c) => c.resultado.tipo === 'proposta_da_origem');
}
