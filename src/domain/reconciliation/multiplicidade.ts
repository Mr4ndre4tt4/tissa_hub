/**
 * Identidade e multiplicidade dos apontamentos legados (secção 8.4).
 *
 * Os apontamentos do XLSM não têm ID permanente por linha. Na primeira
 * conciliação atribui-se um UUID e guarda-se o vínculo de origem. Nas versões
 * seguintes a identidade vem de campos estáveis, comparação de conteúdo e
 * **multiplicidade** — nunca do número da linha isolado.
 *
 * Consequências exigidas:
 *  - uma reordenação de linhas não cria eventos novos;
 *  - dois eventos iguais não viram automaticamente um só;
 *  - uma correspondência ambígua exige confirmação;
 *  - a mesma linha com duração corrigida é uma **alteração**, não uma
 *    atividade nova e silenciosa.
 */

import { normalizarParaComparacao } from '../entities/identidade';

export interface CandidatoOrigem {
  /** Número da linha na fonte: proveniência, nunca chave. */
  linha: number;
  workDate: string | null;
  referenciaBruta: string | null;
  descricao: string | null;
  duracaoMinutos: number | null;
  tipoAtuacao: string | null;
  observacoes: string | null;
}

export interface RegistroConhecido {
  /** UUID interno já atribuído numa conciliação anterior. */
  id: string;
  /** Último estado importado (B). */
  ultimoValorImportado: CandidatoOrigem;
  /** Ordinal quando a mesma chave aparece mais de uma vez na fonte. */
  ocorrencia: number;
}

/**
 * Chave de identidade estável: data + referência normalizada + descrição
 * normalizada + tipo de atuação. A duração fica **fora** da chave de propósito,
 * para que uma correção de duração apareça como alteração do mesmo registro.
 */
export function chaveEstavel(c: CandidatoOrigem): string {
  return [
    c.workDate ?? '',
    normalizarParaComparacao(c.referenciaBruta ?? ''),
    normalizarParaComparacao(c.descricao ?? ''),
    normalizarParaComparacao(c.tipoAtuacao ?? ''),
  ].join('|');
}

/** Chave completa, incluindo a duração: usada para detectar "igual mesmo". */
export function chaveCompleta(c: CandidatoOrigem): string {
  return `${chaveEstavel(c)}|${c.duracaoMinutos ?? ''}|${normalizarParaComparacao(c.observacoes ?? '')}`;
}

export type ClasseDeCorrespondencia =
  | 'novo'
  | 'igual'
  | 'alterado'
  | 'ambiguo'
  | 'ausente_na_carga';

export interface Correspondencia {
  classe: ClasseDeCorrespondencia;
  candidato: CandidatoOrigem | null;
  conhecido: RegistroConhecido | null;
  /** Ordinal desta ocorrência dentro do grupo de mesma chave estável. */
  ocorrencia: number;
  /** Quando `ambiguo`, os conhecidos que disputam a correspondência. */
  disputantes: RegistroConhecido[];
  motivo: string;
}

function agrupar<T>(itens: T[], chave: (t: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const item of itens) {
    const k = chave(item);
    const lista = mapa.get(k);
    if (lista) lista.push(item);
    else mapa.set(k, [item]);
  }
  return mapa;
}

/**
 * Casa os candidatos da nova carga com os registros já conhecidos.
 *
 * O casamento é por grupo de chave estável e por ordinal dentro do grupo: se a
 * fonte trazia dois eventos idênticos, continuam sendo dois. Se a quantidade
 * mudou, o excedente é `novo` e o faltante é `ausente_na_carga` — e ausência
 * nunca apaga nada (secção 8.2).
 */
export function casarPorMultiplicidade(
  candidatos: CandidatoOrigem[],
  conhecidos: RegistroConhecido[],
): Correspondencia[] {
  const gruposCandidatos = agrupar(candidatos, chaveEstavel);
  const gruposConhecidos = agrupar(conhecidos, (c) => chaveEstavel(c.ultimoValorImportado));

  const saida: Correspondencia[] = [];
  const chaves = new Set([...gruposCandidatos.keys(), ...gruposConhecidos.keys()]);

  for (const chave of chaves) {
    // A ordem por linha é apenas para estabilidade da saída; a identidade não
    // depende dela, por isso uma reordenação não gera eventos novos.
    const novos = (gruposCandidatos.get(chave) ?? []).slice().sort((a, b) => a.linha - b.linha);
    const antigos = (gruposConhecidos.get(chave) ?? []).slice().sort((a, b) => a.ocorrencia - b.ocorrencia);

    const maximo = Math.max(novos.length, antigos.length);
    for (let i = 0; i < maximo; i += 1) {
      const candidato = novos[i] ?? null;
      const conhecido = antigos[i] ?? null;

      if (candidato && !conhecido) {
        saida.push({
          classe: 'novo',
          candidato,
          conhecido: null,
          ocorrencia: i,
          disputantes: [],
          motivo:
            antigos.length === 0
              ? 'Registro sem correspondência anterior.'
              : `A carga traz ${novos.length} ocorrências desta atividade e a base conhecia ${antigos.length}.`,
        });
        continue;
      }

      if (!candidato && conhecido) {
        saida.push({
          classe: 'ausente_na_carga',
          candidato: null,
          conhecido,
          ocorrencia: i,
          disputantes: [],
          motivo: 'O registro não veio nesta carga. As horas, notas e vínculos são preservados.',
        });
        continue;
      }

      if (candidato && conhecido) {
        const igual = chaveCompleta(candidato) === chaveCompleta(conhecido.ultimoValorImportado);
        if (igual) {
          saida.push({ classe: 'igual', candidato, conhecido, ocorrencia: i, disputantes: [], motivo: 'Conteúdo idêntico ao último importado.' });
          continue;
        }

        // Mais de um conhecido no grupo e conteúdo divergente: a correspondência
        // por ordinal deixa de ser segura e vira confirmação manual.
        if (antigos.length > 1 && novos.length > 1) {
          saida.push({
            classe: 'ambiguo',
            candidato,
            conhecido,
            ocorrencia: i,
            disputantes: antigos,
            motivo: `Há ${antigos.length} registros equivalentes na base e ${novos.length} na carga, com conteúdo diferente. A associação precisa de confirmação.`,
          });
          continue;
        }

        const mudouDuracao = candidato.duracaoMinutos !== conhecido.ultimoValorImportado.duracaoMinutos;
        saida.push({
          classe: 'alterado',
          candidato,
          conhecido,
          ocorrencia: i,
          disputantes: [],
          motivo: mudouDuracao
            ? `Duração corrigida de ${conhecido.ultimoValorImportado.duracaoMinutos ?? 'ausente'} para ${candidato.duracaoMinutos ?? 'ausente'} minutos.`
            : 'Conteúdo alterado em relação ao último importado.',
        });
      }
    }
  }

  return saida;
}

/**
 * Candidatos a repetição **dentro da mesma carga** (pares 263/267, 264/268,
 * 265/269 e 266/270 do baseline). Ficam como pendência: nunca são excluídos
 * nem homologados automaticamente (AC-035).
 */
export function detectarRepeticoesNaCarga(candidatos: CandidatoOrigem[]): { a: CandidatoOrigem; b: CandidatoOrigem }[] {
  const grupos = agrupar(
    candidatos.filter((c) => c.duracaoMinutos !== null && c.workDate !== null),
    chaveCompleta,
  );
  const pares: { a: CandidatoOrigem; b: CandidatoOrigem }[] = [];
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue;
    const ordenado = grupo.slice().sort((x, y) => x.linha - y.linha);
    for (let i = 1; i < ordenado.length; i += 1) {
      pares.push({ a: ordenado[i - 1]!, b: ordenado[i]! });
    }
  }
  return pares;
}
