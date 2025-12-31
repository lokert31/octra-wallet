import { OCTRA_CONFIG } from '@shared/constants';
import type {
  BalanceResponse,
  SendTxResponse,
  AddressInfoResponse,
  SignedTransaction,
} from '@shared/types';

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
}
