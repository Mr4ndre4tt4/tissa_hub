/**
 * Detalhe do chamado (secção 4.4).
 *
 * Seções: Resumo · Dados CS3 · Meu acompanhamento · Apontamentos · Follow-ups ·
 * Histórico. Fica sempre claro o que veio do CSV, do XLSM e do aplicativo.
 * A soma principal nunca inclui duas vezes um apontamento compartilhado.
 */

import { useState } from 'react';
import { useApp } from '../../app/estado';
import { Aviso, Campo, EstadoVazio, EtiquetaCelula, Indicador, Marca, Minutos, Painel } from '../../design/componentes';
import { CELULAS, ROTULO_CELULA, type Celula, type Uuid } from '../../domain/entities/tipos';
import { exibirStatusCs3 } from '../../domain/entities/celulas';
import { esforcoDoTicket } from '../../domain/time/alocacao';
import { rotularMinutos } from '../../domain/time/duracao';

const ROTULO_ORIGEM: Record<string, string> = {
  cs3_csv: 'Veio da extração CS3',
  xlsm: 'Veio da planilha',
  app: 'Registrado neste aplicativo',
  derived: 'Calculado pelo aplicativo',
};

export function DetalheChamado({ ticketId, aoVoltar }: { ticketId: Uuid; aoVoltar: () => void }) {
  const { revisao, mutar } = useApp();
  const [copiado, setCopiado] = useState(false);

  const ticket = revisao.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    return (
      <EstadoVazio titulo="Chamado não encontrado" acao={<button type="button" onClick={aoVoltar}>Voltar para Chamados</button>}>
        O registro pode ter sido removido da base nesta sessão.
      </EstadoVazio>
    );
  }

  const estado = revisao.personalStates.find((p) => p.ticketId === ticketId);
  const esforco = esforcoDoTicket(ticketId, revisao.timeEntries, revisao.timeEntryReferences, revisao.allocations);
  const entradasVinculadas = revisao.timeEntryReferences.filter((r) => r.ticketId === ticketId).map((r) => r.timeEntryId);
  const apontamentos = revisao.timeEntries.filter((e) => entradasVinculadas.includes(e.id));
  const followUps = revisao.followUps.filter((f) => f.ticketId === ticketId);
  const eventos = revisao.statusEvents.filter((e) => e.ticketId === ticketId);
  const resolucoes = revisao.resolutionEvents.filter((e) => e.ticketId === ticketId);
  const notas = revisao.notes.filter((n) => n.ticketIds.includes(ticketId));
  const status = exibirStatusCs3(ticket.oficial?.statusBruto, revisao.workspace.mapaStatusCs3);

  const atualizarEstado = (campos: Record<string, unknown>) =>
    mutar('updatePersonalTicketState', (base) => ({
      ...base,
      revisionId: crypto.randomUUID(),
      parentRevisionId: base.revisionId,
      personalStates: base.personalStates.map((p) => (p.id === estado?.id ? { ...p, ...campos, atualizadoEm: new Date().toISOString(), versao: p.versao + 1 } : p)),
    }));

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <button type="button" className="discreto" onClick={aoVoltar}>
            ← Voltar para Chamados
          </button>
          <h1>{ticket.referencia.bruto}</h1>
          <p>{estado?.tituloPessoal ?? ticket.oficial?.title ?? 'Sem título'}</p>
        </div>
        <div className="acoes-linha">
          <button
            type="button"
            className="secundario"
            onClick={async () => {
              await navigator.clipboard?.writeText(ticket.referencia.bruto);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            }}
          >
            Copiar ID
          </button>
          {/* Só habilitado depois de validar a URL real de detalhe do CS3. */}
          <button type="button" className="secundario" disabled title="Disponível depois que a URL real de detalhe do CS3 for informada e validada nas Configurações. Nenhum endereço é fabricado a partir do número do chamado.">
            Abrir no CS3
          </button>
          {copiado && <span className="marca marca-ok">ID copiado</span>}
        </div>
      </div>

      {ticket.provisorio && (
        <Aviso tipo="atencao" titulo="Referência provisória.">
          Este chamado foi criado a partir de horas registradas na planilha e ainda não tem linha oficial no CS3. Ao importar a extração
          correspondente, ele será completado sem duplicar.
        </Aviso>
      )}

      <Painel titulo="Resumo">
        <div className="grade grade-4">
          <Indicador
            rotulo="Horas atribuídas"
            valor={rotularMinutos(esforco.atribuidoMinutos)}
            definicao="Apenas alocações confirmadas. Um apontamento compartilhado nunca é somado duas vezes."
          />
          <Indicador
            rotulo="Compartilhadas sem rateio"
            valor={rotularMinutos(esforco.compartilhadoSemRateioMinutos)}
            definicao="Informativo. Não entra na soma principal do chamado até o rateio ser definido."
          />
          <Indicador rotulo="Status CS3" valor={status.bruto === '' ? '—' : status.amigavel} detalhe={status.naoMapeado && status.bruto ? 'Valor não mapeado' : undefined} />
          <Indicador rotulo="Andamento pessoal" valor={estado?.andamentoPessoal ?? '—'} />
        </div>
      </Painel>

      <Painel titulo="Dados CS3">
        {!ticket.oficial ? (
          <EstadoVazio titulo="Sem dados oficiais">Nenhuma extração CS3 trouxe este chamado até agora.</EstadoVazio>
        ) : (
          <>
            <Aviso tipo="informacao">
              Estes campos vêm da extração oficial e só mudam com uma versão mais recente do CS3. Eles não são editáveis aqui.
            </Aviso>
            <div className="rolagem-tabela">
              <table className="densidade-compacta">
                <tbody>
                  <Linha rotulo="Título oficial" valor={ticket.oficial.title} />
                  <Linha rotulo="Status (bruto)" valor={ticket.oficial.statusBruto} />
                  <Linha rotulo="Responsável" valor={ticket.oficial.assignedTo} />
                  <Linha rotulo="Abertura informada" valor={ticket.oficial.startTimeBruto} vazio="Sem data de abertura conhecida" />
                  <Linha rotulo="Última atualização" valor={ticket.oficial.lastUpdateTimeBruto} />
                  <Linha rotulo="Prioridade" valor={ticket.oficial.priority} />
                  <Linha rotulo="Impacto" valor={ticket.oficial.impact} />
                  <Linha rotulo="Complexidade" valor={ticket.oficial.complexity} />
                  <Linha rotulo="Grupo responsável" valor={ticket.oficial.assignmentGroup} />
                  <Linha rotulo="Referência externa" valor={ticket.oficial.external} />
                  <Linha rotulo="Reference ID" valor={ticket.oficial.referenceId} />
                  <Linha rotulo="Tags" valor={ticket.oficial.tags.filter(Boolean).join(' · ') || null} />
                </tbody>
              </table>
            </div>
            <p className="rodape-nota">
              Grupo responsável, categoria e tipo não determinam a célula sozinhos. A data de origem do chamado é diferente da data da
              última importação.
            </p>
          </>
        )}
      </Painel>

      <Painel titulo="Meu acompanhamento">
        {!estado ? (
          <EstadoVazio titulo="Sem acompanhamento pessoal">Nenhum registro pessoal foi importado ou criado para este chamado.</EstadoVazio>
        ) : (
          <>
            <Aviso tipo="informacao">
              Estes campos são seus. Editá-los não altera a origem nem o CS3, e o atualizador de dados oficiais nunca os sobrescreve.
            </Aviso>
            <div className="grade grade-2">
              <Campo rotulo="Título pessoal">
                {(p) => <input {...p} defaultValue={estado.tituloPessoal ?? ''} onBlur={(e) => void atualizarEstado({ tituloPessoal: e.target.value || null })} />}
              </Campo>
              <Campo rotulo="Próxima ação">
                {(p) => <input {...p} defaultValue={estado.proximaAcao ?? ''} onBlur={(e) => void atualizarEstado({ proximaAcao: e.target.value || null })} />}
              </Campo>
              <Campo rotulo="Prazo pessoal" ajuda="Prazo definido por você. Não é SLA oficial.">
                {(p) => <input {...p} type="date" defaultValue={estado.prazo ?? ''} onBlur={(e) => void atualizarEstado({ prazo: e.target.value || null })} />}
              </Campo>
              <Campo rotulo="Andamento pessoal">
                {(p) => <input {...p} defaultValue={estado.andamentoPessoal ?? ''} onBlur={(e) => void atualizarEstado({ andamentoPessoal: e.target.value || null })} />}
              </Campo>
              <Campo rotulo="Célula manual" ajuda="A célula manual prevalece sobre a sugerida pelas tags.">
                {(p) => (
                  <select {...p} defaultValue={estado.celulaManual ?? ''} onChange={(e) => void atualizarEstado({ celulaManual: (e.target.value || null) as Celula | null })}>
                    <option value="">Sem célula manual</option>
                    {CELULAS.map((c) => (
                      <option key={c} value={c}>
                        {ROTULO_CELULA[c]}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo rotulo="Estimativa (minutos)" ajuda='"Sem estimativa" não é zero. A estimativa só entra nos indicadores depois de confirmada.'>
                {(p) => (
                  <input
                    {...p}
                    type="number"
                    min={0}
                    defaultValue={estado.estimativaMinutos ?? ''}
                    onBlur={(e) => void atualizarEstado({ estimativaMinutos: e.target.value === '' ? null : Number(e.target.value), estimativaConfirmada: e.target.value !== '' })}
                  />
                )}
              </Campo>
            </div>

            {estado.celulaSugerida && estado.celulaManual && estado.celulaSugerida !== estado.celulaManual && (
              <Aviso tipo="atencao" titulo="Divergência de célula:">
                As tags sugerem {ROTULO_CELULA[estado.celulaSugerida]}, mas a sua classificação manual é {ROTULO_CELULA[estado.celulaManual]}.
                A manual foi mantida — nada foi reclassificado automaticamente.
              </Aviso>
            )}

            {estado.rndBruto && (
              <Aviso tipo="informacao" titulo="Texto de RND preservado:">
                “{estado.rndBruto}” — guardado integralmente. Nenhum número daqui virou hora apontada ou estimativa exata.
              </Aviso>
            )}

            {notas.length > 0 && (
              <>
                <h3 style={{ marginTop: 'var(--e5)' }}>Notas</h3>
                <ul className="lista-limpa">
                  {notas.map((n) => (
                    <li key={n.id}>
                      <div>{n.texto}</div>
                      <span className="rodape-nota">
                        {n.autoria === 'importacao' ? 'Importada' : 'Sua'} · {n.data ?? 'sem data'}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="rodape-nota">Cada nota é uma entrada própria — nenhuma célula única é sobrescrita a cada importação.</p>
              </>
            )}
          </>
        )}
      </Painel>

      <Painel titulo="Apontamentos">
        {apontamentos.length === 0 ? (
          <EstadoVazio titulo="Nenhum esforço registrado neste chamado" />
        ) : (
          <div className="rolagem-tabela">
            <table className="densidade-compacta">
              <caption>Esforço vinculado. Compartilhados aparecem identificados e não entram duas vezes na soma.</caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Descrição</th>
                  <th scope="col">Célula</th>
                  <th scope="col" className="numero">Duração</th>
                  <th scope="col">Origem</th>
                </tr>
              </thead>
              <tbody>
                {apontamentos.map((e) => {
                  const compartilhado = esforco.entradasCompartilhadas.includes(e.id);
                  return (
                    <tr key={e.id}>
                      <td>{e.workDate ?? <Marca tom="atencao">sem data</Marca>}</td>
                      <td>
                        {e.descricao ?? '—'}
                        {compartilhado && (
                          <div>
                            <Marca tom="atencao">Compartilhado — sem rateio</Marca>
                          </div>
                        )}
                      </td>
                      <td><EtiquetaCelula celula={e.celula} /></td>
                      <td className="numero"><Minutos valor={e.duracaoMinutos} /></td>
                      <td>
                        <Marca>{ROTULO_ORIGEM[e.proveniencia[0]?.origem ?? 'app']}</Marca>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <Painel titulo="Follow-ups">
        {followUps.length === 0 ? (
          <EstadoVazio titulo="Nenhum follow-up registrado" />
        ) : (
          <ul className="lista-limpa">
            {followUps.map((f) => (
              <li key={f.id}>
                <strong>{f.data ?? 'Sem data'}</strong> · {f.canal ?? 'canal não informado'} · tentativa {f.tentativa ?? '—'}
                <div>{f.descricao ?? f.resumo ?? '—'}</div>
                <div>
                  {f.resultado === null ? (
                    <Marca tom="atencao">Resultado desconhecido — não conta como “sem resposta”</Marca>
                  ) : (
                    <Marca>{f.resultado}</Marca>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Painel>

      <Painel titulo="Histórico">
        {eventos.length === 0 && resolucoes.length === 0 ? (
          <EstadoVazio titulo="Sem eventos conhecidos">
            O histórico mostra apenas mudanças realmente observadas. Nenhuma transição anterior é inventada.
          </EstadoVazio>
        ) : (
          <ul className="lista-limpa">
            {eventos.map((e) => (
              <li key={e.id}>
                <strong>{e.data ?? 'Data desconhecida'}</strong>: {e.statusAnterior ?? '—'} → {e.novoStatus ?? '—'}
                {e.usuarioLegado && <div className="rodape-nota">Registrado no legado por {e.usuarioLegado}</div>}
              </li>
            ))}
            {resolucoes.map((r) => (
              <li key={r.id}>
                <strong>{r.dataResolucao ?? 'Resolução sem data conhecida'}</strong>: {r.statusFinal ?? 'Resolvido'}
                <div className="rodape-nota">
                  Snapshot do legado — horas apontadas {r.snapshot.horasApontadas ?? '—'}, apontamentos {r.snapshot.qtdeApontamentos ?? '—'}.
                  Valores derivados, não somados ao esforço.
                </div>
              </li>
            ))}
          </ul>
        )}
      </Painel>
    </>
  );
}

function Linha({ rotulo, valor, vazio = '—' }: { rotulo: string; valor: string | null; vazio?: string }) {
  return (
    <tr>
      <th scope="row" style={{ width: 220 }}>
        {rotulo}
      </th>
      <td>{valor ?? <Marca>{vazio}</Marca>}</td>
    </tr>
  );
}
