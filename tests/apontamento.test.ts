/**
 * Apontamento de horas contra um chamado ainda não importado (secção 8.5).
 *
 * Bug real relatado ao vivo: a pessoa registrava horas citando um chamado
 * (ex. "IR90000099") que ainda não tinha vindo de nenhuma extração CS3, e o
 * chamado simplesmente não aparecia em lugar nenhum — a referência ficava
 * com `ticketId: null`, órfã. `domain/reconciliation/importacao.ts` já sabia
 * completar um chamado `provisorio` quando a extração oficial chegasse, mas
 * nada nunca criava um: a metade que faltava.
 */
import { describe, expect, it } from 'vitest';
import { novoWorkspace, revisaoInicial } from '../src/domain/entities/revisao';
import { aplicarApontamento, resolverOuCriarTicket, type DadosFormulario } from '../src/features/day/MeuDia';
import type { Revision, Ticket } from '../src/domain/entities/tipos';

function baseVazia(): Revision {
  return revisaoInicial(novoWorkspace('Base de teste', '00000000-0000-4000-8000-000000000001'));
}

function dados(parcial: Partial<DadosFormulario> = {}): DadosFormulario {
  return {
    workDate: '2026-09-08',
    descricao: 'Investigação do incidente',
    duracaoTexto: '01:00',
    celula: 'AMS',
    referenciaBruta: '',
    tipoAtuacao: '',
    observacao: '',
    lancamentoExterno: false,
    ...parcial,
  };
}

describe('resolverOuCriarTicket', () => {
  it('cria um chamado provisório quando nenhuma referência bate', () => {
    const { id, tickets } = resolverOuCriarTicket(
      [],
      { bruto: 'IR90000099', namespace: 'IR', normalizado: 'IR90000099' },
      '00000000-0000-4000-8000-000000000001',
      '2026-09-08T10:00:00.000Z',
    );
    expect(tickets).toHaveLength(1);
    expect(tickets[0]!.id).toBe(id);
    expect(tickets[0]!.provisorio).toBe(true);
    expect(tickets[0]!.sourceSystem).toBeNull();
    expect(tickets[0]!.oficial).toBeNull();
  });

  it('reaproveita um chamado já existente pela referência normalizada, sem duplicar', () => {
    const existente: Ticket = {
      id: 'ticket-1',
      workspaceId: '00000000-0000-4000-8000-000000000001',
      sourceSystem: 'CS3',
      ticketType: 'incident',
      sourceTicketId: 'IR90000099',
      provisorio: false,
      referencia: { bruto: 'IR90000099', namespace: 'IR', normalizado: 'IR90000099' },
      oficial: null,
      versaoFonte: null,
      versaoFonteInstante: null,
      proveniencia: [],
      criadoEm: '2026-01-01T00:00:00.000Z',
      atualizadoEm: '2026-01-01T00:00:00.000Z',
      versao: 1,
    };
    const { id, tickets } = resolverOuCriarTicket(
      [existente],
      { bruto: 'ir90000099', namespace: 'IR', normalizado: 'IR90000099' },
      '00000000-0000-4000-8000-000000000001',
      '2026-09-08T10:00:00.000Z',
    );
    expect(id).toBe('ticket-1');
    expect(tickets).toHaveLength(1);
  });
});

describe('aplicarApontamento — referência a um chamado ainda não importado', () => {
  it('cria o chamado provisório junto com o apontamento, em vez de deixar a referência órfã', () => {
    const base = baseVazia();
    expect(base.tickets).toHaveLength(0);

    const nova = aplicarApontamento(base, null, dados({ referenciaBruta: 'IR90000099' }), false);

    expect(nova.tickets).toHaveLength(1);
    expect(nova.tickets[0]!.provisorio).toBe(true);
    expect(nova.tickets[0]!.referencia.normalizado).toBe('IR90000099');

    expect(nova.timeEntries).toHaveLength(1);
    const ref = nova.timeEntryReferences.find((r) => r.timeEntryId === nova.timeEntries[0]!.id);
    expect(ref?.ticketId).toBe(nova.tickets[0]!.id);
  });

  it('duas citações do mesmo chamado no mesmo apontamento não criam dois provisórios', () => {
    const base = baseVazia();
    const nova = aplicarApontamento(base, null, dados({ referenciaBruta: 'IR90000099 ; IR90000099' }), false);
    expect(nova.tickets).toHaveLength(1);
  });

  it('citar um chamado já existente na base não cria um segundo', () => {
    const primeira = aplicarApontamento(baseVazia(), null, dados({ referenciaBruta: 'IR90000099' }), false);
    const segunda = aplicarApontamento(primeira, null, dados({ referenciaBruta: 'IR90000099', workDate: '2026-09-09' }), false);

    expect(segunda.tickets).toHaveLength(1);
    expect(segunda.timeEntries).toHaveLength(2);
    const idsDeChamado = new Set(segunda.timeEntryReferences.map((r) => r.ticketId));
    expect(idsDeChamado.size).toBe(1);
  });

  it('atividade interna, sem referência, não cria chamado nenhum', () => {
    const nova = aplicarApontamento(baseVazia(), null, dados({ referenciaBruta: '' }), false);
    expect(nova.tickets).toHaveLength(0);
  });

  it('editar um apontamento existente também resolve a referência para o mesmo chamado provisório', () => {
    const criada = aplicarApontamento(baseVazia(), null, dados({ referenciaBruta: 'IR90000099' }), false);
    const entrada = criada.timeEntries[0]!;

    const editada = aplicarApontamento(criada, entrada, dados({ referenciaBruta: 'IR90000099', descricao: 'Descrição revisada' }), false);

    expect(editada.tickets).toHaveLength(1);
    const ref = editada.timeEntryReferences.find((r) => r.timeEntryId === entrada.id);
    expect(ref?.ticketId).toBe(editada.tickets[0]!.id);
  });
});
