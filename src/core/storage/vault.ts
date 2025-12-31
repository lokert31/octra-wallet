import { OctraKeyring } from '@core/crypto/keyring';
import { STORAGE_KEYS, WALLET_CONFIG } from '@shared/constants';
import { sha256 } from '@noble/hashes/sha256';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import type { Account, AccountWithPrivateKey } from '@shared/types';

interface WalletData {
  accounts: AccountWithPrivateKey[];
  nextAccountIndex: number;
}

interface EncryptedVault {
  encrypted: string; // base64 encoded encrypted data
  iv: string; // base64 encoded IV
  salt: string; // hex encoded salt for key derivation
}

// Generate random bytes
function generateRandomBytes(length: number): Uint8Array {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return array;
}

// Derive AES key from password using PBKDF2
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  // Use PBKDF2 to derive key material
  const keyMaterial = pbkdf2(sha256, passwordBytes, salt, {
    c: WALLET_CONFIG.PBKDF2_ITERATIONS,
    dkLen: 32, // 256 bits for AES-256
  });

  // Import as AES-GCM key
  return crypto.subtle.importKey(
    'raw',
    keyMaterial.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt data with AES-256-GCM
async function encryptData(data: string, password: string): Promise<EncryptedVault> {
  const salt = generateRandomBytes(32);
  const iv = generateRandomBytes(12); // 96 bits for GCM
  const key = await deriveKey(password, salt);

  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    dataBytes.buffer as ArrayBuffer
  );

  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''),
  };
}

// Decrypt data with AES-256-GCM
async function decryptData(vault: EncryptedVault, password: string): Promise<{ data: string; key: CryptoKey }> {
  const salt = new Uint8Array(vault.salt.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const iv = Uint8Array.from(atob(vault.iv), c => c.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(vault.encrypted), c => c.charCodeAt(0));

  const key = await deriveKey(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encrypted.buffer as ArrayBuffer
  );

  const decoder = new TextDecoder();
  return { data: decoder.decode(decrypted), key };
}

// Decrypt data with pre-derived key (instant)
async function decryptWithKey(vault: EncryptedVault, key: CryptoKey): Promise<string> {
  const iv = Uint8Array.from(atob(vault.iv), c => c.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(vault.encrypted), c => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encrypted.buffer as ArrayBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// Session storage key for temporary password (encrypted by browser)
const SESSION_KEY = 'octra_session';

/**
 * Vault Service - Encrypted storage for wallet data
 * Private keys are encrypted with AES-256-GCM using password-derived key
 */
export class VaultService {
  private static walletData: WalletData | null = null;
  private static currentPassword: string | null = null; // Kept in memory while unlocked
  private static cachedKey: CryptoKey | null = null; // Cached derived key for instant unlock
  private static cachedSalt: string | null = null; // Salt used for cached key

  /**
   * Check if wallet exists
   */
  static async exists(): Promise<boolean> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.VAULT);
    return !!result[STORAGE_KEYS.VAULT];
  }

  /**
   * Initialize - tries to restore session if within auto-lock timeout
   */
  static async init(): Promise<boolean> {
    const exists = await this.exists();
    if (!exists) return false;

    // Try to restore session from session storage
    await this.tryRestoreSession();
    return exists;
  }

  /**
   * Save session to chrome.storage.session (persists across popup closes)
   */
  private static async saveSession(): Promise<void> {
    if (!this.currentPassword) return;

    try {
      await chrome.storage.session.set({
        [SESSION_KEY]: this.currentPassword,
      });
    } catch (e) {
      // Session storage might not be available in all contexts
      console.warn('Could not save session:', e);
    }
  }

  /**
   * Try to restore session from chrome.storage.session
   * Uses cached key for instant unlock when available
   */
  private static async tryRestoreSession(): Promise<boolean> {
    try {
      // Check if we should auto-lock first
      const shouldLock = await this.shouldAutoLock();
      if (shouldLock) {
        // Clear session and cached key if timeout expired
        await chrome.storage.session.remove(SESSION_KEY);
        this.cachedKey = null;
        this.cachedSalt = null;
        return false;
      }

      // Try to get stored password from session
      const result = await chrome.storage.session.get(SESSION_KEY);
      const password = result[SESSION_KEY] as string | undefined;

      if (!password) return false;

      // Try to unlock with stored password
      const vaultResult = await chrome.storage.local.get(STORAGE_KEYS.VAULT);
      if (!vaultResult[STORAGE_KEYS.VAULT]) return false;

      const encryptedVault = vaultResult[STORAGE_KEYS.VAULT] as EncryptedVault;

      try {
        // Check if we have a cached key for this vault
        if (this.cachedKey && this.cachedSalt === encryptedVault.salt) {
          // INSTANT unlock with cached key
          const decryptedData = await decryptWithKey(encryptedVault, this.cachedKey);
          this.walletData = JSON.parse(decryptedData) as WalletData;
          this.currentPassword = password;
          return true;
        }

        // No cached key - derive it (slow, but cache for next time)
        const { data, key } = await decryptData(encryptedVault, password);
        this.walletData = JSON.parse(data) as WalletData;
        this.currentPassword = password;
        this.cachedKey = key;
        this.cachedSalt = encryptedVault.salt;
        return true;
      } catch {
        // Password invalid or decryption failed - clear session
        await chrome.storage.session.remove(SESSION_KEY);
        this.cachedKey = null;
        this.cachedSalt = null;
        return false;
      }
    } catch (e) {
      console.warn('Could not restore session:', e);
      return false;
    }
  }

  /**
   * Clear session (on lock or logout)
   */
  private static async clearSession(): Promise<void> {
    try {
      await chrome.storage.session.remove(SESSION_KEY);
    } catch (e) {
      console.warn('Could not clear session:', e);
    }
  }

  /**
   * Validate password complexity
   */
  private static validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber) {
      throw new Error('Password must contain uppercase, lowercase and numbers');
    }
  }

  /**
   * Create a new wallet with first account (with mnemonic)
   * Requires password to encrypt the vault
   */
  static async create(password: string): Promise<{ account: Account; mnemonic: string; privateKey: string }> {
    this.validatePassword(password);

    const { mnemonic, privateKey, publicKey, address } = OctraKeyring.generateWithMnemonic();

    const account: AccountWithPrivateKey = {
      index: 0,
      name: `${WALLET_CONFIG.DEFAULT_ACCOUNT_NAME} 1`,
      address,
      publicKey,
      privateKey,
    };

    this.walletData = {
      accounts: [account],
      nextAccountIndex: 1,
    };

    this.currentPassword = password;
    await this.save();

    return {
      account: {
        index: account.index,
        name: account.name,
        address: account.address,
        publicKey: account.publicKey,
      },
      mnemonic,
      privateKey,
    };
  }

  /**
   * Import wallet from private key (supports hex/base64)
   * Requires password to encrypt the vault
   */
  static async import(privateKeyInput: string, password: string): Promise<Account> {
    this.validatePassword(password);

    const { privateKey, publicKey, address } = OctraKeyring.fromPrivateKey(privateKeyInput);

    const account: AccountWithPrivateKey = {
      index: 0,
      name: `${WALLET_CONFIG.DEFAULT_ACCOUNT_NAME} 1`,
      address,
      publicKey,
      privateKey,
    };

    this.walletData = {
      accounts: [account],
      nextAccountIndex: 1,
    };

    this.currentPassword = password;
    await this.save();

    return {
      index: account.index,
      name: account.name,
      address: account.address,
      publicKey: account.publicKey,
    };
  }

  /**
   * Import wallet from mnemonic
   * Requires password to encrypt the vault
   */
  static async importFromMnemonic(mnemonic: string, password: string): Promise<Account> {
    this.validatePassword(password);

    const { privateKey, publicKey, address } = OctraKeyring.fromMnemonic(mnemonic);

    const account: AccountWithPrivateKey = {
      index: 0,
      name: `${WALLET_CONFIG.DEFAULT_ACCOUNT_NAME} 1`,
      address,
      publicKey,
      privateKey,
    };

    this.walletData = {
      accounts: [account],
      nextAccountIndex: 1,
    };

    this.currentPassword = password;
    await this.save();

    return {
      index: account.index,
      name: account.name,
      address: account.address,
      publicKey: account.publicKey,
    };
  }

  /**
   * Check if wallet is loaded and decrypted
   */
  static isUnlocked(): boolean {
    return this.walletData !== null && this.currentPassword !== null;
  }

  /**
   * Unlock wallet with password (decrypt)
   * Uses cached key for instant unlock when available
   */
  static async unlock(password: string): Promise<Account[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.VAULT);
    if (!result[STORAGE_KEYS.VAULT]) {
      throw new Error('No wallet found');
    }

    const encryptedVault = result[STORAGE_KEYS.VAULT] as EncryptedVault;

    try {
      let data: string;

      // Try to use cached key for INSTANT unlock
      if (this.cachedKey && this.cachedSalt === encryptedVault.salt) {
        data = await decryptWithKey(encryptedVault, this.cachedKey);
      } else {
        // No cached key - derive it (slow, but cache for next time)
        const result = await decryptData(encryptedVault, password);
        data = result.data;
        this.cachedKey = result.key;
        this.cachedSalt = encryptedVault.salt;
      }

      this.walletData = JSON.parse(data) as WalletData;
      this.currentPassword = password;
      await this.updateActivity();
      await this.saveSession();
      return this.getAccounts();
    } catch {
      // If cached key failed, try with password
      if (this.cachedKey) {
        this.cachedKey = null;
        this.cachedSalt = null;
        return this.unlock(password); // Retry without cache
      }
      throw new Error('Invalid password');
    }
  }

  /**
   * Lock wallet (clear wallet data but keep cached key for quick re-unlock)
   */
  static async lock(): Promise<void> {
    this.walletData = null;
    this.currentPassword = null;
    // NOTE: Keep cachedKey and cachedSalt for instant re-unlock after lock
    // They are only cleared on auto-lock timeout or password change
    await this.clearSession();
  }

  /**
   * Get all accounts (without private keys)
   */
  static getAccounts(): Account[] {
    if (!this.walletData) {
      throw new Error('Wallet is not loaded');
    }

    return this.walletData.accounts.map(({ index, name, address, publicKey }) => ({
      index,
      name,
      address,
      publicKey,
    }));
  }

  /**
   * Add new generated account
   */
  static async addAccount(name?: string): Promise<Account> {
    if (!this.walletData) {
      throw new Error('Wallet is not loaded');
    }

    if (this.walletData.accounts.length >= WALLET_CONFIG.MAX_ACCOUNTS) {
      throw new Error(`Maximum ${WALLET_CONFIG.MAX_ACCOUNTS} accounts allowed`);
    }

    const { privateKey, publicKey, address } = OctraKeyring.generate();

    const account: AccountWithPrivateKey = {
      index: this.walletData.nextAccountIndex,
      name: name || `${WALLET_CONFIG.DEFAULT_ACCOUNT_NAME} ${this.walletData.nextAccountIndex + 1}`,
      address,
      publicKey,
      privateKey,
    };

    this.walletData.accounts.push(account);
    this.walletData.nextAccountIndex++;

    await this.save();

    return {
      index: account.index,
      name: account.name,
      address: account.address,
      publicKey: account.publicKey,
    };
  }

  /**
   * Import account from private key (add to existing wallet)
   */
  static async importAccount(privateKeyInput: string, name?: string): Promise<Account> {
    if (!this.walletData) {
      throw new Error('Wallet is not loaded');
    }

    if (this.walletData.accounts.length >= WALLET_CONFIG.MAX_ACCOUNTS) {
      throw new Error(`Maximum ${WALLET_CONFIG.MAX_ACCOUNTS} accounts allowed`);
    }

    const { privateKey, publicKey, address } = OctraKeyring.fromPrivateKey(privateKeyInput);

    // Check if address already exists
    if (this.walletData.accounts.some((a) => a.address === address)) {
      throw new Error('This account already exists');
    }

    const account: AccountWithPrivateKey = {
      index: this.walletData.nextAccountIndex,
      name: name || `${WALLET_CONFIG.DEFAULT_ACCOUNT_NAME} ${this.walletData.nextAccountIndex + 1}`,
      address,
      publicKey,
      privateKey,
    };

    this.walletData.accounts.push(account);
    this.walletData.nextAccountIndex++;

    await this.save();

    return {
      index: account.index,
      name: account.name,
      address: account.address,
      publicKey: account.publicKey,
    };
  }

  /**
   * Import account from mnemonic (add to existing wallet)
   */
  static async importAccountFromMnemonic(mnemonic: string, name?: string): Promise<Account> {
    if (!this.walletData) {
      throw new Error('Wallet is not loaded');
    }

    if (this.walletData.accounts.length >= WALLET_CONFIG.MAX_ACCOUNTS) {
      throw new Error(`Maximum ${WALLET_CONFIG.MAX_ACCOUNTS} accounts allowed`);
    }

    const { privateKey, publicKey, address } = OctraKeyring.fromMnemonic(mnemonic);

    // Check if address already exists
    if (this.walletData.accounts.some((a) => a.address === address)) {
      throw new Error('This account already exists');
    }

    const account: AccountWithPrivateKey = {
      index: this.walletData.nextAccountIndex,
      name: name || `${WALLET_CONFIG.DEFAULT_ACCOUNT_NAME} ${this.walletData.nextAccountIndex + 1}`,
      address,
      publicKey,
      privateKey,
    };

    this.walletData.accounts.push(account);
    this.walletData.nextAccountIndex++;

    await this.save();

    return {
      index: account.index,
      name: account.name,
      address: account.address,
      publicKey: account.publicKey,
    };
  }

  /**
   * Remove account
   */
  static async removeAccount(index: number): Promise<void> {
    if (!this.walletData) {
      throw new Error('Wallet is not loaded');
    }

    if (this.walletData.accounts.length <= 1) {
      throw new Error('Cannot remove the last account');
    }

    const accountIndex = this.walletData.accounts.findIndex((a) => a.index === index);
    if (accountIndex === -1) {
      throw new Error('Account not found');
    }

    this.walletData.accounts.splice(accountIndex, 1);
    await this.save();
  }

  /**
   * Rename account
   */
  static async renameAccount(index: number, name: string): Promise<void> {
    if (!this.walletData) {
      throw new Error('Wallet is not loaded');
    }

    const account = this.walletData.accounts.find((a) => a.index === index);
    if (!account) {
      throw new Error('Account not found');
    }

    account.name = name;
    await this.save();
  }

  /**
   * Get private key for signing (internal use only)
   */
  static getPrivateKey(index: number): { privateKey: string; publicKey: string } {
    if (!this.walletData) {
      throw new Error('Wallet is not loaded');
    }

    const account = this.walletData.accounts.find((a) => a.index === index);
    if (!account) {
      throw new Error('Account not found');
    }

    return {
      privateKey: account.privateKey,
      publicKey: account.publicKey,
    };
  }

  /**
   * Export private key
   */
  static exportPrivateKey(index: number): string {
    if (!this.walletData) {
      throw new Error('Wallet is not loaded');
    }

    const account = this.walletData.accounts.find((a) => a.index === index);
    if (!account) {
      throw new Error('Account not found');
    }

    return account.privateKey;
  }

  /**
   * Reset wallet (delete all data)
   */
  static async reset(): Promise<void> {
    this.walletData = null;
    await chrome.storage.local.remove(STORAGE_KEYS.VAULT);
  }

  // Private helper - encrypts and saves wallet data
  private static async save(): Promise<void> {
    if (!this.walletData || !this.currentPassword) {
      throw new Error('Cannot save: wallet not loaded or no password');
    }

    const dataStr = JSON.stringify(this.walletData);
    const encryptedVault = await encryptData(dataStr, this.currentPassword);
    await chrome.storage.local.set({ [STORAGE_KEYS.VAULT]: encryptedVault });
  }

  /**
   * Verify password by attempting to decrypt
   */
  static async verifyPassword(password: string): Promise<boolean> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.VAULT);
    if (!result[STORAGE_KEYS.VAULT]) {
      return false;
    }

    try {
      const encryptedVault = result[STORAGE_KEYS.VAULT] as EncryptedVault;
      await decryptData(encryptedVault, password);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Change password - re-encrypt vault with new password
   */
  static async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    // Verify old password
    if (!await this.verifyPassword(oldPassword)) {
      throw new Error('Invalid current password');
    }

    // Validate new password
    this.validatePassword(newPassword);

    // Decrypt with old password
    const result = await chrome.storage.local.get(STORAGE_KEYS.VAULT);
    const encryptedVault = result[STORAGE_KEYS.VAULT] as EncryptedVault;
    const { data: decryptedData } = await decryptData(encryptedVault, oldPassword);

    // Re-encrypt with new password
    const newEncryptedVault = await encryptData(decryptedData, newPassword);
    await chrome.storage.local.set({ [STORAGE_KEYS.VAULT]: newEncryptedVault });

    // Update current password and clear cached key (salt changed)
    if (this.isUnlocked()) {
      this.currentPassword = newPassword;
      this.cachedKey = null;
      this.cachedSalt = null;
    }
  }

  // === Auto-lock Management ===

  /**
   * Update last activity timestamp
   */
  static async updateActivity(): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.LAST_ACTIVITY]: Date.now() });
  }

  /**
   * Get auto-lock timeout setting (in minutes, 0 = disabled)
   */
  static async getAutoLockTimeout(): Promise<number> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.AUTO_LOCK_TIMEOUT);
    const timeout = result[STORAGE_KEYS.AUTO_LOCK_TIMEOUT] as number | undefined;
    return timeout !== undefined ? timeout : WALLET_CONFIG.DEFAULT_AUTO_LOCK_TIMEOUT;
  }

  /**
   * Set auto-lock timeout (in minutes, 0 = disabled)
   */
  static async setAutoLockTimeout(minutes: number): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.AUTO_LOCK_TIMEOUT]: minutes });
  }

  /**
   * Check if should auto-lock based on inactivity
   */
  static async shouldAutoLock(): Promise<boolean> {
    const timeout = await this.getAutoLockTimeout();

    // If timeout is 0, auto-lock is disabled
    if (timeout === 0) return false;

    const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_ACTIVITY);
    const lastActivity = result[STORAGE_KEYS.LAST_ACTIVITY] as number | undefined;

    if (!lastActivity) return false;

    const timeoutMs = timeout * 60 * 1000; // Convert to ms
    return Date.now() - lastActivity > timeoutMs;
  }
}
