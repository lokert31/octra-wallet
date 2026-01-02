// Injected script - runs in page context
// Provides window.octra API for dApps

interface OctraProvider {
  isOctraWallet: boolean;
  version: string;
  connect: () => Promise<{ address: string; publicKey: string }>;
  disconnect: () => Promise<void>;
  isConnected: () => Promise<boolean>;
  getAddress: () => Promise<string | null>;
  getBalance: () => Promise<string>;
  getNetwork: () => Promise<string>;
  sendTransaction: (params: { to: string; amount: number }) => Promise<{ txHash: string }>;
  sendPrivateTransfer: (params: { to: string; amount: number }) => Promise<{ txHash: string }>;
  on: (event: string, callback: (data: unknown) => void) => void;
  off: (event: string, callback: (data: unknown) => void) => void;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

const pendingRequests = new Map<string, PendingRequest>();
const eventListeners = new Map<string, Set<(data: unknown) => void>>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function sendRequest(method: string, params?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = generateId();
    pendingRequests.set(id, { resolve, reject });

    window.postMessage({
      source: 'octra-wallet-page',
      type: 'request',
      id,
      method,
      params,
    }, '*');

    // Timeout after 60 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, 60000);
  });
}

// Listen for responses from content script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  const { source, type, id, success, data, error, eventName, eventData } = event.data;

  if (source !== 'octra-wallet-content') return;

  // Handle responses
  if (type === 'response' && id) {
    const pending = pendingRequests.get(id);
    if (pending) {
      pendingRequests.delete(id);
      if (success) {
        pending.resolve(data);
      } else {
        pending.reject(new Error(error || 'Unknown error'));
      }
    }
  }

  // Handle events
  if (type === 'event' && eventName) {
    const listeners = eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach((callback) => callback(eventData));
    }
  }
});

// Create provider object
const octraProvider: OctraProvider = {
  isOctraWallet: true,
  version: '1.0.0',

  async connect() {
    const result = await sendRequest('connect');
    return result as { address: string; publicKey: string };
  },

  async disconnect() {
    await sendRequest('disconnect');
  },

  async isConnected() {
    const result = await sendRequest('isConnected');
    return result as boolean;
  },

  async getAddress() {
    const result = await sendRequest('getAddress');
    return result as string | null;
  },

  async getBalance() {
    const result = await sendRequest('getBalance');
    return result as string;
  },

  async getNetwork() {
    const result = await sendRequest('getNetwork');
    return result as string;
  },

  async sendTransaction(params: { to: string; amount: number }) {
    const result = await sendRequest('sendTransaction', params);
    return result as { txHash: string };
  },

  async sendPrivateTransfer(params: { to: string; amount: number }) {
    const result = await sendRequest('sendPrivateTransfer', params);
    return result as { txHash: string };
  },

  on(event: string, callback: (data: unknown) => void) {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set());
    }
    eventListeners.get(event)!.add(callback);
  },

  off(event: string, callback: (data: unknown) => void) {
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  },
};

// Expose to window
(window as unknown as { octra?: OctraProvider }).octra = octraProvider;

// Dispatch event to notify dApps that provider is ready
window.dispatchEvent(new Event('octra#initialized'));
