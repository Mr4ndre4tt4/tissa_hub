import { describe, expect, it } from 'vitest';
import { analisarCsv, detectarPerfil, ErroDeCsv, lerCsvCs3 } from '../src/domain/sources/csv';

const CAB_INC =
  'Incident ID;Type (M/V);Title;Escalation Status;Status;Reported By;Reported CI;Device CI;Affected CI;Priority;Impact;Assignment Group;External;Reference ID;Assigned to;Start Time;Last Update Time;Last Used Knowledge Source;Tag 1;Tag 2;Tag 3;Tag 4;Tag 5;Tag 6';
const CAB_REQ =
  'Request ID;Type (V);Title;Escalation Status;Status;Reported By;Reported CI;Device CI;Affected CI;Complexity;Assignment Group;External;Reference ID;Assignee;Start Time;Last Update Time;Last Used Knowledge Source;Tag 1;Tag 2;Tag 3;Tag 4;Tag 5;Tag 6';

function linhaIncidente(id: string, extra: Partial<Record<string, string>> = {}) {
  const c = new Array(24).fill('');
  c[0] = id;
  c[2] = extra.title ?? 'Falha sintética no relatório';
  c[4] = extra.status ?? 'Working';
  c[11] = extra.group ?? 'AMS SAP FI';
  c[15] = extra.start ?? '01/09/2026 09:00:00';
  c[16] = extra.lastUpdate ?? '04/09/2026 14:35:12';
  c[20] = extra.tag3 ?? 'BASELINE';
  return c.join(';');
}

describe('AC-008 — parser real de CSV', () => {
  it('respeita ponto e vírgula dentro de campo entre aspas', () => {
    const linhas = analisarCsv('a;b;c\n"um; dois";x;y\n');
    expect(linhas[1]!.campos).toEqual(['um; dois', 'x', 'y']);
  });

  it('não divide o conteúdo da descrição em aspas escapadas', () => {
    const linhas = analisarCsv('a;b\n"disse ""urgente"" no chamado";z\n');
    expect(linhas[1]!.campos[0]).toBe('disse "urgente" no chamado');
  });

  it('aceita quebra de linha dentro de um campo', () => {
    const linhas = analisarCsv('a;b\n"primeira\nsegunda";z\n');
    expect(linhas).toHaveLength(2);
    expect(linhas[1]!.campos[0]).toBe('primeira\nsegunda');
  });

  it('remove o BOM UTF-8 do primeiro cabeçalho', () => {
    const linhas = analisarCsv('﻿Incident ID;Title\nIR1;t\n');
    expect(linhas[0]!.campos[0]).toBe('Incident ID');
  });

  it('aceita CRLF e arquivo sem quebra final', () => {
    expect(analisarCsv('a;b\r\n1;2')).toHaveLength(2);
  });

  it('recusa aspas não fechadas em vez de adivinhar', () => {
    expect(() => analisarCsv('a;b\n"aberta;z\n')).toThrow(ErroDeCsv);
  });
});

describe('AC-009 — detecção de perfil pelo cabeçalho', () => {
  it('reconhece incidentes e requisições pelo conteúdo, não pelo nome', () => {
    const inc = detectarPerfil(CAB_INC.split(';'));
    const req = detectarPerfil(CAB_REQ.split(';'));
    expect(inc.ok && inc.perfil.tipo).toBe('incident');
    expect(req.ok && req.perfil.tipo).toBe('request');
  });

  it('aceita colunas fora de ordem', () => {
    const embaralhado = ['Status', 'Last Update Time', 'Title', 'Incident ID'];
    expect(detectarPerfil(embaralhado).ok).toBe(true);
  });

  it('bloqueia cabeçalho duplicado', () => {
    const r = detectarPerfil(['Incident ID', 'Title', 'Title', 'Status', 'Last Update Time']);
    expect(r).toMatchObject({ ok: false, motivo: 'cabecalho_duplicado' });
  });

  it('bloqueia coluna obrigatória ausente', () => {
    const r = detectarPerfil(['Incident ID', 'Title', 'Status']);
    expect(r).toMatchObject({ ok: false, motivo: 'obrigatoria_ausente' });
  });

  it('não infere um perfil quando nenhuma chave está presente', () => {
    const r = detectarPerfil(['Chamado', 'Descrição', 'Situação']);
    expect(r).toMatchObject({ ok: false, motivo: 'desconhecido' });
  });

  it('falha num formato não autoriza tratar o arquivo como o outro', () => {
    const r = detectarPerfil(['Incident ID', 'Request ID', 'Title', 'Status', 'Last Update Time']);
    expect(r).toMatchObject({ ok: false, motivo: 'ambiguo' });
  });
});

describe('AC-010 — tipo vem do esquema, não do texto', () => {
  it('um ID com prefixo RR num CSV de incidentes continua sendo incident', () => {
    const r = lerCsvCs3(`${CAB_INC}\n${linhaIncidente('RR99999999')}\n`);
    expect(r.registros[0]!.ticketType).toBe('incident');
  });

  it('External e Reference ID não viram tickets adicionais', () => {
    const c = new Array(24).fill('');
    c[0] = 'IR32000001';
    c[2] = 'Título';
    c[4] = 'Working';
    c[12] = 'RR11111111'; // External
    c[13] = 'REF-999'; // Reference ID
    c[16] = '04/09/2026 14:35:12';
    const r = lerCsvCs3(`${CAB_INC}\n${c.join(';')}\n`);
    expect(r.registros).toHaveLength(1);
    expect(r.registros[0]!.sourceTicketId).toBe('IR32000001');
    expect(r.registros[0]!.oficial.external).toBe('RR11111111');
    expect(r.registros[0]!.oficial.referenceId).toBe('REF-999');
  });
});

describe('campos obrigatórios e pendências de cronologia', () => {
  it('linha completa fica pronta', () => {
    const r = lerCsvCs3(`${CAB_INC}\n${linhaIncidente('IR32000001')}\n`);
    expect(r.registros[0]!.estado).toBe('ready');
    expect(r.registros[0]!.problemas).toEqual([]);
  });

  it('Last Update Time inválido deixa a linha incompleta', () => {
    const r = lerCsvCs3(`${CAB_INC}\n${linhaIncidente('IR32000002', { lastUpdate: 'ontem' })}\n`);
    expect(r.registros[0]!.estado).toBe('incomplete');
  });

  it('Start Time incoerente vira pendência sem inventar abertura', () => {
    const r = lerCsvCs3(`${CAB_INC}\n${linhaIncidente('IR32000003', { start: '31/02/2026 09:00:00' })}\n`);
    expect(r.registros[0]!.estado).toBe('needs_review');
    expect(r.registros[0]!.problemas.join(' ')).toContain('Start Time');
    expect(r.registros[0]!.oficial.startTimeBruto).toBe('31/02/2026 09:00:00');
  });

  it('Start Time ausente não invalida a linha', () => {
    const r = lerCsvCs3(`${CAB_INC}\n${linhaIncidente('IR32000004', { start: '' })}\n`);
    expect(r.registros[0]!.estado).toBe('ready');
    expect(r.registros[0]!.oficial.startTimeBruto).toBeNull();
  });
});

describe('AC-007 / secção 8.2 — colunas ausentes e vazias', () => {
  it('coluna ausente do arquivo chega como null, não como limpeza', () => {
    // Cabeçalho mínimo: Priority nem existe.
    const r = lerCsvCs3('Incident ID;Title;Status;Last Update Time\nIR1;T;Working;04/09/2026 10:00:00\n');
    expect(r.registros[0]!.oficial.priority).toBeNull();
  });

  it('coluna presente e vazia é preservada como vazia', () => {
    const r = lerCsvCs3(`${CAB_INC}\n${linhaIncidente('IR32000005')}\n`);
    expect(r.registros[0]!.oficial.impact).toBeNull();
  });

  it('coluna desconhecida é preservada como metadado, não reinterpretada', () => {
    const r = lerCsvCs3('Incident ID;Title;Status;Last Update Time;Campo Novo\nIR1;T;Working;04/09/2026 10:00:00;valor\n');
    expect(r.colunasDesconhecidas).toEqual(['Campo Novo']);
    expect(r.registros[0]!.oficial.extras).toEqual({ 'Campo Novo': 'valor' });
  });
});

describe('AC-001 — contagem da primeira importação', () => {
  it('3 incidentes + 13 requisições = 16 identidades, sem criar horas', () => {
    const inc = [1, 2, 3].map((n) => linhaIncidente(`IR3200000${n}`)).join('\n');
    const csvInc = lerCsvCs3(`${CAB_INC}\n${inc}\n`);

    const reqLinhas = Array.from({ length: 13 }, (_, i) => {
      const c = new Array(23).fill('');
      c[0] = `RR2300000${i}`;
      c[2] = 'Requisição sintética';
      c[4] = 'Wait on User';
      c[15] = '04/09/2026 14:35:12';
      return c.join(';');
    }).join('\n');
    const csvReq = lerCsvCs3(`${CAB_REQ}\n${reqLinhas}\n`);

    expect(csvInc.registros).toHaveLength(3);
    expect(csvReq.registros).toHaveLength(13);
    const identidades = new Set([
      ...csvInc.registros.map((r) => `${r.ticketType}|${r.sourceTicketId}`),
      ...csvReq.registros.map((r) => `${r.ticketType}|${r.sourceTicketId}`),
    ]);
    expect(identidades.size).toBe(16);
    // As fontes não trazem horas: nenhum campo de duração existe no perfil.
    expect(Object.keys(csvInc.registros[0]!.oficial)).not.toContain('duracaoMinutos');
  });
});
