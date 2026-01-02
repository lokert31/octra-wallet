// Network definitions
export const NETWORKS = {
  mainnet: {
    id: 'mainnet',
    name: 'Mainnet',
    rpcUrl: 'https://octra.network',
    explorerUrl: 'https://octrascan.io',
    chainId: 1,
  },
  testnet: {
    id: 'testnet',
    name: 'Testnet',
    rpcUrl: 'https://testnet.octra.network',
    explorerUrl: 'https://testnet.octrascan.io',
    chainId: 2,
  },
} as const;

export type NetworkId = keyof typeof NETWORKS;

// Octra Network Configuration
export const OCTRA_CONFIG = {
  // Default RPC endpoint (can be overridden)
  RPC_URL: 'https://octra.network',

  // Network info
  NETWORK_NAME: 'Octra Mainnet',
  CHAIN_ID: 1,

  // Token info
  TOKEN_SYMBOL: 'OCT',
  TOKEN_DECIMALS: 6,       // For amount conversion (1 OCT = 1,000,000 units)
  FEE_DECIMALS: 7,         // For fee (ou) conversion (10000 ou = 0.001 OCT)

  // Address prefix
  ADDRESS_PREFIX: 'oct',
} as const;

// Wallet Configuration
export const WALLET_CONFIG = {
  // Default auto-lock timeout (in minutes)
  DEFAULT_AUTO_LOCK_TIMEOUT: 15,

  // PBKDF2 iterations for key derivation (2 million = very slow to brute force)
  PBKDF2_ITERATIONS: 2_000_000,

  // Clipboard auto-clear timeout (in seconds)
  CLIPBOARD_CLEAR_TIMEOUT: 60,

  // Max accounts per wallet
  MAX_ACCOUNTS: 100,

  // Default account name prefix
  DEFAULT_ACCOUNT_NAME: 'Account',
} as const;

// Auto-lock timeout options (in minutes, 0 = disabled)
export const AUTO_LOCK_OPTIONS = [
  { value: 0, label: 'Disabled' },
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
] as const;

// UI Configuration
export const UI_CONFIG = {
  // Popup dimensions
  POPUP_WIDTH: 360,
  POPUP_HEIGHT: 600,

  // Toast duration (ms) - errors show longer
  TOAST_DURATION: 6000,

  // Balance refresh interval (ms)
  BALANCE_REFRESH_INTERVAL: 30_000,

  // History page size
  HISTORY_PAGE_SIZE: 20,
} as const;

// Fee tiers (ou uses 7 decimals: 10000 ou = 0.001 OCT)
// Amount uses 6 decimals: 1,000,000 = 1 OCT
export const FEE_TIERS = {
  LOW: { ou: 10000, label: 'Low', fee: 0.001 },        // 10000 ou = 0.001 OCT
  MEDIUM: { ou: 20000, label: 'Medium', fee: 0.002 },  // 20000 ou = 0.002 OCT
  HIGH: { ou: 50000, label: 'High', fee: 0.005 },      // 50000 ou = 0.005 OCT
} as const;

// Message types for background communication
export const MESSAGE_TYPES = {
  // Wallet operations
  UNLOCK_WALLET: 'UNLOCK_WALLET',
  LOCK_WALLET: 'LOCK_WALLET',
  GET_LOCK_STATUS: 'GET_LOCK_STATUS',
  RESET_WALLET: 'RESET_WALLET',

  // Account operations
  CREATE_WALLET: 'CREATE_WALLET',
  IMPORT_WALLET: 'IMPORT_WALLET',
  GET_ACCOUNTS: 'GET_ACCOUNTS',
  ADD_ACCOUNT: 'ADD_ACCOUNT',
  IMPORT_ACCOUNT: 'IMPORT_ACCOUNT',
  REMOVE_ACCOUNT: 'REMOVE_ACCOUNT',
  RENAME_ACCOUNT: 'RENAME_ACCOUNT',
  GET_ACTIVE_ACCOUNT: 'GET_ACTIVE_ACCOUNT',
  SET_ACTIVE_ACCOUNT: 'SET_ACTIVE_ACCOUNT',
  EXPORT_PRIVATE_KEY: 'EXPORT_PRIVATE_KEY',

  // Balance & Transactions
  GET_BALANCE: 'GET_BALANCE',
  SEND_TRANSACTION: 'SEND_TRANSACTION',
  GET_TRANSACTION_HISTORY: 'GET_TRANSACTION_HISTORY',

  // Session
  PING: 'PING',

  // Password
  VERIFY_PASSWORD: 'VERIFY_PASSWORD',
  CHANGE_PASSWORD: 'CHANGE_PASSWORD',

  // Auto-lock
  UPDATE_ACTIVITY: 'UPDATE_ACTIVITY',
  CHECK_AUTO_LOCK: 'CHECK_AUTO_LOCK',
  GET_AUTO_LOCK_TIMEOUT: 'GET_AUTO_LOCK_TIMEOUT',
  SET_AUTO_LOCK_TIMEOUT: 'SET_AUTO_LOCK_TIMEOUT',

  // RPC
  GET_RPC_URL: 'GET_RPC_URL',
  SET_RPC_URL: 'SET_RPC_URL',

  // Network
  GET_NETWORK: 'GET_NETWORK',
  SET_NETWORK: 'SET_NETWORK',

  // Private transactions
  GET_PRIVATE_BALANCE: 'GET_PRIVATE_BALANCE',
  SEND_PRIVATE_TRANSFER: 'SEND_PRIVATE_TRANSFER',
  GET_PENDING_TRANSFERS: 'GET_PENDING_TRANSFERS',
  CLAIM_PRIVATE_TRANSFER: 'CLAIM_PRIVATE_TRANSFER',
  GET_PUBLIC_KEY: 'GET_PUBLIC_KEY',

  // Encrypt/Decrypt balance (Octra terminology for shield/unshield)
  ENCRYPT_BALANCE: 'ENCRYPT_BALANCE',
  DECRYPT_BALANCE: 'DECRYPT_BALANCE',

  // Legacy aliases (deprecated)
  SHIELD_BALANCE: 'ENCRYPT_BALANCE',
  UNSHIELD_BALANCE: 'DECRYPT_BALANCE',
} as const;

// Storage keys
export const STORAGE_KEYS = {
  VAULT: 'octra_vault',
  PREFERENCES: 'octra_preferences',
  ACTIVE_ACCOUNT: 'octra_active_account',
  TX_HISTORY_CACHE: 'octra_tx_history',
  PASSWORD_HASH: 'octra_password_hash',
  LAST_ACTIVITY: 'octra_last_activity',
  AUTO_LOCK_TIMEOUT: 'octra_auto_lock_timeout',
  PENDING_TRANSACTIONS: 'octra_pending_txs',
  RPC_URL: 'octra_rpc_url',
  NETWORK: 'octra_network',
} as const;

// Explorer URL
export const EXPLORER_URL = 'https://octrascan.io';

// GitHub repository
export const GITHUB_REPO = 'https://github.com/lokert31/octra-wallet';
