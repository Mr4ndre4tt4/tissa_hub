import { describe, expect, it } from 'vitest';
import {
  compararCarimbos,
  dataParaSerial,
  diaDaSemana,
  diferencaEmDias,
  ehDataValida,
  enumerarPeriodo,
  lerCarimboCs3,
  serialParaData,
  somarDias,
} from '../src/domain/time/datas';

describe('AC-020 — datas seriais e calendário', () => {
  it('converte seriais do sistema 1900 corretamente', () => {
    // Referências conhecidas do Excel: 1 = 01/01/1900, 61 = 01/03/1900.
    expect(serialParaData(1)).toEqual({ ok: true, data: '1900-01-01' });
    expect(serialParaData(59)).toEqual({ ok: true, data: '1900-02-28' });
    expect(serialParaData(61)).toEqual({ ok: true, data: '1900-03-01' });
    expect(serialParaData(25569)).toEqual({ ok: true, data: '1970-01-01' });
    expect(serialParaData(45000)).toEqual({ ok: true, data: '2023-03-15' });
  });

  it('o serial fictício 60 não vira data histórica válida', () => {
    const r = serialParaData(60);
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ motivo: 'serial_ficticio' });
  });

  it('respeita o sistema 1904 quando o arquivo declara', () => {
    expect(serialParaData(0 + 1, 1904)).toEqual({ ok: true, data: '1904-01-02' });
    expect(serialParaData(25569 - 1462, 1904)).toEqual({ ok: true, data: '1970-01-01' });
  });

  it('ida e volta de serial é estável nas datas do baseline', () => {
    for (const data of ['2026-05-18', '2026-08-31', '2026-09-04']) {
      const serial = dataParaSerial(data);
      expect(serialParaData(serial)).toEqual({ ok: true, data });
    }
  });

  it('não desloca dia por conversão de fuso', () => {
    // A aritmética é puramente civil; nenhum ponto do período perde um dia.
    for (const data of enumerarPeriodo('2026-05-18', '2026-09-04')) {
      expect(serialParaData(dataParaSerial(data))).toEqual({ ok: true, data });
    }
  });

  it('valida datas civis de verdade', () => {
    expect(ehDataValida('2026-02-28')).toBe(true);
    expect(ehDataValida('2026-02-29')).toBe(false);
    expect(ehDataValida('2024-02-29')).toBe(true);
    expect(ehDataValida('2026-13-01')).toBe(false);
    expect(ehDataValida('2026-04-31')).toBe(false);
  });
});

describe('carimbo CS3 DD/MM/AAAA HH:mm:ss', () => {
  it('lê data e hora local sem converter para UTC', () => {
    const r = lerCarimboCs3('04/09/2026 14:35:12');
    expect(r).toEqual({ ok: true, valor: { data: '2026-09-04', horaLocal: '14:35:12', bruto: '04/09/2026 14:35:12' } });
  });

  it('não confunde dia com mês', () => {
    const r = lerCarimboCs3('05/11/2026 08:00:00');
    expect(r.ok && r.valor.data).toBe('2026-11-05');
  });

  it('recusa data inexistente em vez de normalizar', () => {
    expect(lerCarimboCs3('31/02/2026 10:00:00').ok).toBe(false);
    expect(lerCarimboCs3('2026-09-04').ok).toBe(false);
  });
});

describe('AC-005 / secção 8.3 — comparação de versões de origem', () => {
  const a = lerCarimboCs3('04/09/2026 10:00:00');
  const b = lerCarimboCs3('04/09/2026 12:00:00');

  it('ordena carimbos do mesmo perfil', () => {
    if (!a.ok || !b.ok) throw new Error('fixture inválida');
    expect(compararCarimbos(a.valor, b.valor)).toBe(-1);
    expect(compararCarimbos(b.valor, a.valor)).toBe(1);
    expect(compararCarimbos(a.valor, a.valor)).toBe(0);
  });

  it('devolve null quando os carimbos não são comparáveis', () => {
    if (!a.ok) throw new Error('fixture inválida');
    const semHora = lerCarimboCs3('04/09/2026');
    if (!semHora.ok) throw new Error('fixture inválida');
    expect(compararCarimbos(a.valor, semHora.valor)).toBeNull();
  });
});

describe('aritmética civil', () => {
  it('conta dias entre datas', () => {
    expect(diferencaEmDias('2026-05-18', '2026-08-31')).toBe(105);
    expect(diferencaEmDias('2026-09-04', '2026-09-04')).toBe(0);
    expect(diferencaEmDias('2026-09-05', '2026-09-04')).toBe(-1);
  });

  it('soma dias atravessando meses e anos', () => {
    expect(somarDias('2026-08-31', 1)).toBe('2026-09-01');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('calcula dia da semana sem objeto Date', () => {
    expect(diaDaSemana('1970-01-01')).toBe(4); // quinta
    expect(diaDaSemana('2026-09-07')).toBe(1); // segunda
    expect(diaDaSemana('2026-09-06')).toBe(0); // domingo
  });
});
