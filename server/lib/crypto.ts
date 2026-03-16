/**
 * AES-256-GCM token encryption utilities for encrypting OAuth tokens at rest.
 *
 * Uses Web Crypto API (available in Cloudflare Workers) with PBKDF2 key
 * derivation from AUTH_SECRET. Each encryption generates a random 12-byte IV.
 *
 * Output format: base64(iv || ciphertext || tag) — stored as text in existing
 * D1 columns. Encrypted values are prefixed with "enc:" to distinguish them
 * from plaintext tokens during migration.
 */

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;
const SALT = new TextEncoder().encode('gh-admin-token-encryption-v1');
const ENCRYPTED_PREFIX = 'enc:';

async function deriveKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt a plaintext token. Returns `enc:<base64(iv + ciphertext)>`. */
export async function encryptToken(
  plaintext: string,
  secret: string,
): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  );
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);
  return ENCRYPTED_PREFIX + btoa(String.fromCharCode(...combined));
}

/** Decrypt an encrypted token. Handles both `enc:` prefixed and plaintext (migration). */
export async function decryptToken(
  stored: string,
  secret: string,
): Promise<string> {
  if (!stored.startsWith(ENCRYPTED_PREFIX)) {
    return stored;
  }
  const key = await deriveKey(secret);
  const raw = Uint8Array.from(
    atob(stored.slice(ENCRYPTED_PREFIX.length)),
    (c) => c.charCodeAt(0),
  );
  const iv = raw.slice(0, IV_LENGTH);
  const ciphertext = raw.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}
