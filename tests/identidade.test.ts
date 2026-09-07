import { describe, expect, it } from 'vitest';
import {
  chaveOficial,
  lerReferencia,
  normalizarParaComparacao,
  referenciasCitadasEmTexto,
} from '../src/domain/entities/identidade';
import {
  celulaEfetiva,
  divergenciaDeCelula,
  exibirStatusCs3,
  normalizarAndamentoPessoal,
  sugerirCelulaPorTag3,
} from '../src/domain/entities/celulas';

describe('AC-031 — duas referências numa linha', () => {
  it('RR90000011/RR90000012 vira grupo com dois candidatos, sem fundir tickets', () => {
    const r = lerReferencia('RR90000011/RR90000012');
    expect(r.multiplo).toBe(true);
    expect(r.candidatos.map((c) => c.normalizado)).toEqual(['RR90000011', 'RR90000012']);
    expect(r.candidatos.every((c) => c.namespace === 'RR')).toBe(true);
    expect(r.bruto).toBe('RR90000011/RR90000012');
  });

  it('B215: "IR90000013 ; RR90000014" separa namespaces distintos', () => {
    const r = lerReferencia('IR90000013 ; RR90000014');
    expect(r.candidatos.map((c) => [c.namespace, c.normalizado])).toEqual([
      ['IR', 'IR90000013'],
      ['RR', 'RR90000014'],
    ]);
  });

  it('B294: "RR90000015 / RR90000016" é múltiplo', () => {
    const r = lerReferencia('RR90000015 / RR90000016');
    expect(r.multiplo).toBe(true);
    expect(r.candidatos).toHaveLength(2);
  });
});

describe('AC-032 — referências compostas e namespaces', () => {
  it('B240: IR90000017_INC90000018 são dois namespaces relacionados', () => {
    const r = lerReferencia('IR90000017_INC90000018');
    expect(r.composto).toBe(true);
    expect(r.candidatos.map((c) => c.namespace)).toEqual(['IR', 'INC']);
    // O texto completo continua sendo a referência bruta: nenhum ticket fictício.
    expect(r.bruto).toBe('IR90000017_INC90000018');
  });

  it('B310: CR90019_RR90000020 mantém CR e RR separados', () => {
    const r = lerReferencia('CR90019_RR90000020');
    expect(r.composto).toBe(true);
    expect(r.candidatos.map((c) => c.namespace)).toEqual(['CR', 'RR']);
  });

  it('B170: SCTASK90000021 tem namespace próprio, não IR/RR', () => {
    const r = lerReferencia('SCTASK90000021');
    expect(r.multiplo).toBe(false);
    expect(r.candidatos[0]!.namespace).toBe('SCTASK');
  });

  it('RITM e INC não são tratados como IR/RR', () => {
    expect(lerReferencia('RITM0012345').candidatos[0]!.namespace).toBe('RITM');
    expect(lerReferencia('INC90000018').candidatos[0]!.namespace).toBe('INC');
  });

  it('um sublinhado que não separa namespaces não vira composto', () => {
    const r = lerReferencia('ASSUNTO_QUALQUER');
    expect(r.composto).toBe(false);
    expect(r.candidatos).toHaveLength(1);
    expect(r.candidatos[0]!.namespace).toBe('OUTRO');
  });
});

describe('AC-033 — espaços, caixa e identidade', () => {
  it('normaliza para comparar mas preserva o bruto', () => {
    const r = lerReferencia('  rr90000011 ');
    expect(r.candidatos[0]!.normalizado).toBe('RR90000011');
    expect(r.candidatos[0]!.bruto).toBe('rr90000011');
  });

  it('espaço não separável (NBSP) não cria identidade diferente', () => {
    expect(normalizarParaComparacao(' RR90000011 ')).toBe('RR90000011');
  });

  it('a chave oficial não usa título nem Reference ID', () => {
    const k1 = chaveOficial('ws', 'CS3', 'incident', 'IR90000013');
    const k2 = chaveOficial('ws', 'CS3', 'incident', ' ir90000013 ');
    expect(k1).toBe(k2);
    // Mesmo ID em tipos diferentes é identidade diferente.
    expect(chaveOficial('ws', 'CS3', 'request', 'IR90000013')).not.toBe(k1);
  });

  it('célula vazia não produz candidato', () => {
    expect(lerReferencia('').candidatos).toEqual([]);
    expect(lerReferencia(null).candidatos).toEqual([]);
    expect(lerReferencia('   ').candidatos).toEqual([]);
  });
});

describe('AC-027 — referências citadas em texto livre (C194)', () => {
  it('sugere os dois incidentes sem escolher um arbitrariamente', () => {
    const achados = referenciasCitadasEmTexto('Analisado junto ao IR32000001 e ao IR32000002 na mesma reunião');
    expect(achados.map((r) => r.normalizado)).toEqual(['IR32000001', 'IR32000002']);
  });

  it('não inventa referência onde não há', () => {
    expect(referenciasCitadasEmTexto('Reunião de alinhamento sem chamado')).toEqual([]);
    expect(referenciasCitadasEmTexto(null)).toEqual([]);
  });
});

describe('AC-047 / AC-048 — sugestão de célula pela Tag 3', () => {
  it('MELHORIA SQUAD sugere Squad de forma definida', () => {
    expect(sugerirCelulaPorTag3('MELHORIA SQUAD')).toMatchObject({ celula: 'SQUAD', forca: 'definida' });
  });

  it('TASK FORCE sugere Task Force', () => {
    expect(sugerirCelulaPorTag3('TASK FORCE')).toMatchObject({ celula: 'TASK_FORCE', forca: 'definida' });
  });

  it('BASELINE sozinho sugere AMS apenas a confirmar', () => {
    expect(sugerirCelulaPorTag3('BASELINE')).toMatchObject({ celula: 'AMS', forca: 'a_confirmar' });
  });

  it('AC-048: EXTRABASELINE vai para revisão, nunca AMS', () => {
    const r = sugerirCelulaPorTag3('EXTRABASELINE');
    expect(r.celula).toBeNull();
    expect(r.forca).toBe('revisao');
  });

  it('EXTRABASELINE é avaliado antes de BASELINE mesmo em texto combinado', () => {
    expect(sugerirCelulaPorTag3('SAP EXTRABASELINE 2026').celula).toBeNull();
  });

  it('tag vazia ou desconhecida vai para revisão', () => {
    expect(sugerirCelulaPorTag3('').forca).toBe('revisao');
    expect(sugerirCelulaPorTag3(null).forca).toBe('revisao');
    expect(sugerirCelulaPorTag3('OUTRA COISA').forca).toBe('revisao');
  });

  it('preserva a grafia original da tag avaliada', () => {
    expect(sugerirCelulaPorTag3('  melhoria squad  ').tagBruta).toBe('  melhoria squad  ');
  });
});

describe('AC-046 — precedência da célula manual', () => {
  it('a célula manual prevalece sobre a sugerida', () => {
    expect(celulaEfetiva('TASK_FORCE', 'AMS')).toBe('TASK_FORCE');
  });

  it('sem manual nem sugestão o esforço vai para Sem classificação, não some', () => {
    expect(celulaEfetiva(null, null)).toBe('UNCLASSIFIED');
  });

  it('tag divergente gera aviso, não reclassificação', () => {
    const aviso = divergenciaDeCelula('AMS', sugerirCelulaPorTag3('MELHORIA SQUAD'));
    expect(aviso).toContain('manual');
    expect(divergenciaDeCelula('SQUAD', sugerirCelulaPorTag3('MELHORIA SQUAD'))).toBeNull();
    expect(divergenciaDeCelula(null, sugerirCelulaPorTag3('MELHORIA SQUAD'))).toBeNull();
  });
});

describe('status CS3 e andamento pessoal', () => {
  it('mapa amigável preserva o bruto e não trata Updated como encerrado', () => {
    expect(exibirStatusCs3('Working')).toMatchObject({ amigavel: 'Em atendimento', naoMapeado: false });
    expect(exibirStatusCs3('Wait on User').amigavel).toBe('Aguardando usuário');
    expect(exibirStatusCs3('Wait on External').amigavel).toBe('Aguardando terceiro');
    const upd = exibirStatusCs3('Updated');
    expect(upd.amigavel).toBe('Atualizado / revisar');
    expect(upd.amigavel).not.toMatch(/encerrad/i);
  });

  it('status novo fica visível como não mapeado', () => {
    const r = exibirStatusCs3('Pending Vendor');
    expect(r.naoMapeado).toBe(true);
    expect(r.bruto).toBe('Pending Vendor');
    expect(r.amigavel).toContain('não mapeado');
  });

  it('AC-044: "Transferido " com espaço final é a mesma identidade, com bruto preservado', () => {
    const r = normalizarAndamentoPessoal('Transferido ');
    expect(r.normalizado).toBe('Transferido');
    expect(r.bruto).toBe('Transferido ');
    expect(r.aparado).toBe(true);
  });

  it('preserva o catálogo legado, incluindo Em andamento ABAP', () => {
    expect(normalizarAndamentoPessoal('Em andamento ABAP').normalizado).toBe('Em andamento ABAP');
    expect(normalizarAndamentoPessoal('Aguardando terceiros').normalizado).toBe('Aguardando terceiros');
  });

  it('valor fora do catálogo é mantido em vez de descartado', () => {
    expect(normalizarAndamentoPessoal('Situação nova').normalizado).toBe('Situação nova');
  });
});
