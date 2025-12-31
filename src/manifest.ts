import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Octra Wallet',
  version: '1.0.0',
  description: 'A secure wallet for Octra Network - FHE Blockchain',

  icons: {
    '16': 'assets/icons/icon16.png',
    '48': 'assets/icons/icon48.png',
    '128': 'assets/icons/icon128.png',
  },

  action: {
    default_popup: 'src/ui/popup/index.html',
    default_icon: {
      '16': 'assets/icons/icon16.png',
      '48': 'assets/icons/icon48.png',
    },
    default_title: 'Octra Wallet',
  },

  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  permissions: [
    'storage',
    'alarms',
  ],

  host_permissions: [
    'https://octra.network/*',
    'https://*.octra.network/*',
  ],

  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
});
