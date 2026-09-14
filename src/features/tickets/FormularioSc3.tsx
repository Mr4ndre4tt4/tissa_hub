import { useRef, useState, type FormEvent } from 'react';
import { useApp } from '../../app/estado';
import { Aviso, Campo, Painel } from '../../design/componentes';
import { CAMPOS_SC3, camposSc3Vazios, salvarDadosSc3, type CampoTextoSc3 } from '../../domain/entities/dadosSc3';
import { STATUS_SC3 } from '../../domain/entities/statusSc3';
import type { Ticket } from '../../domain/entities/tipos';

export function FormularioSc3({ ticket, aoFechar }: { ticket: Ticket; aoFechar: () => void }) {
  const { revisao, mutar } = useApp();
  const [campos, setCampos] = useState(() => structuredClone(ticket.oficial ?? camposSc3Vazios()));
  const [revisaoBase] = useState(revisao.revisionId);
  const [restaurar, setRestaurar] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const trava = useRef(false);
  const importado = ticket.ultimoSc3Importado !== undefined ? ticket.ultimoSc3Importado : ticket.oficial;
  function mudar(chave: CampoTextoSc3, valor: string) {
    setRestaurar(false);
    const obrigatorioTexto = ['title', 'statusBruto', 'lastUpdateTimeBruto'].includes(chave);
    setCampos(c => ({ ...c, [chave]: obrigatorioTexto ? valor : valor || null }));
  }
  async function salvar(e: FormEvent) {
    e.preventDefault(); if (trava.current) return; setErro('');
    const comando = { ticketId: ticket.id, revisaoBase, campos, restaurar };
    try {
      salvarDadosSc3(revisao, comando);
      trava.current = true; setEnviando(true);
      const resultado = await mutar(restaurar ? 'restoreSc3Data' : 'updateSc3Data', base => salvarDadosSc3(base, comando));
      if (resultado === 'confirmado' || resultado === 'ja_aplicado') aoFechar();
      else setErro('A gravação não foi confirmada. As alterações continuam no formulário. Confira a mensagem acima antes de tentar novamente.');
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar os dados SC3.'); }
    finally { trava.current = false; setEnviando(false); }
  }
  function entrada([chave, rotulo]: typeof CAMPOS_SC3[number]) {
    const data = chave === 'startTimeBruto' || chave === 'lastUpdateTimeBruto';
    return <Campo key={chave} rotulo={rotulo} obrigatorio={chave === 'title'} ajuda={data ? 'DD/MM/AAAA ou DD/MM/AAAA HH:mm:ss. Sem conversão de fuso.' : undefined}>
      {p => chave === 'statusBruto' ? <select {...p} value={campos.statusBruto} onChange={e => mudar(chave, e.target.value)}>
        <option value="">Sem status informado</option>
        {campos.statusBruto && !STATUS_SC3.some(s => s === campos.statusBruto) && <option value={campos.statusBruto}>{campos.statusBruto} (valor atual)</option>}
        {STATUS_SC3.map(s => <option key={s} value={s}>{s}</option>)}
      </select> : <input {...p} value={campos[chave] ?? ''} required={chave === 'title'} onChange={e => mudar(chave, e.target.value)} />}

    </Campo>;
  }
  return <>
    <div className="cabecalho-pagina"><div><h1>Editar dados SC3</h1><p>{ticket.referencia.bruto}</p></div></div>
    <Painel>
      <p>As alterações valem na Central e prevalecem nas próximas importações. Elas não são enviadas ao sistema SC3.</p>
      <form onSubmit={e => void salvar(e)}>
        {erro && <Aviso tipo="atencao">{erro}</Aviso>}
        {restaurar && <Aviso>Valores do último CSV carregados no formulário. Salve para confirmar a restauração.</Aviso>}
        <fieldset className="formulario-chamado" disabled={enviando}>
          <div className="grade grade-2">{CAMPOS_SC3.slice(0, 11).map(entrada)}</div>
          <details className="outros-campos-sc3"><summary>Tags e outros campos SC3</summary>
            <div className="grade grade-2">
              {Array.from({ length: Math.max(6, campos.tags.length) }, (_, i) => <Campo key={i} rotulo={`Tag ${i + 1}`}>
                {p => <input {...p} value={campos.tags[i] ?? ''} onChange={e => { setRestaurar(false); setCampos(c => ({ ...c, tags: Array.from({ length: Math.max(6, c.tags.length) }, (_, n) => n === i ? e.target.value || null : c.tags[n] ?? null) })); }} />}
              </Campo>)}
              {CAMPOS_SC3.slice(11).map(entrada)}
              {Object.entries(campos.extras).map(([nome, valor]) => <Campo key={nome} rotulo={`Campo adicional: ${nome}`}>
                {p => <input {...p} value={valor} onChange={e => { setRestaurar(false); setCampos(c => ({ ...c, extras: { ...c.extras, [nome]: e.target.value } })); }} />}
              </Campo>)}
            </div>
          </details>
          <div className="acoes-linha acoes-formulario">
            <button type="submit">{enviando ? 'Salvando…' : 'Salvar dados SC3'}</button>
            <button type="button" className="secundario" onClick={aoFechar}>Cancelar</button>
            {importado && Object.keys(ticket.ajustesSc3 ?? {}).length > 0 && <button type="button" className="discreto" onClick={() => { setCampos(structuredClone(importado)); setRestaurar(true); }}>Restaurar valores do último CSV</button>}
          </div>
        </fieldset>
      </form>
    </Painel>
  </>;
}
