/**
 * Conversão de durações.
 *
 * Perfil deste XLSM (secção 6.1): número em `Apontamentos!E` é **fração de dia**;
 * minutos = valor × 1440. Tolerância apenas para ruído de ponto flutuante.
 * 0,125 → 180; 0,0625 → 90; 0,18958333333333333 → 273 (4h33, nunca 4h30).
 *
 * Se a conversão indicar segundos realmente existentes, devolvemos pendência em
 * vez de arredondar silenciosamente o trabalho da pessoa.
 */

export const MINUTOS_POR_DIA = 1440;

/** Ruído aceitável em minutos. 1e-6 min ≈ 60 µs: só absorve erro de binário. */
const EPSILON_MINUTOS = 1e-6;

export type ResultadoDuracao =
  | { ok: true; minutos: number }
  | { ok: false; motivo: 'ausente' | 'nao_numerico' | 'negativa' | 'segundos_reais' | 'excede_dia'; detalhe: string; minutosBrutos?: number };

/**
 * Converte fração de dia do Excel em minutos inteiros.
 * Não arredonda trabalho real: um valor que caia fora do epsilon vira pendência.
 */
export function fracaoDeDiaParaMinutos(valor: unknown): ResultadoDuracao {
  if (valor === null || valor === undefined || valor === '') {
    return { ok: false, motivo: 'ausente', detalhe: 'Sem duração informada.' };
  }
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return { ok: false, motivo: 'nao_numerico', detalhe: `Valor não numérico: ${String(valor)}` };
  }
  if (valor < 0) {
    return { ok: false, motivo: 'negativa', detalhe: `Duração negativa: ${valor}` };
  }

  const minutosBrutos = valor * MINUTOS_POR_DIA;
  const arredondado = Math.round(minutosBrutos);

  if (Math.abs(minutosBrutos - arredondado) > EPSILON_MINUTOS) {
    return {
      ok: false,
      motivo: 'segundos_reais',
      detalhe:
        `A conversão resultou em ${minutosBrutos} minutos, que não é um número inteiro de ` +
        `minutos. Confirme a regra antes de arredondar.`,
      minutosBrutos,
    };
  }

  if (arredondado > MINUTOS_POR_DIA) {
    return {
      ok: false,
      motivo: 'excede_dia',
      detalhe: `Duração de ${arredondado} minutos excede 1.440 minutos em uma data.`,
      minutosBrutos: arredondado,
    };
  }

  return { ok: true, minutos: arredondado };
}

/**
 * Parser próprio de `HH:mm` (secção 6.1). Não usa Date nem depende de locale.
 * Aceita `4:33`, `04:33`, `04:33:00` e `104:00` (acumulado acima de 24h).
 */
export function textoHoraParaMinutos(texto: string): ResultadoDuracao {
  const limpo = texto.replace(/ /g, ' ').trim();
  if (limpo.length === 0) {
    return { ok: false, motivo: 'ausente', detalhe: 'Sem duração informada.' };
  }
  const m = /^(\d{1,4}):([0-5]\d)(?::([0-5]\d))?$/.exec(limpo);
  if (!m) {
    return { ok: false, motivo: 'nao_numerico', detalhe: `Formato de hora não reconhecido: "${texto}"` };
  }
  const horas = Number(m[1]);
  const minutos = Number(m[2]);
  const segundos = m[3] ? Number(m[3]) : 0;

  if (segundos !== 0) {
    return {
      ok: false,
      motivo: 'segundos_reais',
      detalhe: `"${texto}" contém segundos. Confirme a regra antes de arredondar.`,
      minutosBrutos: horas * 60 + minutos + segundos / 60,
    };
  }
  return { ok: true, minutos: horas * 60 + minutos };
}

/** Formata minutos como `HH:mm`. 273 → "04:33"; 561h33 → "561:33". */
export function formatarMinutos(minutos: number): string {
  const sinal = minutos < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(minutos));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sinal}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Rótulo legível curto: 273 → "4h33"; 30 → "30 min"; 480 → "8h". */
export function rotularMinutos(minutos: number): string {
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sinal = minutos < 0 ? '-' : '';
  if (h === 0) return `${sinal}${m} min`;
  if (m === 0) return `${sinal}${h}h`;
  return `${sinal}${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Valida um novo apontamento (secção 5.1): duração confirmada é inteiro
 * positivo e nenhuma data pode receber mais de 1.440 minutos novos.
 * Valores legados maiores são preservados em quarentena pelo importador —
 * esta função rege apenas a criação/edição pela interface.
 */
export function validarNovaDuracao(minutos: number): { ok: true } | { ok: false; erro: string } {
  if (!Number.isInteger(minutos)) return { ok: false, erro: 'A duração precisa ser um número inteiro de minutos.' };
  if (minutos <= 0) return { ok: false, erro: 'A duração precisa ser maior que zero.' };
  if (minutos > MINUTOS_POR_DIA) return { ok: false, erro: 'A duração não pode passar de 1.440 minutos (24h) numa data.' };
  return { ok: true };
}
