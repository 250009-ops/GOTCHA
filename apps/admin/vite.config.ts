import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  // Keep admin on 5173 so shared-login returnUrl / CORS stay predictable.
  // (Without strictPort, Vite may steal marketing's 5174 and break the handoff.)
  server: { port: 5173, strictPort: true },
});
