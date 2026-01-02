/**
 * Balance Encryption Utils for Octra
 * Uses AES-GCM encryption matching the official octra_pre_client
 */

const SALT_V2 = new TextEncoder().encode('octra_encrypted_balance_v2');

/**
 * Derive encryption key from private key
 * SHA256(salt + privateKeyBytes) truncated to 32 bytes
 */
async function deriveEncryptionKey(privateKeyBase64: string): Promise<CryptoKey> {
  const privateKeyBytes = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));

  // Concatenate salt + privateKey
  const combined = new Uint8Array(SALT_V2.length + privateKeyBytes.length);
  combined.set(SALT_V2, 0);
  combined.set(privateKeyBytes, SALT_V2.length);

  // SHA256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const keyBytes = new Uint8Array(hashBuffer).slice(0, 32);

  // Import as AES-GCM key
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt balance value using AES-GCM
 * Returns format: "v2|" + base64(nonce + ciphertext)
 */
export async function encryptClientBalance(
  balance: number,
  privateKeyBase64: string
): Promise<string> {
  const key = await deriveEncryptionKey(privateKeyBase64);

  // Generate 12-byte nonce
  const nonce = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt balance as string
  const plaintext = new TextEncoder().encode(String(balance));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    plaintext
  );

  // Combine nonce + ciphertext
  const combined = new Uint8Array(nonce.length + ciphertext.byteLength);
  combined.set(nonce, 0);
  combined.set(new Uint8Array(ciphertext), nonce.length);

  // Return as v2 format
  return 'v2|' + btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt balance value from encrypted string
 * Handles both v2 (AES-GCM) and v1 (legacy) formats
 */
export async function decryptClientBalance(
  encryptedData: string,
  privateKeyBase64: string
): Promise<number> {
  if (encryptedData.startsWith('v2|')) {
    // V2 format: AES-GCM
    const data = encryptedData.slice(3); // Remove "v2|" prefix
    const combined = Uint8Array.from(atob(data), c => c.charCodeAt(0));

    const nonce = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const key = await deriveEncryptionKey(privateKeyBase64);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      key,
      ciphertext
    );

    const balanceStr = new TextDecoder().decode(plaintext);
    return parseInt(balanceStr, 10);
  }

  // V1 legacy format - just try to parse as number
  // In production this would need the full v1 decryption logic
  console.warn('V1 encrypted balance format detected, may not decrypt correctly');
  return 0;
}

/**
 * Get raw encrypted balance from server response
 */
export function parseEncryptedBalanceResponse(data: {
  encrypted_balance?: string;
  decrypted_balance?: string;
}): { encryptedRaw: number; hasBalance: boolean } {
  // If server returns decrypted_balance, use that
  if (data.decrypted_balance) {
    return {
      encryptedRaw: parseInt(data.decrypted_balance, 10) || 0,
      hasBalance: true,
    };
  }

  // Otherwise need to decrypt encrypted_balance
  return {
    encryptedRaw: 0,
    hasBalance: !!data.encrypted_balance,
  };
}
