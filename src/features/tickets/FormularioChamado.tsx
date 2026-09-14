import { useRef, useState, type FormEvent } from 'react';
import { useApp } from '../../app/estado';
import { Aviso, Campo, Painel } from '../../design/componentes';
import { CELULAS, ROTULO_CELULA, type Ticket } from '../../domain/entities/tipos';
import { dadosDoChamado, salvarChamado, validarDadosChamado, type DadosChamado } from '../../domain/entities/chamados';

export function FormularioChamado({ ticket, aoCancelar, aoSalvar }: { ticket?: Ticket; aoCancelar: () => void; aoSalvar: (id: string) => void }) {
  const { revisao, mutar, modo } = useApp();
  const [dados, setDados] = useState(() => dadosDoChamado(revisao, ticket));
  const [id] = useState(() => ticket?.id ?? crypto.randomUUID());
  const [revisaoBase] = useState(revisao.revisionId);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const trava = useRef(false);
  const mudar = <K extends keyof DadosChamado>(campo: K, valor: DadosChamado[K]) => setDados(d => ({ ...d, [campo]: valor }));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (trava.current) return;
    setErro('');
    const comando = { id, editando: !!ticket, revisaoBase, dados };
    try {
      validarDadosChamado(dados);
      // Erros de identidade/revisão são exibidos antes de iniciar a gravação.
      salvarChamado(revisao, comando);
      trava.current = true; setEnviando(true);
      const resultado = await mutar(ticket ? 'updateTicket' : 'createTicket', base => salvarChamado(base, comando));
      if (resultado === 'confirmado' || resultado === 'ja_aplicado') aoSalvar(id);
      else setErro('A gravação não foi confirmada. Seus dados continuam no formulário. Confira a mensagem acima antes de tentar novamente.');
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar o chamado.'); }
    finally { trava.current = false; setEnviando(false); }
  }

  return <>
    <div className="cabecalho-pagina"><div><h1>{ticket ? 'Editar chamado' : 'Novo chamado'}</h1><p>{ticket ? ticket.referencia.bruto : 'Cadastre um chamado sem precisar importar um arquivo.'}</p></div></div>
    <Painel>
      <form onSubmit={e => void salvar(e)}>
        {erro && <Aviso tipo="atencao">{erro}</Aviso>}
        <fieldset disabled={enviando} className="formulario-chamado">
          <div className="grade grade-2">
            <Campo rotulo="Referência / número" ajuda={ticket ? 'Identificador do registro.' : 'Opcional. Se ainda não tiver um número, criaremos uma referência.'}>
              {p => <input {...p} value={dados.referencia} readOnly={!!ticket} onChange={e => mudar('referencia', e.target.value)} placeholder="Ex.: IR90001234" />}
            </Campo>
            <Campo rotulo="Tipo" obrigatorio={!ticket}>
              {p => <select {...p} value={dados.tipo} disabled={!!ticket} required={!ticket} onChange={e => mudar('tipo', e.target.value as DadosChamado['tipo'])}>
                <option value="">{ticket ? 'Não informado' : 'Selecione'}</option><option value="incident">Incidente</option><option value="request">Requisição</option>
              </select>}
            </Campo>
          </div>
          <Campo rotulo="Título" obrigatorio>{p => <input {...p} required value={dados.titulo} onChange={e => mudar('titulo', e.target.value)} />}</Campo>
          <div className="grade grade-2">
            <Campo rotulo="Andamento pessoal">{p => <input {...p} list="andamentos-chamado" value={dados.andamento} onChange={e => mudar('andamento', e.target.value)} placeholder="Ex.: Em atendimento" />}</Campo>
            <datalist id="andamentos-chamado"><option value="A fazer" /><option value="Em atendimento" /><option value="Aguardando retorno" /><option value="Resolvido" /></datalist>
            <Campo rotulo="Prioridade pessoal">{p => <input {...p} value={dados.prioridade} onChange={e => mudar('prioridade', e.target.value)} placeholder="Ex.: Alta" />}</Campo>
            <Campo rotulo="Responsável pessoal">{p => <input {...p} value={dados.responsavel} onChange={e => mudar('responsavel', e.target.value)} />}</Campo>
            <Campo rotulo="Célula">{p => <select {...p} value={dados.celula} onChange={e => mudar('celula', e.target.value as DadosChamado['celula'])}><option value="">Usar classificação sugerida</option>{CELULAS.map(c => <option value={c} key={c}>{ROTULO_CELULA[c]}</option>)}</select>}</Campo>
            <Campo rotulo="Prazo pessoal">{p => <input {...p} type="date" value={dados.prazo} onChange={e => mudar('prazo', e.target.value)} />}</Campo>
            <Campo rotulo="Estimativa (minutos)">{p => <input {...p} type="number" min="0" step="1" value={dados.estimativa} onChange={e => mudar('estimativa', e.target.value)} placeholder="Sem estimativa" />}</Campo>
          </div>
          <Campo rotulo="Próxima ação">{p => <textarea {...p} rows={3} value={dados.proximaAcao} onChange={e => mudar('proximaAcao', e.target.value)} />}</Campo>
          {ticket?.oficial && <p className="rodape-nota">As alterações ficam no seu acompanhamento e serão mantidas nas próximas importações. Os dados originais do SC3 continuam disponíveis no detalhe.</p>}
          <div className="acoes-linha"><button type="submit">{enviando ? 'Salvando…' : ticket ? 'Salvar alterações' : 'Criar chamado'}</button><button type="button" className="secundario" onClick={aoCancelar}>Cancelar</button></div>
        </fieldset>
        {modo === 'demonstrativo' && <p className="rodape-nota">Demonstração: as alterações duram apenas nesta sessão.</p>}
      </form>
    </Painel>
  </>;
}
