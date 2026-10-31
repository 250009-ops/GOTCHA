import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
// @ts-expect-error plain .mjs helper shared with tests
import { legalPublishProblems, previewStampProblems } from './scripts/legal-guard.mjs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const sharedRoot = fileURLToPath(new URL('../../packages/shared/src', import.meta.url));

function legalPublishGuard(mode: string): Plugin {
  return {
    name: 'legal-publish-guard',
    apply: 'build',
    buildStart() {
      const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
      const legalSource = readFileSync(new URL('./src/lib/legalHtml.generated.ts', import.meta.url), 'utf8');
      const qaBuild = env.VITE_LEGAL_V2 === 'true';
      const problems: string[] = [
        ...legalPublishProblems({ mode, qaBuild, legalSource }),
        ...previewStampProblems({ mode, qaBuild, previewStamp: env.VITE_PREVIEW_STAMP }),
      ];
      if (problems.length) this.error('legal-publish-guard: ' + problems.join('; '));
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE || '/',
  plugins: [legalPublishGuard(mode), tailwindcss(), react()],
  resolve: {
    alias: {
      '@gotcha/shared/learner-copy': `${sharedRoot}/learnerCopy.ts`,
      '@gotcha/shared': `${sharedRoot}/index.ts`,
    },
  },
  server: { port: 5174, strictPort: true },
}));
