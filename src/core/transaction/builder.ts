import { OctraKeyring } from '@core/crypto/keyring';
import { OCTRA_CONFIG, FEE_TIERS } from '@shared/constants';
import type { OctraTransaction, SignedTransaction } from '@shared/types';

export class TransactionBuilder {

  static build(params: {
    from: string;
    to: string;
    amount: number;
    nonce: number;
    feeTier?: keyof typeof FEE_TIERS;
  }): OctraTransaction {
    const { from, to, amount, nonce, feeTier = 'LOW' } = params;

    const amountMicro = Math.floor(amount * Math.pow(10, OCTRA_CONFIG.TOKEN_DECIMALS));
    const ou = String(FEE_TIERS[feeTier].ou);

    return {
      from,
      to_: to,
      amount: String(amountMicro),
      nonce,
      ou,
      timestamp: Date.now() / 1000,
    };
  }

  // sign tx - key order matters here!
  static sign(
    tx: OctraTransaction,
    privateKeyBase64: string,
    publicKeyBase64: string
  ): SignedTransaction {
    // must match official client format exactly
    const message = `{"from":"${tx.from}","to_":"${tx.to_}","amount":"${tx.amount}","nonce":${tx.nonce},"ou":"${tx.ou}","timestamp":${tx.timestamp}}`;
    const messageBytes = new TextEncoder().encode(message);

    const signatureBytes = OctraKeyring.sign(messageBytes, privateKeyBase64);
    const signature = OctraKeyring.toBase64(signatureBytes);

    return {
      ...tx,
      signature,
      public_key: publicKeyBase64,
    };
  }

  static buildAndSign(params: {
    from: string;
    to: string;
    amount: number;
    nonce: number;
    feeTier?: keyof typeof FEE_TIERS;
    privateKey: string;
    publicKey: string;
  }): SignedTransaction {
    const { privateKey, publicKey, ...txParams } = params;
    const tx = this.build(txParams);
    return this.sign(tx, privateKey, publicKey);
  }

  static calculateFee(feeTier: keyof typeof FEE_TIERS = 'LOW'): number {
    return FEE_TIERS[feeTier].fee;
  }

  static validate(params: {
    to: string;
    amount: number;
    balance: number;
    feeTier?: keyof typeof FEE_TIERS;
  }): { valid: boolean; error?: string } {
    const { to, amount, balance, feeTier = 'LOW' } = params;

    if (!OctraKeyring.isValidAddress(to)) {
      return { valid: false, error: 'Invalid recipient address' };
    }

    if (amount <= 0) {
      return { valid: false, error: 'Amount must be greater than 0' };
    }

    const minAmount = 1 / Math.pow(10, OCTRA_CONFIG.TOKEN_DECIMALS);
    if (amount < minAmount) {
      return { valid: false, error: `Minimum amount is ${minAmount} ${OCTRA_CONFIG.TOKEN_SYMBOL}` };
    }

    const fee = this.calculateFee(feeTier);
    if (amount + fee > balance) {
      return { valid: false, error: 'Insufficient balance' };
    }

    return { valid: true };
  }

  static formatAmount(amountMicro: string | number): string {
    const amount = typeof amountMicro === 'string' ? parseInt(amountMicro) : amountMicro;
    return (amount / Math.pow(10, OCTRA_CONFIG.TOKEN_DECIMALS)).toFixed(OCTRA_CONFIG.TOKEN_DECIMALS);
  }

  static parseAmount(amountString: string): number {
    const parsed = parseFloat(amountString);
    if (isNaN(parsed)) throw new Error('Invalid amount');
    return parsed;
  }
}
