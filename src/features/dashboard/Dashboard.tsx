/**
 * Dashboard (secção 4.5) e exportação (secção 13).
 *
 * Números confirmados e prévia bruta não se misturam. Todo indicador traz a
 * sua definição e acesso ao detalhe. Nada aqui é chamado de SLA oficial.
 */

import { useMemo, useState } from 'react';
import { useApp } from '../../app/estado';
import { Aviso, BarrasHorizontais, EstadoVazio, EtiquetaCelula, GraficoDiario, Indicador, Marca, Minutos, Painel } from '../../design/componentes';
import { ROTULO_CELULA, type Celula } from '../../domain/entities/tipos';
import {
  chamadosPorStatus,
  DEFINICOES,
  distribuicaoPorCelula,
  esforcoPorChamado,
  naturezaDoZero,
  painelReconciliado,
  proximasAcoesVencidas,
  resolucoesPessoais,
  saudeDaImportacao,
  serieDiaria,
  tempoAteResolucao,
  type Periodo,
} from '../../domain/metrics/indicadores';
import { diasVencidosIncompletos, saldoDoDia } from '../../domain/time/jornada';
import { rotularMinutos } from '../../domain/time/duracao';
import { gerarCsv, gerarXlsx } from '../../domain/sources/xlsx-escrita';

export function Dashboard() {
  const { revisao, dataSelecionada, definirDataSelecionada, modo } = useApp();
  const [periodo, setPeriodo] = useState<Periodo>({ inicio: '2026-09-01', fim: '2026-09-30' });

  const painel = useMemo(() => painelReconciliado(revisao, periodo), [revisao, periodo]);
  const serie = useMemo(() => serieDiaria(revisao, periodo), [revisao, periodo]);
  const celulas = useMemo(() => distribuicaoPorCelula(revisao, periodo), [revisao, periodo]);
  const porChamado = useMemo(() => esforcoPorChamado(revisao, periodo), [revisao, periodo]);
  const status = useMemo(() => chamadosPorStatus(revisao), [revisao]);
  const resolucoes = useMemo(() => resolucoesPessoais(revisao, periodo), [revisao, periodo]);
  const tempos = useMemo(() => tempoAteResolucao(revisao), [revisao]);
  const saude = useMemo(() => saudeDaImportacao(revisao), [revisao]);
  const vencidas = useMemo(() => proximasAcoesVencidas(revisao, dataSelecionada), [revisao, dataSelecionada]);
  const vencidosIncompletos = useMemo(
    () => diasVencidosIncompletos(dataSelecionada, revisao.timeEntries, revisao.workspace.schedule, revisao.workspace.excecoesCalendario),
    [revisao, dataSelecionada],
  );
  const doDia = saldoDoDia(dataSelecionada, revisao.timeEntries, revisao.workspace.schedule, revisao.workspace.excecoesCalendario);
  const zero = naturezaDoZero(revisao, periodo);

  const ultimaImportacao = saude.porFonte.map((f) => f.lidoEm).sort().at(-1);

  const baixar = (nome: string, bytes: Uint8Array | string, tipo: string) => {
    const blob = new Blob([bytes as BlobPart], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  };

  const linhasExportacao = revisao.timeEntries
    .filter((e) => e.workDate && e.workDate >= periodo.inicio && e.workDate <= periodo.fim)
    .map((e) => {
      const refs = revisao.timeEntryReferences.filter((r) => r.timeEntryId === e.id).map((r) => r.referencia.bruto);
      return [
        e.workDate,
        refs.join(' ; '),
        e.descricao ?? '',
        ROTULO_CELULA[e.celula],
        e.duracaoMinutos,
        e.duracaoMinutos === null ? '' : rotularMinutos(e.duracaoMinutos),
        e.estadoOperacional,
      ];
    });
  const cabecalhosExportacao = ['Data', 'Chamados', 'Descrição', 'Célula', 'Minutos', 'Duração', 'Estado'];

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Dashboard</h1>
          <p>Indicadores recalculados a partir dos apontamentos. Nenhum número vem de painéis salvos na planilha.</p>
        </div>
      </div>

      <Aviso tipo="informacao" titulo="Origem dos números:">
        Dados atualizados até a última importação
        {ultimaImportacao ? ` (${ultimaImportacao.slice(0, 10)})` : ' — nenhuma importação registrada'}. Não há leitura em tempo real do
        CS3. Estas medidas são de acompanhamento pessoal e não são indicadores oficiais de SLA.
      </Aviso>

      <Painel>
        <div className="filtros">
          <div className="campo">
            <label htmlFor="dash-data">Data selecionada</label>
            <input id="dash-data" type="date" value={dataSelecionada} onChange={(e) => definirDataSelecionada(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="dash-inicio">Período de</label>
            <input id="dash-inicio" type="date" value={periodo.inicio} onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="dash-fim">até</label>
            <input id="dash-fim" type="date" value={periodo.fim} onChange={(e) => setPeriodo({ ...periodo, fim: e.target.value })} />
          </div>
        </div>

        <div className="grade grade-4">
          <Indicador rotulo="Horas da data" valor={rotularMinutos(doDia.realizadoMinutos)} definicao={DEFINICOES.horasDaData} />
          <Indicador
            rotulo={doDia.excedenteMinutos > 0 ? 'Excedente da data' : 'Faltante da data'}
            valor={rotularMinutos(doDia.excedenteMinutos > 0 ? doDia.excedenteMinutos : doDia.faltanteMinutos)}
            definicao={DEFINICOES.faltanteExcedente}
          />
          <Indicador rotulo="Dias vencidos com pendência" valor={vencidosIncompletos.length} definicao={DEFINICOES.diasVencidos} />
          <Indicador rotulo="Próximos passos vencidos" valor={vencidas.length} definicao={DEFINICOES.proximasAcoesVencidas} />
        </div>
      </Painel>

      {zero === 'fonte_nao_importada' ? (
        <Painel>
          <EstadoVazio titulo="Nenhuma fonte importada ainda">
            Isto é diferente de “zero horas trabalhadas”: nenhuma extração ou planilha foi carregada nesta base. Vá em{' '}
            <strong>Importações</strong> para começar.
          </EstadoVazio>
        </Painel>
      ) : (
        <>
          <Painel titulo="Horas por dia, com a meta de cada data">
            <GraficoDiario dados={serie} />
            {zero === 'zero_confirmado' && (
              <Aviso tipo="informacao">
                Zero confirmado no período: as fontes foram importadas, mas nenhuma atividade confirmada cai nestas datas.
              </Aviso>
            )}
          </Painel>

          <Painel titulo="Distribuição por célula">
            <BarrasHorizontais
              total={celulas.total}
              itens={celulas.itens.map((i) => ({
                chave: i.celula,
                minutos: i.minutos,
                rotulo: <EtiquetaCelula celula={i.celula as Celula} />,
              }))}
            />
          </Painel>

          <Painel titulo="Reconciliação dos totais">
            <div className="rolagem-tabela">
              <table className="densidade-compacta">
                <caption>As classes são mutuamente exclusivas e somam exatamente o total confirmado.</caption>
                <thead>
                  <tr>
                    <th scope="col">Classe</th>
                    <th scope="col" className="numero">Minutos</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Atribuído a chamados</td><td className="numero"><Minutos valor={painel.atribuidoATickets} /></td></tr>
                  <tr><td>Compartilhado sem rateio</td><td className="numero"><Minutos valor={painel.compartilhadoSemRateio} /></td></tr>
                  <tr><td>Atividade interna</td><td className="numero"><Minutos valor={painel.atividadeInterna} /></td></tr>
                  <tr><td>Referência sem vínculo confirmado</td><td className="numero"><Minutos valor={painel.referenciaSemVinculoConfirmado} /></td></tr>
                  <tr>
                    <th scope="row">Total confirmado</th>
                    <td className="numero"><strong><Minutos valor={painel.totalConfirmado} /></strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {painel.fechaPorClasse && painel.fechaPorCelula ? (
              <Aviso tipo="conclusao" titulo="Os dois eixos fecham.">
                A soma por classe e a soma por célula batem com o total confirmado.
              </Aviso>
            ) : (
              <Aviso tipo="atencao" titulo="Os eixos não fecham.">
                Há divergência entre as somas. O desvio está sendo mostrado em vez de escondido — verifique as pendências de conciliação.
              </Aviso>
            )}

            {painel.minutosExcluidosPorPendencia > 0 && (
              <Aviso tipo="atencao" titulo="Fora dos totais por pendência:">
                {rotularMinutos(painel.minutosExcluidosPorPendencia)} estão em registros com pendência aberta e não entram nos números
                confirmados acima.
              </Aviso>
            )}
            {painel.saldosIniciaisMinutos > 0 && (
              <p className="rodape-nota">
                Saldos iniciais identificados: {rotularMinutos(painel.saldosIniciaisMinutos)}. Mostrados à parte e fora da jornada, porque
                não têm datas detalhadas.
              </p>
            )}
          </Painel>

          <Painel titulo="Maior consumo de esforço">
            {porChamado.length === 0 ? (
              <EstadoVazio titulo="Nenhum esforço atribuído no período" />
            ) : (
              <div className="rolagem-tabela">
                <table className="densidade-compacta">
                  <caption>{DEFINICOES.maiorConsumo}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Chamado</th>
                      <th scope="col">Título</th>
                      <th scope="col" className="numero">Atribuído</th>
                      <th scope="col" className="numero">Compartilhado sem rateio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porChamado.slice(0, 15).map((c) => (
                      <tr key={c.ticketId}>
                        <td>{c.referencia}</td>
                        <td>{c.titulo}</td>
                        <td className="numero"><Minutos valor={c.atribuidoMinutos} /></td>
                        <td className="numero">
                          {c.compartilhadoSemRateioMinutos > 0 ? <Marca tom="atencao">{rotularMinutos(c.compartilhadoSemRateioMinutos)}</Marca> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>

          <div className="grade grade-2">
            <Painel titulo="Chamados por status">
              <h3>Status oficial</h3>
              <ul className="lista-limpa">
                {status.oficial.map((s) => (
                  <li key={s.bruto || 'vazio'}>
                    {s.rotulo} — <strong>{s.quantidade}</strong>
                    {s.naoMapeado && s.bruto && <Marca tom="atencao">não mapeado</Marca>}
                  </li>
                ))}
              </ul>
              <h3 style={{ marginTop: 'var(--e4)' }}>Andamento pessoal</h3>
              <ul className="lista-limpa">
                {status.pessoal.map((s) => (
                  <li key={s.bruto || 'vazio'}>
                    {s.rotulo} — <strong>{s.quantidade}</strong>
                  </li>
                ))}
              </ul>
              {status.provisorios > 0 && <p className="rodape-nota">{status.provisorios} referência(s) provisória(s), contadas à parte.</p>}
            </Painel>

            <Painel titulo="Produtividade pessoal">
              <div className="grade grade-2">
                <Indicador rotulo="Chamados resolvidos (distintos)" valor={resolucoes.ticketsDistintos} definicao={DEFINICOES.resolucoesPessoais} />
                <Indicador rotulo="Eventos de resolução" valor={resolucoes.eventosDeResolucao} />
                <Indicador
                  rotulo="Tempo até resolução (mediana)"
                  valor={tempos.medianaDias === null ? '—' : `${tempos.medianaDias} dias`}
                  definicao={DEFINICOES.tempoAteResolucao}
                  detalhe={tempos.casosExcluidos > 0 ? `${tempos.casosExcluidos} caso(s) excluído(s) por data ausente ou incoerente.` : undefined}
                />
                <Indicador rotulo="Resoluções sem data conhecida" valor={resolucoes.semDataConhecida} detalhe="Nenhuma data foi fabricada." />
              </div>
              <p className="rodape-nota">
                Estas são resoluções <strong>pessoais conhecidas</strong>, registradas por você ou importadas da planilha. Não são
                indicadores oficiais de SLA nem o histórico integral do CS3.
              </p>
            </Painel>
          </div>

          <Painel titulo="Saúde da importação">
            {saude.porFonte.length === 0 ? (
              <EstadoVazio titulo="Nenhuma carga registrada" />
            ) : (
              <div className="rolagem-tabela">
                <table className="densidade-compacta">
                  <thead>
                    <tr>
                      <th scope="col">Fonte</th>
                      <th scope="col">Arquivo</th>
                      <th scope="col">Lido em</th>
                      <th scope="col" className="numero">Aceitos</th>
                      <th scope="col" className="numero">Conflitos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saude.porFonte.map((f) => (
                      <tr key={f.sha256 + f.arquivo}>
                        <td>{f.tipo}</td>
                        <td>{f.arquivo}</td>
                        <td>{f.lidoEm.slice(0, 16).replace('T', ' ')}</td>
                        <td className="numero">{f.aceitos}</td>
                        <td className="numero">{f.conflitos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="rodape-nota">
              Pendências abertas: {saude.pendenciasAbertas}
              {saude.minutosEmPendencia > 0 && ` · ${rotularMinutos(saude.minutosEmPendencia)} fora dos totais confirmados`}.
            </p>
          </Painel>
        </>
      )}

      <Painel titulo="Exportar conferência">
        <p>
          A exportação traz a duração em minutos e o rótulo legível. Textos que poderiam ser interpretados como fórmula saem como texto.
          Exportar não envia horas ao CS3.
        </p>
        <div className="acoes-linha">
          <button
            type="button"
            className="secundario"
            disabled={linhasExportacao.length === 0}
            onClick={() => baixar(`central-chamados-${periodo.inicio}-a-${periodo.fim}.csv`, gerarCsv(cabecalhosExportacao, linhasExportacao), 'text/csv;charset=utf-8')}
          >
            Exportar CSV (UTF-8)
          </button>
          <button
            type="button"
            className="secundario"
            disabled={linhasExportacao.length === 0}
            onClick={() =>
              baixar(
                `central-chamados-${periodo.inicio}-a-${periodo.fim}.xlsx`,
                gerarXlsx([{ nome: 'Apontamentos', cabecalhos: cabecalhosExportacao, linhas: linhasExportacao }]),
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              )
            }
          >
            Exportar XLSX de conferência
          </button>
        </div>
        {modo !== 'conectado' && (
          <p className="rodape-nota">
            Você está no modo demonstrativo: a exportação conterá os dados sintéticos exibidos na tela, não registros reais.
          </p>
        )}
      </Painel>
    </>
  );
}
