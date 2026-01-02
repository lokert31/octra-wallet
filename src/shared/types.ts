// Account types
export interface Account {
  index: number;
  name: string;
  address: string;
  publicKey: string;
}

export interface AccountWithPrivateKey extends Account {
  privateKey: string;
}

// Transaction types
export interface OctraTransaction {
  from: string;
  to_: string;
  amount: string;
  nonce: number;
  ou: string;
  timestamp: number;
}

export interface SignedTransaction extends OctraTransaction {
  signature: string;
  public_key: string;
}

export interface TransactionRecord {
  hash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  type: 'in' | 'out';
  status: 'pending' | 'confirmed' | 'failed';
  nonce?: number;
}

// RPC Response types
export interface BalanceResponse {
  balance: string;
  nonce: number;
}

export interface SendTxResponse {
  status: string;
  tx_hash?: string;
  error?: string;
}

export interface AddressInfoResponse {
  address: string;
  balance: string;
  nonce: number;
  has_public_key?: boolean;
  recent_transactions?: Array<{
    hash: string;
    epoch?: number;
  }>;
}

// Message types for Chrome messaging
export interface WalletMessage<T = unknown> {
  type: string;
  payload?: T;
}

export interface WalletResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Wallet state types
export interface WalletState {
  isInitialized: boolean;
  isLocked: boolean;
  accounts: Account[];
  activeAccountIndex: number;
  balances: Record<string, string>;
}

// UI State types
export interface ToastState {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  subMessage?: string;
  link?: string;
}

// Form types
export interface SendFormData {
  to: string;
  amount: string;
  feeTier: string;
}

// Private transaction types
export interface PrivateBalanceResponse {
  encrypted_balance?: string;
  decrypted_balance?: string;
  has_private_balance: boolean;
}

export interface PendingTransfer {
  id: string;
  from: string;
  to: string;
  amount: string;
  encrypted_amount?: string;
  timestamp: number;
  status: 'pending' | 'claimed' | 'expired';
}

export interface PrivateTransferData {
  from: string;
  to: string;
  amount: number;
  from_private_key: string;
  to_public_key: string;
}
