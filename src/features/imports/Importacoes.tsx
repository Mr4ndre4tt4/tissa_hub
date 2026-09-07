/**
 * Importações e conciliação (secção 4.7).
 *
 * Três entradas explícitas, detecção de tipo pelo conteúdo e os passos
 * selecionar → ler → validar → comparar → resolver → confirmar → resultado.
 * Nada é gravado na base principal enquanto a prévia não for confirmada.
 */

import { useRef, useState } from 'react';
import { useApp } from '../../app/estado';
import { Aviso, EstadoVazio, Marca, Minutos, Painel } from '../../design/componentes';
import { detectarPerfil, analisarCsv, lerCsvCs3, ErroDeCsv } from '../../domain/sources/csv';
import { lerLivro } from '../../domain/sources/ooxml';
import { ErroDeArquivo } from '../../domain/sources/zip';
import { lerXlsmCentral } from '../../domain/sources/xlsm';
import {
  aplicarPrevia,
  previaCsv,
  previaXlsm,
  validarPrevia,
  type ClasseItem,
  type Previa,
} from '../../domain/reconciliation/importacao';
import { sha256Hex } from '../../adapters/graph/cliente';
import type { SourceDocument } from '../../domain/entities/tipos';
import { rotularMinutos } from '../../domain/time/duracao';

type Entrada = 'csv_incidentes' | 'csv_requisicoes' | 'xlsm';

const ROTULO_ENTRADA: Record<Entrada, string> = {
  csv_incidentes: 'CSV de incidentes',
  csv_requisicoes: 'CSV de requisições',
  xlsm: 'Central de Chamados — Excel',
};

const ROTULO_CLASSE: Record<ClasseItem, string> = {
  novo: 'Novos',
  alterado: 'Alterados',
  igual: 'Iguais',
  versao_antiga: 'Versões antigas',
  incompleto: 'Incompletos',
  conflito: 'Conflitos',
  possivel_duplicata: 'Possíveis duplicatas',
  ausente_na_carga: 'Ausentes nesta carga',
};

export function Importacoes() {
  const { revisao, mutar, modo } = useApp();
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<string | null>(null);
  const entradasRef = useRef<Record<Entrada, HTMLInputElement | null>>({ csv_incidentes: null, csv_requisicoes: null, xlsm: null });

  const carregar = async (entrada: Entrada, arquivo: File) => {
    setErro(null);
    setResultado(null);
    setLendo(true);
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      const sha = await sha256Hex(bytes);
      const documento: SourceDocument = {
        id: crypto.randomUUID(),
        tipo: entrada,
        nomeArquivo: arquivo.name,
        origem: 'upload_local',
        sha256: sha,
        tamanhoBytes: arquivo.size,
        perfil: entrada === 'xlsm' ? 'central-chamados-aprimorado-xlsm-v1' : entrada,
        lidoEm: new Date().toISOString(),
      };

      if (entrada === 'xlsm') {
        if (/\.csv$/i.test(arquivo.name)) {
          throw new Error('Este arquivo parece um CSV. Use uma das entradas de CSV — o perfil não é inferido pelo nome.');
        }
        const livro = lerLivro(bytes);
        const leitura = lerXlsmCentral(livro);
        setPrevia(prepararSelecao(previaXlsm(revisao, documento, leitura)));
      } else {
        const texto = new TextDecoder('utf-8').decode(bytes);
        const linhas = analisarCsv(texto);
        const deteccao = detectarPerfil((linhas[0]?.campos ?? []).map((c) => c.trim()));
        if (!deteccao.ok) throw new ErroDeCsv(deteccao.detalhe);

        // Aviso de seleção incompatível: o conteúdo manda, não a entrada usada.
        const esperado = entrada === 'csv_incidentes' ? 'incident' : 'request';
        if (deteccao.perfil.tipo !== esperado) {
          throw new Error(
            `O arquivo é um ${deteccao.perfil.rotulo}, mas foi enviado na entrada "${ROTULO_ENTRADA[entrada]}". ` +
              'Use a entrada correspondente: uma falha num formato não autoriza tratar o arquivo como o outro.',
          );
        }
        setPrevia(prepararSelecao(previaCsv(revisao, documento, lerCsvCs3(texto))));
      }
    } catch (e) {
      setPrevia(null);
      const mensagem =
        e instanceof ErroDeArquivo || e instanceof ErroDeCsv
          ? e.message
          : `Não foi possível ler o arquivo: ${(e as Error).message}`;
      setErro(mensagem);
    } finally {
      setLendo(false);
      // Permite reenviar o mesmo arquivo depois de corrigir algo.
      for (const k of Object.keys(entradasRef.current) as Entrada[]) {
        if (entradasRef.current[k]) entradasRef.current[k]!.value = '';
      }
    }
  };

  const prepararSelecao = (p: Previa): Previa => {
    setSelecionados(new Set(p.itens.filter((i) => i.incluidoPorPadrao).map((i) => i.id)));
    setExcluidos(new Set());
    return p;
  };

  const confirmar = async () => {
    if (!previa) return;
    // Revalida a revisão-base antes de aplicar (secção 8.1).
    const validade = validarPrevia(previa, revisao, previa.documento.sha256);
    if (!validade.valida) {
      setErro(validade.detalhe);
      setPrevia(null);
      return;
    }

    const decisoes = { itensAceitos: selecionados, itensExcluidos: excluidos, decisoesDeIssues: new Map() };
    let aplicados = 0;
    await mutar('commitImport', (base) => {
      const r = aplicarPrevia(base, previa, decisoes, crypto.randomUUID());
      aplicados = r.aplicados;
      return r.revisao;
    });
    setResultado(
      `Carga confirmada: ${aplicados} registro(s) aplicado(s), ${previa.issues.length} pendência(s) enviada(s) para a caixa de conciliação.`,
    );
    setPrevia(null);
  };

  const pendencias = revisao.issues.filter((i) => i.estado === 'aberta' || i.estado === 'adiada');

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Importações</h1>
          <p>Selecionar → ler → validar → comparar → resolver pendências → confirmar → resultado.</p>
        </div>
      </div>

      {modo !== 'conectado' && (
        <Aviso tipo="atencao" titulo="Modo demonstrativo.">
          O que for confirmado aqui fica apenas na memória deste navegador. Nada será gravado no OneDrive enquanto a integração Microsoft
          não estiver configurada.
        </Aviso>
      )}

      <Painel titulo="Escolher a fonte">
        <div className="grade grade-2">
          {(Object.keys(ROTULO_ENTRADA) as Entrada[]).map((entrada) => (
            <div key={entrada} className="campo">
              <label htmlFor={`entrada-${entrada}`}>{ROTULO_ENTRADA[entrada]}</label>
              <input
                id={`entrada-${entrada}`}
                type="file"
                accept={entrada === 'xlsm' ? '.xlsm,.xlsx' : '.csv'}
                disabled={lendo}
                ref={(el) => {
                  entradasRef.current[entrada] = el;
                }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void carregar(entrada, f);
                }}
              />
              <p className="ajuda">
                {entrada === 'xlsm'
                  ? 'Somente leitura. Macros não são executadas e vínculos externos não são abertos.'
                  : 'O tipo é confirmado pelo cabeçalho do arquivo, não pelo nome.'}
              </p>
            </div>
          ))}
        </div>
        {lendo && <Aviso tipo="informacao">Lendo o arquivo…</Aviso>}
        {erro && <Aviso tipo="atencao" titulo="Não foi possível continuar.">{erro}</Aviso>}
        {resultado && <Aviso tipo="conclusao" titulo="Resultado da carga.">{resultado}</Aviso>}
      </Painel>

      {previa && (
        <Painel titulo="Prévia da carga">
          <div className="rolagem-tabela" style={{ marginBottom: 'var(--e4)' }}>
            <table className="densidade-compacta">
              <caption>
                {previa.documento.nomeArquivo} · {previa.documento.tamanhoBytes.toLocaleString('pt-BR')} bytes · perfil{' '}
                {previa.documento.perfil} · origem {previa.documento.origem === 'upload_local' ? 'arquivo local' : 'OneDrive'} · SHA-256{' '}
                {previa.documento.sha256.slice(0, 16)}…
              </caption>
              <thead>
                <tr>
                  {(Object.keys(ROTULO_CLASSE) as ClasseItem[]).map((c) => (
                    <th key={c} scope="col" className="numero">
                      {ROTULO_CLASSE[c]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {(Object.keys(ROTULO_CLASSE) as ClasseItem[]).map((c) => (
                    <td key={c} className="numero">
                      {previa.contagens[c]}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {previa.avisos.map((a) => (
            <Aviso key={a} tipo="informacao">
              {a}
            </Aviso>
          ))}

          {previa.minutosCandidatos > 0 && (
            <Aviso tipo="informacao" titulo="Esforço candidato:">
              {rotularMinutos(previa.minutosCandidatos)} entrarão nos totais se você confirmar os itens marcados.
              {previa.minutosExcluidosPorPendencia > 0 &&
                ` Outros ${rotularMinutos(previa.minutosExcluidosPorPendencia)} ficam de fora por pendência.`}
            </Aviso>
          )}

          <div className="rolagem-tabela">
            <table className="densidade-compacta">
              <caption>Marque o que deve entrar. Excluir um candidato da carga não apaga nenhum registro já existente.</caption>
              <thead>
                <tr>
                  <th scope="col">Incluir</th>
                  <th scope="col">Classe</th>
                  <th scope="col">Registro</th>
                  <th scope="col">O que acontece</th>
                  <th scope="col" className="numero">Linha</th>
                </tr>
              </thead>
              <tbody>
                {previa.itens.slice(0, 300).map((i) => (
                  <tr key={i.id}>
                    <td>
                      <input
                        type="checkbox"
                        style={{ width: 'auto', minHeight: 'auto' }}
                        aria-label={`Incluir ${i.rotulo}`}
                        checked={selecionados.has(i.id)}
                        disabled={i.operacao.tipo === 'nenhuma'}
                        onChange={(e) => {
                          const s = new Set(selecionados);
                          const x = new Set(excluidos);
                          if (e.target.checked) {
                            s.add(i.id);
                            x.delete(i.id);
                          } else {
                            s.delete(i.id);
                            x.add(i.id);
                          }
                          setSelecionados(s);
                          setExcluidos(x);
                        }}
                      />
                    </td>
                    <td>
                      <Marca tom={i.classe === 'conflito' || i.classe === 'possivel_duplicata' || i.classe === 'incompleto' ? 'atencao' : 'neutro'}>
                        {ROTULO_CLASSE[i.classe]}
                      </Marca>
                    </td>
                    <td>{i.rotulo}</td>
                    <td>
                      {i.descricao}
                      {i.campos.length > 0 && (
                        <details style={{ marginTop: 'var(--e1)' }}>
                          <summary>Ver comparação campo a campo</summary>
                          <table className="densidade-compacta" style={{ marginTop: 'var(--e2)' }}>
                            <thead>
                              <tr>
                                <th scope="col">Campo</th>
                                <th scope="col">Último importado</th>
                                <th scope="col">Valor da origem</th>
                                <th scope="col">Valor no aplicativo</th>
                                <th scope="col">Local</th>
                              </tr>
                            </thead>
                            <tbody>
                              {i.campos.map((c) => (
                                <tr key={c.campo}>
                                  <td>{c.rotulo}</td>
                                  <td>{String(c.base ?? '—')}</td>
                                  <td>{String(c.origem ?? '—')}</td>
                                  <td>{String(c.aplicativo ?? '—')}</td>
                                  <td>{c.local ? `${c.local.aba ?? ''} ${c.local.celula ?? ''}` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </details>
                      )}
                    </td>
                    <td className="numero">{i.linhaOrigem ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previa.itens.length > 300 && <p className="rodape-nota">Mostrando os primeiros 300 de {previa.itens.length} itens.</p>}

          <div className="acoes-linha" style={{ marginTop: 'var(--e5)' }}>
            <button type="button" className="secundario" onClick={() => setPrevia(null)}>
              Descartar prévia
            </button>
            <button type="button" onClick={() => void confirmar()} disabled={selecionados.size === 0}>
              Confirmar {selecionados.size} registro(s)
            </button>
          </div>
          <p className="rodape-nota">
            Nada foi gravado até aqui. A confirmação aplica apenas o conjunto marcado, numa única revisão.
          </p>
        </Painel>
      )}

      <Painel titulo={`Caixa de conciliação (${pendencias.length})`}>
        {pendencias.length === 0 ? (
          <EstadoVazio titulo="Nenhuma pendência aberta">
            As pendências ficam guardadas aqui até você decidir — elas não somem depois do upload.
          </EstadoVazio>
        ) : (
          <ul className="lista-limpa">
            {pendencias.map((i) => (
              <li key={i.id}>
                <h3>{i.titulo}</h3>
                <p>{i.descricao}</p>
                {i.impactoMinutos !== null && (
                  <p>
                    <Marca tom="atencao">
                      Impacto no total: <Minutos valor={i.impactoMinutos} /> fora dos confirmados
                    </Marca>
                  </p>
                )}
                {i.evidencia.length > 0 && (
                  <p className="rodape-nota">
                    Evidência: {i.evidencia.map((e) => [e.aba, e.linha ? `linha ${e.linha}` : null, e.celulaPlanilha].filter(Boolean).join(' ')).join(' · ')}
                  </p>
                )}
                <div className="acoes-linha">
                  {i.opcoes.map((o) => (
                    <button
                      key={o.chave}
                      type="button"
                      className={o.destrutiva ? 'perigo' : 'secundario'}
                      onClick={() =>
                        void mutar('reconcileImport', (base) => ({
                          ...base,
                          revisionId: crypto.randomUUID(),
                          parentRevisionId: base.revisionId,
                          issues: base.issues.map((x) =>
                            x.id === i.id
                              ? {
                                  ...x,
                                  estado: o.chave === 'adiar' ? ('adiada' as const) : ('decidida' as const),
                                  decisao: { chave: o.chave, motivo: null, autoria: 'pessoa' as const, decididoEm: new Date().toISOString() },
                                }
                              : x,
                          ),
                        }))
                      }
                    >
                      {o.rotulo}
                      {o.destrutiva && ' (descarta informação)'}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Painel>
    </>
  );
}
