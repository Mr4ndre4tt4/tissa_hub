/**
 * Confere o leitor OOXML contra o baseline do arquivo real.
 *
 * Uso: `npx tsx scripts/verificar-baseline.ts <caminho-do-xlsm>`
 *
 * O caminho é sempre um argumento: o insumo privado nunca está no repositório
 * nem é referenciado por caminho fixo. Este script não escreve no arquivo de
 * origem, não executa macros e não resolve vínculos externos.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { lerLivro } from '../src/domain/sources/ooxml';
import { lerXlsmCentral } from '../src/domain/sources/xlsm';
/**
 * Os contratos derivados do arquivo real (baseline e manifesto) NÃO são
 * versionados: o repositório é público e eles descrevem o trabalho do cliente.
 * O caminho vem de CENTRAL_CONTRATOS, com o local do pacote como padrão.
 */
const DIR_CONTRATOS = process.env.CENTRAL_CONTRATOS ?? 'especificacao/contratos';
const baseline = JSON.parse(readFileSync(`${DIR_CONTRATOS}/baseline_xlsm.json`, 'utf8')) as {
  sha256: string;
  sheets: number;
  source_rows: Record<string, number>;
  input_rows_with_material_content: number;
  numeric_duration_rows: number;
  numeric_duration_minutes_gross: number;
  numeric_duration_period: [string, string];
  date_range_in_input_rows: [string, string];
  calendar_days_with_numeric_duration: number;
  personal_status_distribution: Record<string, number>;
  external_formula_cells: { sheet: string; cell: string }[];
};

const caminho = process.argv[2];
if (!caminho) {
  console.error('Informe o caminho do XLSM. Ex.: npx tsx scripts/verificar-baseline.ts "/caminho/arquivo.xlsm"');
  process.exit(2);
}

const bytes = new Uint8Array(readFileSync(caminho));
const sha = createHash('sha256').update(bytes).digest('hex');

const livro = lerLivro(bytes);
const leitura = lerXlsmCentral(livro);

interface Conferencia {
  item: string;
  esperado: unknown;
  obtido: unknown;
  ok: boolean;
}

const conferencias: Conferencia[] = [];
const conferir = (item: string, esperado: unknown, obtido: unknown) => {
  conferencias.push({ item, esperado, obtido, ok: JSON.stringify(esperado) === JSON.stringify(obtido) });
};

conferir('sha256 do arquivo', baseline.sha256, sha);
conferir('quantidade de abas', baseline.sheets, livro.abas.length);
conferir('Chamados: linhas com referência', baseline.source_rows.Chamados, leitura.chamados.length);
conferir('Apontamentos: linhas operacionais', baseline.input_rows_with_material_content, leitura.apontamentos.length);
conferir('Apontamentos: linhas com duração numérica', baseline.numeric_duration_rows, leitura.apontamentos.filter((a) => a.duracaoMinutos !== null).length);
conferir(
  'Apontamentos: soma bruta em minutos',
  baseline.numeric_duration_minutes_gross,
  leitura.apontamentos.reduce((s, a) => s + (a.duracaoMinutos ?? 0), 0),
);
conferir('Apontamentos: linhas sem duração', baseline.input_rows_with_material_content - baseline.numeric_duration_rows, leitura.apontamentos.filter((a) => a.duracaoMinutos === null).length);
conferir('Apontamentos: linhas com referência preenchida em B', baseline.source_rows.Apontamentos, leitura.apontamentos.filter((a) => a.referenciaBruta !== null && a.referenciaBruta !== '').length);
conferir('Follow-ups', baseline.source_rows['Follow-ups'], leitura.followUps.length);
conferir('To Do Diário', baseline.source_rows['To Do Diário'], leitura.tarefas.length);
conferir('Resolvidos', baseline.source_rows.Resolvidos, leitura.resolvidos.length);
conferir('Histórico Status', baseline.source_rows['Histórico Status'], leitura.historicoStatus.length);
conferir('Meu desenvolvimento', baseline.source_rows['Meu desenvolvimento'], leitura.desenvolvimento.length);
conferir('Planilha1 (comparação)', baseline.source_rows.Planilha1, leitura.planilha1.length);
conferir('Fila Follow-up (derivada)', baseline.source_rows['Fila Follow-up'], leitura.filaFollowUp);

const porData = leitura.apontamentos.filter((a) => a.duracaoMinutos !== null && a.workDate).map((a) => a.workDate!);
conferir('Período das durações numéricas', baseline.numeric_duration_period, [porData.slice().sort()[0], porData.slice().sort().at(-1)]);
conferir('Dias-calendário com duração numérica', baseline.calendar_days_with_numeric_duration, new Set(porData).size);

const todasDatas = leitura.apontamentos.filter((a) => a.workDate).map((a) => a.workDate!).sort();
conferir('Faixa de datas das linhas operacionais', baseline.date_range_in_input_rows, [todasDatas[0], todasDatas.at(-1)]);

conferir('Resolvido em Chamados', baseline.personal_status_distribution.Resolvido, leitura.chamados.filter((c) => (c.statusBruto ?? '').trim() === 'Resolvido').length);
conferir('Transferido com espaço final', 7, leitura.chamados.filter((c) => c.statusBruto !== null && c.statusBruto !== c.statusBruto.trim()).length);
conferir('Erros #REF! em Apontamentos', 15, leitura.diagnostico.errosApontamentos);
conferir('Erros #VALUE! em Chamados', 4, leitura.diagnostico.errosChamados);
conferir('Fórmulas com vínculo externo', baseline.external_formula_cells.length, leitura.diagnostico.formulasExternas);
conferir('Projeto VBA detectado (não executado)', true, livro.contemVba);

const celulasEsperadas: [string, string, number][] = [
  ['Apontamentos', 'E4', 180],
  ['Apontamentos', 'E5', 90],
  ['Apontamentos', 'E142', 273],
  ['Apontamentos', 'E316', 30],
];
for (const [aba, ref, minutos] of celulasEsperadas) {
  const c = livro.abas.find((a) => a.nome === aba)?.celulas.get(ref);
  const v = typeof c?.valorSalvo === 'number' ? Math.round(c.valorSalvo * 1440) : null;
  conferir(`${aba}!${ref} em minutos`, minutos, v);
}

const larguras = [58, 30, 30];
const linha = (c: Conferencia) =>
  `${c.ok ? '  ok  ' : ' FALHA'} │ ${c.item.padEnd(larguras[0]!)} │ esperado ${JSON.stringify(c.esperado)}  obtido ${JSON.stringify(c.obtido)}`;

console.log(`\nArquivo: ${caminho}`);
console.log(`SHA-256: ${sha}\n`);
for (const c of conferencias) console.log(linha(c));

const falhas = conferencias.filter((c) => !c.ok);
console.log(`\n${conferencias.length - falhas.length}/${conferencias.length} conferências passaram.`);
if (falhas.length > 0) process.exit(1);
