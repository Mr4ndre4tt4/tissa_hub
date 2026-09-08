/**
 * Autenticação Microsoft pessoal via MSAL Browser.
 *
 * ATENÇÃO — estado de verificação: o client ID já está configurado, mas o fluxo
 * contra o Microsoft Entra real **ainda não foi confirmado ponta a ponta**. Sem
 * configuração, o aplicativo exibe "Integração Microsoft não configurada" e
 * oferece o modo demonstrativo separado — nunca finge uma conexão (secção 15.1).
 *
 * Decisões aplicadas:
 *  - Authorization Code com PKCE, via MSAL; sem client secret no navegador e
 *    sem fluxo implícito como atalho (M1);
 *  - autoridade de consumidores, compatível com conta Microsoft pessoal;
 *  - escopo inicial `Files.ReadWrite.AppFolder`; `Files.Read` só por
 *    consentimento incremental e explícito (M2, M3);
 *  - cache em memória: tokens nunca são serializados em JSON do OneDrive ou log.
 */

import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  type AccountInfo,
  type Configuration,
} from '@azure/msal-browser';
import type { ProvedorDeToken } from '../graph/graphReal';

export const ESCOPO_PASTA_DO_APP = 'Files.ReadWrite.AppFolder';
export const ESCOPO_LEITURA_EXTERNA = 'Files.Read';

/**
 * Consentimento único e explícito para uma permissão mais ampla — acesso a
 * todo o OneDrive, não só à pasta do aplicativo. Usado apenas para destravar
 * a criação da pasta do aplicativo quando `Files.ReadWrite.AppFolder` sozinho
 * não consegue: limitação conhecida do Microsoft Graph (não deste código —
 * ver DECISOES.md §15), confirmada contra a conta real e documentada em
 * https://github.com/OneDrive/onedrive-api-docs/issues/682. Nunca entra em
 * `escoposConsentidos`: o dia a dia do aplicativo volta a pedir só a pasta do
 * aplicativo depois deste único uso.
 */
export const ESCOPO_PROVISIONAMENTO_UNICO = 'Files.ReadWrite';

export interface ConfiguracaoPublica {
  clientId: string | null;
  authority: string;
  redirectUri: string | null;
  publicAppUrl: string | null;
}

/**
 * Lê a configuração pública do ambiente. Valores nulos significam
 * "entrada real ainda não fornecida" — nunca um segredo fictício.
 */
export function lerConfiguracaoPublica(env: Record<string, string | undefined> = import.meta.env): ConfiguracaoPublica {
  const naoVazio = (v: string | undefined): string | null => {
    const t = (v ?? '').trim();
    return t.length === 0 ? null : t;
  };
  return {
    clientId: naoVazio(env.VITE_MS_CLIENT_ID),
    authority: naoVazio(env.VITE_MS_AUTHORITY) ?? 'https://login.microsoftonline.com/consumers',
    redirectUri: naoVazio(env.VITE_MS_REDIRECT_URI),
    publicAppUrl: naoVazio(env.VITE_APP_URL),
  };
}

export function integracaoConfigurada(config: ConfiguracaoPublica): boolean {
  return config.clientId !== null && config.redirectUri !== null;
}

export class IntegracaoNaoConfigurada extends Error {
  constructor() {
    super(
      'Integração Microsoft não configurada. Informe o client ID e o redirect URI do registro de aplicativo ' +
        'para habilitar o login e a gravação no OneDrive.',
    );
    this.name = 'IntegracaoNaoConfigurada';
  }
}

/**
 * Configuração do MSAL. Exportada para poder ser verificada por teste: uma
 * combinação inválida aqui só apareceria no navegador, no meio do login.
 *
 * Sobre o armazenamento (secção 15.1, "preferindo memória e apenas estado
 * transitório necessário ao redirecionamento"):
 *
 * O MSAL **recusa** o fluxo de redirecionamento quando o cache é `memoryStorage`
 * e `storeAuthStateInCookie` é falso — erro `in_mem_redirect_unavailable` —
 * porque nada sobreviveria à volta do login para processar a resposta.
 *
 * A combinação escolhida mantém a intenção da especificação:
 *  - os **tokens** ficam só em memória e somem ao fechar a página; nunca vão
 *    para localStorage nem são serializados em JSON do OneDrive ou log;
 *  - apenas o **estado transitório do redirecionamento** (state, nonce e o
 *    verificador PKCE) fica num cookie de vida curta, que é exatamente o
 *    "estado transitório necessário ao redirecionamento" que a especificação
 *    admite. Esse cookie trafega para a hospedagem estática, que já serve o
 *    próprio código da página — não amplia o que ela poderia observar.
 *
 * Consequência aceita: recarregar a página encerra a sessão e exige entrar de
 * novo. A especificação já prevê pedir reautenticação sem perder o formulário.
 */
export function configuracaoMsal(config: ConfiguracaoPublica): Configuration {
  if (!integracaoConfigurada(config)) throw new IntegracaoNaoConfigurada();
  return {
    auth: {
      clientId: config.clientId!,
      authority: config.authority,
      redirectUri: config.redirectUri!,
      // Sem client secret no navegador; o PKCE é aplicado pelo MSAL.
      //
      // `false` porque a aplicação roteia por hash: deixar o MSAL renavegar
      // para a URL original depois do retorno embaralha o fragmento e é uma
      // fonte conhecida de laço de redirecionamento em SPA com hash.
      navigateToLoginRequestUrl: false,
    },
    cache: {
      cacheLocation: 'memoryStorage',
      // Exigido pelo MSAL para o fluxo de redirecionamento com cache em memória.
      storeAuthStateInCookie: true,
      secureCookies: true,
    },
    system: {
      loggerOptions: {
        // Nenhum dado pessoal (nem token) é registrado.
        piiLoggingEnabled: false,
        loggerCallback: () => undefined,
      },
    },
  };
}

export class Identidade implements ProvedorDeToken {
  private conta: AccountInfo | null = null;
  private escoposConsentidos = new Set<string>([ESCOPO_PASTA_DO_APP]);
  /** Inicialização em curso. O MSAL v3 exige `initialize()` antes de tudo. */
  private preparacao: Promise<PublicClientApplication> | null = null;

  constructor(private readonly config: ConfiguracaoPublica) {}

  private criarApp(): PublicClientApplication {
    return new PublicClientApplication(configuracaoMsal(this.config));
  }

  /**
   * Devolve a instância já inicializada. Idempotente e seguro para concorrência:
   * qualquer método público aguarda a mesma preparação.
   *
   * Sem isto, chamar `loginRedirect` antes de `initialize()` falha com
   * `uninitialized_public_client_application` — o que acontecia quando a pessoa
   * clicava em "Entrar" antes de a inicialização terminar.
   */
  private async pronta(): Promise<PublicClientApplication> {
    if (!this.preparacao) {
      this.preparacao = (async () => {
        const app = this.criarApp();
        await app.initialize();
        return app;
      })().catch((e) => {
        // Uma falha não pode deixar a preparação travada para sempre.
        this.preparacao = null;
        throw e;
      });
    }
    return this.preparacao;
  }

  /**
   * Processa o retorno de um redirecionamento, se houver, e devolve a conta
   * ativa. Quando o retorno é o do consentimento único de provisionamento
   * (secção `ESCOPO_PROVISIONAMENTO_UNICO`), o token dessa troca específica
   * também é devolvido — nenhum outro fluxo deste aplicativo pede exatamente
   * `Files.ReadWrite` sem o sufixo `.AppFolder`, então a presença desse escopo
   * na resposta identifica o retorno sem ambiguidade.
   */
  async iniciar(): Promise<{ conta: AccountInfo | null; tokenProvisionamentoUnico: string | null }> {
    const app = await this.pronta();
    const resultado = await app.handleRedirectPromise();
    let tokenProvisionamentoUnico: string | null = null;
    if (resultado?.account) {
      this.conta = resultado.account;
      const escoposConcedidos = (resultado.scopes ?? []).map((s) => s.toLowerCase());
      if (escoposConcedidos.includes(ESCOPO_PROVISIONAMENTO_UNICO.toLowerCase())) {
        tokenProvisionamentoUnico = resultado.accessToken;
      }
    } else {
      this.conta = app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
    }
    if (this.conta) app.setActiveAccount(this.conta);
    return { conta: this.conta, tokenProvisionamentoUnico };
  }

  async entrar(): Promise<void> {
    const app = await this.pronta();
    await app.loginRedirect({ scopes: [...this.escoposConsentidos], prompt: 'select_account' });
  }

  /**
   * Consentimento incremental para ler um arquivo fora da pasta do aplicativo.
   * O alcance real de `Files.Read` é explicado na interface: não é uma
   * permissão exclusiva daquele único arquivo (secção 15.3).
   */
  async consentirLeituraExterna(): Promise<void> {
    const app = await this.pronta();
    this.escoposConsentidos.add(ESCOPO_LEITURA_EXTERNA);
    await app.acquireTokenRedirect({ scopes: [ESCOPO_LEITURA_EXTERNA] });
  }

  /**
   * Consentimento único e explícito para destravar a criação da pasta do
   * aplicativo (ver `ESCOPO_PROVISIONAMENTO_UNICO`). Deliberadamente **não**
   * adiciona o escopo a `escoposConsentidos`: depois deste uso único, o
   * aplicativo volta a pedir só a pasta do aplicativo.
   */
  async consentirProvisionamentoUnico(): Promise<void> {
    const app = await this.pronta();
    await app.acquireTokenRedirect({ scopes: [ESCOPO_PROVISIONAMENTO_UNICO], prompt: 'consent' });
  }

  async obterToken(): Promise<string> {
    const app = await this.pronta();
    if (!this.conta) throw new Error('Não há conta Microsoft ativa. Entre novamente.');
    try {
      const r = await app.acquireTokenSilent({ scopes: [...this.escoposConsentidos], account: this.conta });
      return r.accessToken;
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        // A renovação silenciosa pode falhar: pedimos reautenticação sem perder
        // o formulário em memória e sem afirmar que algo foi salvo.
        throw new Error('A sessão expirou. Entre novamente para continuar; o que você digitou continua na tela.');
      }
      throw e;
    }
  }

  /** Identificador estável da conta, usado para isolar a base (AC-057). */
  contaHomeId(): string | null {
    return this.conta?.homeAccountId ?? null;
  }

  contaAtiva(): { nome: string; email: string } | null {
    if (!this.conta) return null;
    return { nome: this.conta.name ?? this.conta.username, email: this.conta.username };
  }

  /** Sair limpa a memória e o estado local antes de qualquer outra conta entrar. */
  async sair(): Promise<void> {
    const app = await this.pronta();
    const conta = this.conta;
    this.conta = null;
    this.escoposConsentidos = new Set([ESCOPO_PASTA_DO_APP]);
    await app.logoutRedirect({ account: conta ?? undefined });
  }
}
