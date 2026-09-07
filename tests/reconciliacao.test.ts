import { describe, expect, it } from 'vitest';
import { compararTresEstados, conciliarCampos, iguais, temConflito } from '../src/domain/reconciliation/tresEstados';
import {
  casarPorMultiplicidade,
  chaveEstavel,
  detectarRepeticoesNaCarga,
  type CandidatoOrigem,
  type RegistroConhecido,
} from '../src/domain/reconciliation/multiplicidade';
import fixtures from '../especificacao/contratos/fixtures_sinteticas.json';

describe('AC-037 — comparação em três estados', () => {
  it('S = B mantém a edição local (A)', () => {
    const r = compararTresEstados('Original', 'Original', 'Minha edição');
    expect(r).toMatchObject({ tipo: 'sem_mudanca_na_origem', valor: 'Minha edição', conflito: false });
  });

  it('A = B e S mudou propõe a alteração da origem', () => {
    const r = compararTresEstados('Original', 'Nova versão', 'Original');
    expect(r).toMatchObject({ tipo: 'proposta_da_origem', valor: 'Nova versão', conflito: false });
  });

  it('A = S concilia sem conflito', () => {
    const r = compararTresEstados('Original', 'Igual', 'Igual');
    expect(r).toMatchObject({ tipo: 'ja_conciliado', valor: 'Igual', conflito: false });
  });

  it('ambos mudaram de formas diferentes exige decisão', () => {
    const r = compararTresEstados('Original', 'Nova versão', 'Minha edição');
    expect(r.conflito).toBe(true);
    expect(r).toMatchObject({ tipo: 'conflito', base: 'Original', origem: 'Nova versão', aplicativo: 'Minha edição' });
  });

  it('as fixtures sintéticas de três estados conferem', () => {
    for (const t of fixtures.threeWayMergeTests) {
      const r = compararTresEstados(t.base, t.source, t.app);
      expect(r.conflito).toBe(t.conflict);
      if ('expected' in t && t.expected !== undefined) expect((r as { valor: string }).valor).toBe(t.expected);
      if ('proposal' in t && t.proposal !== undefined) expect((r as { valor: string }).valor).toBe(t.proposal);
    }
  });

  it('espaços externos não criam diferença artificial', () => {
    expect(iguais('Transferido ', 'Transferido')).toBe(true);
    expect(compararTresEstados('Transferido', 'Transferido ', 'Transferido').tipo).toBe('sem_mudanca_na_origem');
  });

  it('zero não equivale a null', () => {
    expect(iguais(0, null)).toBe(false);
    expect(compararTresEstados(null, 0, null).tipo).toBe('proposta_da_origem');
  });
});

describe('AC-007 — coluna ausente na origem não entra na conciliação', () => {
  it('campo não enviado preserva o valor anterior sem virar limpeza', () => {
    const campos = conciliarCampos(
      [
        { campo: 'prioridade', rotulo: 'Prioridade', base: 'Alta', origem: null, aplicativo: 'Alta' },
        { campo: 'titulo', rotulo: 'Título', base: 'T1', origem: 'T2', aplicativo: 'T1' },
      ],
      new Set(['prioridade']),
    );
    expect(campos.map((c) => c.campo)).toEqual(['titulo']);
    expect(campos[0]!.resultado.tipo).toBe('proposta_da_origem');
  });

  it('campo presente e vazio aparece no comparativo para decisão', () => {
    const campos = conciliarCampos([{ campo: 'obs', rotulo: 'Observações', base: 'texto', origem: '', aplicativo: 'texto' }]);
    expect(campos[0]!.resultado.tipo).toBe('proposta_da_origem');
    expect(temConflito(campos)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

function cand(over: Partial<CandidatoOrigem> & { linha: number }): CandidatoOrigem {
  return {
    workDate: '2026-06-10',
    referenciaBruta: 'RR90000015',
    descricao: 'Análise do erro de faturamento',
    duracaoMinutos: 120,
    tipoAtuacao: 'Análise',
    observacoes: null,
    ...over,
  };
}

function conhecido(id: string, c: CandidatoOrigem, ocorrencia = 0): RegistroConhecido {
  return { id, ultimoValorImportado: c, ocorrencia };
}

describe('AC-034 — reordenação não cria horas', () => {
  it('as mesmas linhas em outra ordem continuam sendo os mesmos registros', () => {
    const original = [cand({ linha: 10 }), cand({ linha: 11, descricao: 'Outra atividade' })];
    const conhecidos = [conhecido('id-1', original[0]!), conhecido('id-2', original[1]!)];

    const reordenado = [cand({ linha: 4, descricao: 'Outra atividade' }), cand({ linha: 5 })];
    const r = casarPorMultiplicidade(reordenado, conhecidos);

    expect(r.filter((x) => x.classe === 'novo')).toHaveLength(0);
    expect(r.filter((x) => x.classe === 'igual')).toHaveLength(2);
    expect(r.map((x) => x.conhecido?.id).sort()).toEqual(['id-1', 'id-2']);
  });

  it('o número da linha não faz parte da identidade', () => {
    expect(chaveEstavel(cand({ linha: 10 }))).toBe(chaveEstavel(cand({ linha: 999 })));
  });
});

describe('AC-002 — reimportação idêntica não duplica', () => {
  it('a mesma carga duas vezes produz apenas "igual"', () => {
    const carga = [cand({ linha: 10 }), cand({ linha: 11, descricao: 'B' }), cand({ linha: 12, descricao: 'C' })];
    const conhecidos = carga.map((c, i) => conhecido(`id-${i}`, c));
    const r = casarPorMultiplicidade(carga, conhecidos);
    expect(r.every((x) => x.classe === 'igual')).toBe(true);
    expect(r).toHaveLength(3);
  });
});

describe('AC-036 — correção de duração é alteração, não atividade nova', () => {
  it('a mesma atividade com duração corrigida vira alteração do mesmo registro', () => {
    const antes = cand({ linha: 10, duracaoMinutos: 120 });
    const depois = cand({ linha: 10, duracaoMinutos: 150 });
    const r = casarPorMultiplicidade([depois], [conhecido('id-1', antes)]);

    expect(r).toHaveLength(1);
    expect(r[0]!.classe).toBe('alterado');
    expect(r[0]!.conhecido!.id).toBe('id-1');
    expect(r[0]!.motivo).toContain('120');
    expect(r[0]!.motivo).toContain('150');
  });
});

describe('multiplicidade — dois eventos iguais não viram um', () => {
  it('duas ocorrências idênticas continuam sendo duas', () => {
    const carga = [cand({ linha: 10 }), cand({ linha: 20 })];
    const conhecidos = [conhecido('id-1', carga[0]!, 0), conhecido('id-2', carga[1]!, 1)];
    const r = casarPorMultiplicidade(carga, conhecidos);
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.classe === 'igual')).toBe(true);
  });

  it('a carga com uma ocorrência a mais gera um novo, sem apagar os anteriores', () => {
    const base = cand({ linha: 10 });
    const r = casarPorMultiplicidade([cand({ linha: 10 }), cand({ linha: 20 })], [conhecido('id-1', base, 0)]);
    expect(r.filter((x) => x.classe === 'igual')).toHaveLength(1);
    expect(r.filter((x) => x.classe === 'novo')).toHaveLength(1);
  });

  it('AC-006: registro ausente da carga é preservado, não encerrado', () => {
    const base = cand({ linha: 10 });
    const r = casarPorMultiplicidade([], [conhecido('id-1', base)]);
    expect(r).toHaveLength(1);
    expect(r[0]!.classe).toBe('ausente_na_carga');
    expect(r[0]!.motivo).toMatch(/preservad/i);
  });

  it('correspondência ambígua exige confirmação em vez de escolher sozinha', () => {
    const a = cand({ linha: 10, duracaoMinutos: 120 });
    const b = cand({ linha: 20, duracaoMinutos: 120 });
    const conhecidos = [conhecido('id-1', a, 0), conhecido('id-2', b, 1)];
    const nova = [cand({ linha: 10, duracaoMinutos: 90 }), cand({ linha: 20, duracaoMinutos: 60 })];

    const r = casarPorMultiplicidade(nova, conhecidos);
    expect(r.every((x) => x.classe === 'ambiguo')).toBe(true);
    expect(r[0]!.disputantes).toHaveLength(2);
  });
});

describe('AC-035 — candidatos a repetição dentro da mesma carga', () => {
  it('os quatro pares do baseline viram quatro pendências, sem exclusão automática', () => {
    // Reproduz a forma dos pares 263/267, 264/268, 265/269 e 266/270.
    const carga: CandidatoOrigem[] = [];
    for (let i = 0; i < 4; i += 1) {
      const modelo = { descricao: `Atividade ${i}`, duracaoMinutos: 60 + i * 30, workDate: '2026-07-15' };
      carga.push(cand({ linha: 263 + i, ...modelo }));
      carga.push(cand({ linha: 267 + i, ...modelo }));
    }
    const pares = detectarRepeticoesNaCarga(carga);
    expect(pares).toHaveLength(4);
    for (const p of pares) {
      expect(p.b.linha - p.a.linha).toBe(4);
      // Nenhum dos dois foi removido da carga.
      expect(carga).toContain(p.a);
      expect(carga).toContain(p.b);
    }
  });

  it('não aponta repetição quando a duração difere', () => {
    const carga = [cand({ linha: 1, duracaoMinutos: 60 }), cand({ linha: 2, duracaoMinutos: 90 })];
    expect(detectarRepeticoesNaCarga(carga)).toHaveLength(0);
  });

  it('linhas sem duração não entram na detecção de repetição', () => {
    const carga = [cand({ linha: 1, duracaoMinutos: null }), cand({ linha: 2, duracaoMinutos: null })];
    expect(detectarRepeticoesNaCarga(carga)).toHaveLength(0);
  });
});
