import { buildSystemPrompt, buildConversationContext } from '../src/lib/ai/prompts';

describe('prompts', () => {
  describe('buildSystemPrompt', () => {
    const businessInfo = { name: 'Test Store', description: 'An online store' };

    it('should include business name and description', () => {
      const result = buildSystemPrompt(businessInfo, [], { system_prompt: null, greeting_message: null });
      expect(result).toContain('Test Store');
      expect(result).toContain('An online store');
    });

    it('should include knowledge base entries', () => {
      const kb = [
        { category: 'faq', title: 'Return Policy', content: '30-day returns' },
        { category: 'pricing', title: 'Shipping', content: 'Free over $50' },
      ];
      const result = buildSystemPrompt(businessInfo, kb, { system_prompt: null, greeting_message: null });
      expect(result).toContain('[FAQ]');
      expect(result).toContain('Return Policy');
      expect(result).toContain('30-day returns');
      expect(result).toContain('[PRICING]');
      expect(result).toContain('Free over $50');
    });

    it('should add custom system prompt when provided', () => {
      const result = buildSystemPrompt(businessInfo, [], { system_prompt: 'Be very formal', greeting_message: null });
      expect(result).toContain('Additional Instructions');
      expect(result).toContain('Be very formal');
    });

    it('should add greeting message when provided', () => {
      const result = buildSystemPrompt(businessInfo, [], { system_prompt: null, greeting_message: 'Welcome!' });
      expect(result).toContain('Greeting:');
      expect(result).toContain('Welcome!');
    });

    it('should handle missing description gracefully', () => {
      const result = buildSystemPrompt({ name: 'Minimal Store' }, [], { system_prompt: null, greeting_message: null });
      expect(result).toContain('Minimal Store');
      expect(result).not.toContain('Description:');
    });

    it('should show fallback when knowledge base is empty', () => {
      const result = buildSystemPrompt(businessInfo, [], { system_prompt: null, greeting_message: null });
      expect(result).toContain('No specific knowledge base entries found');
    });
  });

  describe('buildConversationContext', () => {
    it('should return last N messages', () => {
      const messages = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
        { role: 'user', content: 'Question?' },
      ];
      const result = buildConversationContext(messages, 2);
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Hello!');
      expect(result[1].content).toBe('Question?');
    });

    it('should return all messages if less than memory count', () => {
      const messages = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
      ];
      const result = buildConversationContext(messages, 10);
      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty input', () => {
      const result = buildConversationContext([], 10);
      expect(result).toEqual([]);
    });

    it('should preserve role and content fields', () => {
      const messages = [{ role: 'user', content: 'Test' }];
      const result = buildConversationContext(messages, 10);
      expect(result[0]).toEqual({ role: 'user', content: 'Test' });
    });

    it('should default to memory count of 10', () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i}`,
      }));
      const result = buildConversationContext(messages);
      expect(result).toHaveLength(10);
    });
  });
});
