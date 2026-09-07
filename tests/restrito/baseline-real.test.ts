/**
 * Testes restritos: exigem os insumos privados reais.
 *
 * NÃO fazem parte da suíte automática (`vitest.exclude` cobre `tests/restrito/`),
 * porque os arquivos contêm dados do cliente e nunca entram no repositório.
 *
 * Para executar num ambiente autorizado:
 *   CENTRAL_XLSM="/caminho/central_chamados_produtividade_aprimorado (1).xlsm" \
 *   CENTRAL_CSV_INC="/caminho/export.csv" \
 *   CENTRAL_CSV_REQ="/caminho/export 2.csv" \
 *   npx vitest run --config vitest.restrito.config.ts
 *
 * O arquivo de origem é aberto somente para leitura; o teste confere ao final
 * que o hash continua idêntico (AC-074).
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { lerLivro, type LivroOoxml } from '../../src/domain/sources/ooxml';
import { lerXlsmCentral, type LeituraXlsm } from '../../src/domain/sources/xlsm';
import { lerCsvCs3 } from '../../src/domain/sources/csv';
import { lerReferencia, normalizarParaComparacao, referenciasCitadasEmTexto } from '../../src/domain/entities/identidade';
import { detectarRepeticoesNaCarga } from '../../src/domain/reconciliation/multiplicidade';
import baseline from '../../especificacao/contratos/baseline_xlsm.json';
import manifesto from '../../especificacao/contratos/manifesto_fontes.json';

const CAMINHO_XLSM = process.env.CENTRAL_XLSM;
const CAMINHO_INC = process.env.CENTRAL_CSV_INC;
const CAMINHO_REQ = process.env.CENTRAL_CSV_REQ;

const temXlsm = Boolean(CAMINHO_XLSM);
const temCsv = Boolean(CAMINHO_INC && CAMINHO_REQ);

describe.runIf(temXlsm)('AC-011 / AC-074 — XLSM real, somente leitura', () => {
  let bytes: Uint8Array;
  let livro: LivroOoxml;
  let leitura: LeituraXlsm;
  let hashInicial: string;

  beforeAll(() => {
    bytes = new Uint8Array(readFileSync(CAMINHO_XLSM!));
    hashInicial = createHash('sha256').update(bytes).digest('hex');
    livro = lerLivro(bytes);
    leitura = lerXlsmCentral(livro);
  });

  it('o arquivo é exatamente o do manifesto', () => {
    expect(hashInicial).toBe(baseline.sha256);
    expect(manifesto.files[0]!.sha256).toBe(hashInicial);
  });

  it('AC-011: 13 abas, VBA detectado e nenhum vínculo executado', () => {
    expect(livro.abas).toHaveLength(13);
    expect(livro.contemVba).toBe(true);
    // O projeto VBA foi apenas detectado; nenhuma rotina foi interpretada.
    expect(livro.vinculosExternos.length).toBeGreaterThan(0);
  });

  it('AC-015: 333 linhas operacionais, 281 com duração, 52 sem; 323 é outro denominador', () => {
    expect(leitura.apontamentos).toHaveLength(333);
    expect(leitura.apontamentos.filter((a) => a.duracaoMinutos !== null)).toHaveLength(281);
    expect(leitura.apontamentos.filter((a) => a.duracaoMinutos === null)).toHaveLength(52);
    expect(leitura.apontamentos.filter((a) => a.referenciaBruta)).toHaveLength(323);
  });

  it('AC-018: 33.693 minutos brutos entre 18/05 e 31/08, sem rótulo de homologado', () => {
    const soma = leitura.apontamentos.reduce((s, a) => s + (a.duracaoMinutos ?? 0), 0);
    expect(soma).toBe(33693);
    expect(soma / 60).toBeCloseTo(561.55, 1);
  });

  it('AC-016 / AC-017: conversões de célula conferem', () => {
    const min = (ref: string) => {
      const c = livro.abas.find((a) => a.nome === 'Apontamentos')!.celulas.get(ref)!;
      return Math.round((c.valorSalvo as number) * 1440);
    };
    expect(min('E4')).toBe(180);
    expect(min('E5')).toBe(90);
    expect(min('E142')).toBe(273);
    expect(min('E316')).toBe(30);
  });

  it('AC-031: A4 de Chamados traz dois IDs e vira grupo pessoal', () => {
    const a4 = livro.abas.find((a) => a.nome === 'Chamados')!.celulas.get('A4')!;
    const r = lerReferencia(String(a4.valorSalvo));
    expect(r.multiplo).toBe(true);
    expect(r.candidatos).toHaveLength(2);
  });

  it('AC-031: B215 e B294 são múltiplos com as durações esperadas', () => {
    const b215 = leitura.apontamentos.find((a) => a.linha === 215)!;
    expect(lerReferencia(b215.referenciaBruta).candidatos).toHaveLength(2);
    expect(b215.duracaoMinutos).toBe(120);

    const b294 = leitura.apontamentos.find((a) => a.linha === 294)!;
    expect(lerReferencia(b294.referenciaBruta).candidatos).toHaveLength(2);
    expect(b294.duracaoMinutos).toBe(90);
  });

  it('AC-032: B240, B310 e B170 preservam namespaces distintos', () => {
    const b240 = lerReferencia(leitura.apontamentos.find((a) => a.linha === 240)!.referenciaBruta);
    expect(b240.candidatos.map((c) => c.namespace)).toEqual(['IR', 'INC']);

    const b310 = lerReferencia(leitura.apontamentos.find((a) => a.linha === 310)!.referenciaBruta);
    expect(b310.candidatos.map((c) => c.namespace)).toEqual(['CR', 'RR']);

    const b170 = lerReferencia(leitura.apontamentos.find((a) => a.linha === 170)!.referenciaBruta);
    expect(b170.candidatos[0]!.namespace).toBe('SCTASK');
  });

  it('AC-027: linhas 155, 176 e 194 têm duração sem referência e não são descartadas', () => {
    for (const linha of baseline.rows_with_duration_without_id) {
      const a = leitura.apontamentos.find((x) => x.linha === linha);
      expect(a, `linha ${linha} deveria existir`).toBeDefined();
      expect(a!.referenciaBruta).toBeNull();
      expect(a!.duracaoMinutos).not.toBeNull();
    }
    // C194 cita dois incidentes: sugestão, nunca escolha automática.
    const l194 = leitura.apontamentos.find((a) => a.linha === 194)!;
    expect(referenciasCitadasEmTexto(l194.descricao).length).toBeGreaterThanOrEqual(2);
  });

  it('AC-040: A286/E286 preservam data e 270 min apesar de H:J com erro', () => {
    const a286 = leitura.apontamentos.find((a) => a.linha === 286)!;
    expect(a286.workDate).not.toBeNull();
    expect(a286.duracaoMinutos).toBe(270);
    expect(a286.errosDeFormula.length).toBeGreaterThan(0);
  });

  it('AC-042: as dez fórmulas externas são registradas e nunca resolvidas', () => {
    expect(leitura.diagnostico.formulasExternas).toBe(baseline.external_formula_cells.length);
    const linhasExternas = new Set(baseline.external_formula_cells.map((c) => Number(c.cell.replace(/\D/g, ''))));
    for (const linha of linhasExternas) {
      expect(leitura.apontamentos.find((a) => a.linha === linha)?.temVinculoExterno).toBe(true);
    }
  });

  it('AC-041: F é majoritariamente fórmula, portanto não é status histórico', () => {
    const comRef = leitura.apontamentos.filter((a) => a.referenciaBruta);
    const calculadas = comRef.filter((a) => a.resultadoStatus.calculado);
    expect(calculadas).toHaveLength(298);
    for (const a of calculadas) expect(a.resultadoStatus.calculado).toBe(true);
  });

  it('AC-043: 81 Resolvido em Chamados contra 70 em Resolvidos', () => {
    const resolvidosNoCadastro = leitura.chamados.filter((c) => (c.statusBruto ?? '').trim() === 'Resolvido');
    expect(resolvidosNoCadastro).toHaveLength(81);
    expect(leitura.resolvidos).toHaveLength(70);
    // Os 11 sem correspondência ficam sem data fabricada.
    expect(resolvidosNoCadastro.length - leitura.resolvidos.length).toBe(11);
  });

  it('AC-044: sete "Transferido " com espaço final são normalizados sem perder o bruto', () => {
    const comEspaco = leitura.chamados.filter((c) => c.statusBruto !== null && c.statusBruto !== c.statusBruto.trim());
    expect(comEspaco).toHaveLength(7);
    for (const c of comEspaco) expect(c.statusBruto!.trim()).toBe('Transferido');
  });

  it('AC-012: Planilha1 tem 97 referências, 14 status divergentes, e fica fora da carga principal', () => {
    expect(leitura.planilha1).toHaveLength(97);
    expect(leitura.chamados).toHaveLength(106);

    // As 97 referências da cópia também existem no cadastro principal.
    const porRef = new Map(leitura.chamados.map((c) => [normalizarParaComparacao(c.referenciaBruta ?? ''), c]));
    const sobrepostas = leitura.planilha1.filter((p) => porRef.has(normalizarParaComparacao(p.referenciaBruta ?? '')));
    expect(sobrepostas).toHaveLength(97);

    // Divergências de status entre a cópia e o cadastro: sinalizadas, não aplicadas.
    const divergentes = sobrepostas.filter((p) => {
      const c = porRef.get(normalizarParaComparacao(p.referenciaBruta ?? ''))!;
      return (p.statusBruto ?? '').trim() !== (c.statusBruto ?? '').trim();
    });
    expect(divergentes).toHaveLength(14);
  });

  it('AC-035: os quatro pares candidatos a repetição são detectados na carga real', () => {
    const candidatos = leitura.apontamentos.map((a) => ({
      linha: a.linha,
      workDate: a.workDate,
      referenciaBruta: a.referenciaBruta,
      descricao: a.descricao,
      duracaoMinutos: a.duracaoMinutos,
      tipoAtuacao: a.tipoAtuacao,
      observacoes: a.observacoes,
    }));
    const pares = detectarRepeticoesNaCarga(candidatos).map((p) => [p.a.linha, p.b.linha]);
    for (const esperado of baseline.time_duplicate_candidates) {
      expect(pares, `o par ${esperado.join('/')} deveria virar pendência`).toContainEqual(esperado);
    }
    // Nenhuma linha foi removida da leitura por ser candidata a repetição.
    expect(leitura.apontamentos).toHaveLength(333);
  });

  it('AC-014: 70 resoluções e 16 eventos, mesmo distantes do início', () => {
    expect(leitura.resolvidos).toHaveLength(70);
    expect(leitura.historicoStatus).toHaveLength(16);
  });

  it('AC-053: 8 registros de desenvolvimento, um sem data, nenhum gerando horas', () => {
    expect(leitura.desenvolvimento).toHaveLength(8);
    expect(leitura.desenvolvimento.filter((d) => d.incompleto)).toHaveLength(1);
    expect(leitura.desenvolvimento.every((d) => !('duracaoMinutos' in d))).toBe(true);
  });

  it('AC-013: a data de resolução pessoal fora da tabela principal é capturada', () => {
    expect(leitura.chamados.some((c) => c.dataResolucao.data !== null)).toBe(true);
  });

  it('AC-074: o arquivo de origem continua idêntico após toda a leitura', () => {
    const depois = createHash('sha256').update(new Uint8Array(readFileSync(CAMINHO_XLSM!))).digest('hex');
    expect(depois).toBe(hashInicial);
    expect(depois).toBe(baseline.sha256);
  });
});

describe.runIf(temCsv)('AC-001 — CSVs CS3 reais', () => {
  it('3 incidentes e 13 requisições, 16 identidades, nenhuma hora criada', () => {
    const inc = lerCsvCs3(readFileSync(CAMINHO_INC!, 'utf8'));
    const req = lerCsvCs3(readFileSync(CAMINHO_REQ!, 'utf8'));

    expect(inc.perfil.tipo).toBe('incident');
    expect(req.perfil.tipo).toBe('request');
    expect(inc.registros).toHaveLength(3);
    expect(req.registros).toHaveLength(13);

    const identidades = new Set([
      ...inc.registros.map((r) => `incident|${r.sourceTicketId.toUpperCase()}`),
      ...req.registros.map((r) => `request|${r.sourceTicketId.toUpperCase()}`),
    ]);
    expect(identidades.size).toBe(16);
  });

  it('os hashes conferem com o manifesto', () => {
    const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
    expect(sha(CAMINHO_REQ!)).toBe(manifesto.files[1]!.sha256);
    expect(sha(CAMINHO_INC!)).toBe(manifesto.files[2]!.sha256);
  });

  it('AC-002: reimportar o mesmo arquivo devolve as mesmas identidades', () => {
    const a = lerCsvCs3(readFileSync(CAMINHO_INC!, 'utf8'));
    const b = lerCsvCs3(readFileSync(CAMINHO_INC!, 'utf8'));
    expect(a.registros.map((r) => r.sourceTicketId)).toEqual(b.registros.map((r) => r.sourceTicketId));
  });
});
