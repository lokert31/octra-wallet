import { create } from 'zustand';
import type { Account, ToastState } from '@shared/types';
import { STORAGE_KEYS } from '@shared/constants';

export interface PendingTransaction {
  hash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
}

// Load pending transactions from storage
async function loadPendingTransactions(): Promise<PendingTransaction[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.PENDING_TRANSACTIONS);
    return (result[STORAGE_KEYS.PENDING_TRANSACTIONS] as PendingTransaction[]) || [];
  } catch {
    return [];
  }
}

// Save pending transactions to storage
async function savePendingTransactions(txs: PendingTransaction[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_TRANSACTIONS]: txs });
  } catch (e) {
    console.warn('Failed to save pending transactions:', e);
  }
}

interface WalletState {
  // Auth state
  isInitialized: boolean;
  isLocked: boolean;

  // Account state
  accounts: Account[];
  activeAccountIndex: number;

  // Balance cache
  balances: Record<string, string>;
  nonces: Record<string, number>;

  // Pending transactions
  pendingTransactions: PendingTransaction[];

  // UI state
  toast: ToastState | null;
  isLoading: boolean;

  // Actions
  setInitialized: (initialized: boolean) => void;
  setLocked: (locked: boolean) => void;
  setAccounts: (accounts: Account[]) => void;
  setActiveAccountIndex: (index: number) => void;
  addAccount: (account: Account) => void;
  removeAccount: (index: number) => void;
  renameAccount: (index: number, name: string) => void;
  updateBalance: (address: string, balance: string) => void;
  updateNonce: (address: string, nonce: number) => void;
  addPendingTransaction: (tx: PendingTransaction) => void;
  removePendingTransaction: (hash: string) => void;
  loadPendingTransactions: () => Promise<void>;
  showToast: (message: string, type: ToastState['type'], options?: { subMessage?: string; link?: string }) => void;
  hideToast: () => void;
  setLoading: (loading: boolean) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  // Initial state
  isInitialized: false,
  isLocked: true,
  accounts: [],
  activeAccountIndex: 0,
  balances: {},
  nonces: {},
  pendingTransactions: [],
  toast: null,
  isLoading: false,

  // Actions
  setInitialized: (initialized) => set({ isInitialized: initialized }),

  setLocked: (locked) => set({ isLocked: locked }),

  setAccounts: (accounts) => set({ accounts }),

  setActiveAccountIndex: (index) => set({ activeAccountIndex: index }),

  addAccount: (account) =>
    set((state) => ({
      accounts: [...state.accounts, account],
    })),

  removeAccount: (index) =>
    set((state) => ({
      accounts: state.accounts.filter((a) => a.index !== index),
      activeAccountIndex:
        state.activeAccountIndex === index
          ? state.accounts[0]?.index ?? 0
          : state.activeAccountIndex,
    })),

  renameAccount: (index, name) =>
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.index === index ? { ...a, name } : a
      ),
    })),

  updateBalance: (address, balance) =>
    set((state) => ({
      balances: { ...state.balances, [address]: balance },
    })),

  updateNonce: (address, nonce) =>
    set((state) => ({
      nonces: { ...state.nonces, [address]: nonce },
    })),

  addPendingTransaction: (tx) => {
    set((state) => {
      const newTxs = [tx, ...state.pendingTransactions];
      savePendingTransactions(newTxs);
      return { pendingTransactions: newTxs };
    });
  },

  removePendingTransaction: (hash) => {
    set((state) => {
      const newTxs = state.pendingTransactions.filter((tx) => tx.hash !== hash);
      savePendingTransactions(newTxs);
      return { pendingTransactions: newTxs };
    });
  },

  loadPendingTransactions: async () => {
    const txs = await loadPendingTransactions();
    set({ pendingTransactions: txs });
  },

  showToast: (message, type, options) =>
    set({
      toast: {
        id: Date.now().toString(),
        message,
        type,
        subMessage: options?.subMessage,
        link: options?.link,
      },
    }),

  hideToast: () => set({ toast: null }),

  setLoading: (loading) => set({ isLoading: loading }),
}));

// Selectors
export const useActiveAccount = () => {
  const { accounts, activeAccountIndex } = useWalletStore();
  return accounts.find((a) => a.index === activeAccountIndex) ?? accounts[0];
};

export const useAccountBalance = (address: string) => {
  const { balances } = useWalletStore();
  return balances[address] ?? '0';
};
