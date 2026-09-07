import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@domain': r('./src/domain'),
      '@adapters': r('./src/adapters'),
      '@design': r('./src/design'),
      '@features': r('./src/features'),
      '@app': r('./src/app'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Insumos privados nunca entram na suíte automática.
    exclude: ['node_modules/**', 'tests/restrito/**'],
  },
});
