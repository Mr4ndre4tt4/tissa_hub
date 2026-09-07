/**
 * Verificação da interface com navegador real.
 *
 * Confere o que a secção 18 exige e o que a secção 3.4 pede:
 *  - o corpo nunca rola na horizontal em 360, 390, 768, 1.280 e 1.440 px;
 *  - conteúdo largo rola dentro do próprio contêiner;
 *  - o modal contém o foco e devolve ao acionador;
 *  - nenhum erro de console;
 *  - captura de tela de cada tela, em desktop e celular.
 *
 * Uso:
 *   npm run build && npx vite preview --port 4173 --strictPort &
 *   node scripts/verificar-interface.mjs [--telas <diretório>]
 *
 * As capturas usam o modo demonstrativo, com dados sintéticos: nenhuma imagem
 * contém registro real do cliente.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const argTelas = process.argv.indexOf('--telas');
const DIR = argTelas >= 0 ? process.argv[argTelas + 1] : null;
if (DIR) mkdirSync(DIR, { recursive: true });

const ROTAS = [
  ['dia', 'meu-dia'],
  ['chamados', 'chamados'],
  ['dashboard', 'dashboard'],
  ['planejamento', 'planejamento'],
  ['importacoes', 'importacoes'],
  ['desenvolvimento', 'desenvolvimento'],
  ['configuracoes', 'configuracoes'],
];

const falhas = [];
const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });

async function abrirDemonstracao(pagina) {
  await pagina.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await pagina.getByRole('button', { name: /modo demonstrativo/i }).click();
  await pagina.waitForTimeout(300);
}

/** O corpo não pode rolar na horizontal em nenhuma largura. */
for (const largura of [360, 390, 768, 1280, 1440]) {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: 900 } });
  const pagina = await ctx.newPage();
  const errosConsole = [];
  pagina.on('console', (m) => m.type() === 'error' && errosConsole.push(m.text()));
  pagina.on('pageerror', (e) => errosConsole.push(`pageerror: ${e.message}`));

  await abrirDemonstracao(pagina);
  const capturar = largura === 1440 || largura === 390;
  const prefixo = largura === 1440 ? 'desktop' : 'celular';

  for (const [rota, arquivo] of ROTAS) {
    await pagina.goto(`${BASE}/#/${rota}`, { waitUntil: 'networkidle' });
    await pagina.waitForTimeout(200);
    const x = await pagina.evaluate(() => {
      window.scrollTo(9999, 0);
      const x = window.scrollX;
      window.scrollTo(0, 0);
      return x;
    });
    if (x > 0) falhas.push(`${largura}px · ${rota}: o corpo rolou ${x}px na horizontal.`);
    if (DIR && capturar) await pagina.screenshot({ path: `${DIR}/${prefixo}-${arquivo}.png`, fullPage: true });
  }

  if (errosConsole.length > 0) falhas.push(`${largura}px: erros de console — ${errosConsole.join(' | ')}`);
  console.log(`${largura}px: verificado`);
  await ctx.close();
}

/** Conteúdo largo rola dentro do próprio contêiner. */
{
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const pagina = await ctx.newPage();
  await abrirDemonstracao(pagina);
  await pagina.goto(`${BASE}/#/chamados`, { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(200);
  const r = await pagina.evaluate(() => {
    const d = document.querySelector('.rolagem-tabela');
    d.scrollLeft = 9999;
    const x = d.scrollLeft;
    d.scrollLeft = 0;
    return { rolou: x, visivel: d.clientWidth, conteudo: d.scrollWidth };
  });
  if (r.rolou <= 0) falhas.push('A tabela larga não rolou dentro do próprio contêiner.');
  console.log(`tabela larga: contêiner ${r.visivel}px, conteúdo ${r.conteudo}px, rolagem interna ${r.rolou}px`);
  await ctx.close();
}

/** Modal com foco contido e devolução ao acionador. */
{
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const pagina = await ctx.newPage();
  await abrirDemonstracao(pagina);

  await pagina.getByRole('button', { name: 'Novo apontamento' }).click();
  await pagina.waitForTimeout(200);
  const dentro = await pagina.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement) ?? false);
  if (!dentro) falhas.push('O foco inicial não ficou dentro do diálogo.');
  if (DIR) await pagina.screenshot({ path: `${DIR}/desktop-formulario.png`, fullPage: true });

  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(200);
  const voltou = await pagina.evaluate(() => document.activeElement?.textContent?.includes('Novo apontamento') ?? false);
  if (!voltou) falhas.push('O foco não voltou ao acionador depois de fechar o diálogo.');
  console.log(`modal: foco contido = ${dentro}, foco devolvido ao acionador = ${voltou}`);
  await ctx.close();
}

/** Detalhe do chamado abre por ID. */
{
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const pagina = await ctx.newPage();
  await abrirDemonstracao(pagina);
  await pagina.goto(`${BASE}/#/chamados`, { waitUntil: 'networkidle' });
  await pagina.getByRole('button', { name: /IR90000001/ }).first().click();
  await pagina.waitForTimeout(300);
  const temResumo = await pagina.getByRole('heading', { name: 'Resumo' }).isVisible();
  if (!temResumo) falhas.push('O detalhe do chamado não abriu.');
  if (DIR) await pagina.screenshot({ path: `${DIR}/desktop-detalhe.png`, fullPage: true });
  console.log(`detalhe do chamado: aberto = ${temResumo}`);
  await ctx.close();
}

await navegador.close();

if (falhas.length > 0) {
  console.error(`\n${falhas.length} falha(s):`);
  for (const f of falhas) console.error(` - ${f}`);
  process.exit(1);
}
console.log('\nInterface verificada: nenhuma falha.');
