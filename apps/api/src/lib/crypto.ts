import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const TAG_LENGTH = 16; // 128 bits

/**
 * Encrypts a plaintext string using AES-256-GCM with a random IV.
 * Returns a serialized format: iv:authTag:ciphertext (all hex-encoded).
 */
export function encryptToken(text: string, customKeyHex?: string): string {
  if (!text) return '';
  const keyHex = customKeyHex || env.ENCRYPTION_KEY;
  const key = Buffer.from(keyHex, 'hex');

  if (key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (64 hex characters)');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a serialized token (iv:authTag:ciphertext) using AES-256-GCM.
 * Validates authentication tag to detect any tampering.
 */
export function decryptToken(encryptedPayload: string, customKeyHex?: string): string {
  if (!encryptedPayload) return '';
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format. Expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const keyHex = customKeyHex || env.ENCRYPTION_KEY;
  const key = Buffer.from(keyHex, 'hex');

  if (key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (64 hex characters)');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (authTag.length !== TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generates an OAuth state token with a cryptographically secure random nonce
 * and HMAC signature to prevent CSRF during OAuth callback.
 */
export function generateOAuthState(tenantId: string, userId: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const data = JSON.stringify({ tenantId, userId, nonce, timestamp: Date.now() });
  const signature = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(data)
    .digest('hex');
  return Buffer.from(JSON.stringify({ data, signature })).toString('base64url');
}

/**
 * Validates OAuth state token. Returns decoded data or throws an error.
 */
export function verifyOAuthState(stateString: string): { tenantId: string; userId: string; timestamp: number } {
  try {
    const raw = Buffer.from(stateString, 'base64url').toString('utf8');
    const { data, signature } = JSON.parse(raw);
    const expectedSig = crypto
      .createHmac('sha256', env.JWT_SECRET)
      .update(data)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      throw new Error('Invalid OAuth state signature');
    }

    const payload = JSON.parse(data);
    // 15-minute expiry for OAuth callback state
    if (Date.now() - payload.timestamp > 15 * 60 * 1000) {
      throw new Error('OAuth state token expired');
    }

    return payload;
  } catch (err: any) {
    throw new Error(`OAuth state validation failed: ${err.message}`);
  }
}
