import { defineConfig } from 'vite';
import { retroPocketPwa } from './build/pwa-plugin.js';

export default defineConfig({
  base: './',
  plugins: [retroPocketPwa()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 0
  },
  server: {
    port: 5173
  }
});
