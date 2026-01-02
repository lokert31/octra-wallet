import { VaultService } from '@core/storage/vault';
import { OctraRPC } from '@core/rpc/client';
import { TransactionBuilder } from '@core/transaction/builder';
import { MESSAGE_TYPES, STORAGE_KEYS, OCTRA_CONFIG, NETWORKS, type NetworkId } from '@shared/constants';
import { onMessage } from '@shared/messaging';
import type { WalletMessage, WalletResponse } from '@shared/types';

// Helper to get active account index
async function getActiveAccountIndex(): Promise<number> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_ACCOUNT);
  return (result[STORAGE_KEYS.ACTIVE_ACCOUNT] as number) ?? 0;
}

/**
 * Handle messages from UI
 */
async function handleMessage(
  message: WalletMessage,
  _sender: chrome.runtime.MessageSender
): Promise<WalletResponse> {
  const { type, payload } = message;

  try {
    switch (type) {
      // === Wallet Status ===
      case MESSAGE_TYPES.GET_LOCK_STATUS: {
        const exists = await VaultService.exists();

        // Try to restore session if not unlocked
        if (exists && !VaultService.isUnlocked()) {
          await VaultService.init(); // This tries to restore session
        }

        // Check auto-lock
        if (VaultService.isUnlocked()) {
          const shouldLock = await VaultService.shouldAutoLock();
          if (shouldLock) {
            await VaultService.lock();
          }
        }

        return {
          success: true,
          data: {
            isInitialized: exists,
            isLocked: exists && !VaultService.isUnlocked(),
          },
        };
      }

      // === Create Wallet ===
      case MESSAGE_TYPES.CREATE_WALLET: {
        const { password } = payload as { password: string };
        if (!password) {
          return { success: false, error: 'Password required' };
        }

        const { account, mnemonic, privateKey } = await VaultService.create(password);
        return {
          success: true,
          data: {
            ...account,
            mnemonic,
            privateKey,
          }
        };
      }

      // === Import Wallet ===
      case MESSAGE_TYPES.IMPORT_WALLET: {
        const { privateKey, mnemonic, password } = payload as {
          privateKey?: string;
          mnemonic?: string;
          password: string;
        };

        if (!password) {
          return { success: false, error: 'Password required' };
        }

        let account;
        if (mnemonic) {
          account = await VaultService.importFromMnemonic(mnemonic, password);
        } else if (privateKey) {
          account = await VaultService.import(privateKey, password);
        } else {
          return { success: false, error: 'Private key or mnemonic required' };
        }

        return { success: true, data: account };
      }

      // === Unlock Wallet (decrypt with password) ===
      case MESSAGE_TYPES.UNLOCK_WALLET: {
        const { password } = payload as { password: string };
        if (!password) {
          return { success: false, error: 'Password required' };
        }

        const accounts = await VaultService.unlock(password);
        return { success: true, data: accounts };
      }

      // === Lock Wallet ===
      case MESSAGE_TYPES.LOCK_WALLET: {
        await VaultService.lock();
        return { success: true };
      }

      // === Get Accounts ===
      case MESSAGE_TYPES.GET_ACCOUNTS: {
        if (!VaultService.isUnlocked()) {
          return { success: false, error: 'Wallet is locked' };
        }
        const accounts = VaultService.getAccounts();
        return { success: true, data: accounts };
      }

      // === Add Account ===
      case MESSAGE_TYPES.ADD_ACCOUNT: {
        const { name } = payload as { name?: string };
        const newAccount = await VaultService.addAccount(name);
        return { success: true, data: newAccount };
      }

      // === Import Account (add to existing wallet) ===
      case MESSAGE_TYPES.IMPORT_ACCOUNT: {
        const { privateKey, mnemonic, name } = payload as {
          privateKey?: string;
          mnemonic?: string;
          name?: string;
        };

        let account;
        if (mnemonic) {
          account = await VaultService.importAccountFromMnemonic(mnemonic, name);
        } else if (privateKey) {
          account = await VaultService.importAccount(privateKey, name);
        } else {
          return { success: false, error: 'Private key or mnemonic required' };
        }

        return { success: true, data: account };
      }

      // === Remove Account ===
      case MESSAGE_TYPES.REMOVE_ACCOUNT: {
        const { index } = payload as { index: number };
        await VaultService.removeAccount(index);
        return { success: true };
      }

      // === Rename Account ===
      case MESSAGE_TYPES.RENAME_ACCOUNT: {
        const { index, name } = payload as { index: number; name: string };
        await VaultService.renameAccount(index, name);
        return { success: true };
      }

      // === Get Active Account ===
      case MESSAGE_TYPES.GET_ACTIVE_ACCOUNT: {
        const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_ACCOUNT);
        const activeIndex = result[STORAGE_KEYS.ACTIVE_ACCOUNT] as number | undefined;
        return { success: true, data: activeIndex ?? 0 };
      }

      // === Set Active Account ===
      case MESSAGE_TYPES.SET_ACTIVE_ACCOUNT: {
        const { index } = payload as { index: number };
        await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_ACCOUNT]: index });
        return { success: true };
      }

      // === Export Private Key ===
      case MESSAGE_TYPES.EXPORT_PRIVATE_KEY: {
        const { index } = payload as { index: number };
        const privateKey = VaultService.exportPrivateKey(index);
        return { success: true, data: privateKey };
      }

      // === Get Balance ===
      case MESSAGE_TYPES.GET_BALANCE: {
        const { address } = payload as { address: string };
        const balanceData = await OctraRPC.getBalance(address);
        // API returns balance already in OCT format (not micro-units)
        return {
          success: true,
          data: {
            balance: balanceData.balance,
            balanceRaw: balanceData.balance,
            nonce: balanceData.nonce,
          },
        };
      }

      // === Send Transaction ===
      case MESSAGE_TYPES.SEND_TRANSACTION: {
        const { from, to, amount, accountIndex, feeTier } = payload as {
          from: string;
          to: string;
          amount: number;
          accountIndex: number;
          feeTier?: 'LOW' | 'MEDIUM' | 'HIGH';
        };

        if (!VaultService.isUnlocked()) {
          return { success: false, error: 'Wallet is locked' };
        }

        // Get account keys
        const { privateKey, publicKey } = VaultService.getPrivateKey(accountIndex);

        // Get current nonce
        const balanceData = await OctraRPC.getBalance(from);
        const nonce = balanceData.nonce + 1;

        // Build and sign transaction
        const signedTx = TransactionBuilder.buildAndSign({
          from,
          to,
          amount,
          nonce,
          feeTier: feeTier || 'LOW',
          privateKey,
          publicKey,
        });

        // Send transaction
        const result = await OctraRPC.sendTransaction(signedTx);

        if (result.status === 'accepted') {
          return {
            success: true,
            data: {
              txHash: result.tx_hash,
              nonce,
            },
          };
        }

        return { success: false, error: result.error || 'Transaction failed' };
      }

      // === Get Transaction History ===
      case MESSAGE_TYPES.GET_TRANSACTION_HISTORY: {
        const { address } = payload as { address: string };
        const info = await OctraRPC.getAddressInfo(address);

        if (!info?.recent_transactions) {
          return { success: true, data: [] };
        }

        // Fetch transaction details
        const transactions = await Promise.all(
          info.recent_transactions.slice(0, 20).map(async (ref) => {
            const tx = await OctraRPC.getTransaction(ref.hash);
            return tx ? { ...tx, hash: ref.hash } : null;
          })
        );

        return {
          success: true,
          data: transactions.filter(Boolean),
        };
      }

      // === Ping (keep alive) ===
      case MESSAGE_TYPES.PING: {
        return { success: true, data: 'pong' };
      }

      // === Reset Wallet ===
      case MESSAGE_TYPES.RESET_WALLET: {
        await VaultService.reset();
        return { success: true };
      }

      // === Password Operations ===
      case MESSAGE_TYPES.VERIFY_PASSWORD: {
        const { password } = payload as { password: string };
        const isValid = await VaultService.verifyPassword(password);
        return { success: true, data: isValid };
      }

      case MESSAGE_TYPES.CHANGE_PASSWORD: {
        const { oldPassword, newPassword } = payload as { oldPassword: string; newPassword: string };
        await VaultService.changePassword(oldPassword, newPassword);
        return { success: true };
      }

      // === Auto-lock Operations ===
      case MESSAGE_TYPES.UPDATE_ACTIVITY: {
        await VaultService.updateActivity();
        return { success: true };
      }

      case MESSAGE_TYPES.CHECK_AUTO_LOCK: {
        const shouldLock = await VaultService.shouldAutoLock();
        return { success: true, data: shouldLock };
      }

      case MESSAGE_TYPES.GET_AUTO_LOCK_TIMEOUT: {
        const timeout = await VaultService.getAutoLockTimeout();
        return { success: true, data: timeout };
      }

      case MESSAGE_TYPES.SET_AUTO_LOCK_TIMEOUT: {
        const { timeout } = payload as { timeout: number };
        await VaultService.setAutoLockTimeout(timeout);
        return { success: true };
      }

      // === RPC Operations ===
      case MESSAGE_TYPES.GET_RPC_URL: {
        const result = await chrome.storage.local.get(STORAGE_KEYS.RPC_URL);
        const rpcUrl = result[STORAGE_KEYS.RPC_URL] as string | undefined;
        return { success: true, data: rpcUrl || OCTRA_CONFIG.RPC_URL };
      }

      case MESSAGE_TYPES.SET_RPC_URL: {
        const { url } = payload as { url: string };
        await chrome.storage.local.set({ [STORAGE_KEYS.RPC_URL]: url });
        OctraRPC.setEndpoint(url);
        return { success: true };
      }

      // === Network Operations ===
      case MESSAGE_TYPES.GET_NETWORK: {
        const result = await chrome.storage.local.get(STORAGE_KEYS.NETWORK);
        const networkId = (result[STORAGE_KEYS.NETWORK] as NetworkId) || 'mainnet';
        return { success: true, data: networkId };
      }

      case MESSAGE_TYPES.SET_NETWORK: {
        const { networkId } = payload as { networkId: NetworkId };
        if (!NETWORKS[networkId]) {
          return { success: false, error: 'Invalid network' };
        }
        await chrome.storage.local.set({ [STORAGE_KEYS.NETWORK]: networkId });
        OctraRPC.setNetwork(networkId);
        return { success: true };
      }

      // === Private Transaction Operations ===
      case MESSAGE_TYPES.GET_PRIVATE_BALANCE: {
        const { address, accountIndex } = payload as { address: string; accountIndex: number };
        if (!VaultService.isUnlocked()) {
          return { success: false, error: 'Wallet is locked' };
        }
        const { privateKey } = VaultService.getPrivateKey(accountIndex);
        const privateBalance = await OctraRPC.getPrivateBalance(address, privateKey);
        return { success: true, data: privateBalance };
      }

      case MESSAGE_TYPES.SEND_PRIVATE_TRANSFER: {
        const { from, to, amount, accountIndex } = payload as {
          from: string;
          to: string;
          amount: number;
          accountIndex: number;
        };

        if (!VaultService.isUnlocked()) {
          return { success: false, error: 'Wallet is locked' };
        }

        // Get sender's private key
        const { privateKey } = VaultService.getPrivateKey(accountIndex);

        // Get recipient's public key
        const toPublicKey = await OctraRPC.getPublicKey(to);
        if (!toPublicKey) {
          return { success: false, error: 'Could not get recipient public key' };
        }

        // Send private transfer
        const result = await OctraRPC.sendPrivateTransfer({
          from,
          to,
          amount,
          fromPrivateKey: privateKey,
          toPublicKey,
        });

        if (result.status === 'accepted') {
          return { success: true, data: { txHash: result.tx_hash } };
        }

        return { success: false, error: result.error || 'Private transfer failed' };
      }

      case MESSAGE_TYPES.GET_PENDING_TRANSFERS: {
        const { address } = payload as { address: string };
        const pending = await OctraRPC.getPendingTransfers(address);
        return { success: true, data: pending };
      }

      case MESSAGE_TYPES.CLAIM_PRIVATE_TRANSFER: {
        const { transferId, accountIndex } = payload as { transferId: string; accountIndex: number };

        if (!VaultService.isUnlocked()) {
          return { success: false, error: 'Wallet is locked' };
        }

        const { privateKey } = VaultService.getPrivateKey(accountIndex);
        const result = await OctraRPC.claimPrivateTransfer(transferId, privateKey);

        if (result.status === 'accepted') {
          return { success: true, data: { txHash: result.tx_hash } };
        }

        return { success: false, error: result.error || 'Claim failed' };
      }

      case MESSAGE_TYPES.GET_PUBLIC_KEY: {
        const { address } = payload as { address: string };
        const publicKey = await OctraRPC.getPublicKey(address);
        return { success: true, data: publicKey };
      }

      case MESSAGE_TYPES.SHIELD_BALANCE: {
        const { address, amount, accountIndex } = payload as {
          address: string;
          amount: number;
          accountIndex: number;
        };

        if (!VaultService.isUnlocked()) {
          return { success: false, error: 'Wallet is locked' };
        }

        const { privateKey } = VaultService.getPrivateKey(accountIndex);
        const result = await OctraRPC.shieldBalance({
          address,
          amount,
          privateKey,
        });

        if (result.status === 'accepted') {
          return { success: true, data: { txHash: result.tx_hash } };
        }

        return { success: false, error: result.error || 'Shield failed' };
      }

      case MESSAGE_TYPES.UNSHIELD_BALANCE: {
        const { address, amount, accountIndex } = payload as {
          address: string;
          amount: number;
          accountIndex: number;
        };

        if (!VaultService.isUnlocked()) {
          return { success: false, error: 'Wallet is locked' };
        }

        const { privateKey } = VaultService.getPrivateKey(accountIndex);
        const result = await OctraRPC.unshieldBalance({
          address,
          amount,
          privateKey,
        });

        if (result.status === 'accepted') {
          return { success: true, data: { txHash: result.tx_hash } };
        }

        return { success: false, error: result.error || 'Unshield failed' };
      }

      // === dApp Operations ===
      case 'DAPP_CONNECT_REQUEST': {
        // For now, auto-approve if wallet is unlocked
        if (!VaultService.isUnlocked()) {
          return { success: false, error: 'Wallet is locked' };
        }
        const accounts = VaultService.getAccounts();
        const activeIndex = await getActiveAccountIndex();
        const account = accounts[activeIndex] || accounts[0];
        if (account) {
          return {
            success: true,
            data: { address: account.address, publicKey: account.publicKey },
          };
        }
        return { success: false, error: 'No accounts available' };
      }

      case 'DAPP_GET_ACCOUNT': {
        if (!VaultService.isUnlocked()) {
          return { success: false, error: 'Wallet is locked' };
        }
        const accounts = VaultService.getAccounts();
        const activeIndex = await getActiveAccountIndex();
        const account = accounts[activeIndex] || accounts[0];
        if (account) {
          return {
            success: true,
            data: { address: account.address, publicKey: account.publicKey },
          };
        }
        return { success: false, error: 'No accounts available' };
      }

      case 'DAPP_GET_ADDRESS': {
        if (!VaultService.isUnlocked()) {
          return { success: false, error: 'Wallet is locked' };
        }
        const accounts = VaultService.getAccounts();
        const activeIndex = await getActiveAccountIndex();
        const account = accounts[activeIndex] || accounts[0];
        return { success: true, data: account?.address || null };
      }

      case 'DAPP_GET_BALANCE': {
        if (!VaultService.isUnlocked()) {
          return { success: false, error: 'Wallet is locked' };
        }
        const accounts = VaultService.getAccounts();
        const activeIndex = await getActiveAccountIndex();
        const account = accounts[activeIndex] || accounts[0];
        if (!account) {
          return { success: false, error: 'No accounts available' };
        }
        const balanceData = await OctraRPC.getBalance(account.address);
        return { success: true, data: balanceData.balance };
      }

      case 'DAPP_SEND_TRANSACTION': {
        const { to, amount } = payload as { to: string; amount: number; origin: string };
        if (!VaultService.isUnlocked()) {
          return { success: false, error: 'Wallet is locked' };
        }

        const accounts = VaultService.getAccounts();
        const activeIndex = await getActiveAccountIndex();
        const account = accounts[activeIndex] || accounts[0];
        if (!account) {
          return { success: false, error: 'No accounts available' };
        }

        const { privateKey, publicKey } = VaultService.getPrivateKey(activeIndex);
        const balanceData = await OctraRPC.getBalance(account.address);
        const nonce = balanceData.nonce + 1;

        const signedTx = TransactionBuilder.buildAndSign({
          from: account.address,
          to,
          amount,
          nonce,
          feeTier: 'LOW',
          privateKey,
          publicKey,
        });

        const result = await OctraRPC.sendTransaction(signedTx);

        if (result.status === 'accepted') {
          return { success: true, data: { txHash: result.tx_hash } };
        }

        return { success: false, error: result.error || 'Transaction failed' };
      }

      case 'DAPP_SEND_PRIVATE_TRANSFER': {
        const { to, amount } = payload as { to: string; amount: number; origin: string };
        if (!VaultService.isUnlocked()) {
          return { success: false, error: 'Wallet is locked' };
        }

        const accounts = VaultService.getAccounts();
        const activeIndex = await getActiveAccountIndex();
        const account = accounts[activeIndex] || accounts[0];
        if (!account) {
          return { success: false, error: 'No accounts available' };
        }

        const { privateKey } = VaultService.getPrivateKey(activeIndex);
        const toPublicKey = await OctraRPC.getPublicKey(to);
        if (!toPublicKey) {
          return { success: false, error: 'Could not get recipient public key' };
        }

        const result = await OctraRPC.sendPrivateTransfer({
          from: account.address,
          to,
          amount,
          fromPrivateKey: privateKey,
          toPublicKey,
        });

        if (result.status === 'accepted') {
          return { success: true, data: { txHash: result.tx_hash } };
        }

        return { success: false, error: result.error || 'Private transfer failed' };
      }

      default:
        return { success: false, error: `Unknown message type: ${type}` };
    }
  } catch (error) {
    console.error('Background error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Initialize message listener
onMessage(handleMessage);

// Load network and RPC URL on startup
async function initNetwork() {
  // First check for custom RPC URL
  const rpcResult = await chrome.storage.local.get(STORAGE_KEYS.RPC_URL);
  const customRpcUrl = rpcResult[STORAGE_KEYS.RPC_URL] as string | undefined;

  if (customRpcUrl) {
    OctraRPC.setEndpoint(customRpcUrl);
  } else {
    // Use network setting
    const networkResult = await chrome.storage.local.get(STORAGE_KEYS.NETWORK);
    const networkId = (networkResult[STORAGE_KEYS.NETWORK] as NetworkId) || 'mainnet';
    OctraRPC.setNetwork(networkId);
  }
}

// Auto-load wallet and network on startup
VaultService.init();
initNetwork();
