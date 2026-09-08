/**
 * Política de segurança de conteúdo (`index.html`), na parte que já custou
 * uma sessão inteira de investigação: `connect-src` precisa liberar os
 * domínios reais que o Microsoft Graph usa, não os que parecem certos.
 *
 * `my.microsoftpersonalcontent.com` é o domínio confirmado contra a conta
 * real para download de conteúdo do OneDrive **pessoal** — diferente de
 * `*.sharepoint.com` (OneDrive/SharePoint corporativo) e `*.1drv.com`
 * (links de compartilhamento). Sem ele, toda leitura de revisão falha com
 * "Failed to fetch" sem nenhuma pista de causa (DECISOES.md §21-22).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
const csp = html.match(/content="(default-src[^"]*)"/)?.[1] ?? '';

describe('Content-Security-Policy em index.html', () => {
  it('existe e tem connect-src restrito (não "*")', () => {
    expect(csp).not.toBe('');
    expect(csp).toMatch(/connect-src[^;]*'self'/);
    expect(csp).not.toMatch(/connect-src[^;]*\*(?!\.[a-z])/); // sem curinga solto, só *.dominio
  });

  it('libera o domínio real de download do OneDrive pessoal', () => {
    // Regressão direta: este domínio foi confirmado contra a conta real
    // depois de "Failed to fetch" persistir mesmo com a chamada ao Graph
    // funcionando — a política de segurança bloqueava antes da rede.
    expect(csp).toContain('https://*.microsoftpersonalcontent.com');
  });

  it('libera o Graph e a autoridade de login, exigidos pelo próprio fluxo', () => {
    expect(csp).toContain('https://graph.microsoft.com');
    expect(csp).toContain('https://login.microsoftonline.com');
  });
});
