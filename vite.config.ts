import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: 'demo',
  // GitHub Pages serves the demo from /<repo>/ — the workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  resolve: {
    alias: {
      'nova-charts': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
