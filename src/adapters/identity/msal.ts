/**
 * Autenticação Microsoft pessoal via MSAL Browser.
 *
 * ATENÇÃO — estado de verificação: implementado e compilado, **nunca executado
 * contra o Microsoft Entra real**, porque o client ID e o redirect URI ainda
 * não foram fornecidos. Sem configuração, o aplicativo exibe "Integração
 * Microsoft não configurada" e oferece o modo demonstrativo separado — nunca
 * finge uma conexão (secção 15.1).
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

export class Identidade implements ProvedorDeToken {
  private app: PublicClientApplication | null = null;
  private conta: AccountInfo | null = null;
  private escoposConsentidos = new Set<string>([ESCOPO_PASTA_DO_APP]);

  constructor(private readonly config: ConfiguracaoPublica) {}

  private exigirApp(): PublicClientApplication {
    if (!integracaoConfigurada(this.config)) throw new IntegracaoNaoConfigurada();
    if (!this.app) {
      const configuracao: Configuration = {
        auth: {
          clientId: this.config.clientId!,
          authority: this.config.authority,
          redirectUri: this.config.redirectUri!,
          // Sem client secret no navegador; o PKCE é aplicado pelo MSAL.
          navigateToLoginRequestUrl: true,
        },
        cache: {
          // Memória por padrão; apenas o estado transitório do redirecionamento
          // usa sessionStorage. Nenhum token vai para localStorage.
          cacheLocation: 'memoryStorage',
          temporaryCacheLocation: 'sessionStorage',
          storeAuthStateInCookie: false,
        },
        system: {
          loggerOptions: {
            // Nenhum dado pessoal (nem token) é registrado.
            piiLoggingEnabled: false,
            loggerCallback: () => undefined,
          },
        },
      };
      this.app = new PublicClientApplication(configuracao);
    }
    return this.app;
  }

  async iniciar(): Promise<AccountInfo | null> {
    const app = this.exigirApp();
    await app.initialize();
    const resultado = await app.handleRedirectPromise();
    if (resultado?.account) this.conta = resultado.account;
    else this.conta = app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
    if (this.conta) app.setActiveAccount(this.conta);
    return this.conta;
  }

  async entrar(): Promise<void> {
    const app = this.exigirApp();
    await app.loginRedirect({ scopes: [...this.escoposConsentidos], prompt: 'select_account' });
  }

  /**
   * Consentimento incremental para ler um arquivo fora da pasta do aplicativo.
   * O alcance real de `Files.Read` é explicado na interface: não é uma
   * permissão exclusiva daquele único arquivo (secção 15.3).
   */
  async consentirLeituraExterna(): Promise<void> {
    const app = this.exigirApp();
    this.escoposConsentidos.add(ESCOPO_LEITURA_EXTERNA);
    await app.acquireTokenRedirect({ scopes: [ESCOPO_LEITURA_EXTERNA] });
  }

  async obterToken(): Promise<string> {
    const app = this.exigirApp();
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
    const app = this.exigirApp();
    const conta = this.conta;
    this.conta = null;
    this.escoposConsentidos = new Set([ESCOPO_PASTA_DO_APP]);
    await app.logoutRedirect({ account: conta ?? undefined });
  }
}
