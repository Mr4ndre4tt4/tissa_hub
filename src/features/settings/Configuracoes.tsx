/**
 * Configurações (secção 4.9).
 *
 * Conta e permissões; fonte Excel vinculada; jornada e calendário; células e
 * etiquetas; mapas de status; regras de follow-up; retenção; exportação e
 * recuperação; diagnóstico da conexão e versão do aplicativo.
 *
 * Operações que descartam dados exigem resumo das consequências e confirmação.
 */

import { useState } from 'react';
import { useApp } from '../../app/estado';
import { Aviso, Campo, ConfirmarExclusao, EtiquetaCelula, Marca, Painel } from '../../design/componentes';
import { CELULAS, type Revision } from '../../domain/entities/tipos';
import { ESCOPO_LEITURA_EXTERNA, ESCOPO_PASTA_DO_APP, integracaoConfigurada } from '../../adapters/identity/msal';
import { MAPA_STATUS_CS3 } from '../../domain/entities/celulas';
import { rotularMinutos } from '../../domain/time/duracao';

const VERSAO_APP = '0.5.0';
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function Configuracoes() {
  const { revisao, mutar, modo, config } = useApp();
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);

  const atualizarWorkspace = (campos: Partial<Revision['workspace']>) =>
    mutar('updateWorkspace', (base) => ({
      ...base,
      revisionId: crypto.randomUUID(),
      parentRevisionId: base.revisionId,
      workspace: { ...base.workspace, ...campos },
    }));

  const ws = revisao.workspace;

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Configurações</h1>
          <p>Conta, fonte de dados, jornada e regras. Versão do aplicativo {VERSAO_APP}.</p>
        </div>
      </div>

      <Painel titulo="Conta e permissões">
        {modo === 'conectado' ? (
          <Aviso tipo="conclusao" titulo="Conectado.">
            Os dados desta base ficam no OneDrive pessoal da conta autenticada.
          </Aviso>
        ) : (
          <Aviso tipo="atencao" titulo="Integração Microsoft não configurada.">
            Faltam o <strong>client ID</strong> e o <strong>redirect URI</strong> de um registro de aplicativo Microsoft com suporte a conta
            pessoal. Enquanto isso, o login está desativado e o aplicativo funciona apenas em modo demonstrativo, com dados sintéticos.
          </Aviso>
        )}

        <div className="rolagem-tabela">
          <table className="densidade-compacta">
            <tbody>
              <tr>
                <th scope="row" style={{ width: 260 }}>Client ID</th>
                <td>{config.clientId ?? <Marca tom="atencao">não informado</Marca>}</td>
              </tr>
              <tr>
                <th scope="row">Autoridade</th>
                <td>{config.authority}</td>
              </tr>
              <tr>
                <th scope="row">Redirect URI</th>
                <td>{config.redirectUri ?? <Marca tom="atencao">não informado</Marca>}</td>
              </tr>
              <tr>
                <th scope="row">Endereço publicado</th>
                <td>{config.publicAppUrl ?? <Marca tom="atencao">ainda não publicado</Marca>}</td>
              </tr>
              <tr>
                <th scope="row">Escopo em uso</th>
                <td>
                  <Marca>{ESCOPO_PASTA_DO_APP}</Marca> — pasta especial do aplicativo
                </td>
              </tr>
              <tr>
                <th scope="row">Escopo opcional</th>
                <td>
                  <Marca>{ESCOPO_LEITURA_EXTERNA}</Marca> — só com consentimento explícito
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="rodape-nota">
          Nenhuma permissão é ampliada automaticamente. <strong>{ESCOPO_LEITURA_EXTERNA}</strong> não é uma permissão exclusiva de um único
          arquivo: o aplicativo limita a sua lógica ao item que você escolher, mas o OAuth não oferece esse isolamento.
        </p>
      </Painel>

      <Painel titulo="Fonte Excel vinculada">
        <p>Três formas, com alcances diferentes:</p>
        <ol>
          <li><strong>Upload manual</strong> — não exige ler outras pastas do seu OneDrive. Disponível agora, em Importações.</li>
          <li><strong>Arquivo dentro da pasta do aplicativo</strong> — você coloca ou autoriza uma cópia ali. O original não é movido.</li>
          <li><strong>Arquivo no local atual</strong> — exige consentimento incremental de leitura, com o alcance explicado acima.</li>
        </ol>
        <Aviso tipo="atencao" titulo="Vínculo ainda não configurado.">
          Nenhum arquivo do OneDrive está vinculado. As opções 2 e 3 dependem da conexão Microsoft. O vínculo é guardado por driveId +
          itemId, e não por caminho: renomear o arquivo não desconecta.
        </Aviso>
      </Painel>

      <Painel titulo="Jornada e calendário">
        <fieldset>
          <legend>Meta por dia da semana (minutos)</legend>
          <div className="grade grade-4">
            {DIAS.map((dia, i) => (
              <Campo key={dia} rotulo={dia}>
                {(p) => (
                  <input
                    {...p}
                    type="number"
                    min={0}
                    max={1440}
                    defaultValue={ws.schedule.metaPorDiaSemana[i]}
                    onBlur={(e) => {
                      const nova = [...ws.schedule.metaPorDiaSemana] as typeof ws.schedule.metaPorDiaSemana;
                      nova[i] = Math.max(0, Math.min(1440, Number(e.target.value) || 0));
                      void atualizarWorkspace({ schedule: { ...ws.schedule, metaPorDiaSemana: nova } });
                    }}
                  />
                )}
              </Campo>
            ))}
          </div>
          <p className="rodape-nota">
            Segunda a sexta com 480 minutos é o padrão do projeto, não uma leitura do calendário real. Ajuste conforme a sua jornada.
          </p>
        </fieldset>

        <div className="grade grade-2">
          <Campo
            rotulo="Início do controle"
            ajuda="Antes desta data o aplicativo não gera pendência de jornada nem dívida retroativa de horas."
          >
            {(p) => (
              <input
                {...p}
                type="date"
                defaultValue={ws.schedule.inicioControle ?? ''}
                onBlur={(e) => void atualizarWorkspace({ schedule: { ...ws.schedule, inicioControle: e.target.value || null } })}
              />
            )}
          </Campo>
          <Campo rotulo="Fuso de trabalho">
            {(p) => <input {...p} defaultValue={ws.schedule.fusoTrabalho} onBlur={(e) => void atualizarWorkspace({ schedule: { ...ws.schedule, fusoTrabalho: e.target.value } })} />}
          </Campo>
          <Campo
            rotulo="Fuso das extrações CS3"
            ajuda="Enquanto não for informado, os horários das fontes são preservados como locais e perfis temporais diferentes não são comparados."
          >
            {(p) => (
              <input
                {...p}
                placeholder="Ainda não informado"
                defaultValue={ws.fusoFonteCsv ?? ''}
                onBlur={(e) => void atualizarWorkspace({ fusoFonteCsv: e.target.value || null })}
              />
            )}
          </Campo>
        </div>

        {ws.excecoesCalendario.length > 0 && (
          <div className="rolagem-tabela">
            <table className="densidade-compacta">
              <caption>Exceções de calendário: férias, feriados, folga e jornada reduzida ajustam a meta daquela data.</caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Motivo</th>
                  <th scope="col" className="numero">Meta</th>
                </tr>
              </thead>
              <tbody>
                {ws.excecoesCalendario.map((e) => (
                  <tr key={e.data}>
                    <td>{e.data}</td>
                    <td>{e.motivo}</td>
                    <td className="numero">{rotularMinutos(e.metaMinutos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <Painel titulo="Células e etiquetas">
        <div className="acoes-linha">
          {CELULAS.map((c) => (
            <EtiquetaCelula key={c} celula={c} />
          ))}
        </div>
        <p className="rodape-nota">
          As três células operacionais são AMS, Squad de melhoria e Task Force. “Geral / transversal” classifica atividade interna e “Sem
          classificação” é pendência — nunca perda de esforço. A cor da etiqueta não representa urgência nem sucesso, e o nome sempre
          aparece junto.
        </p>
      </Painel>

      <Painel titulo="Mapa de status CS3">
        <div className="rolagem-tabela">
          <table className="densidade-compacta">
            <thead>
              <tr>
                <th scope="col">Valor bruto</th>
                <th scope="col">Exibição</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ws.mapaStatusCs3).map(([bruto, amigavel]) => (
                <tr key={bruto}>
                  <td><code>{bruto}</code></td>
                  <td>{amigavel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rodape-nota">
          O valor bruto é sempre preservado. Valores novos aparecem marcados como não mapeados; os estados não são ordenados como se
          houvesse progresso irreversível, e “Updated” significa atualizado/revisar, não encerrado.
        </p>
        {Object.keys(ws.mapaStatusCs3).length !== Object.keys(MAPA_STATUS_CS3).length && (
          <Aviso tipo="informacao">O mapa foi personalizado nesta base.</Aviso>
        )}
      </Painel>

      <Painel titulo="Regras de follow-up">
        <Campo rotulo="Situação da regra">
          {(p) => (
            <select
              {...p}
              value={ws.regrasFollowUp.ruleStatus}
              onChange={(e) =>
                void atualizarWorkspace({ regrasFollowUp: { ...ws.regrasFollowUp, ruleStatus: e.target.value as 'unconfirmed' | 'confirmed' } })
              }
            >
              <option value="unconfirmed">Não confirmada</option>
              <option value="confirmed">Confirmada</option>
            </select>
          )}
        </Campo>
        <div className="grade grade-2">
          <Campo rotulo="Cadência (dias)">
            {(p) => (
              <input
                {...p}
                type="number"
                min={1}
                defaultValue={ws.regrasFollowUp.cadenciaDias ?? ''}
                onBlur={(e) => void atualizarWorkspace({ regrasFollowUp: { ...ws.regrasFollowUp, cadenciaDias: e.target.value === '' ? null : Number(e.target.value) } })}
              />
            )}
          </Campo>
          <Campo rotulo="Limite de tentativas">
            {(p) => (
              <input
                {...p}
                type="number"
                min={1}
                defaultValue={ws.regrasFollowUp.limiteTentativas ?? ''}
                onBlur={(e) => void atualizarWorkspace({ regrasFollowUp: { ...ws.regrasFollowUp, limiteTentativas: e.target.value === '' ? null : Number(e.target.value) } })}
              />
            )}
          </Campo>
        </div>
        <Aviso tipo="atencao" titulo="Divergência conhecida na origem.">
          A planilha legada menciona três cobranças para incidentes num lugar e usa duas nos cálculos. Nenhuma das duas regras foi assumida.
          Mesmo depois de confirmada, a regra só recomenda acompanhamento: o aplicativo nunca encerra chamados no CS3.
        </Aviso>
      </Painel>

      <Painel titulo="Retenção, exportação e recuperação">
        <p>
          As revisões não são apagadas automaticamente. Restaurar cria uma revisão nova a partir de um checkpoint e preserva a anterior
          para retorno — é diferente de desfazer uma importação, que só pode reverter campos ainda não alterados depois.
        </p>
        <Aviso tipo="atencao" titulo="Sobre backup.">
          Cópias na mesma conta não protegem contra a perda total da conta. Uma exportação independente depende de um destino autorizado, e
          o aplicativo não faz criptografia ponta a ponta.
        </Aviso>
        <div className="acoes-linha">
          <button type="button" className="secundario" disabled={modo !== 'conectado'} title={modo !== 'conectado' ? 'Disponível quando houver conexão Microsoft.' : undefined}>
            Criar checkpoint
          </button>
          <button type="button" className="perigo" onClick={() => setConfirmarDescarte(true)}>
            Descartar a base desta sessão
          </button>
        </div>
      </Painel>

      <Painel titulo="Diagnóstico">
        <div className="rolagem-tabela">
          <table className="densidade-compacta">
            <tbody>
              <tr><th scope="row" style={{ width: 260 }}>Versão do aplicativo</th><td>{VERSAO_APP}</td></tr>
              <tr><th scope="row">Modo</th><td>{modo === 'conectado' ? 'Conectado ao OneDrive' : 'Demonstrativo (dados sintéticos, em memória)'}</td></tr>
              <tr><th scope="row">Integração configurada</th><td>{integracaoConfigurada(config) ? 'Sim' : 'Não'}</td></tr>
              <tr><th scope="row">Revisão atual</th><td><code>{revisao.revisionId}</code></td></tr>
              <tr><th scope="row">Versão do schema</th><td>{revisao.schemaVersion}</td></tr>
              <tr><th scope="row">Chamados / apontamentos</th><td>{revisao.tickets.length} / {revisao.timeEntries.length}</td></tr>
              <tr><th scope="row">Pendências abertas</th><td>{revisao.issues.filter((i) => i.estado === 'aberta').length}</td></tr>
              <tr><th scope="row">Fontes registradas</th><td>{revisao.sourceDocuments.length}</td></tr>
              <tr>
                <th scope="row">Tipografia</th>
                <td>
                  Magnetik não foi fornecida. Em uso: fallback do sistema.{' '}
                  <Marca tom="atencao">Substituição declarada</Marca>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Painel>

      <ConfirmarExclusao
        aberto={confirmarDescarte}
        titulo="Descartar a base desta sessão?"
        rotuloAcao="Excluir"
        consequencias={[
          `Os ${revisao.timeEntries.length} apontamentos e ${revisao.tickets.length} chamados carregados nesta sessão sairão da tela.`,
          modo === 'conectado'
            ? 'As revisões já publicadas no OneDrive continuam gravadas e podem ser reabertas.'
            : 'Como nada foi gravado fora do navegador, esta ação não pode ser desfeita nesta sessão.',
          'Nenhum arquivo de origem é alterado.',
        ]}
        aoCancelar={() => setConfirmarDescarte(false)}
        aoConfirmar={() => {
          setConfirmarDescarte(false);
          void mutar('resetSession', (base) => ({
            ...base,
            revisionId: crypto.randomUUID(),
            parentRevisionId: base.revisionId,
            tickets: [],
            personalStates: [],
            timeEntries: [],
            timeEntryReferences: [],
            allocations: [],
            followUps: [],
            tasks: [],
            statusEvents: [],
            resolutionEvents: [],
            developmentRecords: [],
            issues: [],
            notes: [],
            groups: [],
          }));
        }}
      />
    </>
  );
}
