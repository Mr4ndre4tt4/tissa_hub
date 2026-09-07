/**
 * AC-069 / AC-070 — paleta, contraste e tipografia.
 *
 * Confere que o CSS aplicado usa exatamente os HEX escritos na referência e
 * que nenhuma combinação proibida (texto claro sobre Serene Blue ou Mint
 * Frost) aparece nas regras.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import tokens from '../contratos/design_tokens.json';

const css = readFileSync(new URL('../src/design/tokens.css', import.meta.url), 'utf8');

/** Luminância relativa conforme a definição do WCAG. */
function luminancia(hex: string): number {
  const n = hex.replace('#', '');
  const canais = [0, 2, 4].map((i) => Number.parseInt(n.slice(i, i + 2), 16) / 255);
  const linear = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const { sereneBlue, deepSlate, mintFrost, midnightBlack, proWhite } = tokens.palette;

describe('AC-069 — paleta obrigatória', () => {
  it('os cinco HEX da referência estão no CSS aplicado', () => {
    for (const [nome, hex] of Object.entries(tokens.palette)) {
      expect(css.toLowerCase(), `${nome} (${hex}) deveria estar no CSS`).toContain(hex.toLowerCase());
    }
  });

  it('os valores conferem com a imagem da identidade visual', () => {
    expect(sereneBlue).toBe('#A6BAC8');
    expect(deepSlate).toBe('#334049');
    expect(mintFrost).toBe('#D1E6D2');
    expect(midnightBlack).toBe('#1A1A1A');
    expect(proWhite).toBe('#FAFAFA');
  });

  it('o fundo é Pro White, não bege nem cinza frio arbitrário', () => {
    expect(css).toMatch(/--canvas:\s*var\(--pro-white\)/);
    expect(css).toMatch(/body\s*\{[^}]*background:\s*var\(--canvas\)/);
  });

  it('botão principal é Deep Slate com texto Pro White', () => {
    expect(css).toMatch(/--primary-bg:\s*var\(--deep-slate\)/);
    expect(css).toMatch(/--primary-text:\s*var\(--pro-white\)/);
  });

  it('seleção usa Serene Blue com texto Deep Slate', () => {
    expect(css).toMatch(/--selected-bg:\s*var\(--serene-blue\)/);
    expect(css).toMatch(/--selected-text:\s*var\(--deep-slate\)/);
  });
});

describe('AC-069 / secção 3.4 — contraste', () => {
  it('os pares aprovados batem com os valores publicados', () => {
    expect(contraste(deepSlate, proWhite)).toBeCloseTo(tokens.contrastChecks.deepSlateOnProWhite, 1);
    expect(contraste(deepSlate, sereneBlue)).toBeCloseTo(tokens.contrastChecks.deepSlateOnSereneBlue, 1);
    expect(contraste(deepSlate, mintFrost)).toBeCloseTo(tokens.contrastChecks.deepSlateOnMintFrost, 1);
  });

  it('todo texto de célula atinge 4,5:1 sobre o seu fundo', () => {
    for (const [nome, papel] of Object.entries(tokens.cells)) {
      const razao = contraste(papel.text, papel.background);
      expect(razao, `${nome}: ${papel.text} sobre ${papel.background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('texto branco sobre Serene Blue e Mint Frost está abaixo do mínimo e é proibido', () => {
    expect(contraste(proWhite, sereneBlue)).toBeLessThan(4.5);
    expect(contraste(proWhite, mintFrost)).toBeLessThan(4.5);
    // Nenhuma regra do CSS pinta texto claro nesses dois fundos.
    expect(css).not.toMatch(/etiqueta-AMS\s*\{[^}]*color:\s*var\(--pro-white\)/);
    expect(css).not.toMatch(/etiqueta-SQUAD\s*\{[^}]*color:\s*var\(--pro-white\)/);
  });

  it('o texto secundário mantém contraste suficiente sobre o fundo', () => {
    const secundario = /--text-muted:\s*(#[0-9a-f]{6})/i.exec(css)?.[1];
    expect(secundario).toBeTruthy();
    expect(contraste(secundario!, proWhite)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('AC-070 — tipografia', () => {
  it('a Magnetik não foi incluída e o fallback está declarado', () => {
    expect(tokens.font.assetProvided).toBe(false);
    // Nenhuma fonte é baixada ou incorporada: não há @font-face no projeto.
    expect(css).not.toMatch(/@font-face/);
    expect(css).toMatch(/system-ui/);
    expect(css).toMatch(/Magnetik não foi fornecida/);
  });

  it('tabelas e controles não usam pesos extra-light ou light', () => {
    // Os pesos são declarados em variáveis; nenhuma fica abaixo de 400.
    const pesos = [...css.matchAll(/--peso-[a-z]+:\s*(\d{3})/g)].map((m) => Number(m[1]));
    expect(pesos.length).toBe(3);
    for (const p of pesos) expect(p).toBeGreaterThanOrEqual(400);
    for (const p of Object.values(tokens.font.weights)) expect(p).toBeGreaterThanOrEqual(400);
    // Nenhum peso literal abaixo de 400 escapou pelas regras.
    const literais = [...css.matchAll(/font-weight:\s*(\d{3})/g)].map((m) => Number(m[1]));
    for (const p of literais) expect(p).toBeGreaterThanOrEqual(400);
  });

  it('a escala tipográfica não desce abaixo de 12 px, e dados ficam em 14 px', () => {
    expect(css).toMatch(/--t-tabela:\s*14px/);
    expect(css).toMatch(/--t-legenda:\s*12px/);
    expect(css).toMatch(/--t-corpo:\s*16px/);
    expect(css).toMatch(/--t-titulo:\s*32px/);
  });
});

describe('secção 3.3 — layout e movimento', () => {
  it('as medidas de layout batem com o contrato', () => {
    expect(css).toContain(`--lateral: ${tokens.layout.sidebarWidthPx}px`);
    expect(css).toContain(`--largura-max: ${tokens.layout.desktopContentMaxPx}px`);
    expect(css).toContain(`--altura-controle: ${tokens.layout.controlMinHeightPx}px`);
    expect(css).toContain(`--raio-controle: ${tokens.layout.radiusPx.control}px`);
    expect(css).toContain(`--raio-painel: ${tokens.layout.radiusPx.panel}px`);
  });

  it('as transições são discretas e a redução de movimento é respeitada', () => {
    expect(css).toContain(`${tokens.motion.durationMs}ms`);
    expect(css).toMatch(/prefers-reduced-motion/);
  });

  it('não há gradiente, neon nem sombra grande', () => {
    expect(css).not.toMatch(/linear-gradient|radial-gradient/);
    expect(css).not.toMatch(/backdrop-filter/);
    // Nenhuma sombra ampla; o único fundo escurecido é o do modal.
    expect(css).not.toMatch(/box-shadow:\s*[^;]*\d{2,}px\s+\d{2,}px/);
  });
});
