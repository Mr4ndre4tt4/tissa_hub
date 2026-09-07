import { describe, expect, it } from 'vitest';
import {
  esforcoDoTicket,
  reconciliarTotais,
  totaisPorCelula,
  validarAlocacoes,
} from '../src/domain/time/alocacao';
import { alocacao, apontamento, idSintetico, referencia } from './apoio/construtores';
import fixtures from '../especificacao/contratos/fixtures_sinteticas.json';

const TICKET_A = idSintetico('t');
const TICKET_B = idSintetico('t');

describe('AC-024 — compartilhamento sem rateio', () => {
  it('120 min em dois chamados somam 120 no dia e zero em cada ticket', () => {
    const e = apontamento({ duracaoMinutos: 120 });
    const refs = [referencia(e.id, 'RR90000001', TICKET_A), referencia(e.id, 'IR90000002', TICKET_B)];

    const totais = reconciliarTotais([e], refs, []);
    expect(totais.totalConfirmado).toBe(120);
    expect(totais.compartilhadoSemRateio).toBe(120);
    expect(totais.atribuidoATickets).toBe(0);

    // Nenhum ticket recebe os 120 integrais.
    expect(esforcoDoTicket(TICKET_A, [e], refs, []).atribuidoMinutos).toBe(0);
    expect(esforcoDoTicket(TICKET_B, [e], refs, []).atribuidoMinutos).toBe(0);
    expect(esforcoDoTicket(TICKET_A, [e], refs, []).compartilhadoSemRateioMinutos).toBe(120);
  });

  it('o apontamento compartilhado não é contado duas vezes no total', () => {
    const e = apontamento({ duracaoMinutos: 120 });
    const refs = [referencia(e.id, 'RR90000001', TICKET_A), referencia(e.id, 'IR90000002', TICKET_B)];
    const t = reconciliarTotais([e], refs, []);
    expect(t.atribuidoATickets + t.compartilhadoSemRateio + t.atividadeInterna + t.referenciaSemVinculoConfirmado).toBe(120);
    expect(t.fecha).toBe(true);
  });
});

describe('AC-025 — rateio confirmado', () => {
  it('75 + 45 = 120 é aceito e distribui corretamente', () => {
    const e = apontamento({ duracaoMinutos: 120 });
    const refs = [referencia(e.id, 'RR90000001', TICKET_A), referencia(e.id, 'IR90000002', TICKET_B)];
    const alocs = [alocacao(e.id, TICKET_A, 75), alocacao(e.id, TICKET_B, 45)];

    expect(validarAlocacoes(120, alocs).ok).toBe(true);
    const totais = reconciliarTotais([e], refs, alocs);
    expect(totais.totalConfirmado).toBe(120);
    expect(totais.atribuidoATickets).toBe(120);
    expect(totais.compartilhadoSemRateio).toBe(0);

    expect(esforcoDoTicket(TICKET_A, [e], refs, alocs).atribuidoMinutos).toBe(75);
    expect(esforcoDoTicket(TICKET_B, [e], refs, alocs).atribuidoMinutos).toBe(45);
  });

  it('75 + 60 é rejeitado com allocation_sum_mismatch', () => {
    const r = validarAlocacoes(120, [
      { ticketId: TICKET_A, minutos: 75 },
      { ticketId: TICKET_B, minutos: 60 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.erro).toBe('allocation_sum_mismatch');
  });

  it('rejeita alocação não positiva e ticket repetido', () => {
    expect(validarAlocacoes(120, [{ ticketId: TICKET_A, minutos: 0 }]).erro).toBe('allocation_not_positive');
    expect(
      validarAlocacoes(120, [
        { ticketId: TICKET_A, minutos: 60 },
        { ticketId: TICKET_A, minutos: 60 },
      ]).erro,
    ).toBe('allocation_duplicate_ticket');
  });

  it('as fixtures sintéticas de alocação conferem', () => {
    for (const t of fixtures.allocationTests) {
      const alocs = t.allocations.map((a, i) => ({ ticketId: `ticket-${a.ref}-${i}`, minutos: a.minutes }));
      const r = validarAlocacoes(t.durationMinutes, alocs);
      if ('expectedError' in t) expect(r.erro).toBe(t.expectedError);
      else if (alocs.length > 0) expect(r.ok).toBe(true);
    }
  });
});

describe('AC-049 — reconciliação das cinco classes', () => {
  it('as classes são mutuamente exclusivas e fecham com o total', () => {
    const interna = apontamento({ duracaoMinutos: 60, celula: 'GENERAL' });
    const doTicket = apontamento({ duracaoMinutos: 120, celula: 'AMS' });
    const provisoria = apontamento({ duracaoMinutos: 30, celula: 'UNCLASSIFIED' });
    const compartilhada = apontamento({ duracaoMinutos: 90, celula: 'SQUAD' });

    const refs = [
      referencia(doTicket.id, 'RR90000001', TICKET_A),
      referencia(provisoria.id, 'RR90000003', null),
      referencia(compartilhada.id, 'RR90000001', TICKET_A),
      referencia(compartilhada.id, 'IR90000002', TICKET_B),
    ];

    const t = reconciliarTotais([interna, doTicket, provisoria, compartilhada], refs, []);
    expect(t).toMatchObject({
      atribuidoATickets: 120,
      compartilhadoSemRateio: 90,
      atividadeInterna: 60,
      referenciaSemVinculoConfirmado: 30,
      totalConfirmado: 300,
      fecha: true,
    });
  });

  it('AMS + Squad + Task Force + Geral + Sem classificação = total confirmado', () => {
    const entradas = [
      apontamento({ duracaoMinutos: 120, celula: 'AMS' }),
      apontamento({ duracaoMinutos: 90, celula: 'SQUAD' }),
      apontamento({ duracaoMinutos: 60, celula: 'TASK_FORCE' }),
      apontamento({ duracaoMinutos: 30, celula: 'GENERAL' }),
      apontamento({ duracaoMinutos: 45, celula: 'UNCLASSIFIED' }),
      // Fora do total confirmado: não pode desbalancear o eixo de células.
      apontamento({ duracaoMinutos: 999, celula: 'AMS', estadoOperacional: 'draft' }),
    ];
    const r = totaisPorCelula(entradas);
    expect(r.totalConfirmado).toBe(345);
    expect(r.porCelula).toEqual({ AMS: 120, SQUAD: 90, TASK_FORCE: 60, GENERAL: 30, UNCLASSIFIED: 45 });
    expect(r.fecha).toBe(true);
  });

  it('AC-030: cancelado sai do total mas o registro continua existindo', () => {
    const vivo = apontamento({ duracaoMinutos: 120 });
    const cancelado = apontamento({
      duracaoMinutos: 60,
      estadoOperacional: 'cancelled',
      canceladoEm: '2026-09-07T10:00:00-03:00',
      motivoCancelamento: 'Lançado em duplicidade',
    });
    expect(reconciliarTotais([vivo, cancelado], [], []).totalConfirmado).toBe(120);
    expect(cancelado.motivoCancelamento).toBe('Lançado em duplicidade');
    expect(cancelado.canceladoEm).not.toBeNull();
  });
});

describe('AC-028 — nunca somar totais derivados junto do detalhe', () => {
  it('o esforço do ticket vem só dos apontamentos, não de snapshots', () => {
    const e = apontamento({ duracaoMinutos: 273 });
    const refs = [referencia(e.id, 'RR90000001', TICKET_A)];
    // Um snapshot legado de "horas apontadas" existiria à parte; aqui provamos
    // que a função de esforço só enxerga apontamentos e alocações.
    expect(esforcoDoTicket(TICKET_A, [e], refs, []).atribuidoMinutos).toBe(273);
  });
});
