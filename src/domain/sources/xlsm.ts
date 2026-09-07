/**
 * Perfil `central-chamados-aprimorado-xlsm-v1`.
 *
 * Traduz o livro OOXML nas estruturas do domínio, preservando proveniência.
 * O leitor reconhece as colunas **pelo cabeçalho**, não pela letra: um arquivo
 * renomeado ou com colunas reordenadas continua legível (secção 10.2). As
 * posições documentadas servem apenas de conferência.
 *
 * Nada aqui recalcula fórmula, executa macro ou resolve vínculo externo.
 */

import type { CelulaOoxml, LivroOoxml, AbaOoxml } from './ooxml';
import { indiceDaColuna, nomeDaColuna } from './ooxml';
import { fracaoDeDiaParaMinutos, textoHoraParaMinutos } from '../time/duracao';
import { serialParaData, ehDataValida } from '../time/datas';
import { normalizarParaComparacao } from '../entities/identidade';
import type { WorkDate } from '../entities/tipos';

/** Aba → papel, conforme secção 10.1. */
export const PAPEIS_DAS_ABAS: Record<string, 'principal' | 'derivada' | 'comparacao' | 'catalogo' | 'documentacao'> = {
  Chamados: 'principal',
  Apontamentos: 'principal',
  'Follow-ups': 'principal',
  'To Do Diário': 'principal',
  Resolvidos: 'principal',
  'Histórico Status': 'principal',
  'Meu desenvolvimento': 'principal',
  Planilha1: 'comparacao',
  'Fila Follow-up': 'derivada',
  Dashboard: 'derivada',
  Produtividade: 'derivada',
  Listas: 'catalogo',
  Instruções: 'documentacao',
};

export interface ValorDeCelula {
  ref: string;
  texto: string | null;
  numero: number | null;
  natureza: CelulaOoxml['natureza'];
  formula: string | null;
  formulaExterna: boolean;
  erro: string | null;
  /** Verdadeiro quando o valor veio de fórmula: consulta, não declaração histórica. */
  calculado: boolean;
}

const VAZIO: ValorDeCelula = {
  ref: '',
  texto: null,
  numero: null,
  natureza: 'empty',
  formula: null,
  formulaExterna: false,
  erro: null,
  calculado: false,
};

function valorDe(celula: CelulaOoxml | undefined): ValorDeCelula {
  if (!celula) return VAZIO;
  const v = celula.valorSalvo;
  const texto = typeof v === 'string' ? (v.trim().length > 0 ? v : null) : v === null ? null : String(v);
  return {
    ref: celula.ref,
    texto,
    numero: typeof v === 'number' ? v : null,
    natureza: celula.natureza,
    formula: celula.formula,
    formulaExterna: celula.formulaExterna,
    erro: celula.erro,
    calculado: celula.natureza === 'formula_cached' || celula.natureza === 'formula_error',
  };
}

/** Uma célula tem conteúdo material literal (não vazia e não derivada de fórmula). */
function materialLiteral(v: ValorDeCelula): boolean {
  if (v.natureza !== 'literal') return false;
  return v.texto !== null || v.numero !== null;
}

/* ------------------------------------------------------------------ */
/* Mapeamento semântico de colunas                                     */
/* ------------------------------------------------------------------ */

export interface MapaDeColunas {
  linhaCabecalho: number;
  /** Rótulo normalizado → letra da coluna. */
  porRotulo: Map<string, string>;
  /** Rótulos encontrados que o perfil não conhece. */
  desconhecidos: string[];
}

function lerCabecalho(aba: AbaOoxml, linhaCabecalho: number): MapaDeColunas {
  const porRotulo = new Map<string, string>();
  const desconhecidos: string[] = [];
  for (const celula of aba.celulas.values()) {
    if (celula.linha !== linhaCabecalho) continue;
    const v = valorDe(celula);
    if (v.texto === null) continue;
    const chave = normalizarParaComparacao(v.texto);
    if (!porRotulo.has(chave)) porRotulo.set(chave, celula.coluna);
  }
  return { linhaCabecalho, porRotulo, desconhecidos };
}

/**
 * Descobre a linha de cabeçalho: prefere a definição da tabela; senão procura a
 * primeira linha que contenha ao menos dois rótulos esperados.
 */
function descobrirLinhaCabecalho(aba: AbaOoxml, rotulosEsperados: string[], padrao: number): number {
  if (aba.tabelas.length > 0 && aba.tabelas[0]!.linhaCabecalho > 0) return aba.tabelas[0]!.linhaCabecalho;

  const esperados = new Set(rotulosEsperados.map(normalizarParaComparacao));
  const contagem = new Map<number, number>();
  for (const celula of aba.celulas.values()) {
    if (celula.linha > 20) continue;
    const v = valorDe(celula);
    if (v.texto === null) continue;
    if (esperados.has(normalizarParaComparacao(v.texto))) {
      contagem.set(celula.linha, (contagem.get(celula.linha) ?? 0) + 1);
    }
  }
  let melhor = padrao;
  let maior = 1;
  for (const [linha, n] of contagem) {
    if (n > maior) {
      maior = n;
      melhor = linha;
    }
  }
  return melhor;
}

/** Acesso a uma coluna pelo rótulo, com posição documentada como reserva. */
function coluna(mapa: MapaDeColunas, rotulo: string, reserva: string): string {
  return mapa.porRotulo.get(normalizarParaComparacao(rotulo)) ?? reserva;
}

function celulaDe(aba: AbaOoxml, col: string, linha: number): ValorDeCelula {
  return valorDe(aba.celulas.get(`${col}${linha}`));
}

/* ------------------------------------------------------------------ */
/* Conversões                                                          */
/* ------------------------------------------------------------------ */

export interface DataLida {
  data: WorkDate | null;
  bruto: string | null;
  problema: string | null;
}

/** Lê uma data que pode estar como serial numérico ou como texto. */
export function lerData(v: ValorDeCelula, sistema: 1900 | 1904): DataLida {
  if (v.numero !== null) {
    const r = serialParaData(v.numero, sistema);
    return r.ok ? { data: r.data, bruto: String(v.numero), problema: null } : { data: null, bruto: String(v.numero), problema: r.detalhe };
  }
  if (v.texto === null) return { data: null, bruto: null, problema: null };

  const t = v.texto.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) {
    const d = `${iso[1]}-${iso[2]}-${iso[3]}`;
    return ehDataValida(d) ? { data: d, bruto: t, problema: null } : { data: null, bruto: t, problema: `Data inexistente: "${t}".` };
  }
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (br) {
    const d = `${br[3]}-${br[2]!.padStart(2, '0')}-${br[1]!.padStart(2, '0')}`;
    return ehDataValida(d) ? { data: d, bruto: t, problema: null } : { data: null, bruto: t, problema: `Data inexistente: "${t}".` };
  }
  return { data: null, bruto: t, problema: `Data não reconhecida: "${t}".` };
}

/* ------------------------------------------------------------------ */
/* Registros lidos                                                     */
/* ------------------------------------------------------------------ */

export interface ChamadoLido {
  linha: number;
  referenciaBruta: string | null;
  tituloPessoal: string | null;
  statusBruto: string | null;
  prioridade: string | null;
  ultimaAtualizacao: DataLida;
  responsavel: string | null;
  categoria: string | null;
  dataCriacao: DataLida;
  proximaAcao: string | null;
  observacoes: string | null;
  tipoDica: string | null;
  rndBruto: string | null;
  prioridadeOriginal: string | null;
  /** Fora da tabela principal, mas precisa ser lido (secção 10.2). */
  dataResolucao: DataLida;
  /** Colunas derivadas AH:AM, usadas só para reconciliação. */
  derivados: Record<string, ValorDeCelula>;
  errosDeFormula: string[];
}

export interface ApontamentoLido {
  linha: number;
  workDate: WorkDate | null;
  dataBruta: string | null;
  problemaData: string | null;
  referenciaBruta: string | null;
  descricao: string | null;
  /** Verdadeiro quando C veio de fórmula (título calculado, não descrição). */
  descricaoCalculada: boolean;
  tipoAtuacao: string | null;
  duracaoMinutos: number | null;
  duracaoBruta: number | string | null;
  problemaDuracao: string | null;
  /** Valor de F. Quando calculado, é consulta ao cadastro — não status histórico. */
  resultadoStatus: ValorDeCelula;
  observacoes: string | null;
  /** `LANÇADO` na observação: anotação pessoal, nunca confirmação de integração. */
  lancamentoExterno: 'reported_posted' | null;
  errosDeFormula: string[];
  temVinculoExterno: boolean;
}

export interface FollowUpLido {
  linha: number;
  data: DataLida;
  referenciaBruta: string | null;
  descricao: string | null;
  tipo: string | null;
  tentativa: number | null;
  canal: string | null;
  responsavel: string | null;
  resultado: string | null;
  dataResposta: DataLida;
  proximaAcao: string | null;
  resumo: string | null;
  statusNoMomento: string | null;
}

export interface TarefaLida {
  linha: number;
  tarefa: string | null;
  relacionada: string | null;
  referenciaBruta: string | null;
  prioridade: string | null;
  horario: string | null;
  status: string | null;
  check: boolean | null;
  observacoes: string | null;
  data: DataLida;
  divergenciaStatusCheck: boolean;
}

export interface ResolvidoLido {
  linha: number;
  referenciaBruta: string | null;
  descricao: string | null;
  tipo: string | null;
  categoria: string | null;
  prioridade: string | null;
  responsavel: string | null;
  dataCriacao: DataLida;
  dataResolucao: DataLida;
  tempoEmAberto: string | null;
  horasApontadas: number | null;
  qtdeApontamentos: number | null;
  fusRealizados: number | null;
  statusFinal: string | null;
  observacoes: string | null;
}

export interface EventoStatusLido {
  linha: number;
  dataHoraBruta: string | null;
  data: WorkDate | null;
  referenciaBruta: string | null;
  statusAnterior: string | null;
  novoStatus: string | null;
  usuarioLegado: string | null;
  observacao: string | null;
  origem: string | null;
}

export interface DesenvolvimentoLido {
  linha: number;
  data: DataLida;
  tipoAtividade: string | null;
  tema: string | null;
  descricao: string | null;
  pessoaArea: string | null;
  resultado: string | null;
  competencia: string | null;
  relevancia: string | null;
  proximoPasso: string | null;
  status: string | null;
  incompleto: boolean;
}

export interface DiagnosticoXlsm {
  errosChamados: number;
  errosApontamentos: number;
  formulasExternas: number;
  abasEncontradas: string[];
  abasAusentes: string[];
  contemVba: boolean;
  vinculosExternos: string[];
  colunasDesconhecidas: Record<string, string[]>;
}

export interface LeituraXlsm {
  chamados: ChamadoLido[];
  apontamentos: ApontamentoLido[];
  followUps: FollowUpLido[];
  tarefas: TarefaLida[];
  resolvidos: ResolvidoLido[];
  historicoStatus: EventoStatusLido[];
  desenvolvimento: DesenvolvimentoLido[];
  /** Aba de comparação: nunca entra na carga principal (secção 10.1). */
  planilha1: { linha: number; referenciaBruta: string | null; statusBruto: string | null }[];
  /** Visão derivada: contagem apenas, a fila é reconstruída pelo domínio. */
  filaFollowUp: number;
  diagnostico: DiagnosticoXlsm;
  sistemaData: 1900 | 1904;
}

function texto(v: ValorDeCelula): string | null {
  return v.texto;
}

/** Última linha material da aba, considerando intervalos vazios no meio. */
function ultimaLinhaMaterial(aba: AbaOoxml, colunas: string[], apartirDe: number): number {
  let ultima = apartirDe - 1;
  const indices = new Set(colunas.map(indiceDaColuna));
  for (const celula of aba.celulas.values()) {
    if (celula.linha < apartirDe) continue;
    if (!indices.has(indiceDaColuna(celula.coluna))) continue;
    if (!materialLiteral(valorDe(celula))) continue;
    if (celula.linha > ultima) ultima = celula.linha;
  }
  return ultima;
}

export function lerXlsmCentral(livro: LivroOoxml): LeituraXlsm {
  const porNome = new Map(livro.abas.map((a) => [a.nome, a]));
  const sistema = livro.sistemaData;
  const colunasDesconhecidas: Record<string, string[]> = {};

  const abasEsperadas = Object.keys(PAPEIS_DAS_ABAS);
  const abasEncontradas = livro.abas.map((a) => a.nome);
  const abasAusentes = abasEsperadas.filter((n) => !porNome.has(n));

  let errosChamados = 0;
  let errosApontamentos = 0;
  let formulasExternas = 0;

  /* ---------------- Chamados ---------------- */
  const chamados: ChamadoLido[] = [];
  const abaChamados = porNome.get('Chamados');
  if (abaChamados) {
    const linhaCab = descobrirLinhaCabecalho(abaChamados, ['Número do Chamado', 'Descrição', 'Status', 'Próxima Ação'], 3);
    const mapa = lerCabecalho(abaChamados, linhaCab);
    const cRef = coluna(mapa, 'Número do Chamado', 'A');
    const cDesc = coluna(mapa, 'Descrição', 'B');
    const cStatus = coluna(mapa, 'Status', 'C');
    const cPrio = coluna(mapa, 'Prioridade', 'D');
    const cAtual = coluna(mapa, 'Última Atualização', 'E');
    const cResp = coluna(mapa, 'Responsável', 'F');
    const cCat = coluna(mapa, 'Categoria', 'G');
    const cCriacao = coluna(mapa, 'Data de Criação', 'H');
    const cProx = coluna(mapa, 'Próxima Ação', 'I');
    const cObs = coluna(mapa, 'Observações', 'J');
    const cTipo = coluna(mapa, 'Tipo', 'K');
    const cRnd = coluna(mapa, 'RND?', 'L');
    const cPrioOrig = coluna(mapa, 'Prioridade Original', 'M');
    const cResolucao = coluna(mapa, 'Data Resolução', 'AG');

    const primeira = linhaCab + 1;
    const ultima = ultimaLinhaMaterial(abaChamados, [cRef], primeira);

    for (let linha = primeira; linha <= ultima; linha += 1) {
      const ref = celulaDe(abaChamados, cRef, linha);
      // Identidade da linha é a referência preenchida na coluna do chamado.
      if (!materialLiteral(ref)) continue;

      const errosDeFormula: string[] = [];
      for (const celula of abaChamados.celulas.values()) {
        if (celula.linha === linha && celula.erro) {
          errosDeFormula.push(`${celula.ref}=${celula.erro}`);
          errosChamados += 1;
        }
      }

      const derivados: Record<string, ValorDeCelula> = {};
      for (const col of ['AH', 'AI', 'AJ', 'AK', 'AL', 'AM']) {
        const v = celulaDe(abaChamados, col, linha);
        if (v.natureza !== 'empty') derivados[col] = v;
      }

      chamados.push({
        linha,
        referenciaBruta: ref.texto,
        tituloPessoal: texto(celulaDe(abaChamados, cDesc, linha)),
        statusBruto: texto(celulaDe(abaChamados, cStatus, linha)),
        prioridade: texto(celulaDe(abaChamados, cPrio, linha)),
        ultimaAtualizacao: lerData(celulaDe(abaChamados, cAtual, linha), sistema),
        responsavel: texto(celulaDe(abaChamados, cResp, linha)),
        categoria: texto(celulaDe(abaChamados, cCat, linha)),
        dataCriacao: lerData(celulaDe(abaChamados, cCriacao, linha), sistema),
        proximaAcao: texto(celulaDe(abaChamados, cProx, linha)),
        observacoes: texto(celulaDe(abaChamados, cObs, linha)),
        tipoDica: texto(celulaDe(abaChamados, cTipo, linha)),
        rndBruto: texto(celulaDe(abaChamados, cRnd, linha)),
        prioridadeOriginal: texto(celulaDe(abaChamados, cPrioOrig, linha)),
        dataResolucao: lerData(celulaDe(abaChamados, cResolucao, linha), sistema),
        derivados,
        errosDeFormula,
      });
    }
    colunasDesconhecidas.Chamados = mapa.desconhecidos;
  }

  /* ---------------- Apontamentos ---------------- */
  const apontamentos: ApontamentoLido[] = [];
  const abaApont = porNome.get('Apontamentos');
  if (abaApont) {
    const linhaCab = descobrirLinhaCabecalho(abaApont, ['Data', 'Número do Chamado', 'Descrição', 'Horas'], 3);
    const mapa = lerCabecalho(abaApont, linhaCab);
    const cData = coluna(mapa, 'Data', 'A');
    const cRef = coluna(mapa, 'Número do Chamado', 'B');
    const cDesc = coluna(mapa, 'Descrição', 'C');
    const cTipo = coluna(mapa, 'Tipo de Atuação', 'D');
    const cHoras = coluna(mapa, 'Horas', 'E');
    const cResultado = coluna(mapa, 'Resultado/Status', 'F');
    const cObs = coluna(mapa, 'Observações', 'G');

    // Critério de linha operacional: conteúdo literal em B, C, D, E ou G.
    // Linhas só com data ou só com fórmulas auxiliares não são trabalho (10.1).
    const colsMateriais = [cRef, cDesc, cTipo, cHoras, cObs];
    const primeira = linhaCab + 1;
    const ultima = ultimaLinhaMaterial(abaApont, colsMateriais, primeira);

    for (let linha = primeira; linha <= ultima; linha += 1) {
      const vRef = celulaDe(abaApont, cRef, linha);
      const vDesc = celulaDe(abaApont, cDesc, linha);
      const vTipo = celulaDe(abaApont, cTipo, linha);
      const vHoras = celulaDe(abaApont, cHoras, linha);
      const vObs = celulaDe(abaApont, cObs, linha);

      const operacional = [vRef, vDesc, vTipo, vHoras, vObs].some(materialLiteral);
      if (!operacional) continue;

      const errosDeFormula: string[] = [];
      let temVinculoExterno = false;
      for (const celula of abaApont.celulas.values()) {
        if (celula.linha !== linha) continue;
        if (celula.erro) {
          errosDeFormula.push(`${celula.ref}=${celula.erro}`);
          errosApontamentos += 1;
        }
        if (celula.formulaExterna) {
          temVinculoExterno = true;
          formulasExternas += 1;
        }
      }

      // Duração: fração de dia neste perfil; texto HH:mm também é aceito.
      let duracaoMinutos: number | null = null;
      let problemaDuracao: string | null = null;
      if (vHoras.numero !== null) {
        const r = fracaoDeDiaParaMinutos(vHoras.numero);
        if (r.ok) duracaoMinutos = r.minutos;
        else problemaDuracao = r.detalhe;
      } else if (vHoras.texto !== null) {
        const r = textoHoraParaMinutos(vHoras.texto);
        if (r.ok) duracaoMinutos = r.minutos;
        else problemaDuracao = r.detalhe;
      }

      const dataLida = lerData(celulaDe(abaApont, cData, linha), sistema);
      const obs = texto(vObs);

      apontamentos.push({
        linha,
        workDate: dataLida.data,
        dataBruta: dataLida.bruto,
        problemaData: dataLida.problema,
        referenciaBruta: vRef.texto,
        descricao: vDesc.texto,
        descricaoCalculada: vDesc.calculado,
        tipoAtuacao: vTipo.texto,
        duracaoMinutos,
        duracaoBruta: vHoras.numero ?? vHoras.texto,
        problemaDuracao,
        resultadoStatus: celulaDe(abaApont, cResultado, linha),
        observacoes: obs,
        lancamentoExterno: obs !== null && normalizarParaComparacao(obs).includes('LANÇADO') ? 'reported_posted' : null,
        errosDeFormula,
        temVinculoExterno,
      });
    }
    colunasDesconhecidas.Apontamentos = mapa.desconhecidos;
  }

  /* ---------------- Follow-ups ---------------- */
  const followUps: FollowUpLido[] = [];
  const abaFu = porNome.get('Follow-ups');
  if (abaFu) {
    const linhaCab = descobrirLinhaCabecalho(abaFu, ['Data Follow-up', 'Número do Chamado', 'Canal', 'Resultado'], 5);
    const mapa = lerCabecalho(abaFu, linhaCab);
    const cData = coluna(mapa, 'Data Follow-up', 'A');
    const cRef = coluna(mapa, 'Número do Chamado', 'B');
    const primeira = linhaCab + 1;
    const ultima = ultimaLinhaMaterial(abaFu, [cData, cRef], primeira);

    for (let linha = primeira; linha <= ultima; linha += 1) {
      const vData = celulaDe(abaFu, cData, linha);
      const vRef = celulaDe(abaFu, cRef, linha);
      if (!materialLiteral(vData) && !materialLiteral(vRef)) continue;

      const tentativaBruta = celulaDe(abaFu, coluna(mapa, 'Tentativa #', 'E'), linha);
      followUps.push({
        linha,
        data: lerData(vData, sistema),
        referenciaBruta: vRef.texto,
        descricao: texto(celulaDe(abaFu, coluna(mapa, 'Descrição', 'C'), linha)),
        tipo: texto(celulaDe(abaFu, coluna(mapa, 'Tipo', 'D'), linha)),
        tentativa: tentativaBruta.numero,
        canal: texto(celulaDe(abaFu, coluna(mapa, 'Canal', 'F'), linha)),
        responsavel: texto(celulaDe(abaFu, coluna(mapa, 'Responsável', 'G'), linha)),
        // Resultado vazio significa desconhecido, nunca "sem resposta" (10.5).
        resultado: texto(celulaDe(abaFu, coluna(mapa, 'Resultado', 'H'), linha)),
        dataResposta: lerData(celulaDe(abaFu, coluna(mapa, 'Data da Resposta', 'I'), linha), sistema),
        proximaAcao: texto(celulaDe(abaFu, coluna(mapa, 'Próxima Ação', 'J'), linha)),
        resumo: texto(celulaDe(abaFu, coluna(mapa, 'Observação / Resumo', 'K'), linha)),
        statusNoMomento: texto(celulaDe(abaFu, coluna(mapa, 'Status no momento', 'L'), linha)),
      });
    }
  }

  /* ---------------- To Do Diário ---------------- */
  const tarefas: TarefaLida[] = [];
  const abaTodo = porNome.get('To Do Diário');
  if (abaTodo) {
    const linhaCab = descobrirLinhaCabecalho(abaTodo, ['Tarefa', 'Prioridade', 'Status', 'Data'], 5);
    const mapa = lerCabecalho(abaTodo, linhaCab);
    const cTarefa = coluna(mapa, 'Tarefa', 'A');
    const primeira = linhaCab + 1;
    const ultima = ultimaLinhaMaterial(abaTodo, [cTarefa], primeira);

    for (let linha = primeira; linha <= ultima; linha += 1) {
      const vTarefa = celulaDe(abaTodo, cTarefa, linha);
      if (!materialLiteral(vTarefa)) continue;

      const status = texto(celulaDe(abaTodo, coluna(mapa, 'Status', 'F'), linha));
      const vCheck = celulaDe(abaTodo, coluna(mapa, 'Check de conclusão', 'G'), linha);
      const check =
        vCheck.natureza === 'empty' ? null : typeof vCheck.texto === 'string' ? /^(x|sim|ok|true|1|✓)$/i.test(vCheck.texto.trim()) : vCheck.numero === 1;
      const concluidoPeloStatus = status !== null && /conclu|feito|final/i.test(status);

      tarefas.push({
        linha,
        tarefa: vTarefa.texto,
        relacionada: texto(celulaDe(abaTodo, coluna(mapa, 'Relacionada ao chamado?', 'B'), linha)),
        referenciaBruta: texto(celulaDe(abaTodo, coluna(mapa, 'Nº Chamado', 'C'), linha)),
        prioridade: texto(celulaDe(abaTodo, coluna(mapa, 'Prioridade', 'D'), linha)),
        horario: texto(celulaDe(abaTodo, coluna(mapa, 'Horário', 'E'), linha)),
        status,
        check,
        observacoes: texto(celulaDe(abaTodo, coluna(mapa, 'Observações rápidas', 'H'), linha)),
        data: lerData(celulaDe(abaTodo, coluna(mapa, 'Data', 'I'), linha), sistema),
        // Divergência entre status e check gera pendência; nada é perdido (10.5).
        divergenciaStatusCheck: check !== null && concluidoPeloStatus !== check,
      });
    }
  }

  /* ---------------- Resolvidos ---------------- */
  const resolvidos: ResolvidoLido[] = [];
  const abaRes = porNome.get('Resolvidos');
  if (abaRes) {
    const linhaCab = descobrirLinhaCabecalho(abaRes, ['Número do Chamado', 'Data Resolução', 'Status Final'], 5);
    const mapa = lerCabecalho(abaRes, linhaCab);
    const cRef = coluna(mapa, 'Número do Chamado', 'A');
    const primeira = linhaCab + 1;
    const ultima = ultimaLinhaMaterial(abaRes, [cRef], primeira);

    for (let linha = primeira; linha <= ultima; linha += 1) {
      const vRef = celulaDe(abaRes, cRef, linha);
      if (!materialLiteral(vRef)) continue;
      resolvidos.push({
        linha,
        referenciaBruta: vRef.texto,
        descricao: texto(celulaDe(abaRes, coluna(mapa, 'Descrição', 'B'), linha)),
        tipo: texto(celulaDe(abaRes, coluna(mapa, 'Tipo', 'C'), linha)),
        categoria: texto(celulaDe(abaRes, coluna(mapa, 'Categoria', 'D'), linha)),
        prioridade: texto(celulaDe(abaRes, coluna(mapa, 'Prioridade', 'E'), linha)),
        responsavel: texto(celulaDe(abaRes, coluna(mapa, 'Responsável', 'F'), linha)),
        dataCriacao: lerData(celulaDe(abaRes, coluna(mapa, 'Data de Criação', 'G'), linha), sistema),
        dataResolucao: lerData(celulaDe(abaRes, coluna(mapa, 'Data Resolução', 'H'), linha), sistema),
        tempoEmAberto: texto(celulaDe(abaRes, coluna(mapa, 'Tempo em Aberto', 'I'), linha)),
        // Snapshots derivados: preservados, jamais somados ao esforço (10.5).
        horasApontadas: celulaDe(abaRes, coluna(mapa, 'Horas Apontadas', 'J'), linha).numero,
        qtdeApontamentos: celulaDe(abaRes, coluna(mapa, 'Qtde Apontamentos', 'K'), linha).numero,
        fusRealizados: celulaDe(abaRes, coluna(mapa, 'FUs Realizados', 'L'), linha).numero,
        statusFinal: texto(celulaDe(abaRes, coluna(mapa, 'Status Final', 'M'), linha)),
        observacoes: texto(celulaDe(abaRes, coluna(mapa, 'Observações', 'N'), linha)),
      });
    }
  }

  /* ---------------- Histórico Status ---------------- */
  const historicoStatus: EventoStatusLido[] = [];
  const abaHist = porNome.get('Histórico Status');
  if (abaHist) {
    const linhaCab = descobrirLinhaCabecalho(abaHist, ['Data/Hora', 'Número do Chamado', 'Novo Status'], 5);
    const mapa = lerCabecalho(abaHist, linhaCab);
    const cData = coluna(mapa, 'Data/Hora', 'A');
    const cRef = coluna(mapa, 'Número do Chamado', 'B');
    const primeira = linhaCab + 1;
    const ultima = ultimaLinhaMaterial(abaHist, [cData, cRef], primeira);

    for (let linha = primeira; linha <= ultima; linha += 1) {
      const vData = celulaDe(abaHist, cData, linha);
      const vRef = celulaDe(abaHist, cRef, linha);
      if (!materialLiteral(vData) && !materialLiteral(vRef)) continue;
      const d = lerData(vData, sistema);
      historicoStatus.push({
        linha,
        dataHoraBruta: d.bruto,
        data: d.data,
        referenciaBruta: vRef.texto,
        statusAnterior: texto(celulaDe(abaHist, coluna(mapa, 'Status Anterior', 'C'), linha)),
        novoStatus: texto(celulaDe(abaHist, coluna(mapa, 'Novo Status', 'D'), linha)),
        // Usuário do legado, separado de quem faz a importação (10.5).
        usuarioLegado: texto(celulaDe(abaHist, coluna(mapa, 'Usuário', 'E'), linha)),
        observacao: texto(celulaDe(abaHist, coluna(mapa, 'Observação', 'F'), linha)),
        origem: texto(celulaDe(abaHist, coluna(mapa, 'Origem', 'G'), linha)),
      });
    }
  }

  /* ---------------- Meu desenvolvimento ---------------- */
  const desenvolvimento: DesenvolvimentoLido[] = [];
  const abaDev = porNome.get('Meu desenvolvimento');
  if (abaDev) {
    const linhaCab = descobrirLinhaCabecalho(abaDev, ['Data', 'Tipo de atividade', 'Tema', 'Descrição do que fiz'], 7);
    const mapa = lerCabecalho(abaDev, linhaCab);
    const cData = coluna(mapa, 'Data', 'A');
    const cDesc = coluna(mapa, 'Descrição do que fiz', 'D');
    const cTema = coluna(mapa, 'Tema', 'C');
    const primeira = linhaCab + 1;
    const ultima = ultimaLinhaMaterial(abaDev, [cData, cTema, cDesc], primeira);

    for (let linha = primeira; linha <= ultima; linha += 1) {
      const vData = celulaDe(abaDev, cData, linha);
      const vDesc = celulaDe(abaDev, cDesc, linha);
      const vTema = celulaDe(abaDev, cTema, linha);
      if (![vData, vDesc, vTema].some(materialLiteral)) continue;
      const d = lerData(vData, sistema);
      desenvolvimento.push({
        linha,
        data: d,
        tipoAtividade: texto(celulaDe(abaDev, coluna(mapa, 'Tipo de atividade', 'B'), linha)),
        tema: vTema.texto,
        descricao: vDesc.texto,
        pessoaArea: texto(celulaDe(abaDev, coluna(mapa, 'Pessoa / área impactada', 'E'), linha)),
        resultado: texto(celulaDe(abaDev, coluna(mapa, 'Resultado / impacto', 'F'), linha)),
        competencia: texto(celulaDe(abaDev, coluna(mapa, 'Competência demonstrada', 'G'), linha)),
        relevancia: texto(celulaDe(abaDev, coluna(mapa, 'Relevância para one a one', 'H'), linha)),
        proximoPasso: texto(celulaDe(abaDev, coluna(mapa, 'Próximo passo', 'I'), linha)),
        status: texto(celulaDe(abaDev, coluna(mapa, 'Status', 'J'), linha)),
        // Data ausente não invalida a descrição: fica armazenado com pendência (4.8).
        incompleto: d.data === null,
      });
    }
  }

  /* ---------------- Planilha1 (comparação) ---------------- */
  const planilha1: LeituraXlsm['planilha1'] = [];
  const abaP1 = porNome.get('Planilha1');
  if (abaP1) {
    const linhaCab = descobrirLinhaCabecalho(abaP1, ['Número do Chamado', 'Status', 'Descrição'], 3);
    const mapa = lerCabecalho(abaP1, linhaCab);
    const cRef = coluna(mapa, 'Número do Chamado', 'A');
    const cStatus = coluna(mapa, 'Status', 'C');
    const primeira = linhaCab + 1;
    const ultima = ultimaLinhaMaterial(abaP1, [cRef], primeira);
    for (let linha = primeira; linha <= ultima; linha += 1) {
      const vRef = celulaDe(abaP1, cRef, linha);
      if (!materialLiteral(vRef)) continue;
      planilha1.push({ linha, referenciaBruta: vRef.texto, statusBruto: texto(celulaDe(abaP1, cStatus, linha)) });
    }
  }

  /* ---------------- Fila Follow-up (derivada) ---------------- */
  let filaFollowUp = 0;
  const abaFila = porNome.get('Fila Follow-up');
  if (abaFila) {
    const linhaCab = descobrirLinhaCabecalho(abaFila, ['Número do Chamado', 'Descrição'], 3);
    const linhas = new Set<number>();
    for (const celula of abaFila.celulas.values()) {
      if (celula.linha <= linhaCab) continue;
      if (valorDe(celula).natureza !== 'empty') linhas.add(celula.linha);
    }
    filaFollowUp = linhas.size;
  }

  return {
    chamados,
    apontamentos,
    followUps,
    tarefas,
    resolvidos,
    historicoStatus,
    desenvolvimento,
    planilha1,
    filaFollowUp,
    sistemaData: sistema,
    diagnostico: {
      errosChamados,
      errosApontamentos,
      formulasExternas,
      abasEncontradas,
      abasAusentes,
      contemVba: livro.contemVba,
      vinculosExternos: livro.vinculosExternos,
      colunasDesconhecidas,
    },
  };
}

export { nomeDaColuna, indiceDaColuna };
