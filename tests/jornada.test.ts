import { describe, expect, it } from 'vitest';
import { diasVencidosIncompletos, metaDaData, metaDoPeriodo, saldoDoDia } from '../src/domain/time/jornada';
import { apontamento, jornadaPadrao } from './apoio/construtores';
import fixtures from '../contratos/fixtures_sinteticas.json';

const SEG = '2026-09-07'; // segunda-feira
const SAB = '2026-09-05'; // sábado

describe('AC-021 / AC-022 — meta diária de 480 minutos', () => {
  it('AC-021: 7h30 realizadas deixam 30 min faltantes e zero de excedente', () => {
    const s = saldoDoDia(SEG, [apontamento({ workDate: SEG, duracaoMinutos: 450 })], jornadaPadrao(), []);
    expect(s).toMatchObject({ metaMinutos: 480, realizadoMinutos: 450, faltanteMinutos: 30, excedenteMinutos: 0 });
  });

  it('AC-022: 8h15 excedem em 15 min sem truncar a duração', () => {
    const s = saldoDoDia(SEG, [apontamento({ workDate: SEG, duracaoMinutos: 495 })], jornadaPadrao(), []);
    expect(s).toMatchObject({ metaMinutos: 480, realizadoMinutos: 495, faltanteMinutos: 0, excedenteMinutos: 15 });
  });

  it('faltante e excedente nunca são positivos ao mesmo tempo', () => {
    for (const minutos of [0, 1, 200, 480, 481, 900, 1440]) {
      const s = saldoDoDia(SEG, [apontamento({ workDate: SEG, duracaoMinutos: minutos })], jornadaPadrao(), []);
      expect(s.faltanteMinutos > 0 && s.excedenteMinutos > 0).toBe(false);
    }
  });

  it('a meta é do conjunto das atividades, não por célula', () => {
    const entradas = [
      apontamento({ workDate: SEG, duracaoMinutos: 180, celula: 'AMS' }),
      apontamento({ workDate: SEG, duracaoMinutos: 180, celula: 'SQUAD' }),
      apontamento({ workDate: SEG, duracaoMinutos: 120, celula: 'TASK_FORCE' }),
    ];
    expect(saldoDoDia(SEG, entradas, jornadaPadrao(), [])).toMatchObject({ realizadoMinutos: 480, faltanteMinutos: 0 });
  });

  it('nunca completa a meta artificialmente nem compensa outro dia', () => {
    const entradas = [
      apontamento({ workDate: '2026-09-01', duracaoMinutos: 600 }),
      apontamento({ workDate: '2026-09-02', duracaoMinutos: 300 }),
    ];
    expect(saldoDoDia('2026-09-02', entradas, jornadaPadrao(), []).realizadoMinutos).toBe(300);
    expect(saldoDoDia('2026-09-02', entradas, jornadaPadrao(), []).faltanteMinutos).toBe(180);
  });

  it('as fixtures sintéticas de saldo conferem', () => {
    for (const t of fixtures.dailyBalanceTests) {
      const schedule = { ...jornadaPadrao(), metaPorDiaSemana: [0, t.targetMinutes, 0, 0, 0, 0, 0] as Schedule7 };
      const s = saldoDoDia(SEG, [apontamento({ workDate: SEG, duracaoMinutos: t.confirmedMinutes || null })], schedule, []);
      expect(s.faltanteMinutos).toBe(t.missingMinutes);
      expect(s.excedenteMinutos).toBe(t.excessMinutes);
    }
  });
});

type Schedule7 = [number, number, number, number, number, number, number];

describe('AC-019 — o que entra e o que não entra no total confirmado', () => {
  it('rascunho, cancelado, sem duração e em quarentena ficam fora', () => {
    const entradas = [
      apontamento({ workDate: SEG, duracaoMinutos: 120 }),
      apontamento({ workDate: SEG, duracaoMinutos: 60, estadoOperacional: 'draft' }),
      apontamento({ workDate: SEG, duracaoMinutos: 60, estadoOperacional: 'cancelled', canceladoEm: '2026-09-07T10:00:00-03:00' }),
      apontamento({ workDate: SEG, duracaoMinutos: null }),
      apontamento({ workDate: SEG, duracaoMinutos: 90, estadoImportacao: 'needs_review' }),
      apontamento({ workDate: SEG, duracaoMinutos: 90, elegivelJornada: false }),
    ];
    const s = saldoDoDia(SEG, entradas, jornadaPadrao(), []);
    expect(s.realizadoMinutos).toBe(120);
    // Sem duração, quarentena e não elegível continuam visíveis como incompletos.
    expect(s.incompletos).toBe(3);
  });

  it('duração ausente não vira 0 nem 8h de trabalho', () => {
    const s = saldoDoDia(SEG, [apontamento({ workDate: SEG, duracaoMinutos: null })], jornadaPadrao(), []);
    expect(s.realizadoMinutos).toBe(0);
    expect(s.faltanteMinutos).toBe(480);
    expect(s.incompletos).toBe(1);
  });
});

describe('AC-023 — exceções de jornada', () => {
  it('férias zeram a meta e não geram falta', () => {
    const s = saldoDoDia(SEG, [], jornadaPadrao(), [{ data: SEG, metaMinutos: 0, motivo: 'Férias' }]);
    expect(s).toMatchObject({ metaMinutos: 0, faltanteMinutos: 0, excedenteMinutos: 0 });
  });

  it('jornada parcial usa a meta de 240 minutos', () => {
    const s = saldoDoDia(SEG, [apontamento({ workDate: SEG, duracaoMinutos: 240 })], jornadaPadrao(), [
      { data: SEG, metaMinutos: 240, motivo: 'Jornada reduzida' },
    ]);
    expect(s).toMatchObject({ metaMinutos: 240, faltanteMinutos: 0, excedenteMinutos: 0 });
  });

  it('fim de semana tem meta zero pelo padrão configurável', () => {
    expect(metaDaData(SAB, jornadaPadrao(), [])).toBe(0);
    expect(metaDaData(SEG, jornadaPadrao(), [])).toBe(480);
  });

  it('dias futuros não são atraso', () => {
    const vencidos = diasVencidosIncompletos('2026-09-07', [], jornadaPadrao('2026-09-01'), []);
    expect(vencidos.every((v) => v.data < '2026-09-07')).toBe(true);
    expect(vencidos.some((v) => v.data === '2026-09-07')).toBe(false);
  });

  it('antes do início do controle não há pendência de jornada', () => {
    const vencidos = diasVencidosIncompletos('2026-09-07', [], jornadaPadrao('2026-09-03'), []);
    expect(vencidos.every((v) => v.data >= '2026-09-03')).toBe(true);
    // 03/09 (quinta) e 04/09 (sexta) são úteis e ficaram sem esforço.
    expect(vencidos.map((v) => v.data)).toEqual(['2026-09-03', '2026-09-04']);
  });

  it('sem início de controle definido, nada é cobrado retroativamente', () => {
    expect(diasVencidosIncompletos('2026-09-07', [], jornadaPadrao(null), [])).toEqual([]);
  });
});

describe('meta do período', () => {
  it('separa meta vencida até ontem, de hoje e total', () => {
    const r = metaDoPeriodo('2026-09-01', '2026-09-11', '2026-09-07', [], jornadaPadrao(), []);
    // 01–04 são úteis (4 dias), 07 é hoje, 08–11 futuros (4 dias). Total 9 × 480.
    expect(r.metaVencidaAteOntem).toBe(4 * 480);
    expect(r.metaDeHoje).toBe(480);
    expect(r.metaTotalPeriodo).toBe(9 * 480);
  });
});
