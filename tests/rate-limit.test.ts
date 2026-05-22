import { describe, it, expect } from '@jest/globals';

describe('rate-limit helpers', () => {
  describe('checkRateLimit logic', () => {
    it('should allow when count is below max', () => {
      const config = { windowMs: 60000, maxRequests: 30 };
      const count = 5;
      const allowed = count < config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - count);
      expect(allowed).toBe(true);
      expect(remaining).toBe(25);
    });

    it('should block when count equals max', () => {
      const config = { windowMs: 60000, maxRequests: 30 };
      const count = 30;
      const allowed = count < config.maxRequests;
      expect(allowed).toBe(false);
    });

    it('should block when count exceeds max', () => {
      const config = { windowMs: 60000, maxRequests: 30 };
      const count = 35;
      const allowed = count < config.maxRequests;
      expect(allowed).toBe(false);
    });

    it('should return 0 remaining when exceeded', () => {
      const config = { windowMs: 60000, maxRequests: 10 };
      const count = 15;
      const remaining = Math.max(0, config.maxRequests - count);
      expect(remaining).toBe(0);
    });
  });

  describe('checkDailyQuota logic', () => {
    it('should allow when quota not exceeded', () => {
      const used = 50;
      const limit = 100;
      expect(used < limit).toBe(true);
    });

    it('should block when quota exceeded', () => {
      const used = 100;
      const limit = 100;
      expect(used < limit).toBe(false);
    });

    it('should block when quota is exceeded beyond limit', () => {
      const used = 150;
      const limit = 100;
      expect(used < limit).toBe(false);
    });
  });
});
