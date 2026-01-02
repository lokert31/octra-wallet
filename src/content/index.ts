// Content script - runs in isolated context
// Bridges between injected script (page context) and background service worker

// Inject the provider script into the page
function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

// Inject as early as possible
injectScript();

// Connected sites storage key
const CONNECTED_SITES_KEY = 'octra_connected_sites';

// Get connected sites
async function getConnectedSites(): Promise<string[]> {
  const result = await chrome.storage.local.get(CONNECTED_SITES_KEY);
  return (result[CONNECTED_SITES_KEY] as string[]) || [];
}

// Add connected site
async function addConnectedSite(origin: string): Promise<void> {
  const sites = await getConnectedSites();
  if (!sites.includes(origin)) {
    sites.push(origin);
    await chrome.storage.local.set({ [CONNECTED_SITES_KEY]: sites });
  }
}

// Check if site is connected
async function isSiteConnected(origin: string): Promise<boolean> {
  const sites = await getConnectedSites();
  return sites.includes(origin);
}

// Remove connected site
async function removeConnectedSite(origin: string): Promise<void> {
  const sites = await getConnectedSites();
  const newSites = sites.filter((s) => s !== origin);
  await chrome.storage.local.set({ [CONNECTED_SITES_KEY]: newSites });
}

// Handle messages from injected script
window.addEventListener('message', async (event) => {
  // Only accept messages from same window
  if (event.source !== window) return;

  const { source, type, id, method, params } = event.data;

  // Only handle messages from our injected script
  if (source !== 'octra-wallet-page' || type !== 'request') return;

  const origin = window.location.origin;

  try {
    let result: unknown;

    switch (method) {
      case 'connect': {
        // Check if already connected
        if (await isSiteConnected(origin)) {
          const response = await chrome.runtime.sendMessage({
            type: 'DAPP_GET_ACCOUNT',
          });
          if (response.success) {
            result = response.data;
          } else {
            throw new Error(response.error || 'Failed to get account');
          }
        } else {
          // Request connection approval
          const response = await chrome.runtime.sendMessage({
            type: 'DAPP_CONNECT_REQUEST',
            payload: { origin, favicon: getFavicon() },
          });

          if (response.success) {
            await addConnectedSite(origin);
            result = response.data;
          } else {
            throw new Error(response.error || 'Connection rejected');
          }
        }
        break;
      }

      case 'disconnect': {
        await removeConnectedSite(origin);
        result = true;
        break;
      }

      case 'isConnected': {
        result = await isSiteConnected(origin);
        break;
      }

      case 'getAddress': {
        if (!(await isSiteConnected(origin))) {
          throw new Error('Not connected');
        }
        const response = await chrome.runtime.sendMessage({
          type: 'DAPP_GET_ADDRESS',
        });
        result = response.success ? response.data : null;
        break;
      }

      case 'getBalance': {
        if (!(await isSiteConnected(origin))) {
          throw new Error('Not connected');
        }
        const response = await chrome.runtime.sendMessage({
          type: 'DAPP_GET_BALANCE',
        });
        if (response.success) {
          result = response.data;
        } else {
          throw new Error(response.error || 'Failed to get balance');
        }
        break;
      }

      case 'getNetwork': {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_NETWORK',
        });
        result = response.success ? response.data : 'mainnet';
        break;
      }

      case 'sendTransaction': {
        if (!(await isSiteConnected(origin))) {
          throw new Error('Not connected');
        }
        const response = await chrome.runtime.sendMessage({
          type: 'DAPP_SEND_TRANSACTION',
          payload: { ...params, origin },
        });
        if (response.success) {
          result = response.data;
        } else {
          throw new Error(response.error || 'Transaction failed');
        }
        break;
      }

      case 'sendPrivateTransfer': {
        if (!(await isSiteConnected(origin))) {
          throw new Error('Not connected');
        }
        const response = await chrome.runtime.sendMessage({
          type: 'DAPP_SEND_PRIVATE_TRANSFER',
          payload: { ...params, origin },
        });
        if (response.success) {
          result = response.data;
        } else {
          throw new Error(response.error || 'Private transfer failed');
        }
        break;
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    // Send success response
    window.postMessage({
      source: 'octra-wallet-content',
      type: 'response',
      id,
      success: true,
      data: result,
    }, '*');
  } catch (error) {
    // Send error response
    window.postMessage({
      source: 'octra-wallet-content',
      type: 'response',
      id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, '*');
  }
});

// Helper to get favicon
function getFavicon(): string {
  const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
  return link?.href || `${window.location.origin}/favicon.ico`;
}

// Listen for events from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'WALLET_EVENT') {
    window.postMessage({
      source: 'octra-wallet-content',
      type: 'event',
      eventName: message.eventName,
      eventData: message.eventData,
    }, '*');
  }
});
