import { createFallbackResponse } from '../src/lib/ai/openrouter';

describe('openrouter', () => {
  describe('createFallbackResponse', () => {
    it('should return a fallback message', async () => {
      const result = await createFallbackResponse();
      expect(result).toBe("Thanks for your message! We'll get back to you shortly.");
    });
  });
});
