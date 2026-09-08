/**
 * Estado da aplicação e ciclo de vida da conexão Microsoft.
 *
 * Modos, sempre visíveis para a pessoa (secções 1 e 15.1):
 *  - `nao_configurado`: falta client ID / redirect URI. Login desativado.
 *  - `demonstrativo`: dados sintéticos, em memória. Nada é gravado e a
 *    interface **nunca** diz "Salvo no OneDrive".
 *  - `conectando`: autenticando ou lendo a base.
 *  - `sem_base`: conta autenticada, pasta do aplicativo pronta, mas nenhuma
 *    revisão ativa. Criar a base é uma operação **explícita** (secção 16.3).
 *  - `conectado`: base carregada do OneDrive pessoal.
 *  - `recuperacao`: há revisões gravadas sem ponteiro válido, ou a base não
 *    confere. Nunca se recria uma base vazia por cima disso.
 *
 * Alterar no navegador não é salvar. Toda mutação declara o seu resultado:
 * confirmado, incerto, conflito ou erro.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Revision, Uuid } from '../domain/entities/tipos';
import { novoWorkspace, revisaoInicial, validarInvariantes } from '../domain/entities/revisao';
import {
  BaseCorrompida,
  RecuperacaoNecessaria,
  RepositorioOneDrive,
  type ResultadoSalvar,
} from '../adapters/storage/repositorio';
import { GraphReal } from '../adapters/graph/graphReal';
import { ErroGraph } from '../adapters/graph/cliente';
import {
  Identidade,
  integracaoConfigurada,
  lerConfiguracaoPublica,
  type ConfiguracaoPublica,
} from '../adapters/identity/msal';
import { revisaoDemonstrativa } from '../fixtures/demonstracao';

export type ModoDeOperacao =
  | 'nao_configurado'
  | 'demonstrativo'
  | 'conectando'
  | 'sem_base'
  | 'conectado'
  | 'recuperacao';

export type EstadoDeGravacao =
  | { situacao: 'ocioso' }
  | { situacao: 'gravando' }
  | { situacao: 'confirmado'; mensagem: string }
  | { situacao: 'nao_confirmado'; mensagem: string }
  | { situacao: 'conflito'; mensagem: string }
  | { situacao: 'erro'; mensagem: string };

export interface ContaAtiva {
  nome: string;
  email: string;
}

export interface ContextoApp {
  modo: ModoDeOperacao;
  config: ConfiguracaoPublica;
  revisao: Revision;
  gravacao: EstadoDeGravacao;
  dataSelecionada: string;
  definirDataSelecionada: (d: string) => void;
  mutar: (operacao: string, mutacao: (base: Revision) => Revision) => Promise<ResultadoSalvar['estado']>;
  limparGravacao: () => void;
  entrarNoModoDemonstrativo: () => void;

  /* --- conexão Microsoft --- */
  conta: ContaAtiva | null;
  /** Mensagem do passo em curso, para a tela de conexão não ficar muda. */
  progresso: string | null;
  erroConexao: string | null;
  entrarComMicrosoft: () => Promise<void>;
  sair: () => Promise<void>;
  /** Cria a primeira revisão. Operação explícita (secção 16.3). */
  criarBase: () => Promise<void>;
  /** Relê a base a partir do ponteiro remoto. */
  recarregar: () => Promise<void>;
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

/**
 * Códigos do MSAL que têm causa conhecida e conserto claro. A mensagem explica
 * o que fazer; o código fica visível para quem precisar relatar o problema.
 */
const CAUSAS_MSAL: Record<string, string> = {
  uninitialized_public_client_application:
    'A biblioteca de autenticação foi usada antes de terminar de iniciar. Recarregue a página e tente de novo.',
  interaction_in_progress:
    'Há um login em andamento nesta aba. Recarregue a página e tente de novo.',
  redirect_uri_mismatch:
    'O endereço de retorno não confere com o cadastrado no registro do aplicativo. Ele precisa ser exatamente ' +
    'https://mr4ndre4tt4.github.io/tissa_hub/ — com a barra final — e estar na plataforma "Single-page application".',
  invalid_client:
    'O client ID não foi reconhecido. Confira se é o "Application (client) ID" do registro e se ele aceita contas Microsoft pessoais.',
  unauthorized_client:
    'O registro do aplicativo não permite este fluxo. Confirme que a plataforma cadastrada é "Single-page application", não "Web".',
  user_cancelled: 'O login foi cancelado na tela da Microsoft.',
  access_denied: 'O consentimento foi recusado na tela da Microsoft. Sem ele o aplicativo não acessa a pasta no OneDrive.',
  consent_required: 'É preciso conceder o consentimento na tela da Microsoft para o aplicativo usar a própria pasta no seu OneDrive.',
  popup_window_error: 'O navegador bloqueou a janela de autenticação.',
};

/** Traduz falhas técnicas em português, sem expor exceção bruta (secção 4.10). */
function explicar(e: unknown): string {
  // Erros do MSAL trazem `errorCode`: é a informação que identifica a causa.
  const codigo = (e as { errorCode?: unknown })?.errorCode;
  if (typeof codigo === 'string' && codigo.length > 0) {
    const conhecida = CAUSAS_MSAL[codigo];
    const bruta = (e as { errorMessage?: unknown }).errorMessage;
    const detalhe = typeof bruta === 'string' && bruta.length > 0 ? bruta : '';
    // O código sempre aparece, para poder ser relatado sem ambiguidade.
    return conhecida
      ? `${conhecida} (código: ${codigo})`
      : `Falha na autenticação Microsoft — código: ${codigo}.${detalhe ? ` ${detalhe}` : ''}`;
  }

  if (e instanceof RecuperacaoNecessaria) {
    return `${e.message} Nenhuma base foi recriada: use a recuperação para escolher uma revisão.`;
  }
  if (e instanceof BaseCorrompida) return e.message;
  if (e instanceof ErroGraph) {
    switch (e.codigo) {
      case 'nao_autorizado':
        return 'A sessão expirou ou o consentimento foi recusado. Entre novamente.';
      case 'proibido':
        return 'A conta não autorizou o acesso à pasta do aplicativo. A permissão não será ampliada automaticamente.';
      case 'limite_taxa':
        return `O serviço pediu para aguardar${e.retryAfterSegundos ? ` ${e.retryAfterSegundos} s` : ''} antes de tentar de novo.`;
      case 'quota':
        return 'Não há espaço suficiente na conta. Nada foi gravado.';
      case 'transporte':
        return 'A conexão falhou. Verifique a rede e tente de novo — nada foi gravado.';
      default:
        return e.message;
    }
  }
  return e instanceof Error ? e.message : String(e);
}

export function ProvedorApp({
  children,
  configuracao = lerConfiguracaoPublica(),
  /** Injeção para testes: substitui o repositório real. */
  repositorioDeTeste = null,
}: {
  children: ReactNode;
  configuracao?: ConfiguracaoPublica;
  repositorioDeTeste?: RepositorioOneDrive | null;
}) {
  const [modo, setModo] = useState<ModoDeOperacao>(
    repositorioDeTeste ? 'conectado' : 'nao_configurado',
  );
  const [revisao, setRevisao] = useState<Revision>(() => revisaoInicial(novoWorkspace()));
  const [gravacao, setGravacao] = useState<EstadoDeGravacao>({ situacao: 'ocioso' });
  const [dataSelecionada, definirDataSelecionada] = useState<string>(hojeLocal());
  const [conta, setConta] = useState<ContaAtiva | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erroConexao, setErroConexao] = useState<string | null>(null);

  const identidadeRef = useRef<Identidade | null>(null);
  const repositorioRef = useRef<RepositorioOneDrive | null>(repositorioDeTeste);
  const iniciadoRef = useRef(false);

  /** Abre a pasta do aplicativo e carrega a revisão ativa, se houver. */
  const conectar = useCallback(async (identidade: Identidade) => {
    const homeId = identidade.contaHomeId();
    if (!homeId) throw new Error('Não foi possível identificar a conta autenticada.');

    setProgresso('Abrindo a pasta do aplicativo no OneDrive…');
    const repo = new RepositorioOneDrive(new GraphReal(identidade), homeId);
    await repo.inicializar();
    repositorioRef.current = repo;

    setProgresso('Lendo a base…');
    const { revisao: ativa } = await repo.carregarRevisaoAtiva();

    if (ativa) {
      setRevisao(ativa);
      setModo('conectado');
    } else {
      // Base ainda não existe: criar é decisão explícita da pessoa.
      setModo('sem_base');
    }
    setProgresso(null);
  }, []);

  /* Retorno do redirecionamento do login, uma única vez. */
  useEffect(() => {
    if (iniciadoRef.current) return;
    iniciadoRef.current = true;
    if (repositorioDeTeste) return;
    if (!integracaoConfigurada(configuracao)) return;

    void (async () => {
      const identidade = new Identidade(configuracao);
      identidadeRef.current = identidade;
      try {
        setProgresso('Verificando a sessão Microsoft…');
        const encontrada = await identidade.iniciar();
        if (!encontrada) {
          // Ninguém autenticado ainda: a tela de entrada assume.
          setProgresso(null);
          return;
        }
        setConta(identidade.contaAtiva());
        setModo('conectando');
        await conectar(identidade);
      } catch (e) {
        setProgresso(null);
        setErroConexao(explicar(e));
        setModo(e instanceof RecuperacaoNecessaria || e instanceof BaseCorrompida ? 'recuperacao' : 'nao_configurado');
      }
    })();
  }, [configuracao, conectar, repositorioDeTeste]);

  const entrarComMicrosoft = useCallback(async () => {
    setErroConexao(null);
    const identidade = identidadeRef.current ?? new Identidade(configuracao);
    identidadeRef.current = identidade;
    try {
      setModo('conectando');
      setProgresso('Levando você para a tela da Microsoft…');
      // Redireciona; o retorno é tratado pelo efeito acima.
      await identidade.entrar();
    } catch (e) {
      setProgresso(null);
      setErroConexao(explicar(e));
      setModo('nao_configurado');
    }
  }, [configuracao]);

  const sair = useCallback(async () => {
    // Trocar conta descarta a base anterior da memória antes de qualquer outra
    // coisa (secção 17): nenhuma conta carrega o cache da outra.
    setRevisao(revisaoInicial(novoWorkspace()));
    repositorioRef.current = null;
    setConta(null);
    setModo('nao_configurado');
    setGravacao({ situacao: 'ocioso' });
    try {
      await identidadeRef.current?.sair();
    } catch (e) {
      setErroConexao(explicar(e));
    }
  }, []);

  const criarBase = useCallback(async () => {
    const repo = repositorioRef.current;
    if (!repo) return;
    setErroConexao(null);
    setProgresso('Criando a base no OneDrive…');
    try {
      const ws = novoWorkspace('Central de Chamados');
      const r = await repo.publicarRevisaoInicial(revisaoInicial(ws), globalThis.crypto.randomUUID());
      if (r.estado === 'confirmado') {
        setRevisao(r.revisao);
        setModo('conectado');
        setGravacao({ situacao: 'confirmado', mensagem: 'Base criada no OneDrive.' });
      } else if (r.estado === 'conflito') {
        // Outra sessão inicializou antes: usamos a base existente.
        setRevisao(r.revisaoAtual);
        setModo('conectado');
        setGravacao({ situacao: 'confirmado', mensagem: r.detalhe });
      } else {
        setErroConexao('detalhe' in r ? r.detalhe : 'Não foi possível criar a base.');
      }
    } catch (e) {
      setErroConexao(explicar(e));
    } finally {
      setProgresso(null);
    }
  }, []);

  const recarregar = useCallback(async () => {
    const repo = repositorioRef.current;
    if (!repo) return;
    setErroConexao(null);
    setProgresso('Relendo a base…');
    try {
      const { revisao: ativa } = await repo.carregarRevisaoAtiva();
      if (ativa) {
        setRevisao(ativa);
        setModo('conectado');
      } else {
        setModo('sem_base');
      }
    } catch (e) {
      setErroConexao(explicar(e));
      setModo(e instanceof RecuperacaoNecessaria || e instanceof BaseCorrompida ? 'recuperacao' : 'conectado');
    } finally {
      setProgresso(null);
    }
  }, []);

  const entrarNoModoDemonstrativo = useCallback(() => {
    const demo = revisaoDemonstrativa();
    setRevisao(demo);
    setModo('demonstrativo');
    setGravacao({ situacao: 'ocioso' });
    // A demonstração abre na última data com registro, para a tela não parecer
    // vazia. O modo conectado continua abrindo em hoje.
    const datas = demo.timeEntries.map((e) => e.workDate).filter((d): d is string => d !== null);
    if (datas.length > 0) definirDataSelecionada(datas.sort().at(-1)!);
  }, []);

  const mutar = useCallback<ContextoApp['mutar']>(
    async (operacao, mutacao) => {
      const operationId: Uuid = globalThis.crypto.randomUUID();
      setGravacao({ situacao: 'gravando' });
      const repo = repositorioRef.current;

      // Sem conexão, a alteração fica só na memória do navegador — e a mensagem
      // diz exatamente isso. Jamais "Salvo no OneDrive".
      if (modo !== 'conectado' || !repo) {
        const nova = mutacao(revisao);
        const problemas = validarInvariantes(nova);
        if (problemas.length > 0) {
          setGravacao({ situacao: 'erro', mensagem: problemas.map((p) => p.detalhe).join(' ') });
          return 'invalido';
        }
        setRevisao(nova);
        setGravacao({
          situacao: 'nao_confirmado',
          mensagem:
            'Alterado apenas nesta sessão do navegador. Nada foi gravado no OneDrive — você não está conectado a uma base.',
        });
        return 'confirmado';
      }

      let resultado: ResultadoSalvar;
      try {
        resultado = await repo.salvar(operationId, operacao, (base) => mutacao(base));
      } catch (e) {
        setGravacao({ situacao: 'erro', mensagem: `${explicar(e)} Nada foi gravado.` });
        return 'erro';
      }

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
    [modo, revisao],
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
      conta,
      progresso,
      erroConexao,
      entrarComMicrosoft,
      sair,
      criarBase,
      recarregar,
    }),
    [
      modo,
      configuracao,
      revisao,
      gravacao,
      dataSelecionada,
      mutar,
      entrarNoModoDemonstrativo,
      conta,
      progresso,
      erroConexao,
      entrarComMicrosoft,
      sair,
      criarBase,
      recarregar,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Verdadeiro quando os dados NÃO estão indo para o OneDrive. */
export function ehModoSemGravacao(modo: ModoDeOperacao): boolean {
  return modo !== 'conectado';
}

/** Faixa de estado da gravação, exibida nas telas que alteram dados. */
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
