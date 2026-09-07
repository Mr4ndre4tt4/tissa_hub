/**
 * Meu desenvolvimento (secção 4.8).
 *
 * Módulo simples de notas estruturadas. Não gera horas, não constrói avaliação
 * de desempenho e não faz ranking de pessoas. Uma descrição sem data continua
 * armazenada, com pendência.
 */

import { useState } from 'react';
import { useApp } from '../../app/estado';
import { Aviso, EstadoVazio, Marca, Painel } from '../../design/componentes';
import { normalizarParaComparacao } from '../../domain/entities/identidade';
import { gerarCsv } from '../../domain/sources/xlsx-escrita';

export function MeuDesenvolvimento() {
  const { revisao } = useApp();
  const [busca, setBusca] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');

  const registros = revisao.developmentRecords.filter((d) => {
    const alvo = normalizarParaComparacao(busca);
    if (alvo.length > 0) {
      const campos = [d.tema, d.descricao, d.tipoAtividade, d.resultado, d.competencia, d.proximoPasso]
        .filter(Boolean)
        .map((t) => normalizarParaComparacao(t!));
      if (!campos.some((c) => c.includes(alvo))) return false;
    }
    // O filtro de período só se aplica a registros com data; os sem data
    // continuam listados à parte, nunca descartados.
    if (d.data !== null) {
      if (inicio && d.data < inicio) return false;
      if (fim && d.data > fim) return false;
    }
    return true;
  });

  const comData = registros.filter((d) => d.data !== null).sort((a, b) => (a.data! < b.data! ? 1 : -1));
  const semData = registros.filter((d) => d.data === null);

  const exportarResumo = () => {
    const csv = gerarCsv(
      ['Data', 'Tipo', 'Tema', 'Descrição', 'Pessoa / área', 'Resultado', 'Competência', 'Relevância para one a one', 'Próximo passo', 'Status'],
      registros.map((d) => [
        d.data ?? 'Sem data',
        d.tipoAtividade ?? '',
        d.tema ?? '',
        d.descricao ?? '',
        d.pessoaArea ?? '',
        d.resultado ?? '',
        d.competencia ?? '',
        d.relevanciaOneOnOne ?? '',
        d.proximoPasso ?? '',
        d.status ?? '',
      ]),
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meu-desenvolvimento.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Meu desenvolvimento</h1>
          <p>Registros profissionais preservados da planilha, independentes do esforço apontado.</p>
        </div>
        <button type="button" className="secundario" onClick={exportarResumo} disabled={registros.length === 0}>
          Exportar resumo do período
        </button>
      </div>

      <Aviso tipo="informacao">
        Estes relatos não geram horas. Eles não alimentam nenhuma avaliação de desempenho nem comparação entre pessoas.
      </Aviso>

      <Painel>
        <div className="filtros">
          <div className="campo" style={{ minWidth: 260 }}>
            <label htmlFor="busca-dev">Buscar</label>
            <input id="busca-dev" type="search" placeholder="Tema, descrição, competência" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="dev-inicio">De</label>
            <input id="dev-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="dev-fim">até</label>
            <input id="dev-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
        </div>

        {registros.length === 0 ? (
          <EstadoVazio titulo="Nenhum registro de desenvolvimento">
            {revisao.developmentRecords.length === 0
              ? 'Importe a planilha para trazer a aba "Meu desenvolvimento".'
              : 'Nenhum resultado para estes filtros. Os registros continuam guardados.'}
          </EstadoVazio>
        ) : (
          <ul className="lista-limpa">
            {comData.map((d) => (
              <li key={d.id}>
                <h3>
                  {d.tema ?? 'Sem tema'} <Marca>{d.data}</Marca> {d.tipoAtividade && <Marca>{d.tipoAtividade}</Marca>}
                </h3>
                <p>{d.descricao ?? '—'}</p>
                <dl className="grade grade-2" style={{ margin: 0 }}>
                  <Detalhe rotulo="Pessoa / área impactada" valor={d.pessoaArea} />
                  <Detalhe rotulo="Resultado / impacto" valor={d.resultado} />
                  <Detalhe rotulo="Competência demonstrada" valor={d.competencia} />
                  <Detalhe rotulo="Relevância para one a one" valor={d.relevanciaOneOnOne} />
                  <Detalhe rotulo="Próximo passo" valor={d.proximoPasso} />
                  <Detalhe rotulo="Status" valor={d.status} />
                </dl>
              </li>
            ))}
          </ul>
        )}

        {semData.length > 0 && (
          <>
            <h3 style={{ marginTop: 'var(--e5)' }}>Sem data ({semData.length})</h3>
            <p className="rodape-nota">
              Estes registros não têm data. A descrição continua armazenada e a data fica como pendência — nada foi descartado nem
              atribuído a hoje.
            </p>
            <ul className="lista-limpa">
              {semData.map((d) => (
                <li key={d.id}>
                  <h3>
                    {d.tema ?? 'Sem tema'} <Marca tom="atencao">Data pendente</Marca>
                  </h3>
                  <p>{d.descricao ?? '—'}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Painel>
    </>
  );
}

function Detalhe({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <dt className="rodape-nota">{rotulo}</dt>
      <dd style={{ margin: 0 }}>{valor}</dd>
    </div>
  );
}
