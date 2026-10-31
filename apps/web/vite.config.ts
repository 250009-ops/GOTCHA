import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// S4 footer build id: git short sha + commit date (deterministic, so rebuilds stay byte-identical). Env overrides win.
const git = (cmd: string) => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
process.env.VITE_BUILD_COMMIT ||= git('git rev-parse --short=7 HEAD');
process.env.VITE_BUILD_DATE ||= git('git log -1 --format=%cs HEAD');

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
