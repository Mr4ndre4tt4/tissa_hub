/**
 * Leitor OOXML somente-leitura para XLSM/XLSX.
 *
 * Escolha de arquitetura (secção 14.1): a especificação permite "complementar
 * com leitura OOXML segura ou escolher alternativa documentada, mantendo o
 * contrato". Este leitor foi escrito porque o perfil exige, em cada célula,
 * **fórmula, valor bruto, valor salvo e natureza** simultaneamente, além de
 * limites próprios de descompressão e de células examinadas — controle que uma
 * biblioteca genérica não oferece. Ver `docs/DECISOES.md`.
 *
 * O que este leitor NUNCA faz (secções 8.1, 10.4, 10.7 e 17):
 *  - executar VBA (o `vbaProject.bin` é apenas detectado, jamais interpretado);
 *  - recalcular fórmulas (não há motor de avaliação neste código);
 *  - seguir vínculos externos, DDE, conexões ou URLs encontradas;
 *  - escrever qualquer byte no arquivo de origem.
 */

import { ArquivoZip, ErroDeArquivo, LIMITES_PADRAO, type LimitesZip } from './zip';
import { percorrerTags, textoAte } from './xml';

export const LIMITE_CELULAS_EXAMINADAS = 1_000_000;

export type TipoErroCelula = '#REF!' | '#VALUE!' | '#DIV/0!' | '#N/A' | '#NAME?' | '#NULL!' | '#NUM!' | string;

export type NaturezaCelula = 'literal' | 'formula_cached' | 'formula_error' | 'empty';

export interface CelulaOoxml {
  /** Referência A1 dentro da aba. */
  ref: string;
  coluna: string;
  linha: number;
  natureza: NaturezaCelula;
  /** Texto da fórmula quando existir. Guardado, nunca avaliado. */
  formula: string | null;
  /** Verdadeiro quando a fórmula referencia outro arquivo (`[1]Plan1!A1`). */
  formulaExterna: boolean;
  /** Valor salvo pelo Excel na última gravação. */
  valorSalvo: string | number | boolean | null;
  /** Texto bruto exatamente como estava no XML, antes de tipar. */
  bruto: string | null;
  erro: TipoErroCelula | null;
  /** Verdadeiro quando o formato da célula é de data/hora. */
  formatoData: boolean;
}

export interface AbaOoxml {
  nome: string;
  /** Índice de células por referência A1. */
  celulas: Map<string, CelulaOoxml>;
  /** Maior linha com qualquer conteúdo material. */
  ultimaLinha: number;
  /** Tabelas declaradas nesta aba. */
  tabelas: TabelaOoxml[];
}

export interface TabelaOoxml {
  nome: string;
  ref: string;
  linhaCabecalho: number;
  colunas: string[];
}

export interface LivroOoxml {
  abas: AbaOoxml[];
  /** Sistema de datas declarado pelo próprio arquivo (secção 6.1). */
  sistemaData: 1900 | 1904;
  /** Verdadeiro quando há projeto VBA. Detecção apenas; nada é executado. */
  contemVba: boolean;
  /** Vínculos externos declarados. Registrados, jamais resolvidos. */
  vinculosExternos: string[];
  celulasExaminadas: boolean;
  totalCelulas: number;
}

/** Converte a referência A1 em coluna/linha sem regex custosa por célula. */
function partirRef(ref: string): { coluna: string; linha: number } {
  let i = 0;
  while (i < ref.length && ref.charCodeAt(i) >= 65) i += 1;
  return { coluna: ref.slice(0, i), linha: Number(ref.slice(i)) || 0 };
}

/** Índice numérico de uma coluna: A=1, Z=26, AA=27. */
export function indiceDaColuna(coluna: string): number {
  let n = 0;
  for (const ch of coluna) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** Nome de uma coluna a partir do índice: 1=A, 27=AA. */
export function nomeDaColuna(indice: number): string {
  let n = indice;
  let saida = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    saida = String.fromCharCode(65 + resto) + saida;
    n = Math.floor((n - 1) / 26);
  }
  return saida;
}

/**
 * Formatos numéricos internos do Excel que representam data ou hora.
 * Usados só para saber se um número é data — não para recalcular nada.
 */
const FORMATOS_DATA_INTERNOS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function pareceFormatoData(codigo: string): boolean {
  // Remove seções de cor e texto literal antes de procurar marcadores de data.
  const limpo = codigo.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '');
  return /[dmyhs]/i.test(limpo) && !/^[#0.,%\s]*$/.test(limpo);
}

function lerSharedStrings(zip: ArquivoZip): string[] {
  if (!zip.tem('xl/sharedStrings.xml')) return [];
  const xml = zip.lerTexto('xl/sharedStrings.xml');
  const strings: string[] = [];
  let atual: string[] = [];
  let dentroDeSi = false;

  for (const tag of percorrerTags(xml)) {
    if (tag.nome === 'si') {
      if (tag.fechamento) {
        strings.push(atual.join(''));
        dentroDeSi = false;
      } else if (tag.autoFechada) {
        strings.push('');
      } else {
        atual = [];
        dentroDeSi = true;
      }
      continue;
    }
    // `rPh` traz fonética japonesa; não faz parte do texto exibido.
    if (dentroDeSi && tag.nome === 't' && !tag.fechamento && !tag.autoFechada) {
      atual.push(textoAte(xml, tag.fim, 't').texto);
    }
  }
  return strings;
}

/** Estilos: só precisamos saber quais `xf` apontam para formato de data. */
function lerEstilosDeData(zip: ArquivoZip): boolean[] {
  if (!zip.tem('xl/styles.xml')) return [];
  const xml = zip.lerTexto('xl/styles.xml');

  const formatosPersonalizados = new Map<number, string>();
  for (const tag of percorrerTags(xml)) {
    if (tag.nome === 'numFmt' && !tag.fechamento) {
      const id = Number(tag.atributos.numFmtId);
      const codigo = tag.atributos.formatCode ?? '';
      if (Number.isFinite(id)) formatosPersonalizados.set(id, codigo);
    }
  }

  const ehData: boolean[] = [];
  let dentroCellXfs = false;
  for (const tag of percorrerTags(xml)) {
    if (tag.nome === 'cellXfs') {
      dentroCellXfs = !tag.fechamento;
      continue;
    }
    if (dentroCellXfs && tag.nome === 'xf' && !tag.fechamento) {
      const id = Number(tag.atributos.numFmtId ?? '0');
      const personalizado = formatosPersonalizados.get(id);
      ehData.push(FORMATOS_DATA_INTERNOS.has(id) || (personalizado !== undefined && pareceFormatoData(personalizado)));
    }
  }
  return ehData;
}

interface RelacaoAba {
  nome: string;
  caminho: string;
}

function lerRelacoesDeAbas(zip: ArquivoZip): RelacaoAba[] {
  const wb = zip.lerTexto('xl/workbook.xml');
  const rels = zip.tem('xl/_rels/workbook.xml.rels') ? zip.lerTexto('xl/_rels/workbook.xml.rels') : '';

  const alvoPorId = new Map<string, string>();
  for (const tag of percorrerTags(rels)) {
    if (tag.nome === 'Relationship' && tag.atributos.Id && tag.atributos.Target) {
      let alvo = tag.atributos.Target;
      if (alvo.startsWith('/')) alvo = alvo.slice(1);
      else if (!alvo.startsWith('xl/')) alvo = `xl/${alvo.replace(/^\.\//, '')}`;
      alvoPorId.set(tag.atributos.Id, alvo);
    }
  }

  const abas: RelacaoAba[] = [];
  for (const tag of percorrerTags(wb)) {
    if (tag.nome === 'sheet' && !tag.fechamento) {
      const nome = tag.atributos.name ?? '';
      const rid = tag.atributos['r:id'] ?? tag.atributos['id'] ?? '';
      const caminho = alvoPorId.get(rid);
      if (nome && caminho) abas.push({ nome, caminho });
    }
  }
  return abas;
}

function lerSistemaData(zip: ArquivoZip): 1900 | 1904 {
  const wb = zip.lerTexto('xl/workbook.xml');
  for (const tag of percorrerTags(wb)) {
    if (tag.nome === 'workbookPr' && !tag.fechamento) {
      const v = tag.atributos.date1904;
      if (v === '1' || v === 'true') return 1904;
    }
  }
  return 1900;
}

function lerTabelasDaAba(zip: ArquivoZip, caminhoAba: string): TabelaOoxml[] {
  const partes = caminhoAba.split('/');
  const arquivo = partes.pop()!;
  const relsPath = `${partes.join('/')}/_rels/${arquivo}.rels`;
  if (!zip.tem(relsPath)) return [];

  const rels = zip.lerTexto(relsPath);
  const caminhos: string[] = [];
  for (const tag of percorrerTags(rels)) {
    if (tag.nome === 'Relationship' && (tag.atributos.Type ?? '').endsWith('/table')) {
      let alvo = tag.atributos.Target ?? '';
      if (alvo.startsWith('/')) alvo = alvo.slice(1);
      else if (alvo.startsWith('../')) alvo = `xl/${alvo.slice(3)}`;
      else if (!alvo.startsWith('xl/')) alvo = `xl/worksheets/${alvo}`;
      caminhos.push(alvo);
    }
  }

  const tabelas: TabelaOoxml[] = [];
  for (const caminho of caminhos) {
    if (!zip.tem(caminho)) continue;
    const xml = zip.lerTexto(caminho);
    let nome = '';
    let ref = '';
    let cabecalhos = 1;
    const colunas: string[] = [];
    for (const tag of percorrerTags(xml)) {
      if (tag.nome === 'table' && !tag.fechamento) {
        nome = tag.atributos.displayName ?? tag.atributos.name ?? '';
        ref = tag.atributos.ref ?? '';
        cabecalhos = Number(tag.atributos.headerRowCount ?? '1');
      }
      if (tag.nome === 'tableColumn' && !tag.fechamento && tag.atributos.name) colunas.push(tag.atributos.name);
    }
    if (nome && ref) {
      const inicio = ref.split(':')[0] ?? '';
      tabelas.push({ nome, ref, linhaCabecalho: cabecalhos > 0 ? partirRef(inicio).linha : 0, colunas });
    }
  }
  return tabelas;
}

/**
 * Lê uma aba preservando fórmula, valor salvo, natureza e erro.
 * Nenhum valor é recalculado: o que está aqui é o que o Excel gravou.
 */
function lerAba(
  zip: ArquivoZip,
  nome: string,
  caminho: string,
  strings: string[],
  estilosData: boolean[],
  orcamento: { restante: number },
): AbaOoxml {
  const xml = zip.lerTexto(caminho);
  const celulas = new Map<string, CelulaOoxml>();
  let ultimaLinha = 0;

  let ref = '';
  let tipo = '';
  let estilo = -1;
  let formula: string | null = null;
  let formulaExterna = false;
  let valorTexto: string | null = null;
  let dentroDeCelula = false;

  for (const tag of percorrerTags(xml)) {
    if (tag.nome === 'c') {
      if (tag.fechamento || tag.autoFechada) {
        if (dentroDeCelula || tag.autoFechada) {
          if (ref) {
            const celula = montarCelula(ref, tipo, estilo, formula, formulaExterna, valorTexto, strings, estilosData, xml);
            if (celula.natureza !== 'empty') {
              celulas.set(ref, celula);
              if (celula.linha > ultimaLinha) ultimaLinha = celula.linha;
            }
          }
        }
        dentroDeCelula = false;
        ref = '';
        tipo = '';
        estilo = -1;
        formula = null;
        formulaExterna = false;
        valorTexto = null;
        continue;
      }

      orcamento.restante -= 1;
      if (orcamento.restante < 0) {
        throw new ErroDeArquivo(
          `A planilha ultrapassou o limite de ${LIMITE_CELULAS_EXAMINADAS.toLocaleString('pt-BR')} células examinadas deste projeto.`,
          'limite',
        );
      }

      dentroDeCelula = true;
      ref = tag.atributos.r ?? '';
      tipo = tag.atributos.t ?? 'n';
      estilo = Number(tag.atributos.s ?? '-1');
      formula = null;
      formulaExterna = false;
      valorTexto = null;

      if (tag.autoFechada) {
        dentroDeCelula = false;
        ref = '';
      }
      continue;
    }

    if (!dentroDeCelula) continue;

    if (tag.nome === 'f' && !tag.fechamento) {
      if (tag.autoFechada) {
        formula = '';
      } else {
        const { texto } = textoAte(xml, tag.fim, 'f');
        formula = texto;
      }
      // `[n]` no início de uma referência indica arquivo externo (secção 10.6).
      formulaExterna = /\[\d+\]/.test(formula ?? '');
      continue;
    }
    if (tag.nome === 'v' && !tag.fechamento && !tag.autoFechada) {
      valorTexto = textoAte(xml, tag.fim, 'v').texto;
      continue;
    }
    if (tag.nome === 'is' && !tag.fechamento && !tag.autoFechada) {
      valorTexto = textoAte(xml, tag.fim, 'is').texto;
      tipo = 'inlineStrLido';
      continue;
    }
  }

  return { nome, celulas, ultimaLinha, tabelas: lerTabelasDaAba(zip, caminho) };
}

const ERROS_CONHECIDOS = new Set(['#REF!', '#VALUE!', '#DIV/0!', '#N/A', '#NAME?', '#NULL!', '#NUM!', '#GETTING_DATA']);

function montarCelula(
  ref: string,
  tipo: string,
  estilo: number,
  formula: string | null,
  formulaExterna: boolean,
  valorTexto: string | null,
  strings: string[],
  estilosData: boolean[],
  _xml: string,
): CelulaOoxml {
  const { coluna, linha } = partirRef(ref);
  const formatoData = estilo >= 0 && estilosData[estilo] === true;

  let valorSalvo: string | number | boolean | null = null;
  let erro: string | null = null;

  if (valorTexto !== null) {
    if (tipo === 'e' || ERROS_CONHECIDOS.has(valorTexto)) {
      erro = valorTexto;
      valorSalvo = null;
    } else if (tipo === 's') {
      const i = Number(valorTexto);
      valorSalvo = strings[i] ?? '';
    } else if (tipo === 'str' || tipo === 'inlineStr' || tipo === 'inlineStrLido') {
      valorSalvo = valorTexto;
    } else if (tipo === 'b') {
      valorSalvo = valorTexto === '1';
    } else if (tipo === 'd') {
      valorSalvo = valorTexto; // data ISO literal
    } else {
      const n = Number(valorTexto);
      valorSalvo = Number.isFinite(n) ? n : valorTexto;
    }
  }

  let natureza: NaturezaCelula;
  if (erro !== null) natureza = 'formula_error';
  else if (formula !== null) natureza = 'formula_cached';
  else if (valorTexto === null) natureza = 'empty';
  else natureza = 'literal';

  return {
    ref,
    coluna,
    linha,
    natureza,
    formula,
    formulaExterna,
    valorSalvo,
    bruto: valorTexto,
    erro,
    formatoData,
  };
}

/**
 * Abre um XLSM/XLSX em memória. O arquivo de origem nunca é modificado.
 */
export function lerLivro(bytes: Uint8Array, limites: LimitesZip = LIMITES_PADRAO): LivroOoxml {
  const zip = ArquivoZip.abrir(bytes, limites);

  if (!zip.tem('xl/workbook.xml')) {
    throw new ErroDeArquivo('O pacote não parece uma pasta de trabalho do Excel (falta xl/workbook.xml).', 'estrutura');
  }

  const strings = lerSharedStrings(zip);
  const estilosData = lerEstilosDeData(zip);
  const sistemaData = lerSistemaData(zip);
  const relacoes = lerRelacoesDeAbas(zip);

  const orcamento = { restante: LIMITE_CELULAS_EXAMINADAS };
  const abas: AbaOoxml[] = [];
  for (const rel of relacoes) {
    if (!zip.tem(rel.caminho)) continue;
    abas.push(lerAba(zip, rel.nome, rel.caminho, strings, estilosData, orcamento));
  }

  // Detecção — não execução. O binário do VBA jamais é interpretado.
  const contemVba = zip.tem('xl/vbaProject.bin');

  const vinculosExternos = zip
    .listar()
    .filter((n) => n.startsWith('xl/externalLinks/') && n.endsWith('.xml'))
    .map((n) => n.split('/').pop()!);

  const totalCelulas = abas.reduce((s, a) => s + a.celulas.size, 0);

  return {
    abas,
    sistemaData,
    contemVba,
    vinculosExternos,
    celulasExaminadas: true,
    totalCelulas,
  };
}

/** Acesso a uma célula por aba e referência. */
export function celula(livro: LivroOoxml, aba: string, ref: string): CelulaOoxml | null {
  return livro.abas.find((a) => a.nome === aba)?.celulas.get(ref) ?? null;
}
