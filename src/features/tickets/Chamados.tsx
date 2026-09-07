/**
 * Chamados e detalhe do chamado (secções 4.3 e 4.4).
 *
 * A tabela é a visão obrigatória. Total acumulado e total do período aparecem
 * separados. Referências provisórias dizem que os dados oficiais ainda não
 * foram importados. Concluir aqui nunca altera o CS3.
 */

import { useMemo, useState } from 'react';
import { useApp } from '../../app/estado';
import { Aviso, EstadoVazio, EtiquetaCelula, Marca, Minutos, Painel } from '../../design/componentes';
import { ROTULO_CELULA, type Celula, type Revision, type Ticket, type Uuid } from '../../domain/entities/tipos';
import { exibirStatusCs3 } from '../../domain/entities/celulas';
import { esforcoDoTicket } from '../../domain/time/alocacao';
import { normalizarParaComparacao } from '../../domain/entities/identidade';
import { noPeriodo, type Periodo } from '../../domain/metrics/indicadores';
import { rotularMinutos } from '../../domain/time/duracao';

interface LinhaChamado {
  ticket: Ticket;
  tituloExibido: string;
  statusOficial: ReturnType<typeof exibirStatusCs3>;
  andamentoPessoal: string | null;
  celula: Celula;
  acumuladoMinutos: number;
  periodoMinutos: number;
  compartilhadoMinutos: number;
  proximaAcao: string | null;
  ultimaAtualizacaoOficial: string | null;
}

export function Chamados({ aoAbrir }: { aoAbrir: (id: Uuid) => void }) {
  const { revisao } = useApp();
  const [busca, setBusca] = useState('');
  const [filtroCelula, setFiltroCelula] = useState<'todas' | Celula>('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [somentePendencias, setSomentePendencias] = useState(false);
  const [densidade, setDensidade] = useState<'normal' | 'compacta'>('normal');
  const [periodo, setPeriodo] = useState<Periodo>({ inicio: '2026-09-01', fim: '2026-09-30' });

  const linhas = useMemo(() => montarLinhas(revisao, periodo), [revisao, periodo]);

  const filtradas = linhas.filter((l) => {
    const alvo = normalizarParaComparacao(busca);
    if (alvo.length > 0) {
      // Busca por ID, título, referência externa e termos da descrição.
      const campos = [
        l.ticket.referencia.bruto,
        l.ticket.sourceTicketId ?? '',
        l.tituloExibido,
        l.ticket.oficial?.title ?? '',
        l.ticket.oficial?.external ?? '',
        l.proximaAcao ?? '',
      ].map(normalizarParaComparacao);
      if (!campos.some((c) => c.includes(alvo))) return false;
    }
    if (filtroCelula !== 'todas' && l.celula !== filtroCelula) return false;
    if (filtroStatus !== 'todos' && l.statusOficial.bruto !== filtroStatus) return false;
    if (somentePendencias && !temPendencia(revisao, l.ticket.id)) return false;
    return true;
  });

  const statusDisponiveis = [...new Set(linhas.map((l) => l.statusOficial.bruto))].filter((s) => s.length > 0);
  const totalAcumulado = filtradas.reduce((s, l) => s + l.acumuladoMinutos, 0);
  const totalPeriodo = filtradas.reduce((s, l) => s + l.periodoMinutos, 0);

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Chamados</h1>
          <p>Incidentes e requisições, com o status oficial e o seu acompanhamento lado a lado.</p>
        </div>
      </div>

      <Painel>
        <div className="filtros">
          <div className="campo" style={{ minWidth: 280 }}>
            <label htmlFor="busca-chamados">Buscar</label>
            <input
              id="busca-chamados"
              type="search"
              placeholder="ID, título, referência externa ou termo"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="filtro-celula">Célula</label>
            <select id="filtro-celula" value={filtroCelula} onChange={(e) => setFiltroCelula(e.target.value as 'todas' | Celula)}>
              <option value="todas">Todas</option>
              {(Object.keys(ROTULO_CELULA) as Celula[]).map((c) => (
                <option key={c} value={c}>
                  {ROTULO_CELULA[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="filtro-status">Status oficial</label>
            <select id="filtro-status" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="todos">Todos</option>
              {statusDisponiveis.map((s) => (
                <option key={s} value={s}>
                  {exibirStatusCs3(s, revisao.workspace.mapaStatusCs3).amigavel}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="periodo-inicio">Período (esforço)</label>
            <input id="periodo-inicio" type="date" value={periodo.inicio} onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="periodo-fim">até</label>
            <input id="periodo-fim" type="date" value={periodo.fim} onChange={(e) => setPeriodo({ ...periodo, fim: e.target.value })} />
          </div>
          <label style={{ display: 'flex', gap: 'var(--e2)', alignItems: 'center', marginBottom: 0 }}>
            <input type="checkbox" style={{ width: 'auto', minHeight: 'auto' }} checked={somentePendencias} onChange={(e) => setSomentePendencias(e.target.checked)} />
            Somente com pendência
          </label>
          <button type="button" className="secundario" onClick={() => setDensidade(densidade === 'normal' ? 'compacta' : 'normal')}>
            Densidade: {densidade === 'normal' ? 'normal' : 'compacta'}
          </button>
        </div>

        {/* O filtro de período afeta o esforço, não o acumulado histórico. */}
        <Aviso tipo="informacao" titulo="Totais separados:">
          Acumulado de todo o histórico: <strong>{rotularMinutos(totalAcumulado)}</strong>. No período selecionado:{' '}
          <strong>{rotularMinutos(totalPeriodo)}</strong>. Filtrar o período não elimina horas históricas dos relatórios de esforço.
        </Aviso>

        {filtradas.length === 0 ? (
          linhas.length === 0 ? (
            <EstadoVazio titulo="Nenhum chamado na base">
              Importe as extrações do CS3 ou a planilha em <strong>Importações</strong> para começar.
            </EstadoVazio>
          ) : (
            <EstadoVazio titulo="Nenhum resultado para estes filtros">
              Os {linhas.length} chamados continuam na base. Ajuste ou limpe os filtros para vê-los.
            </EstadoVazio>
          )
        ) : (
          <div className="rolagem-tabela">
            <table className={densidade === 'compacta' ? 'densidade-compacta' : undefined}>
              <caption>
                {filtradas.length} de {linhas.length} chamados. Durações em horas e minutos.
              </caption>
              <thead>
                <tr>
                  <th scope="col">ID / referência</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Título</th>
                  <th scope="col">Status CS3</th>
                  <th scope="col">Andamento pessoal</th>
                  <th scope="col">Célula</th>
                  <th scope="col" className="numero">Horas atribuídas</th>
                  <th scope="col">Próxima ação</th>
                  <th scope="col">Última atualização oficial</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l) => (
                  <tr key={l.ticket.id}>
                    <td>
                      {/* O título pode quebrar linha; o ID continua identificável. */}
                      <button type="button" className="discreto" onClick={() => aoAbrir(l.ticket.id)}>
                        {l.ticket.referencia.bruto}
                      </button>
                      {l.ticket.provisorio && (
                        <div>
                          <Marca tom="atencao">Dados oficiais ainda não importados</Marca>
                        </div>
                      )}
                    </td>
                    <td>{l.ticket.ticketType === 'incident' ? 'Incidente' : l.ticket.ticketType === 'request' ? 'Requisição' : '—'}</td>
                    <td>{l.tituloExibido}</td>
                    <td>
                      {l.statusOficial.bruto === '' ? <Marca>—</Marca> : <Marca tom={l.statusOficial.naoMapeado ? 'atencao' : 'neutro'}>{l.statusOficial.amigavel}</Marca>}
                    </td>
                    <td>{l.andamentoPessoal ?? <Marca>—</Marca>}</td>
                    <td><EtiquetaCelula celula={l.celula} /></td>
                    <td className="numero">
                      <Minutos valor={l.acumuladoMinutos} />
                      {l.compartilhadoMinutos > 0 && (
                        <div className="marca marca-atencao" style={{ marginTop: 'var(--e1)' }}>
                          + {rotularMinutos(l.compartilhadoMinutos)} sem rateio
                        </div>
                      )}
                    </td>
                    <td>{l.proximaAcao ?? <Marca>—</Marca>}</td>
                    <td>{l.ultimaAtualizacaoOficial ?? <Marca>—</Marca>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </>
  );
}

function montarLinhas(revisao: Revision, periodo: Periodo): LinhaChamado[] {
  const doPeriodo = revisao.timeEntries.filter((e) => noPeriodo(e.workDate, periodo));
  const idsPeriodo = new Set(doPeriodo.map((e) => e.id));

  return revisao.tickets.map((ticket) => {
    const estado = revisao.personalStates.find((p) => p.ticketId === ticket.id);
    const acumulado = esforcoDoTicket(ticket.id, revisao.timeEntries, revisao.timeEntryReferences, revisao.allocations);
    const noPeriodoEsforco = esforcoDoTicket(
      ticket.id,
      doPeriodo,
      revisao.timeEntryReferences.filter((r) => idsPeriodo.has(r.timeEntryId)),
      revisao.allocations.filter((a) => idsPeriodo.has(a.timeEntryId)),
    );

    return {
      ticket,
      tituloExibido: estado?.tituloPessoal ?? ticket.oficial?.title ?? 'Sem título',
      statusOficial: exibirStatusCs3(ticket.oficial?.statusBruto, revisao.workspace.mapaStatusCs3),
      andamentoPessoal: estado?.andamentoPessoal ?? null,
      celula: estado?.celulaManual ?? estado?.celulaSugerida ?? 'UNCLASSIFIED',
      acumuladoMinutos: acumulado.atribuidoMinutos,
      periodoMinutos: noPeriodoEsforco.atribuidoMinutos,
      compartilhadoMinutos: acumulado.compartilhadoSemRateioMinutos,
      proximaAcao: estado?.proximaAcao ?? null,
      ultimaAtualizacaoOficial: ticket.oficial?.lastUpdateTimeBruto ?? null,
    };
  });
}

function temPendencia(revisao: Revision, ticketId: Uuid): boolean {
  const entradas = new Set(revisao.timeEntryReferences.filter((r) => r.ticketId === ticketId).map((r) => r.timeEntryId));
  return revisao.issues.some(
    (i) => (i.estado === 'aberta' || i.estado === 'adiada') && (i.entidade?.id === ticketId || (i.entidade && entradas.has(i.entidade.id))),
  );
}
