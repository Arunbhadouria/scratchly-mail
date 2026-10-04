import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken, generateOAuthState, verifyOAuthState } from '../src/lib/crypto.js';

describe('Crypto & Token Encryption Module (AES-256-GCM)', () => {
  const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('should encrypt and decrypt a plaintext token accurately', () => {
    const originalToken = 'ya29.a0AfH6SMDh_fake_google_refresh_token_12345';
    const encrypted = encryptToken(originalToken, testKey);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(originalToken);
    expect(encrypted.split(':').length).toBe(3); // iv : tag : ciphertext

    const decrypted = decryptToken(encrypted, testKey);
    expect(decrypted).toBe(originalToken);
  });

  it('should throw an error if the auth tag is tampered with', () => {
    const originalToken = 'secret-refresh-token';
    const encrypted = encryptToken(originalToken, testKey);
    const [iv, tag, ciphertext] = encrypted.split(':');

    // Alter a byte in the tag
    const tamperedTag = tag.slice(0, -2) + 'ff';
    const tamperedPayload = `${iv}:${tamperedTag}:${ciphertext}`;

    expect(() => decryptToken(tamperedPayload, testKey)).toThrow();
  });

  it('should generate and verify OAuth state parameters with HMAC signature', () => {
    const tenantId = 'tenant-123';
    const userId = 'user-456';

    const state = generateOAuthState(tenantId, userId);
    expect(typeof state).toBe('string');

    const decoded = verifyOAuthState(state);
    expect(decoded.tenantId).toBe(tenantId);
    expect(decoded.userId).toBe(userId);
    expect(typeof decoded.timestamp).toBe('number');
  });

  it('should reject tampered OAuth state tokens', () => {
    const state = generateOAuthState('tenant-1', 'user-1');
    const tampered = state + 'tampered';

    expect(() => verifyOAuthState(tampered)).toThrow();
  });
});
