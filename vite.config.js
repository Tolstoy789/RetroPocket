import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { retroPocketPwa } from './build/pwa-plugin.js';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
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
