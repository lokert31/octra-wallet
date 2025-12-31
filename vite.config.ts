import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
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
      },
    },
  },
});
