import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const sharedRoot = fileURLToPath(new URL('../../packages/shared/src', import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@gotcha/shared/learner-copy': `${sharedRoot}/learnerCopy.ts`,
      '@gotcha/shared': `${sharedRoot}/index.ts`,
    },
  },
  server: { port: 5174, strictPort: true },
});
