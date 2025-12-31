import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { hmac } from '@noble/hashes/hmac';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { OCTRA_CONFIG } from '@shared/constants';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

// Ed25519 key management for Octra
export class OctraKeyring {

  static generate(): { privateKey: string; publicKey: string; address: string } {
    const keypair = nacl.sign.keyPair();
    return {
      privateKey: this.toBase64(keypair.secretKey),
      publicKey: this.toBase64(keypair.publicKey),
      address: this.publicKeyToAddress(keypair.publicKey),
    };
  }

  static generateWithMnemonic(): { mnemonic: string; privateKey: string; publicKey: string; address: string } {
    const mnemonic = generateMnemonic(wordlist, 128); // 12 words
    const wallet = this.fromMnemonic(mnemonic);
    return { mnemonic, ...wallet };
  }

  // auto-detect base64 or hex
  static fromPrivateKey(privateKeyInput: string): { privateKey: string; publicKey: string; address: string } {
    const trimmed = privateKeyInput.trim();
    let secretKeyBytes: Uint8Array;

    if (this.isHex(trimmed)) {
      secretKeyBytes = this.fromHex(trimmed);
    } else {
      try {
        secretKeyBytes = this.fromBase64(trimmed);
      } catch {
        throw new Error('Invalid private key format. Use base64 or hex.');
      }
    }

    return this.fromSecretKeyBytes(secretKeyBytes);
  }

  static fromSecretKeyBytes(secretKey: Uint8Array): { privateKey: string; publicKey: string; address: string } {
    let fullSecretKey: Uint8Array;
    let publicKey: Uint8Array;

    if (secretKey.length === 32) {
      // 32-byte seed
      const keypair = nacl.sign.keyPair.fromSeed(secretKey);
      fullSecretKey = keypair.secretKey;
      publicKey = keypair.publicKey;
    } else if (secretKey.length === 64) {
      // full 64-byte secret key
      fullSecretKey = secretKey;
      publicKey = secretKey.slice(32);
    } else {
      throw new Error(`Invalid private key length: ${secretKey.length}`);
    }

    return {
      privateKey: this.toBase64(fullSecretKey),
      publicKey: this.toBase64(publicKey),
      address: this.publicKeyToAddress(publicKey),
    };
  }

  // BIP39 mnemonic -> Octra wallet
  // derivation: mnemonic -> PBKDF2 seed -> HMAC-SHA512("Octra seed") -> Ed25519
  static fromMnemonic(mnemonic: string): { privateKey: string; publicKey: string; address: string } {
    const words = mnemonic.trim().toLowerCase().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      throw new Error('Mnemonic must be 12 or 24 words');
    }

    const normalizedMnemonic = words.join(' ');
    const encoder = new TextEncoder();

    // BIP39 seed
    const seed = pbkdf2(sha512, encoder.encode(normalizedMnemonic), encoder.encode('mnemonic'), {
      c: 2048,
      dkLen: 64,
    });

    // Octra specific derivation
    const mac = hmac(sha512, encoder.encode('Octra seed'), seed);
    const masterPrivateKey = mac.slice(0, 32);

    const keypair = nacl.sign.keyPair.fromSeed(masterPrivateKey);
    return {
      privateKey: this.toBase64(keypair.secretKey),
      publicKey: this.toBase64(keypair.publicKey),
      address: this.publicKeyToAddress(keypair.publicKey),
    };
  }

  // address = "oct" + base58(sha256(publicKey))
  static publicKeyToAddress(publicKey: Uint8Array): string {
    const hash = sha256(publicKey);
    return OCTRA_CONFIG.ADDRESS_PREFIX + bs58.encode(hash);
  }

  static isValidAddress(address: string): boolean {
    if (!address.startsWith(OCTRA_CONFIG.ADDRESS_PREFIX)) return false;
    try {
      const decoded = bs58.decode(address.slice(OCTRA_CONFIG.ADDRESS_PREFIX.length));
      return decoded.length === 32;
    } catch {
      return false;
    }
  }

  static verifyAddressMatchesPublicKey(address: string, publicKey: Uint8Array): boolean {
    return address === this.publicKeyToAddress(publicKey);
  }

  static sign(message: Uint8Array, secretKeyBase64: string): Uint8Array {
    const secretKey = this.fromBase64(secretKeyBase64);
    return nacl.sign.detached(message, secretKey);
  }

  static verify(message: Uint8Array, signature: Uint8Array, publicKeyBase64: string): boolean {
    const publicKey = this.fromBase64(publicKeyBase64);
    return nacl.sign.detached.verify(message, signature, publicKey);
  }

  static addressToHash(address: string): Uint8Array {
    if (!address.startsWith(OCTRA_CONFIG.ADDRESS_PREFIX)) {
      throw new Error('Invalid address format');
    }
    return bs58.decode(address.slice(OCTRA_CONFIG.ADDRESS_PREFIX.length));
  }

  static isHex(str: string): boolean {
    return /^[0-9a-fA-F]{64}$/.test(str) || /^[0-9a-fA-F]{128}$/.test(str);
  }

  static toBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
  }

  static fromBase64(str: string): Uint8Array {
    try {
      return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
    } catch {
      throw new Error('Invalid base64 string');
    }
  }

  static toHex(bytes: Uint8Array): string {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  static fromHex(hex: string): Uint8Array {
    const cleanHex = hex.replace(/^0x/, '');
    const matches = cleanHex.match(/.{1,2}/g);
    if (!matches) throw new Error('Invalid hex string');
    return Uint8Array.from(matches.map((byte) => parseInt(byte, 16)));
  }
}
