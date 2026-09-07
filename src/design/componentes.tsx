/**
 * Primitivas de interface, estilizadas pelos tokens.
 *
 * Acessibilidade (secção 3.4): rótulos associados, erros ligados aos campos,
 * modal com foco contido e retorno ao acionador, estados que não dependem só
 * de cor e alternativa tabular para todo gráfico.
 */

import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { Celula } from '../domain/entities/tipos';
import { ROTULO_CELULA } from '../domain/entities/tipos';
import { rotularMinutos } from '../domain/time/duracao';

export function Painel({ titulo, acao, children }: { titulo?: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="painel">
      {titulo && (
        <div className="cabecalho-pagina" style={{ marginBottom: 'var(--e4)' }}>
          <h2>{titulo}</h2>
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

export function Indicador({
  rotulo,
  valor,
  definicao,
  detalhe,
}: {
  rotulo: string;
  valor: ReactNode;
  definicao?: string;
  detalhe?: ReactNode;
}) {
  return (
    <div className="indicador">
      <dl style={{ margin: 0 }}>
        <dt>{rotulo}</dt>
        <dd>{valor}</dd>
      </dl>
      {detalhe && <div className="definicao">{detalhe}</div>}
      {definicao && <p className="definicao">{definicao}</p>}
    </div>
  );
}

/** A etiqueta de célula sempre carrega o nome: a cor nunca é o único sinal. */
export function EtiquetaCelula({ celula }: { celula: Celula }) {
  return <span className={`etiqueta etiqueta-${celula}`}>{ROTULO_CELULA[celula]}</span>;
}

export function Marca({ children, tom = 'neutro' }: { children: ReactNode; tom?: 'neutro' | 'atencao' | 'ok' }) {
  const classe = tom === 'atencao' ? 'marca marca-atencao' : tom === 'ok' ? 'marca marca-ok' : 'marca';
  return <span className={classe}>{children}</span>;
}

export function Aviso({
  tipo = 'informacao',
  titulo,
  children,
}: {
  tipo?: 'informacao' | 'atencao' | 'conclusao';
  titulo?: string;
  children: ReactNode;
}) {
  // Ícone textual + contorno + texto: o estado não depende apenas da cor.
  const icone = tipo === 'atencao' ? '!' : tipo === 'conclusao' ? '✓' : 'i';
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'atencao' ? 'alert' : 'status'}>
      <span className="icone" aria-hidden="true">
        {icone}
      </span>
      <div>
        {titulo && <strong>{titulo} </strong>}
        {children}
      </div>
    </div>
  );
}

export function Campo({
  rotulo,
  ajuda,
  erro,
  obrigatorio,
  children,
}: {
  rotulo: string;
  ajuda?: string;
  erro?: string | null;
  obrigatorio?: boolean;
  children: (props: { id: string; 'aria-describedby': string | undefined; 'aria-invalid': boolean }) => ReactNode;
}) {
  const id = useId();
  const idAjuda = `${id}-ajuda`;
  const idErro = `${id}-erro`;
  // A mensagem de erro é ligada ao campo por aria-describedby.
  const descritores = [ajuda ? idAjuda : null, erro ? idErro : null].filter(Boolean).join(' ');

  return (
    <div className="campo">
      <label htmlFor={id}>
        {rotulo}
        {obrigatorio && <span aria-hidden="true"> *</span>}
        {obrigatorio && <span className="so-leitor-de-tela"> (obrigatório)</span>}
      </label>
      {children({ id, 'aria-describedby': descritores || undefined, 'aria-invalid': Boolean(erro) })}
      {ajuda && (
        <p className="ajuda" id={idAjuda}>
          {ajuda}
        </p>
      )}
      {erro && (
        <p className="erro" id={idErro}>
          {erro}
        </p>
      )}
    </div>
  );
}

/** Modal com foco contido e devolução do foco ao acionador. */
export function Dialogo({
  titulo,
  aberto,
  aoFechar,
  children,
  acoes,
}: {
  titulo: string;
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
  acoes?: ReactNode;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const acionador = useRef<Element | null>(null);

  useEffect(() => {
    if (!aberto) return;
    acionador.current = document.activeElement;
    const primeiro = caixa.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    primeiro?.focus();

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        aoFechar();
        return;
      }
      if (e.key !== 'Tab' || !caixa.current) return;
      const focaveis = [...caixa.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
        (el) => !el.hasAttribute('disabled'),
      );
      if (focaveis.length === 0) return;
      const inicio = focaveis[0]!;
      const fim = focaveis[focaveis.length - 1]!;
      if (e.shiftKey && document.activeElement === inicio) {
        e.preventDefault();
        fim.focus();
      } else if (!e.shiftKey && document.activeElement === fim) {
        e.preventDefault();
        inicio.focus();
      }
    };

    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      (acionador.current as HTMLElement | null)?.focus?.();
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} ref={caixa}>
        <h2>{titulo}</h2>
        <div style={{ marginTop: 'var(--e4)' }}>{children}</div>
        {acoes && <div className="acoes">{acoes}</div>}
      </div>
    </div>
  );
}

/** Confirmação explícita para operações que descartam dados (secção 3.1). */
export function ConfirmarExclusao({
  aberto,
  titulo,
  consequencias,
  rotuloAcao,
  aoConfirmar,
  aoCancelar,
}: {
  aberto: boolean;
  titulo: string;
  consequencias: string[];
  rotuloAcao: 'Excluir' | 'Cancelar registro';
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  return (
    <Dialogo
      titulo={titulo}
      aberto={aberto}
      aoFechar={aoCancelar}
      acoes={
        <>
          <button type="button" className="secundario" onClick={aoCancelar}>
            Voltar
          </button>
          <button type="button" className="perigo" onClick={aoConfirmar}>
            {rotuloAcao}
          </button>
        </>
      }
    >
      <p>Confirme antes de continuar. O que vai acontecer:</p>
      <ul>
        {consequencias.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </Dialogo>
  );
}

export function EstadoVazio({ titulo, children, acao }: { titulo: string; children?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="estado-vazio">
      <h3>{titulo}</h3>
      {children && <p>{children}</p>}
      {acao && <div style={{ marginTop: 'var(--e4)' }}>{acao}</div>}
    </div>
  );
}

export function Minutos({ valor }: { valor: number | null }) {
  if (valor === null) return <Marca tom="atencao">sem duração</Marca>;
  // Rótulo legível e minutos explícitos, como exige a exportação e a tabela.
  return (
    <span title={`${valor} minutos`}>
      {rotularMinutos(valor)} <span className="so-leitor-de-tela">({valor} minutos)</span>
    </span>
  );
}

/**
 * Barras diárias com linha de meta. Toda visualização vem acompanhada de uma
 * alternativa tabular acessível (secção 3.4).
 */
export function GraficoDiario({ dados }: { dados: { data: string; realizadoMinutos: number; metaMinutos: number }[] }) {
  const maximo = Math.max(480, ...dados.map((d) => Math.max(d.realizadoMinutos, d.metaMinutos)));
  return (
    <>
      <div className="grafico" role="img" aria-label="Horas confirmadas por dia, com a meta de cada data.">
        {dados.map((d) => {
          const altura = maximo === 0 ? 0 : (d.realizadoMinutos / maximo) * 100;
          const acima = d.metaMinutos > 0 && d.realizadoMinutos > d.metaMinutos;
          return (
            <div className="barra-dia" key={d.data} title={`${d.data}: ${rotularMinutos(d.realizadoMinutos)} de ${rotularMinutos(d.metaMinutos)}`}>
              <div className={acima ? 'haste acima' : 'haste'} style={{ height: `${altura}%` }} />
              <span className="rotulo">{d.data.slice(8)}</span>
            </div>
          );
        })}
      </div>
      <details style={{ marginTop: 'var(--e3)' }}>
        <summary>Ver os mesmos dados em tabela</summary>
        <div className="rolagem-tabela" style={{ marginTop: 'var(--e3)' }}>
          <table className="densidade-compacta">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col" className="numero">
                  Realizado
                </th>
                <th scope="col" className="numero">
                  Meta
                </th>
              </tr>
            </thead>
            <tbody>
              {dados.map((d) => (
                <tr key={d.data}>
                  <td>{d.data}</td>
                  <td className="numero">
                    <Minutos valor={d.realizadoMinutos} />
                  </td>
                  <td className="numero">
                    <Minutos valor={d.metaMinutos} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export function BarrasHorizontais({
  itens,
  total,
}: {
  itens: { rotulo: ReactNode; chave: string; minutos: number }[];
  total: number;
}) {
  return (
    <div>
      {itens.map((i) => (
        <div className="barra-horizontal" key={i.chave}>
          <div>{i.rotulo}</div>
          <div className="trilha">
            <div className="preenchimento" style={{ width: total === 0 ? '0%' : `${(i.minutos / total) * 100}%` }} />
          </div>
          <div className="numero">
            <Minutos valor={i.minutos} />
          </div>
        </div>
      ))}
      {/* Proporção sempre com denominador visível (secção 13). */}
      <p className="rodape-nota">Denominador: {rotularMinutos(total)} confirmados no período.</p>
    </div>
  );
}
