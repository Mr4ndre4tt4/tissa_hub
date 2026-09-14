/**
 * Chamados e detalhe do chamado (secções 4.3 e 4.4).
 *
 * A tabela é a visão obrigatória. Total acumulado e total do período aparecem
 * separados. Referências provisórias dizem que os dados oficiais ainda não
 * foram importados. Concluir aqui nunca altera o SC3.
 */

import { FormularioSc3 } from './FormularioSc3';
import { useListaChamados, textoParaBusca } from './estadoLista';
import { normalizarStatusSc3, STATUS_SC3, statusSc3Encerrado } from '../../domain/entities/statusSc3';
import { ehDataValida } from '../../domain/time/datas';
import { FormularioChamado } from './FormularioChamado';
import { useMemo, useState } from 'react';
import { useApp } from '../../app/estado';
import { Aviso, EstadoVazio, EtiquetaCelula, Marca, Minutos, Painel } from '../../design/componentes';
import { ROTULO_CELULA, type Celula, type Revision, type Ticket, type Uuid } from '../../domain/entities/tipos';
import { exibirStatusCs3 } from '../../domain/entities/celulas';
import { esforcoDoTicket } from '../../domain/time/alocacao';
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
  const [criando, setCriando] = useState(false);
  const [sc3EmEdicao, setSc3EmEdicao] = useState<string | null>(null);
  const { filtros, setFiltros, limpar } = useListaChamados();
  const { busca, celula: filtroCelula, status: filtroStatus, situacao, somentePendencias, densidade, periodo, ordem } = filtros;
  const alterar = <K extends keyof typeof filtros>(chave: K, valor: typeof filtros[K]) => setFiltros(f => ({ ...f, [chave]: valor }));
  const periodoValido = ehDataValida(periodo.inicio) && ehDataValida(periodo.fim) && periodo.inicio <= periodo.fim;

  const estadosPorTicket = useMemo(() => new Map(revisao.personalStates.map(p => [p.ticketId, p])), [revisao.personalStates]);
  const linhas = useMemo(() => montarLinhas(revisao, periodo), [revisao, periodo]);

  const filtradas = linhas.filter((l) => {
    const alvo = textoParaBusca(busca);
    if (alvo.length > 0) {
      // Busca por ID, título, referência externa e termos da descrição.
      const campos = [
        l.ticket.referencia.bruto,
        l.ticket.sourceTicketId ?? '',
        l.tituloExibido,
        l.ticket.oficial?.title ?? '',
        l.ticket.oficial?.external ?? '',
        l.proximaAcao ?? '',
        l.ticket.oficial?.assignedTo ?? '',
        estadosPorTicket.get(l.ticket.id)?.responsavelPessoal ?? '',
      ].map(textoParaBusca);
      if (!campos.some((c) => c.includes(alvo))) return false;
    }
    if (filtroCelula !== 'todas' && l.celula !== filtroCelula) return false;
    if (filtroStatus !== 'todos' && (normalizarStatusSc3(l.statusOficial.bruto) || 'sem_status') !== filtroStatus) return false;
    if (situacao === 'abertos' && statusSc3Encerrado(l.statusOficial.bruto)) return false;
    if (situacao === 'encerrados' && !statusSc3Encerrado(l.statusOficial.bruto)) return false;
    if (somentePendencias && !temPendencia(revisao, l.ticket.id)) return false;
    return true;
  });

  const statusDisponiveis = [...new Set([...STATUS_SC3, ...linhas.map(l => normalizarStatusSc3(l.statusOficial.bruto)).filter(Boolean)])];
  const pessoal = (id: string) => estadosPorTicket.get(id);
  const instante = (data: string | undefined) => Number.isFinite(Date.parse(data ?? '')) ? Date.parse(data!) : 0;
  filtradas.sort((a, b) => {
    if (ordem === 'referencia') return a.ticket.referencia.bruto.localeCompare(b.ticket.referencia.bruto, 'pt-BR', { numeric: true });
    if (ordem === 'prazo') return (pessoal(a.ticket.id)?.prazo || '9999').localeCompare(pessoal(b.ticket.id)?.prazo || '9999');
    return Math.max(instante(b.ticket.atualizadoEm), instante(pessoal(b.ticket.id)?.atualizadoEm)) - Math.max(instante(a.ticket.atualizadoEm), instante(pessoal(a.ticket.id)?.atualizadoEm));
  });
  const totalAcumulado = filtradas.reduce((s, l) => s + l.acumuladoMinutos, 0);
  const totalPeriodo = filtradas.reduce((s, l) => s + l.periodoMinutos, 0);

  const editado = revisao.tickets.find(t => t.id === sc3EmEdicao);
  if (editado) return <FormularioSc3 key={editado.id} ticket={editado} aoFechar={() => setSc3EmEdicao(null)} />;
  if (criando) return <FormularioChamado aoCancelar={() => setCriando(false)} aoSalvar={aoAbrir} />;

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Chamados</h1>
          <p>Incidentes e requisições, com o status oficial e o seu acompanhamento lado a lado.</p>
        </div>
        <button type="button" onClick={() => setCriando(true)}>Novo chamado</button>
      </div>

      <Painel>
        <div className="filtros">
          <div className="campo busca-chamados">
            <label htmlFor="busca-chamados">Buscar</label>
            <input
              id="busca-chamados"
              type="search"
              placeholder="ID, título, responsável ou próxima ação"
              value={busca}
              onChange={(e) => alterar('busca', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="filtro-status">Status SC3</label>
            <select id="filtro-status" value={filtroStatus} onChange={(e) => alterar('status', e.target.value)}>
              <option value="todos">Todos</option>
              <option value="sem_status">Sem status informado</option>
              {statusDisponiveis.map((s) => (
                <option key={s} value={s}>
                  {exibirStatusCs3(s, revisao.workspace.mapaStatusCs3).amigavel}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="filtro-situacao">Situação</label>
            <select id="filtro-situacao" value={situacao} onChange={e => alterar('situacao', e.target.value as typeof situacao)}>
              <option value="todos">Todos os chamados</option><option value="abertos">Em aberto</option><option value="encerrados">Resolved / Closed</option>
            </select>
          </div>
          <button type="button" className="secundario" onClick={limpar}>Limpar filtros</button>
        </div>
        <details className="filtros-avancados"><summary>Mais filtros e ordenação</summary><div className="filtros">
          <div className="campo">
            <label htmlFor="filtro-celula">Célula</label>
            <select id="filtro-celula" value={filtroCelula} onChange={(e) => alterar('celula', e.target.value as 'todas' | Celula)}>
              <option value="todas">Todas</option>
              {(Object.keys(ROTULO_CELULA) as Celula[]).map((c) => (
                <option key={c} value={c}>
                  {ROTULO_CELULA[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="periodo-inicio">Período (esforço)</label>
            <input id="periodo-inicio" type="date" value={periodo.inicio} onChange={(e) => alterar('periodo', { ...periodo, inicio: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="periodo-fim">até</label>
            <input id="periodo-fim" type="date" value={periodo.fim} onChange={(e) => alterar('periodo', { ...periodo, fim: e.target.value })} />
          </div>
          <label style={{ display: 'flex', gap: 'var(--e2)', alignItems: 'center', marginBottom: 0 }}>
            <input type="checkbox" style={{ width: 'auto', minHeight: 'auto' }} checked={somentePendencias} onChange={(e) => alterar('somentePendencias', e.target.checked)} />
            Somente com pendência
          </label>
          <button type="button" className="secundario" onClick={() => alterar('densidade', densidade === 'normal' ? 'compacta' : 'normal')}>
            Densidade: {densidade === 'normal' ? 'normal' : 'compacta'}
          </button>
          <div className="campo"><label htmlFor="ordem-chamados">Ordenar por</label>
            <select id="ordem-chamados" value={ordem} onChange={e => alterar('ordem', e.target.value as typeof ordem)}>
              <option value="recentes">Atualizados recentemente</option><option value="referencia">Referência</option><option value="prazo">Prazo pessoal</option>
            </select>
          </div>
        </div><p className="rodape-nota">O período filtra o esforço. Os chamados e as horas históricas continuam na base.</p></details>

        {!periodoValido && <Aviso tipo="atencao">Informe um período válido, com a data inicial anterior ou igual à final.</Aviso>}
        <div className="resumo-lista" role="status">
          <strong>{filtradas.length} de {linhas.length} chamados</strong>
          <span>Esforço acumulado: {rotularMinutos(totalAcumulado)}</span>
          <span>No período: {periodoValido ? rotularMinutos(totalPeriodo) : 'período inválido'}</span>
        </div>

        {filtradas.length === 0 ? (
          linhas.length === 0 ? (
            <EstadoVazio titulo="Nenhum chamado na base">
              Use <strong>Novo chamado</strong> para cadastrar manualmente ou envie um arquivo em <strong>Importações</strong>.
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
                  <th scope="col">Status SC3</th>
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
                      <div><button type="button" className="discreto atalho-sc3" aria-label={`Editar SC3 de ${l.ticket.referencia.bruto}`} onClick={() => setSc3EmEdicao(l.ticket.id)}>Editar SC3</button></div>
                      {l.ticket.provisorio && (
                        <div>
                          <Marca tom="atencao">Sem importação SC3</Marca>
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
