/**
 * Estado da configuração pública no aplicativo publicado.
 *
 * O workflow define VITE_MS_REDIRECT_URI e VITE_APP_URL a partir do endereço do
 * Pages mesmo quando o client ID ainda não existe. Este teste garante que essa
 * combinação **não** faz o aplicativo se declarar integrado: sem client ID real,
 * a tela precisa dizer "Integração Microsoft não configurada" (secção 15.1).
 */

import { describe, expect, it } from 'vitest';
import { integracaoConfigurada, lerConfiguracaoPublica } from '../src/adapters/identity/msal';
import exemplo from '../contratos/configuracao_publica.exemplo.json';

const PAGES = 'https://mr4ndre4tt4.github.io/tissa_hub/';

describe('configuração do aplicativo publicado', () => {
  it('sem nenhuma variável, nada é inventado', () => {
    const c = lerConfiguracaoPublica({});
    expect(c.clientId).toBeNull();
    expect(c.redirectUri).toBeNull();
    expect(c.publicAppUrl).toBeNull();
    // A autoridade de consumidores é o padrão do projeto, não um segredo.
    expect(c.authority).toBe('https://login.microsoftonline.com/consumers');
    expect(integracaoConfigurada(c)).toBe(false);
  });

  it('com endereço publicado mas sem client ID, continua NÃO configurado', () => {
    const c = lerConfiguracaoPublica({ VITE_MS_REDIRECT_URI: PAGES, VITE_APP_URL: PAGES });
    expect(c.publicAppUrl).toBe(PAGES);
    expect(c.redirectUri).toBe(PAGES);
    // Este é o estado exato do primeiro deploy: publicado, porém sem integração.
    expect(integracaoConfigurada(c)).toBe(false);
  });

  it('variável vazia é tratada como ausente, não como valor', () => {
    const c = lerConfiguracaoPublica({ VITE_MS_CLIENT_ID: '   ', VITE_MS_REDIRECT_URI: '' });
    expect(c.clientId).toBeNull();
    expect(integracaoConfigurada(c)).toBe(false);
  });

  it('só com client ID e redirect URI reais a integração é considerada configurada', () => {
    const c = lerConfiguracaoPublica({
      VITE_MS_CLIENT_ID: '00000000-0000-4000-8000-000000000000',
      VITE_MS_REDIRECT_URI: PAGES,
    });
    expect(integracaoConfigurada(c)).toBe(true);
  });

  it('o esquema de configuração não traz credencial fictícia', () => {
    // Null significa "entrada real ainda não fornecida" (secção 22).
    expect(exemplo.auth.clientId).toBeNull();
    expect(exemplo.auth.redirectUri).toBeNull();
    expect(exemplo.hosting.publicAppUrl).toBeNull();
    expect(exemplo.auth.clientSecretAllowed).toBe(false);
    expect(exemplo.hosting.publishRequiresApproval).toBe(true);
    // Files.ReadWrite (não .AppFolder): a pasta especial do OneDrive não
    // funciona nesta conta, confirmado contra a conta real (DECISOES.md §19).
    expect(exemplo.auth.initialGraphScopes).toEqual(['Files.ReadWrite']);
  });

  it('a prova de persistência continua exigida antes do uso produtivo', () => {
    expect(exemplo.storage.requiresLiveProof).toBe(true);
    expect(exemplo.storage.remoteSaveAcknowledgementRequired).toBe(true);
    expect(exemplo.storage.offlineWritesEnabled).toBe(false);
  });
});
