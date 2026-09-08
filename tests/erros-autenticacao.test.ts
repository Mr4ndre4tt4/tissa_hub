/**
 * Mensagens de falha de autenticação.
 *
 * Um erro precisa dizer o que aconteceu e o que fazer, sem exceção bruta
 * (secção 4.10) — e sempre com o código, para poder ser relatado.
 */
import { describe, expect, it } from 'vitest';
import { configuracaoMsal, Identidade, integracaoConfigurada, lerConfiguracaoPublica } from '../src/adapters/identity/msal';
import { explicar } from '../src/app/estado';

const CONFIG_REAL = lerConfiguracaoPublica({
  VITE_MS_CLIENT_ID: 'c38e8f4f-cb6d-48bd-b067-93f0d44b101a',
  VITE_MS_REDIRECT_URI: 'https://mr4ndre4tt4.github.io/tissa_hub/',
});

describe('configuração do MSAL — compatível com o fluxo de redirecionamento', () => {
  const c = configuracaoMsal(CONFIG_REAL);

  it('cache em memória exige estado de autenticação em cookie', () => {
    // Sem isto o MSAL recusa o redirecionamento com in_mem_redirect_unavailable:
    // o erro real que impediu o login.
    if (c.cache?.cacheLocation === 'memoryStorage') {
      expect(c.cache?.storeAuthStateInCookie).toBe(true);
    }
  });

  it('tokens não vão para localStorage', () => {
    expect(c.cache?.cacheLocation).not.toBe('localStorage');
  });

  it('o cookie de estado transitório é restrito a HTTPS', () => {
    if (c.cache?.storeAuthStateInCookie) expect(c.cache?.secureCookies).toBe(true);
  });

  it('não renavega para a URL original: a aplicação roteia por hash', () => {
    expect(c.auth.navigateToLoginRequestUrl).toBe(false);
  });

  it('nenhum client secret e nenhum registro de dado pessoal', () => {
    expect(JSON.stringify(c)).not.toMatch(/secret/i);
    expect(c.system?.loggerOptions?.piiLoggingEnabled).toBe(false);
  });

  it('usa o redirect URI e a autoridade configurados', () => {
    expect(c.auth.redirectUri).toBe('https://mr4ndre4tt4.github.io/tissa_hub/');
    expect(c.auth.authority).toBe('https://login.microsoftonline.com/consumers');
  });

  it('sem configuração, nem chega a montar', () => {
    expect(() => configuracaoMsal(lerConfiguracaoPublica({}))).toThrow(/não configurada/i);
  });
});

describe('Identidade — inicialização', () => {
  it('sem configuração, qualquer operação recusa antes de tocar na rede', async () => {
    const id = new Identidade(lerConfiguracaoPublica({}));
    await expect(id.entrar()).rejects.toThrow(/não configurada/i);
    await expect(id.iniciar()).rejects.toThrow(/não configurada/i);
  });

  it('uma falha de preparação não trava as tentativas seguintes', async () => {
    const id = new Identidade(lerConfiguracaoPublica({}));
    await expect(id.iniciar()).rejects.toThrow();
    // A segunda tentativa precisa falhar da mesma forma, não ficar pendurada.
    await expect(id.iniciar()).rejects.toThrow(/não configurada/i);
  });

  it('sem conta ativa não há identificador de isolamento', () => {
    const id = new Identidade(lerConfiguracaoPublica({}));
    expect(id.contaHomeId()).toBeNull();
    expect(id.contaAtiva()).toBeNull();
  });

  it('a configuração publicada hoje é reconhecida como completa', () => {
    const c = lerConfiguracaoPublica({
      VITE_MS_CLIENT_ID: 'c38e8f4f-cb6d-48bd-b067-93f0d44b101a',
      VITE_MS_REDIRECT_URI: 'https://mr4ndre4tt4.github.io/tissa_hub/',
    });
    expect(integracaoConfigurada(c)).toBe(true);
    expect(c.authority).toBe('https://login.microsoftonline.com/consumers');
  });
});

describe('explicar — server_error não pode esconder o código AADSTS', () => {
  it('extrai o código AADSTS de dentro de `.message`, mesmo com errorMessage vazio', () => {
    // Reproduz o erro relatado: errorCode presente, errorMessage vazio, e o
    // código AADSTS só aparece na mensagem completa do MSAL.
    const erro = Object.assign(
      new Error(
        'Server returned an error. AADSTS9002326: Cross-origin token redemption is permitted only ' +
          'for the \'Single-Page Application\' client-type.',
      ),
      { errorCode: 'server_error', errorMessage: '' },
    );
    const texto = explicar(erro);
    expect(texto).toContain('AADSTS9002326');
    expect(texto).toMatch(/plataforma "Web"/);
  });

  it('mostra o subcódigo quando presente', () => {
    const erro = Object.assign(new Error('falha'), {
      errorCode: 'server_error',
      errorMessage: 'falha',
      subError: 'client_mismatch',
    });
    expect(explicar(erro)).toContain('subcódigo: client_mismatch');
  });

  it('um código sem causa conhecida ainda aparece, com o AADSTS se houver', () => {
    const erro = Object.assign(new Error('AADSTS50011: algo não bate.'), {
      errorCode: 'algum_codigo_desconhecido',
      errorMessage: 'AADSTS50011: algo não bate.',
    });
    const texto = explicar(erro);
    expect(texto).toContain('algum_codigo_desconhecido');
    expect(texto).toContain('AADSTS50011');
  });
});
