import { encrypt, decrypt, hashToken, verifyWebhookSignature } from '../src/lib/crypto';

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.ENCRYPTION_KEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('crypto', () => {
  describe('encrypt / decrypt', () => {
    it('should encrypt and decrypt a string', () => {
      const original = 'Hello, World!';
      const encrypted = encrypt(original);
      expect(encrypted).not.toBe(original);
      expect(encrypted.split(':').length).toBe(3);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should produce different ciphertexts for same input', () => {
      const original = 'test-value';
      const e1 = encrypt(original);
      const e2 = encrypt(original);
      expect(e1).not.toBe(e2);
    });

    it('should handle empty string', () => {
      const original = '';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should handle long strings', () => {
      const original = 'a'.repeat(10000);
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should throw on invalid encrypted format', () => {
      expect(() => decrypt('invalid-format')).toThrow('Invalid encrypted text format');
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = encrypt('secret-data');
      const parts = encrypted.split(':');
      parts[2] = parts[2].slice(0, -1) + '0';
      expect(() => decrypt(parts.join(':'))).toThrow();
    });

    it('should throw when ENCRYPTION_KEY is missing', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY is not set');
    });
  });

  describe('hashToken', () => {
    it('should produce a hex string of 64 characters', () => {
      const hash = hashToken('my-token');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be deterministic', () => {
      const hash1 = hashToken('same-token');
      const hash2 = hashToken('same-token');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashToken('token-a');
      const hash2 = hashToken('token-b');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify a valid HMAC-SHA256 signature', () => {
      const body = '{"test":"data"}';
      const secret = 'my-app-secret';
      const crypto = require('crypto');
      const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
      expect(verifyWebhookSignature(expectedSig, body, secret)).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const body = '{"test":"data"}';
      const secret = 'my-app-secret';
      expect(verifyWebhookSignature('invalid-signature', body, secret)).toBe(false);
    });

    it('should reject when body is tampered', () => {
      const body = '{"test":"data"}';
      const secret = 'my-app-secret';
      const crypto = require('crypto');
      const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
      expect(verifyWebhookSignature(expectedSig, '{"test":"tampered"}', secret)).toBe(false);
    });
  });
});
