import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // `@gotcha/shared` ships a CommonJS build for the Nest/ts-node backend; Rollup can't
      // statically resolve named exports from it through the npm-workspace symlink. Point
      // Vite straight at the TS source instead so esbuild processes it as a normal ES module.
      '@gotcha/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  server: { port: 5175 },
});
