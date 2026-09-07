/**
 * Datas civis e seriais do Excel.
 *
 * Regras da especificação (6.1):
 *  - Datas seriais respeitam o sistema 1900/1904 declarado no arquivo.
 *  - O serial fictício 60 no sistema 1900 (29/02/1900, que não existiu) não vira
 *    data histórica válida por suposição.
 *  - Não converter datas civis em UTC e depois deslocar um dia: toda a
 *    aritmética aqui é feita sobre componentes Y/M/D, sem objeto Date com fuso.
 */

import type { WorkDate } from '../entities/tipos';

export type ResultadoData =
  | { ok: true; data: WorkDate }
  | { ok: false; motivo: 'ausente' | 'serial_invalido' | 'serial_ficticio' | 'fora_de_faixa' | 'formato'; detalhe: string };

const DIAS_NO_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function bissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

function diasNoMes(ano: number, mes: number): number {
  if (mes === 2) return bissexto(ano) ? 29 : 28;
  return DIAS_NO_MES[mes - 1]!;
}

/** Converte dias desde uma época civil em Y/M/D, sem usar Date. */
function civilDeDiasDesdeEpoca(dias: number): { ano: number; mes: number; dia: number } {
  // Algoritmo de Howard Hinnant (days_from_civil invertido), época 1970-01-01.
  let z = dias + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { ano: y + (m <= 2 ? 1 : 0), mes: m, dia: d };
}

/** Converte Y/M/D em dias desde 1970-01-01, sem usar Date. */
export function diasDesdeEpoca(ano: number, mes: number, dia: number): number {
  const y = ano - (mes <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = mes + (mes > 2 ? -3 : 9);
  const doy = Math.floor((153 * mp + 2) / 5) + dia - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function formatar(ano: number, mes: number, dia: number): WorkDate {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Serial do Excel → data civil.
 *
 * No sistema 1900 o Excel trata 1899-12-31 como serial 1 e inclui um
 * 29/02/1900 inexistente no serial 60. Seriais < 61 ficam ambíguos e o
 * serial 60 é rejeitado explicitamente (AC-020).
 */
export function serialParaData(serial: number, sistema: 1900 | 1904 = 1900): ResultadoData {
  if (!Number.isFinite(serial)) {
    return { ok: false, motivo: 'serial_invalido', detalhe: `Serial não numérico: ${String(serial)}` };
  }
  const inteiro = Math.floor(serial);
  if (inteiro <= 0) {
    return { ok: false, motivo: 'serial_invalido', detalhe: `Serial fora de faixa: ${serial}` };
  }

  if (sistema === 1900) {
    if (inteiro === 60) {
      return {
        ok: false,
        motivo: 'serial_ficticio',
        detalhe: 'O serial 60 corresponde a 29/02/1900, data que não existiu. Não é convertida em data histórica.',
      };
    }
    // 1900-01-01 é o serial 1; a partir do serial 61 há o deslocamento do bug.
    const offset = inteiro > 60 ? -2 : -1;
    const dias = diasDesdeEpoca(1900, 1, 1) + inteiro + offset;
    const { ano, mes, dia } = civilDeDiasDesdeEpoca(dias);
    return { ok: true, data: formatar(ano, mes, dia) };
  }

  const dias = diasDesdeEpoca(1904, 1, 1) + inteiro;
  const { ano, mes, dia } = civilDeDiasDesdeEpoca(dias);
  return { ok: true, data: formatar(ano, mes, dia) };
}

/** Data civil → serial, para conferência dos testes. */
export function dataParaSerial(data: WorkDate, sistema: 1900 | 1904 = 1900): number {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number];
  const dias = diasDesdeEpoca(a, m, d);
  if (sistema === 1904) return dias - diasDesdeEpoca(1904, 1, 1);
  const bruto = dias - diasDesdeEpoca(1900, 1, 1) + 1;
  return bruto >= 60 ? bruto + 1 : bruto;
}

/** Valida `YYYY-MM-DD` de verdade (rejeita 2026-02-30). */
export function ehDataValida(texto: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12) return false;
  return dia >= 1 && dia <= diasNoMes(ano, mes);
}

/**
 * Data no formato CS3 `DD/MM/AAAA HH:mm:ss`.
 * Devolve a parte civil e o horário local **sem** converter para UTC: enquanto
 * o fuso da fonte não for informado, comparar perfis distintos é proibido (4.1).
 */
export interface CarimboFonte {
  data: WorkDate;
  horaLocal: string | null;
  bruto: string;
}

export function lerCarimboCs3(bruto: string): { ok: true; valor: CarimboFonte } | { ok: false; detalhe: string } {
  const limpo = bruto.replace(/ /g, ' ').trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(limpo);
  if (!m) return { ok: false, detalhe: `Data não reconhecida no perfil CS3: "${bruto}"` };
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  const data = formatar(ano, mes, dia);
  if (!ehDataValida(data)) return { ok: false, detalhe: `Data inexistente: "${bruto}"` };
  const horaLocal =
    m[4] !== undefined
      ? `${String(Number(m[4])).padStart(2, '0')}:${m[5]}:${m[6] ?? '00'}`
      : null;
  return { ok: true, valor: { data, horaLocal, bruto: limpo } };
}

/**
 * Comparação de versões de origem (secção 8.3).
 * Só compara carimbos do **mesmo perfil de fonte**; devolve `null` quando não
 * são comparáveis, e a decisão vira revisão em vez de prioridade por upload.
 */
export function compararCarimbos(a: CarimboFonte, b: CarimboFonte): number | null {
  const chave = (c: CarimboFonte) => `${c.data} ${c.horaLocal ?? ''}`;
  const ka = chave(a);
  const kb = chave(b);
  if ((a.horaLocal === null) !== (b.horaLocal === null)) return null;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/** Diferença em dias civis. Positiva quando `fim` é posterior a `inicio`. */
export function diferencaEmDias(inicio: WorkDate, fim: WorkDate): number {
  const [a1, m1, d1] = inicio.split('-').map(Number) as [number, number, number];
  const [a2, m2, d2] = fim.split('-').map(Number) as [number, number, number];
  return diasDesdeEpoca(a2, m2, d2) - diasDesdeEpoca(a1, m1, d1);
}

/** Dia da semana civil, 0 = domingo. Sem objeto Date, portanto sem fuso. */
export function diaDaSemana(data: WorkDate): number {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number];
  const dias = diasDesdeEpoca(a, m, d);
  return ((dias % 7) + 11) % 7; // 1970-01-01 foi quinta-feira (4).
}

/** Soma dias a uma data civil. */
export function somarDias(data: WorkDate, dias: number): WorkDate {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number];
  const { ano, mes, dia } = civilDeDiasDesdeEpoca(diasDesdeEpoca(a, m, d) + dias);
  return formatar(ano, mes, dia);
}

/** Enumera as datas de um período fechado. */
export function enumerarPeriodo(inicio: WorkDate, fim: WorkDate): WorkDate[] {
  const total = diferencaEmDias(inicio, fim);
  if (total < 0) return [];
  const saida: WorkDate[] = [];
  for (let i = 0; i <= total; i += 1) saida.push(somarDias(inicio, i));
  return saida;
}
