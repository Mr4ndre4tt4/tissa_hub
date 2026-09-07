import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { lerLivro } from '../src/domain/sources/ooxml';
import { ArquivoZip, ErroDeArquivo, LIMITES_PADRAO } from '../src/domain/sources/zip';
import { gerarCsv, gerarXlsx, neutralizarFormula } from '../src/domain/sources/xlsx-escrita';
import { decodificarTextoXml } from '../src/domain/sources/xml';
import { analisarCsv } from '../src/domain/sources/csv';

/** Monta um XLSX sintético com células de tipos variados. */
function livroSintetico(celulasXml: string, extras: Record<string, Uint8Array> = {}): Uint8Array {
  const arquivos: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
        `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="Plan" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        `<sheetData>${celulasXml}</sheetData></worksheet>`,
    ),
    ...extras,
  };
  return zipSync(arquivos, { level: 0 });
}

describe('AC-041 / AC-042 — o leitor preserva fórmula, valor salvo e natureza', () => {
  const bytes = livroSintetico(
    `<row r="1">` +
      `<c r="A1"><v>0.125</v></c>` +
      `<c r="B1" t="str"><f>VLOOKUP(B12,Chamados!A:C,3,FALSE)</f><v>Em andamento</v></c>` +
      `<c r="C1" t="e"><f>IF(#REF!="","",TEXT(#REF!,"mmm/yyyy"))</f><v>#REF!</v></c>` +
      `<c r="D1" t="str"><f>[1]Plan1!A1</f><v>externo</v></c>` +
      `<c r="E1" t="inlineStr"><is><t>LANÇADO</t></is></c>` +
      `</row>`,
  );
  const livro = lerLivro(bytes);
  const plan = livro.abas[0]!;

  it('valor literal numérico chega intacto', () => {
    const a1 = plan.celulas.get('A1')!;
    expect(a1.natureza).toBe('literal');
    expect(a1.valorSalvo).toBe(0.125);
    expect(a1.formula).toBeNull();
  });

  it('AC-041: fórmula de consulta guarda texto, valor salvo e natureza calculada', () => {
    const b1 = plan.celulas.get('B1')!;
    expect(b1.natureza).toBe('formula_cached');
    expect(b1.formula).toBe('VLOOKUP(B12,Chamados!A:C,3,FALSE)');
    expect(b1.valorSalvo).toBe('Em andamento');
    // Nenhum recálculo ocorreu: o valor é o que o Excel gravou.
  });

  it('erro de fórmula é preservado com o tipo, sem descartar a célula', () => {
    const c1 = plan.celulas.get('C1')!;
    expect(c1.natureza).toBe('formula_error');
    expect(c1.erro).toBe('#REF!');
    expect(c1.formula).toContain('#REF!');
  });

  it('AC-042: fórmula com vínculo externo é marcada e nunca resolvida', () => {
    const d1 = plan.celulas.get('D1')!;
    expect(d1.formulaExterna).toBe(true);
    expect(d1.valorSalvo).toBe('externo');
  });

  it('texto em linha é lido corretamente', () => {
    expect(plan.celulas.get('E1')!.valorSalvo).toBe('LANÇADO');
  });

  it('detecta VBA sem executar', () => {
    const comVba = lerLivro(livroSintetico('<row r="1"><c r="A1"><v>1</v></c></row>', { 'xl/vbaProject.bin': new Uint8Array([1, 2, 3]) }));
    expect(comVba.contemVba).toBe(true);
  });

  it('lê o sistema de datas declarado pelo arquivo', () => {
    expect(livro.sistemaData).toBe(1900);
  });
});

describe('AC-058 / AC-060 — arquivo é dado não confiável', () => {
  it('rejeita um arquivo que não é pacote Office', () => {
    expect(() => lerLivro(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(ErroDeArquivo);
    try {
      lerLivro(strToU8('isto não é um zip'));
    } catch (e) {
      expect((e as ErroDeArquivo).codigo).toBe('assinatura');
    }
  });

  it('rejeita arquivo acima do limite de tamanho antes de interpretar', () => {
    const grande = new Uint8Array(LIMITES_PADRAO.tamanhoArquivoBytes + 1);
    try {
      ArquivoZip.abrir(grande);
      throw new Error('deveria ter falhado');
    } catch (e) {
      expect((e as ErroDeArquivo).codigo).toBe('tamanho');
      expect((e as ErroDeArquivo).message).toMatch(/limite/i);
    }
  });

  it('rejeita caminho com travessia de diretório', () => {
    const malicioso = zipSync({ '../fora.xml': strToU8('x') }, { level: 0 });
    try {
      ArquivoZip.abrir(malicioso);
      throw new Error('deveria ter falhado');
    } catch (e) {
      expect((e as ErroDeArquivo).codigo).toBe('caminho');
    }
  });

  it('rejeita expansão excessiva (zip bomb)', () => {
    // Um arquivo de 5 MiB de zeros comprime muito além do limite de razão.
    const bomba = zipSync({ 'grande.xml': new Uint8Array(5 * 1024 * 1024) }, { level: 9 });
    try {
      ArquivoZip.abrir(bomba);
      throw new Error('deveria ter falhado');
    } catch (e) {
      expect((e as ErroDeArquivo).codigo).toBe('expansao');
    }
  });

  it('não expande entidades XML personalizadas', () => {
    // Uma entidade não predefinida volta literal: não há expansão nem XXE.
    expect(decodificarTextoXml('&xxe;')).toBe('&xxe;');
    expect(decodificarTextoXml('&lt;a&gt;&amp;')).toBe('<a>&');
    expect(decodificarTextoXml('&#65;&#x42;')).toBe('AB');
  });

  it('erro de estrutura interrompe com mensagem compreensível, sem base parcial', () => {
    const semWorkbook = zipSync({ 'xl/outro.xml': strToU8('<a/>') }, { level: 0 });
    try {
      lerLivro(semWorkbook);
      throw new Error('deveria ter falhado');
    } catch (e) {
      expect(e).toBeInstanceOf(ErroDeArquivo);
      expect((e as Error).message).toMatch(/Excel|pacote/i);
    }
  });
});

describe('AC-058 — exportação trata conteúdo como texto', () => {
  it('neutraliza texto que pareceria fórmula na planilha de destino', () => {
    expect(neutralizarFormula('=SOMA(A1:A9)')).toBe("'=SOMA(A1:A9)");
    expect(neutralizarFormula('+1')).toBe("'+1");
    expect(neutralizarFormula('@import')).toBe("'@import");
    expect(neutralizarFormula('IR90001001')).toBe('IR90001001');
  });

  it('o XLSX gerado é relido com o conteúdo como texto, nunca como fórmula', () => {
    const bytes = gerarXlsx([
      { nome: 'Conferência', cabecalhos: ['Chamado', 'Minutos'], linhas: [['=CMD|calc', 273]] },
    ]);
    const livro = lerLivro(bytes);
    const plan = livro.abas[0]!;
    expect(plan.celulas.get('A2')!.valorSalvo).toBe("'=CMD|calc");
    expect(plan.celulas.get('A2')!.formula).toBeNull();
    expect(plan.celulas.get('B2')!.valorSalvo).toBe(273);
  });

  it('o CSV exportado sai em UTF-8 com BOM e mantém a duração em minutos', () => {
    const csv = gerarCsv(['Chamado', 'Minutos', 'Duração'], [['RR90000015', 273, '4h33']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const linhas = analisarCsv(csv);
    expect(linhas[1]!.campos).toEqual(['RR90000015', '273', '4h33']);
  });

  it('escapa aspas e caracteres XML na exportação', () => {
    const bytes = gerarXlsx([{ nome: 'X', cabecalhos: ['t'], linhas: [['disse "urgente" & <ok>']] }]);
    expect(lerLivro(bytes).abas[0]!.celulas.get('A2')!.valorSalvo).toBe('disse "urgente" & <ok>');
  });
});
