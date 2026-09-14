/** Valores escolhidos pela pessoa; grafias antigas são aceitas somente como dados existentes. */
export const STATUS_SC3 = ['Waiting External', 'Waiting User', 'Went On Fulfillment', 'Update', 'Working', 'Resolved', 'Closed'] as const;
export type StatusSc3 = typeof STATUS_SC3[number];
const ALIASES: Record<string, StatusSc3> = {
  'WAIT ON USER': 'Waiting User', 'WAIT ON EXTERNAL': 'Waiting External', UPDATED: 'Update',
  ...Object.fromEntries(STATUS_SC3.map(s => [s.toUpperCase(), s])),
};
export function normalizarStatusSc3(valor: string): string {
  return ALIASES[valor.trim().toUpperCase()] ?? valor.trim();
}
export function statusSc3Encerrado(valor: string): boolean {
  return ['Resolved', 'Closed'].includes(normalizarStatusSc3(valor));
}
