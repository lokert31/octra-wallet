import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { buildSync } from 'esbuild';
import manifest from './src/manifest';

// Plugin to copy icons after build
const copyIcons = () => ({
  name: 'copy-icons',
  writeBundle() {
    const iconDir = resolve(__dirname, 'dist/assets/icons');
    if (!existsSync(iconDir)) {
      mkdirSync(iconDir, { recursive: true });
    }
    ['icon16.png', 'icon48.png', 'icon128.png'].forEach(icon => {
      copyFileSync(
        resolve(__dirname, `src/assets/icons/${icon}`),
        resolve(iconDir, icon)
      );
    });
  }
});

// Pre-build injected script to public folder
function preBuildInjectedScript() {
  const publicDir = resolve(__dirname, 'public');
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }
  buildSync({
    entryPoints: [resolve(__dirname, 'src/content/injected.ts')],
    bundle: true,
    outfile: resolve(publicDir, 'injected.js'),
    format: 'iife',
    target: 'es2020',
    minify: true,
  });
}

// Build injected script before vite starts
preBuildInjectedScript();

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    copyIcons(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@core': resolve(__dirname, 'src/core'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@background': resolve(__dirname, 'src/background'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/ui/popup/index.html'),
        fullpage: resolve(__dirname, 'src/ui/fullpage/index.html'),
      },
    },
  },
});
