/**
 * Planejamento (secção 4.6): Tarefas do dia e Follow-ups.
 *
 * Nenhum destes registros cria horas. "Registrar esforço desta atividade"
 * apenas abre o formulário de apontamento com vínculo e descrição sugeridos —
 * sem preencher duração e sem gravar nada até a confirmação.
 */

import { useState } from 'react';
import { useApp } from '../../app/estado';
import { Aviso, EstadoVazio, Marca, Painel } from '../../design/componentes';
import type { Revision } from '../../domain/entities/tipos';

export function Planejamento({ aoRegistrarEsforco }: { aoRegistrarEsforco: (sugestao: { referencia: string; descricao: string }) => void }) {
  const { revisao, mutar } = useApp();
  const [aba, setAba] = useState<'tarefas' | 'followups'>('tarefas');

  const comData = revisao.tasks.filter((t) => t.data !== null).sort((a, b) => (a.data! < b.data! ? -1 : 1));
  const semData = revisao.tasks.filter((t) => t.data === null);

  const alternarConclusao = (id: string) =>
    mutar('saveTask', (base: Revision) => ({
      ...base,
      revisionId: crypto.randomUUID(),
      parentRevisionId: base.revisionId,
      tasks: base.tasks.map((t) => (t.id === id ? { ...t, concluida: !t.concluida } : t)),
    }));

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Planejamento</h1>
          <p>Tarefas e cobranças. Concluir uma tarefa ou marcar um follow-up não acrescenta tempo à jornada.</p>
        </div>
      </div>

      <Aviso tipo="informacao" titulo="Estes registros não geram horas.">
        Para registrar esforço, use a ação em cada item: ela abre o formulário de apontamento com o vínculo e a descrição sugeridos, sem
        preencher duração e sem gravar nada até você confirmar.
      </Aviso>

      <div className="acoes-linha" style={{ marginBottom: 'var(--e4)' }} role="tablist" aria-label="Visões do planejamento">
        <button type="button" role="tab" aria-selected={aba === 'tarefas'} className={aba === 'tarefas' ? '' : 'secundario'} onClick={() => setAba('tarefas')}>
          Tarefas do dia ({revisao.tasks.length})
        </button>
        <button type="button" role="tab" aria-selected={aba === 'followups'} className={aba === 'followups' ? '' : 'secundario'} onClick={() => setAba('followups')}>
          Follow-ups ({revisao.followUps.length})
        </button>
      </div>

      {aba === 'tarefas' ? (
        <Painel titulo="Tarefas">
          {revisao.tasks.length === 0 ? (
            <EstadoVazio titulo="Nenhuma tarefa registrada" />
          ) : (
            <>
              <div className="rolagem-tabela">
                <table>
                  <caption>Tarefas com data, ordenadas pela data prevista.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Concluída</th>
                      <th scope="col">Tarefa</th>
                      <th scope="col">Data</th>
                      <th scope="col">Horário</th>
                      <th scope="col">Prioridade</th>
                      <th scope="col">Vínculo</th>
                      <th scope="col">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comData.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <input
                            type="checkbox"
                            style={{ width: 'auto', minHeight: 'auto' }}
                            checked={t.concluida}
                            aria-label={`Marcar "${t.titulo}" como concluída`}
                            onChange={() => void alternarConclusao(t.id)}
                          />
                        </td>
                        <td>
                          {t.titulo}
                          {t.divergenciaStatusCheck && (
                            <div>
                              <Marca tom="atencao">Status e check divergiam na origem — os dois valores foram preservados</Marca>
                            </div>
                          )}
                        </td>
                        <td>{t.data}</td>
                        <td>{t.horario ?? '—'}</td>
                        <td>{t.prioridade ?? '—'}</td>
                        <td>{t.referenciaBruta ?? <Marca>sem chamado</Marca>}</td>
                        <td>
                          <button
                            type="button"
                            className="discreto"
                            onClick={() => aoRegistrarEsforco({ referencia: t.referenciaBruta ?? '', descricao: t.titulo })}
                          >
                            Registrar esforço desta atividade
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {semData.length > 0 && (
                <>
                  <h3 style={{ marginTop: 'var(--e5)' }}>Sem data</h3>
                  {/* Tarefa sem data é "Sem data", nunca "hoje" (secção 4.6). */}
                  <p className="rodape-nota">Estas tarefas não têm data definida. Elas não foram atribuídas a hoje.</p>
                  <ul className="lista-limpa">
                    {semData.map((t) => (
                      <li key={t.id}>
                        <label style={{ display: 'flex', gap: 'var(--e2)', alignItems: 'center' }}>
                          <input type="checkbox" style={{ width: 'auto', minHeight: 'auto' }} checked={t.concluida} onChange={() => void alternarConclusao(t.id)} />
                          {t.titulo}
                        </label>
                        {t.observacao && <div className="rodape-nota">{t.observacao}</div>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </Painel>
      ) : (
        <Painel titulo="Follow-ups">
          {revisao.followUps.length === 0 ? (
            <EstadoVazio titulo="Nenhum follow-up registrado" />
          ) : (
            <>
              <div className="rolagem-tabela">
                <table>
                  <caption>Eventos de cobrança e retorno. A fila é sempre derivada destes eventos.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Data</th>
                      <th scope="col">Chamado</th>
                      <th scope="col">Canal</th>
                      <th scope="col" className="numero">Tentativa</th>
                      <th scope="col">Resultado</th>
                      <th scope="col">Resposta</th>
                      <th scope="col">Próxima ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revisao.followUps.map((f) => (
                      <tr key={f.id}>
                        <td>{f.data ?? <Marca tom="atencao">sem data</Marca>}</td>
                        <td>{f.referenciaBruta ?? '—'}</td>
                        <td>{f.canal ?? '—'}</td>
                        <td className="numero">{f.tentativa ?? '—'}</td>
                        <td>{f.resultado === null ? <Marca tom="atencao">Desconhecido</Marca> : f.resultado}</td>
                        <td>
                          {f.dataResposta ?? (f.resultado !== null && /com resposta/i.test(f.resultado) ? <Marca tom="atencao">Com resposta, sem data — incompleto</Marca> : '—')}
                        </td>
                        <td>{f.proximaAcao ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {revisao.workspace.regrasFollowUp.ruleStatus === 'unconfirmed' && (
                <Aviso tipo="atencao" titulo="Regra de cadência ainda não confirmada.">
                  Sem a regra definida em Configurações, o aplicativo não calcula elegibilidade automática nem recomenda encerramento. Você
                  pode agendar a próxima ação manualmente, com data explícita. Mesmo com a regra confirmada, o aplicativo apenas recomenda
                  acompanhamento — ele nunca encerra chamados no CS3.
                </Aviso>
              )}
              <p className="rodape-nota">
                Resultado em branco significa desconhecido, não “sem resposta”. Uma tentativa só é contada como sem retorno quando o
                resultado é explicitamente compatível e a sequência de datas é válida.
              </p>
            </>
          )}
        </Painel>
      )}
    </>
  );
}
