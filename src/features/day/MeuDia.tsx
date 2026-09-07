/**
 * Meu dia (secção 4.2).
 *
 * Topo: data, seletor de dia, horas confirmadas/meta, faltante/excedente,
 * registros incompletos e a única ação principal da tela.
 * A linha "Compartilhadas / sem rateio" fica visível quando existir.
 */

import { useMemo, useState } from 'react';
import { useApp, hojeLocal } from '../../app/estado';
import { Aviso, Campo, ConfirmarExclusao, Dialogo, EstadoVazio, EtiquetaCelula, Indicador, Minutos, Painel } from '../../design/componentes';
import { CELULAS, ROTULO_CELULA, type Celula, type Revision, type TimeEntry } from '../../domain/entities/tipos';
import { contaParaJornada, ehIncompleto, saldoDoDia } from '../../domain/time/jornada';
import { reconciliarTotais } from '../../domain/time/alocacao';
import { rotularMinutos, textoHoraParaMinutos, validarNovaDuracao } from '../../domain/time/duracao';
import { lerReferencia } from '../../domain/entities/identidade';
import { DEFINICOES } from '../../domain/metrics/indicadores';

export function MeuDia() {
  const { revisao, dataSelecionada, definirDataSelecionada, mutar } = useApp();
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<TimeEntry | null>(null);
  const [aCancelar, setACancelar] = useState<TimeEntry | null>(null);
  const [copiado, setCopiado] = useState(false);

  const saldo = useMemo(
    () => saldoDoDia(dataSelecionada, revisao.timeEntries, revisao.workspace.schedule, revisao.workspace.excecoesCalendario),
    [revisao, dataSelecionada],
  );

  const doDia = revisao.timeEntries.filter((e) => e.workDate === dataSelecionada && e.estadoOperacional !== 'cancelled');
  const idsDoDia = new Set(doDia.map((e) => e.id));
  const totais = reconciliarTotais(
    doDia,
    revisao.timeEntryReferences.filter((r) => idsDoDia.has(r.timeEntryId)),
    revisao.allocations.filter((a) => idsDoDia.has(a.timeEntryId)),
  );

  const resumoCopiavel = () =>
    [
      `Resumo de ${dataSelecionada}`,
      ...doDia.map((e) => `- ${e.duracaoMinutos === null ? 'sem duração' : rotularMinutos(e.duracaoMinutos)} — ${e.descricao ?? 'Sem descrição'}`),
      `Total confirmado: ${rotularMinutos(saldo.realizadoMinutos)} de ${rotularMinutos(saldo.metaMinutos)}`,
    ].join('\n');

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Meu dia</h1>
          <p>Registre o trabalho da data e acompanhe o fechamento da jornada.</p>
        </div>
        <button type="button" onClick={() => { setEmEdicao(null); setFormularioAberto(true); }}>
          Novo apontamento
        </button>
      </div>

      <Painel>
        <div className="filtros">
          <div className="campo">
            <label htmlFor="data-do-dia">Data de trabalho</label>
            <input
              id="data-do-dia"
              type="date"
              value={dataSelecionada}
              onChange={(e) => definirDataSelecionada(e.target.value)}
            />
          </div>
          <button type="button" className="secundario" onClick={() => definirDataSelecionada(hojeLocal())}>
            Ir para hoje
          </button>
          <button
            type="button"
            className="secundario"
            onClick={async () => {
              await navigator.clipboard?.writeText(resumoCopiavel());
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2500);
            }}
          >
            Copiar resumo do dia
          </button>
          {copiado && <span className="marca marca-ok">Resumo copiado</span>}
        </div>

        <div className="grade grade-4">
          <Indicador rotulo="Horas confirmadas" valor={rotularMinutos(saldo.realizadoMinutos)} definicao={DEFINICOES.horasDaData} />
          <Indicador rotulo="Meta da data" valor={rotularMinutos(saldo.metaMinutos)} />
          <Indicador
            rotulo={saldo.excedenteMinutos > 0 ? 'Excedente' : 'Faltante'}
            valor={rotularMinutos(saldo.excedenteMinutos > 0 ? saldo.excedenteMinutos : saldo.faltanteMinutos)}
            definicao={DEFINICOES.faltanteExcedente}
          />
          <Indicador
            rotulo="Registros incompletos"
            valor={saldo.incompletos}
            detalhe={saldo.incompletos > 0 ? 'Ficam fora do total confirmado, mas continuam guardados.' : undefined}
          />
        </div>

        {totais.compartilhadoSemRateio > 0 && (
          <div style={{ marginTop: 'var(--e4)' }}>
            <Aviso tipo="informacao" titulo="Compartilhadas / sem rateio:">
              {rotularMinutos(totais.compartilhadoSemRateio)} do dia estão em atividades ligadas a mais de um chamado. Somam uma vez no
              total do dia e não foram atribuídos a nenhum chamado até você definir o rateio.
            </Aviso>
          </div>
        )}

        {saldo.metaMinutos === 0 && (
          <p className="rodape-nota">Esta data não tem meta de jornada, então não gera falta.</p>
        )}
      </Painel>

      <Painel titulo="Atividades da data">
        {doDia.length === 0 ? (
          <EstadoVazio titulo="Nenhuma atividade nesta data">
            Ainda não há registro para {dataSelecionada}. Isso é diferente de “nenhuma hora trabalhada”: pode ser que o dia ainda não tenha
            sido lançado.
          </EstadoVazio>
        ) : (
          <div className="rolagem-tabela">
            <table>
              <caption>Atividades de {dataSelecionada}. Durações em horas e minutos.</caption>
              <thead>
                <tr>
                  <th scope="col">Descrição</th>
                  <th scope="col">Vínculo</th>
                  <th scope="col">Célula</th>
                  <th scope="col" className="numero">Duração</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {doDia.map((e) => {
                  const refs = revisao.timeEntryReferences.filter((r) => r.timeEntryId === e.id);
                  return (
                    <tr key={e.id}>
                      <td>{e.descricao ?? <span className="marca marca-atencao">Sem descrição</span>}</td>
                      <td>
                        {refs.length === 0 ? (
                          <span className="marca">Atividade interna</span>
                        ) : (
                          refs.map((r) => (
                            <span key={r.id} className="marca" style={{ marginRight: 'var(--e1)' }}>
                              {r.referencia.bruto}
                            </span>
                          ))
                        )}
                        {refs.length > 1 && <div className="marca marca-atencao" style={{ marginTop: 'var(--e1)' }}>Compartilhado — sem rateio</div>}
                      </td>
                      <td><EtiquetaCelula celula={e.celula} /></td>
                      <td className="numero"><Minutos valor={e.duracaoMinutos} /></td>
                      <td>
                        {contaParaJornada(e) ? (
                          <span className="marca marca-ok">Confirmado</span>
                        ) : e.estadoOperacional === 'draft' ? (
                          <span className="marca">Rascunho</span>
                        ) : (
                          <span className="marca marca-atencao">Incompleto</span>
                        )}
                        {e.lancamentoExterno === 'reported_posted' && (
                          <div className="marca" style={{ marginTop: 'var(--e1)' }} title="Anotação pessoal importada. Não é confirmação de integração com o CS3.">
                            Lançado (anotação pessoal)
                          </div>
                        )}
                      </td>
                      <td>
                        <button type="button" className="discreto" onClick={() => { setEmEdicao(e); setFormularioAberto(true); }}>
                          Editar
                        </button>
                        <button type="button" className="discreto" onClick={() => setACancelar(e)}>
                          Cancelar registro
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {doDia.some(ehIncompleto) && (
          <p className="rodape-nota">
            Registros incompletos aparecem na lista, mas não entram no total confirmado. Eles não valem zero nem oito horas — apenas
            aguardam a informação que falta.
          </p>
        )}
      </Painel>

      <FormularioApontamento
        aberto={formularioAberto}
        entrada={emEdicao}
        dataPadrao={dataSelecionada}
        revisao={revisao}
        aoFechar={() => setFormularioAberto(false)}
        aoSalvar={async (dados, rascunho) => {
          const ok = await mutar(emEdicao ? 'editTimeEntry' : 'createTimeEntry', (base) => aplicarApontamento(base, emEdicao, dados, rascunho));
          // O formulário só fecha quando a gravação não ficou incerta.
          if (ok === 'confirmado' || ok === 'ja_aplicado') setFormularioAberto(false);
        }}
      />

      <ConfirmarExclusao
        aberto={aCancelar !== null}
        titulo="Cancelar este registro de horas?"
        rotuloAcao="Cancelar registro"
        consequencias={[
          'A duração sai do total confirmado da data.',
          'O registro continua guardado no histórico, com a auditoria do cancelamento.',
          'Nada é apagado: o cancelamento é reversível pela trilha de alteração.',
        ]}
        aoCancelar={() => setACancelar(null)}
        aoConfirmar={async () => {
          const alvo = aCancelar!;
          setACancelar(null);
          await mutar('cancelTimeEntry', (base) => ({
            ...base,
            revisionId: crypto.randomUUID(),
            parentRevisionId: base.revisionId,
            timeEntries: base.timeEntries.map((e) =>
              e.id === alvo.id
                ? { ...e, estadoOperacional: 'cancelled' as const, canceladoEm: new Date().toISOString(), motivoCancelamento: 'Cancelado pela pessoa', versao: e.versao + 1 }
                : e,
            ),
          }));
        }}
      />
    </>
  );
}

interface DadosFormulario {
  workDate: string;
  descricao: string;
  duracaoTexto: string;
  celula: Celula;
  referenciaBruta: string;
  tipoAtuacao: string;
  observacao: string;
  lancamentoExterno: boolean;
}

function aplicarApontamento(base: Revision, existente: TimeEntry | null, d: DadosFormulario, rascunho: boolean): Revision {
  const minutos = d.duracaoTexto.trim() === '' ? null : (textoHoraParaMinutos(d.duracaoTexto) as { ok: true; minutos: number }).minutos;
  const leitura = lerReferencia(d.referenciaBruta);
  const agora = new Date().toISOString();

  const nova: Revision = {
    ...base,
    revisionId: crypto.randomUUID(),
    parentRevisionId: base.revisionId,
    criadoEm: agora,
    timeEntries: [...base.timeEntries],
    timeEntryReferences: [...base.timeEntryReferences],
  };

  if (existente) {
    nova.timeEntries = nova.timeEntries.map((e) =>
      e.id === existente.id
        ? {
            ...e,
            workDate: d.workDate,
            descricao: d.descricao || null,
            duracaoMinutos: minutos,
            celula: d.celula,
            celulaDefinidaPor: 'pessoa' as const,
            tipoAtuacaoBruto: d.tipoAtuacao || null,
            observacao: d.observacao || null,
            lancamentoExterno: d.lancamentoExterno ? ('reported_posted' as const) : null,
            estadoOperacional: rascunho || minutos === null ? ('draft' as const) : ('confirmed' as const),
            atualizadoEm: agora,
            versao: e.versao + 1,
          }
        : e,
    );
    nova.timeEntryReferences = nova.timeEntryReferences.filter((r) => r.timeEntryId !== existente.id);
    for (const c of leitura.candidatos) {
      nova.timeEntryReferences.push({
        id: crypto.randomUUID(),
        timeEntryId: existente.id,
        ticketId: base.tickets.find((t) => t.referencia.normalizado === c.normalizado)?.id ?? null,
        groupId: null,
        referencia: c,
      });
    }
    return nova;
  }

  const id = crypto.randomUUID();
  nova.timeEntries.push({
    id,
    workspaceId: base.workspace.id,
    workDate: d.workDate,
    descricao: d.descricao || null,
    duracaoMinutos: minutos,
    tipoAtuacaoBruto: d.tipoAtuacao || null,
    tipoAtuacaoNormalizado: null,
    celula: d.celula,
    celulaDefinidaPor: 'pessoa',
    estadoOperacional: rascunho || minutos === null ? 'draft' : 'confirmed',
    estadoImportacao: 'ready',
    elegivelJornada: true,
    lancamentoExterno: d.lancamentoExterno ? 'reported_posted' : null,
    observacao: d.observacao || null,
    referencias: leitura.candidatos,
    proveniencia: [{ origem: 'app', observadoEm: agora, natureza: 'literal' }],
    criadoEm: agora,
    atualizadoEm: agora,
    canceladoEm: null,
    motivoCancelamento: null,
    versao: 1,
  });
  for (const c of leitura.candidatos) {
    nova.timeEntryReferences.push({
      id: crypto.randomUUID(),
      timeEntryId: id,
      ticketId: base.tickets.find((t) => t.referencia.normalizado === c.normalizado)?.id ?? null,
      groupId: null,
      referencia: c,
    });
  }
  return nova;
}

function FormularioApontamento({
  aberto,
  entrada,
  dataPadrao,
  revisao,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  entrada: TimeEntry | null;
  dataPadrao: string;
  revisao: Revision;
  aoFechar: () => void;
  aoSalvar: (dados: DadosFormulario, rascunho: boolean) => Promise<void>;
}) {
  const [dados, setDados] = useState<DadosFormulario>(() => inicial(entrada, dataPadrao, revisao));
  const [enviando, setEnviando] = useState(false);
  const [chaveEntrada, setChaveEntrada] = useState<string | null>(entrada?.id ?? null);

  // Reinicia o formulário quando o registro em edição muda.
  if ((entrada?.id ?? null) !== chaveEntrada) {
    setChaveEntrada(entrada?.id ?? null);
    setDados(inicial(entrada, dataPadrao, revisao));
  }

  const erroDuracao = (() => {
    if (dados.duracaoTexto.trim() === '') return null;
    const r = textoHoraParaMinutos(dados.duracaoTexto);
    if (!r.ok) return r.detalhe;
    const v = validarNovaDuracao(r.minutos);
    return v.ok ? null : v.erro;
  })();

  const erroData = dados.workDate.trim() === '' ? 'Informe a data de trabalho.' : null;
  const erroDescricao = dados.descricao.trim() === '' ? 'Descreva a atividade.' : null;
  const podeConfirmar = !erroData && !erroDescricao && !erroDuracao && dados.duracaoTexto.trim() !== '';

  const enviar = async (rascunho: boolean) => {
    // Um clique duplo não pode gerar duas atividades (secção 4.2).
    if (enviando) return;
    setEnviando(true);
    try {
      await aoSalvar(dados, rascunho);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialogo
      titulo={entrada ? 'Editar apontamento' : 'Novo apontamento'}
      aberto={aberto}
      aoFechar={aoFechar}
      acoes={
        <>
          <button type="button" className="secundario" onClick={aoFechar} disabled={enviando}>
            Voltar
          </button>
          <button type="button" className="secundario" onClick={() => void enviar(true)} disabled={enviando || Boolean(erroData)}>
            Salvar rascunho
          </button>
          <button type="button" onClick={() => void enviar(false)} disabled={enviando || !podeConfirmar}>
            {enviando ? 'Gravando…' : 'Confirmar apontamento'}
          </button>
        </>
      }
    >
      <Campo rotulo="Data de trabalho" obrigatorio erro={erroData} ajuda="Um apontamento retroativo usa a data do trabalho, não a de hoje.">
        {(p) => <input {...p} type="date" value={dados.workDate} onChange={(e) => setDados({ ...dados, workDate: e.target.value })} />}
      </Campo>

      <Campo rotulo="Chamado(s) ou atividade interna" ajuda="Vários chamados podem ser citados; o esforço soma uma vez só no dia.">
        {(p) => (
          <input
            {...p}
            type="text"
            placeholder="Ex.: IR90000001 ; RR90000002 — deixe vazio para atividade interna"
            value={dados.referenciaBruta}
            onChange={(e) => setDados({ ...dados, referenciaBruta: e.target.value })}
          />
        )}
      </Campo>

      <Campo rotulo="Descrição" obrigatorio erro={erroDescricao}>
        {(p) => <textarea {...p} value={dados.descricao} onChange={(e) => setDados({ ...dados, descricao: e.target.value })} />}
      </Campo>

      <Campo rotulo="Tipo de atuação">
        {(p) => <input {...p} type="text" value={dados.tipoAtuacao} onChange={(e) => setDados({ ...dados, tipoAtuacao: e.target.value })} />}
      </Campo>

      <Campo
        rotulo="Duração (HH:mm)"
        erro={erroDuracao}
        ajuda="Deixe vazio para salvar como rascunho sem duração. Rascunhos não entram no total confirmado."
      >
        {(p) => (
          <input {...p} type="text" inputMode="numeric" placeholder="04:33" value={dados.duracaoTexto} onChange={(e) => setDados({ ...dados, duracaoTexto: e.target.value })} />
        )}
      </Campo>

      <Campo rotulo="Célula histórica" ajuda="Fica gravada neste apontamento como fotografia da época; não muda quando o chamado muda de célula.">
        {(p) => (
          <select {...p} value={dados.celula} onChange={(e) => setDados({ ...dados, celula: e.target.value as Celula })}>
            {CELULAS.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CELULA[c]}
              </option>
            ))}
          </select>
        )}
      </Campo>

      <Campo rotulo="Observação">
        {(p) => <textarea {...p} value={dados.observacao} onChange={(e) => setDados({ ...dados, observacao: e.target.value })} />}
      </Campo>

      <label style={{ display: 'flex', gap: 'var(--e2)', alignItems: 'flex-start' }}>
        <input
          type="checkbox"
          style={{ width: 'auto', minHeight: 'auto', marginTop: '4px' }}
          checked={dados.lancamentoExterno}
          onChange={(e) => setDados({ ...dados, lancamentoExterno: e.target.checked })}
        />
        <span>
          Já lancei estas horas no CS3 por fora
          <span className="ajuda" style={{ display: 'block' }}>
            Anotação pessoal sua. Este aplicativo não envia horas ao CS3 e não verifica esse lançamento.
          </span>
        </span>
      </label>
    </Dialogo>
  );
}

function inicial(entrada: TimeEntry | null, dataPadrao: string, revisao: Revision): DadosFormulario {
  if (!entrada) {
    return {
      workDate: dataPadrao,
      descricao: '',
      duracaoTexto: '',
      celula: 'UNCLASSIFIED',
      referenciaBruta: '',
      tipoAtuacao: '',
      observacao: '',
      lancamentoExterno: false,
    };
  }
  const refs = revisao.timeEntryReferences.filter((r) => r.timeEntryId === entrada.id).map((r) => r.referencia.bruto);
  return {
    workDate: entrada.workDate ?? dataPadrao,
    descricao: entrada.descricao ?? '',
    duracaoTexto: entrada.duracaoMinutos === null ? '' : `${String(Math.floor(entrada.duracaoMinutos / 60)).padStart(2, '0')}:${String(entrada.duracaoMinutos % 60).padStart(2, '0')}`,
    celula: entrada.celula,
    referenciaBruta: refs.join(' ; '),
    tipoAtuacao: entrada.tipoAtuacaoBruto ?? '',
    observacao: entrada.observacao ?? '',
    lancamentoExterno: entrada.lancamentoExterno === 'reported_posted',
  };
}
