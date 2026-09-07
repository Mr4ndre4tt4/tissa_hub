/**
 * Estado da aplicação.
 *
 * Três modos, sempre visíveis para a pessoa (secções 1 e 15.1):
 *  - `nao_configurado`: falta client ID / redirect URI. A conexão Microsoft
 *    fica desativada e o aplicativo diz exatamente o que falta.
 *  - `demonstrativo`: dados sintéticos, em memória. Nada é gravado em lugar
 *    nenhum e a interface **nunca** diz "Salvo no OneDrive".
 *  - `conectado`: conta Microsoft ativa e revisões no OneDrive pessoal.
 *
 * Alterar no navegador não é salvar. Toda mutação declara o seu resultado:
 * confirmado, incerto, conflito ou erro.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Revision, Uuid } from '../domain/entities/tipos';
import { novoWorkspace, revisaoInicial, validarInvariantes } from '../domain/entities/revisao';
import { RepositorioOneDrive, type ResultadoSalvar } from '../adapters/storage/repositorio';
import { integracaoConfigurada, lerConfiguracaoPublica, type ConfiguracaoPublica } from '../adapters/identity/msal';
import { revisaoDemonstrativa } from '../fixtures/demonstracao';

export type ModoDeOperacao = 'nao_configurado' | 'demonstrativo' | 'conectado';

export type EstadoDeGravacao =
  | { situacao: 'ocioso' }
  | { situacao: 'gravando' }
  | { situacao: 'confirmado'; mensagem: string }
  | { situacao: 'nao_confirmado'; mensagem: string }
  | { situacao: 'conflito'; mensagem: string }
  | { situacao: 'erro'; mensagem: string };

export interface ContextoApp {
  modo: ModoDeOperacao;
  config: ConfiguracaoPublica;
  revisao: Revision;
  gravacao: EstadoDeGravacao;
  /** Data selecionada em Meu dia e no Dashboard. */
  dataSelecionada: string;
  definirDataSelecionada: (d: string) => void;
  /** Aplica uma mutação e informa honestamente o resultado. */
  mutar: (operacao: string, mutacao: (base: Revision) => Revision) => Promise<ResultadoSalvar['estado']>;
  limparGravacao: () => void;
  entrarNoModoDemonstrativo: () => void;
}

const Contexto = createContext<ContextoApp | null>(null);

export function useApp(): ContextoApp {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useApp precisa estar dentro de ProvedorApp.');
  return ctx;
}

export function hojeLocal(): string {
  // Data civil local, sem converter para UTC (secção 6.1).
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ProvedorApp({
  children,
  repositorio = null,
  configuracao = lerConfiguracaoPublica(),
}: {
  children: ReactNode;
  repositorio?: RepositorioOneDrive | null;
  configuracao?: ConfiguracaoPublica;
}) {
  const [modo, setModo] = useState<ModoDeOperacao>(() =>
    repositorio ? 'conectado' : integracaoConfigurada(configuracao) ? 'nao_configurado' : 'nao_configurado',
  );
  const [revisao, setRevisao] = useState<Revision>(() => revisaoInicial(novoWorkspace()));
  const [gravacao, setGravacao] = useState<EstadoDeGravacao>({ situacao: 'ocioso' });
  const [dataSelecionada, definirDataSelecionada] = useState<string>(hojeLocal());

  const entrarNoModoDemonstrativo = useCallback(() => {
    const demo = revisaoDemonstrativa();
    setRevisao(demo);
    setModo('demonstrativo');
    setGravacao({ situacao: 'ocioso' });
    // A demonstração abre na última data com registro, para a tela não parecer
    // vazia. O modo normal continua abrindo em hoje.
    const datas = demo.timeEntries.map((e) => e.workDate).filter((d): d is string => d !== null);
    if (datas.length > 0) definirDataSelecionada(datas.sort().at(-1)!);
  }, []);

  const mutar = useCallback<ContextoApp['mutar']>(
    async (operacao, mutacao) => {
      const operationId: Uuid = globalThis.crypto.randomUUID();
      setGravacao({ situacao: 'gravando' });

      // Modo demonstrativo: a alteração fica só na memória do navegador, e a
      // mensagem diz exatamente isso. Jamais "Salvo no OneDrive".
      if (modo !== 'conectado' || !repositorio) {
        const nova = mutacao(revisao);
        const problemas = validarInvariantes(nova);
        if (problemas.length > 0) {
          setGravacao({ situacao: 'erro', mensagem: problemas.map((p) => p.detalhe).join(' ') });
          return 'invalido';
        }
        setRevisao(nova);
        setGravacao({
          situacao: 'nao_confirmado',
          mensagem: 'Alterado apenas nesta sessão do navegador. Nada foi gravado no OneDrive — a integração ainda não está configurada.',
        });
        return 'confirmado';
      }

      const resultado = await repositorio.salvar(operationId, operacao, (base) => mutacao(base));

      switch (resultado.estado) {
        case 'confirmado':
        case 'ja_aplicado':
          setRevisao(resultado.revisao);
          setGravacao({ situacao: 'confirmado', mensagem: 'Salvo no OneDrive.' });
          break;
        case 'conflito':
          setRevisao(resultado.revisaoAtual);
          setGravacao({ situacao: 'conflito', mensagem: resultado.detalhe });
          break;
        case 'incerto':
          // O formulário é mantido; não afirmamos salvamento (secção 16.3).
          setGravacao({ situacao: 'nao_confirmado', mensagem: `Ainda não confirmado no OneDrive. ${resultado.detalhe}` });
          break;
        case 'invalido':
          setGravacao({ situacao: 'erro', mensagem: resultado.problemas.join(' ') });
          break;
        default:
          setGravacao({ situacao: 'erro', mensagem: resultado.detalhe });
      }
      return resultado.estado;
    },
    [modo, repositorio, revisao],
  );

  const valor = useMemo<ContextoApp>(
    () => ({
      modo,
      config: configuracao,
      revisao,
      gravacao,
      dataSelecionada,
      definirDataSelecionada,
      mutar,
      limparGravacao: () => setGravacao({ situacao: 'ocioso' }),
      entrarNoModoDemonstrativo,
    }),
    [modo, configuracao, revisao, gravacao, dataSelecionada, mutar, entrarNoModoDemonstrativo],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Faixa de estado da gravação, exibida em todas as telas que alteram dados. */
export function usarMensagemDeGravacao(): { tipo: 'informacao' | 'atencao' | 'conclusao'; texto: string } | null {
  const { gravacao } = useApp();
  switch (gravacao.situacao) {
    case 'ocioso':
      return null;
    case 'gravando':
      return { tipo: 'informacao', texto: 'Gravando…' };
    case 'confirmado':
      return { tipo: 'conclusao', texto: gravacao.mensagem };
    case 'nao_confirmado':
      return { tipo: 'atencao', texto: gravacao.mensagem };
    case 'conflito':
      return { tipo: 'atencao', texto: gravacao.mensagem };
    case 'erro':
      return { tipo: 'atencao', texto: gravacao.mensagem };
  }
}
