import { describe, expect, it } from 'vitest';
import {
  formatarMinutos,
  fracaoDeDiaParaMinutos,
  rotularMinutos,
  textoHoraParaMinutos,
  validarNovaDuracao,
} from '../src/domain/time/duracao';
import fixtures from '../contratos/fixtures_sinteticas.json';

describe('AC-016 / AC-017 — conversão de duração do Excel', () => {
  it('0,125 vira 180 minutos, não 0,125 hora', () => {
    expect(fracaoDeDiaParaMinutos(0.125)).toEqual({ ok: true, minutos: 180 });
  });

  it('0,0625 vira 90 minutos', () => {
    expect(fracaoDeDiaParaMinutos(0.0625)).toEqual({ ok: true, minutos: 90 });
  });

  it('AC-017: 0,18958333333333333 vira 273 minutos (4h33), nunca 270', () => {
    const r = fracaoDeDiaParaMinutos(0.18958333333333333);
    expect(r).toEqual({ ok: true, minutos: 273 });
    expect(rotularMinutos(273)).toBe('4h33');
  });

  it('E316 do baseline: 30 minutos', () => {
    expect(fracaoDeDiaParaMinutos(30 / 1440)).toEqual({ ok: true, minutos: 30 });
  });

  it('AC-019: duração ausente fica incompleta, não vira 0 nem 8h', () => {
    expect(fracaoDeDiaParaMinutos(null)).toMatchObject({ ok: false, motivo: 'ausente' });
    expect(fracaoDeDiaParaMinutos('')).toMatchObject({ ok: false, motivo: 'ausente' });
    expect(fracaoDeDiaParaMinutos(undefined)).toMatchObject({ ok: false, motivo: 'ausente' });
  });

  it('não arredonda silenciosamente quando há segundos reais', () => {
    // 10 segundos = 1/8640 de dia: não é minuto inteiro.
    const r = fracaoDeDiaParaMinutos(10 / 86400);
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ motivo: 'segundos_reais' });
  });

  it('absorve apenas ruído de ponto flutuante', () => {
    // 273 minutos reconstruídos por caminho binário diferente.
    expect(fracaoDeDiaParaMinutos((273 / 1440) * 1.0000000000000002)).toEqual({ ok: true, minutos: 273 });
  });

  it('rejeita negativa e sinaliza acima de 24h', () => {
    expect(fracaoDeDiaParaMinutos(-0.1)).toMatchObject({ ok: false, motivo: 'negativa' });
    expect(fracaoDeDiaParaMinutos(1.5)).toMatchObject({ ok: false, motivo: 'excede_dia' });
  });

  it('todas as fixtures sintéticas de duração conferem', () => {
    for (const t of fixtures.durationTests) {
      if (t.unit === 'excel_day_fraction') {
        const r = fracaoDeDiaParaMinutos(t.raw);
        if (t.expectedMinutes === null) expect(r.ok).toBe(false);
        else expect(r).toEqual({ ok: true, minutos: t.expectedMinutes });
      } else {
        expect(textoHoraParaMinutos(String(t.raw))).toEqual({ ok: true, minutos: t.expectedMinutes });
      }
    }
  });
});

describe('parser próprio de HH:mm', () => {
  it('lê 04:33 como 273 minutos', () => {
    expect(textoHoraParaMinutos('04:33')).toEqual({ ok: true, minutos: 273 });
    expect(textoHoraParaMinutos('4:33')).toEqual({ ok: true, minutos: 273 });
  });

  it('aceita acumulado acima de 24h', () => {
    expect(textoHoraParaMinutos('561:33')).toEqual({ ok: true, minutos: 33693 });
  });

  it('recusa formato desconhecido em vez de adivinhar', () => {
    expect(textoHoraParaMinutos('4,33')).toMatchObject({ ok: false, motivo: 'nao_numerico' });
    expect(textoHoraParaMinutos('04:75')).toMatchObject({ ok: false, motivo: 'nao_numerico' });
  });

  it('sinaliza segundos em vez de descartá-los', () => {
    expect(textoHoraParaMinutos('04:33:20')).toMatchObject({ ok: false, motivo: 'segundos_reais' });
  });
});

describe('formatação', () => {
  it('formata 33.693 minutos como 561:33 (561h33 brutas)', () => {
    expect(formatarMinutos(33693)).toBe('561:33');
    expect(rotularMinutos(33693)).toBe('561h33');
  });

  it('formata casos comuns', () => {
    expect(rotularMinutos(30)).toBe('30 min');
    expect(rotularMinutos(480)).toBe('8h');
    expect(rotularMinutos(450)).toBe('7h30');
  });
});

describe('validação de novo apontamento (secção 5.1)', () => {
  it('exige inteiro positivo até 1.440 minutos', () => {
    expect(validarNovaDuracao(273).ok).toBe(true);
    expect(validarNovaDuracao(0).ok).toBe(false);
    expect(validarNovaDuracao(-5).ok).toBe(false);
    expect(validarNovaDuracao(1441).ok).toBe(false);
    expect(validarNovaDuracao(12.5).ok).toBe(false);
  });
});
