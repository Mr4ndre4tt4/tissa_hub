/**
 * Mensagens de falha de autenticação.
 *
 * Um erro precisa dizer o que aconteceu e o que fazer, sem exceção bruta
 * (secção 4.10) — e sempre com o código, para poder ser relatado.
 */
import { describe, expect, it } from 'vitest';
import { Identidade, integracaoConfigurada, lerConfiguracaoPublica } from '../src/adapters/identity/msal';

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
