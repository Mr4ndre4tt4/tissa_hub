/**
 * Configuração da suíte restrita, que só roda em ambiente autorizado e com os
 * insumos privados apontados por variáveis de ambiente. Separada de propósito
 * da suíte automática (secção 18: testes sintéticos e testes com dados reais
 * não se misturam).
 */
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@domain': r('./src/domain'),
      '@adapters': r('./src/adapters'),
      '@design': r('./src/design'),
      '@features': r('./src/features'),
      '@app': r('./src/app'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/restrito/**/*.test.ts'],
  },
});
