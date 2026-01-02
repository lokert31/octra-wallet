import { OCTRA_CONFIG, NETWORKS, type NetworkId } from '@shared/constants';
import type {
  BalanceResponse,
  SendTxResponse,
  AddressInfoResponse,
  SignedTransaction,
  PrivateBalanceResponse,
  PendingTransfer,
} from '@shared/types';
import { encryptClientBalance } from '@core/crypto/balance-encryption';

/**
 * Octra RPC Client
 */
export class OctraRPC {
  private static baseUrl: string = OCTRA_CONFIG.RPC_URL;

  /**
   * Set custom RPC endpoint
   */
  static setEndpoint(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Get balance and nonce for an address
   */
  static async getBalance(address: string): Promise<BalanceResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/balance/${address}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 404) {
        // Address not found, return zero balance
        return { balance: '0', nonce: 0 };
      }

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      return {
        balance: String(data.balance || '0'),
        nonce: parseInt(data.nonce || '0'),
      };
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw new Error('Failed to fetch balance from network');
    }
  }

  /**
   * Get detailed address info
   */
  static async getAddressInfo(address: string): Promise<AddressInfoResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/address/${address}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get address info:', error);
      return null;
    }
  }

  /**
   * Send a signed transaction
   */
  static async sendTransaction(tx: SignedTransaction): Promise<SendTxResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/send-tx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx),
      });

      const text = await response.text();

      // Try to parse as JSON
      let data: { status?: string; tx_hash?: string; error?: string } | null = null;
      try {
        data = JSON.parse(text);
      } catch {
        // Not JSON, check if it's a success text response
        if (text.toLowerCase().startsWith('ok')) {
          return {
            status: 'accepted',
            tx_hash: text.split(' ').pop() || '',
          };
        }
      }

      if (response.ok && data?.status === 'accepted') {
        return {
          status: 'accepted',
          tx_hash: data.tx_hash,
        };
      }

      // Return error from response
      const errorMsg = data?.error || text || 'Transaction failed';
      return {
        status: 'failed',
        error: errorMsg,
      };
    } catch (error) {
      console.error('Failed to send transaction:', error);
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Get transaction details by hash
   */
  static async getTransaction(hash: string): Promise<unknown | null> {
    try {
      const response = await fetch(`${this.baseUrl}/tx/${hash}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Get staging (pending) transactions
   */
  static async getStaging(): Promise<{ staged_transactions: unknown[] } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/staging`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Format balance from micro-units to display
   */
  static formatBalance(balanceMicro: string): string {
    const balance = parseInt(balanceMicro) || 0;
    return (balance / Math.pow(10, OCTRA_CONFIG.TOKEN_DECIMALS)).toFixed(
      OCTRA_CONFIG.TOKEN_DECIMALS
    );
  }

  /**
   * Parse balance to number
   */
  static parseBalance(balanceMicro: string): number {
    const balance = parseInt(balanceMicro) || 0;
    return balance / Math.pow(10, OCTRA_CONFIG.TOKEN_DECIMALS);
  }

  /**
   * Get public key for an address (needed for private transfers)
   */
  static async getPublicKey(address: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/public_key/${address}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.public_key || null;
    } catch {
      return null;
    }
  }

  /**
   * Get encrypted private balance
   */
  static async getPrivateBalance(address: string, privateKey: string): Promise<PrivateBalanceResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/view_encrypted_balance/${address}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Private-Key': privateKey,
        },
      });

      if (!response.ok) {
        return { has_private_balance: false };
      }

      const data = await response.json();
      return {
        encrypted_balance: data.encrypted_balance,
        decrypted_balance: data.decrypted_balance,
        has_private_balance: !!data.encrypted_balance || !!data.decrypted_balance,
      };
    } catch {
      return { has_private_balance: false };
    }
  }

  /**
   * Send private transfer
   */
  static async sendPrivateTransfer(data: {
    from: string;
    to: string;
    amount: number;
    fromPrivateKey: string;
    toPublicKey: string;
  }): Promise<SendTxResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/private_transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: data.from,
          to: data.to,
          amount: Math.floor(data.amount * Math.pow(10, OCTRA_CONFIG.TOKEN_DECIMALS)),
          from_private_key: data.fromPrivateKey,
          to_public_key: data.toPublicKey,
        }),
      });

      const result = await response.json();

      if (response.ok && result.status === 'accepted') {
        return { status: 'accepted', tx_hash: result.tx_hash };
      }

      return { status: 'failed', error: result.error || 'Private transfer failed' };
    } catch (error) {
      return { status: 'failed', error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  /**
   * Get pending private transfers
   */
  static async getPendingTransfers(address: string): Promise<PendingTransfer[]> {
    try {
      const response = await fetch(`${this.baseUrl}/pending_private_transfers?address=${address}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) return [];
      const data = await response.json();
      return data.pending_transfers || [];
    } catch {
      return [];
    }
  }

  /**
   * Claim private transfer
   */
  static async claimPrivateTransfer(transferId: string, privateKey: string): Promise<SendTxResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/claim_private_transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transfer_id: transferId,
          private_key: privateKey,
        }),
      });

      const result = await response.json();

      if (response.ok && result.status === 'accepted') {
        return { status: 'accepted', tx_hash: result.tx_hash };
      }

      return { status: 'failed', error: result.error || 'Claim failed' };
    } catch (error) {
      return { status: 'failed', error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  /**
   * Encrypt Balance - convert public balance to encrypted (private) balance
   * This is the Octra equivalent of "shield"
   */
  static async encryptBalance(data: {
    address: string;
    amount: number;
    privateKey: string;
  }): Promise<SendTxResponse> {
    try {
      // First get current encrypted balance
      const encData = await this.getPrivateBalance(data.address, data.privateKey);
      const currentRaw = encData.decrypted_balance ? parseInt(encData.decrypted_balance, 10) : 0;

      // Calculate new encrypted total (current + amount)
      const amountRaw = Math.floor(data.amount * Math.pow(10, OCTRA_CONFIG.TOKEN_DECIMALS));
      const newRaw = currentRaw + amountRaw;

      // Encrypt the new balance
      const encryptedData = await encryptClientBalance(newRaw, data.privateKey);

      const response = await fetch(`${this.baseUrl}/encrypt_balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: data.address,
          amount: String(amountRaw),
          private_key: data.privateKey,
          encrypted_data: encryptedData,
        }),
      });

      const result = await response.json();

      if (response.ok && (result.status === 'accepted' || result.tx_hash || result.success)) {
        return { status: 'accepted', tx_hash: result.tx_hash || result.hash || 'success' };
      }

      return { status: 'failed', error: result.error || result.message || 'Encrypt balance failed' };
    } catch (error) {
      return { status: 'failed', error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  /**
   * Decrypt Balance - convert encrypted (private) balance back to public balance
   * This is the Octra equivalent of "unshield"
   */
  static async decryptBalance(data: {
    address: string;
    amount: number;
    privateKey: string;
  }): Promise<SendTxResponse> {
    try {
      // First get current encrypted balance
      const encData = await this.getPrivateBalance(data.address, data.privateKey);
      const currentRaw = encData.decrypted_balance ? parseInt(encData.decrypted_balance, 10) : 0;

      const amountRaw = Math.floor(data.amount * Math.pow(10, OCTRA_CONFIG.TOKEN_DECIMALS));

      // Check sufficient balance
      if (currentRaw < amountRaw) {
        return { status: 'failed', error: 'Insufficient encrypted balance' };
      }

      // Calculate new encrypted total (current - amount)
      const newRaw = currentRaw - amountRaw;

      // Encrypt the new balance
      const encryptedData = await encryptClientBalance(newRaw, data.privateKey);

      const response = await fetch(`${this.baseUrl}/decrypt_balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: data.address,
          amount: String(amountRaw),
          private_key: data.privateKey,
          encrypted_data: encryptedData,
        }),
      });

      const result = await response.json();

      if (response.ok && (result.status === 'accepted' || result.tx_hash || result.success)) {
        return { status: 'accepted', tx_hash: result.tx_hash || result.hash || 'success' };
      }

      return { status: 'failed', error: result.error || result.message || 'Decrypt balance failed' };
    } catch (error) {
      return { status: 'failed', error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  /**
   * @deprecated Use encryptBalance instead
   */
  static async shieldBalance(data: {
    address: string;
    amount: number;
    privateKey: string;
  }): Promise<SendTxResponse> {
    return this.encryptBalance(data);
  }

  /**
   * @deprecated Use decryptBalance instead
   */
  static async unshieldBalance(data: {
    address: string;
    amount: number;
    privateKey: string;
  }): Promise<SendTxResponse> {
    return this.decryptBalance(data);
  }

  /**
   * Set network (mainnet/testnet)
   */
  static setNetwork(networkId: NetworkId): void {
    const network = NETWORKS[networkId];
    if (network) {
      this.baseUrl = network.rpcUrl;
    }
  }

  /**
   * Get current endpoint
   */
  static getEndpoint(): string {
    return this.baseUrl;
  }
}
