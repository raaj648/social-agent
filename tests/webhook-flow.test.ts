import { processWebhookMessage } from '@/lib/meta/webhook';

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }));
jest.mock('@/lib/crypto', () => ({ decrypt: jest.fn() }));
jest.mock('@/lib/meta/graph', () => ({
  sendMessage: jest.fn(), sendWhatsAppMessage: jest.fn(),
}));
jest.mock('@/lib/ai/openrouter', () => ({ createCompletion: jest.fn() }));
// checkCredits mock is no longer used — deduct_credit RPC handles atomic deduction
jest.mock('@/lib/utils', () => ({ isWithinBusinessHours: jest.fn() }));
jest.mock('@/lib/ai/prompts', () => ({
  buildSystemPrompt: jest.fn(() => 'system prompt'),
  buildConversationContext: jest.fn(() => []),
}));

import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';
import { sendMessage, sendWhatsAppMessage } from '@/lib/meta/graph';
import { createCompletion } from '@/lib/ai/openrouter';

import { isWithinBusinessHours } from '@/lib/utils';

class QB {
  _resolve: any = { data: null, error: null };
  _count: number | undefined;

  select(_f?: any, opts?: any) { if (opts?.count === 'exact' && opts?.head) this._resolve.count = this._count; return this; }
  eq() { return this; }
  order() { return this; }
  limit() { return this; }
  gte() { return this; }
  is() { return this; }
  not() { return this; }
  maybeSingle() { return Promise.resolve(this._resolve); }

  single() {
    return Promise.resolve(this._resolve);
  }

  insert(_d: any) {
    return { select: () => ({ single: () => Promise.resolve(this._resolve) }) };
  }

  update(_d: any) {
    return { eq: () => Promise.resolve() };
  }

  then(resolve: any) {
    return Promise.resolve(resolve(this._resolve));
  }
}

type QBCb = (qb: QB) => void;

function mockFrom(cbs: QBCb[], rpcResult: any = { data: true, error: null }) {
  let i = 0;
  (createAdminClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => {
      const qb = new QB();
      if (i < cbs.length) cbs[i](qb);
      i++;
      return qb;
    }),
    rpc: jest.fn(() => ({ then: (resolve: any) => Promise.resolve(resolve(rpcResult)) })),
  });
}

const mockPage = {
  id: 'page-db-1', page_id: '123456789', page_name: 'Test Page',
  page_access_token: 'encrypted-page-token', user_id: 'user-1',
  user: { id: 'user-1', is_active: true, full_name: 'Test User', business_name: 'Test Business', order_method: null as any, order_link: null as any },
};

const mockIgAccount = {
  id: 'ig-db-1', ig_account_id: '987654321', ig_username: 'test_instagram',
  ig_access_token: 'encrypted-ig-token', user_id: 'user-1',
  user: { id: 'user-1', is_active: true, full_name: 'Test User', business_name: 'Test Business', order_method: null as any, order_link: null as any },
};

const mockWhatsAppAccount = {
  id: 'wa-db-1', phone_number_id: '5551234567', business_name: 'Test WhatsApp',
  access_token: 'encrypted-wa-token', user_id: 'user-1',
  user: { id: 'user-1', is_active: true, full_name: 'Test User', business_name: 'Test Business', order_method: null as any, order_link: null as any },
};

const mockAiSettings = {
  id: 'settings-1', tenant_id: 'tenant-1', page_id: 'page-db-1',
  is_active: true, model: 'openai/gpt-4o-mini', temperature: 0.7, max_tokens: 500,
  system_prompt: null, fallback_response: "We'll get back to you shortly.",
  keywords_blacklist: [] as string[], business_hours_only: false,
  greeting_enabled: false, greeting_message: null as any,
  conversation_memory_count: 10, timezone: 'UTC',
};

const mockConversation = {
  id: 'conv-1', tenant_id: 'tenant-1', sender_id: 'sender-1', platform: 'messenger',
  is_ai_paused: false, unread_count: 0,
  last_message_at: new Date().toISOString(), last_interaction: new Date().toISOString(),
};

const mockMessages = [
  { role: 'user', content: 'Previous' },
  { role: 'assistant', content: 'Reply' },
];

const completionOk = {
  choices: [{ message: { content: 'AI reply text', tool_calls: undefined } }],
  usage: { total_tokens: 50 },
};

describe('processWebhookMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (decrypt as jest.Mock).mockReturnValue('decrypted-token');
    (createCompletion as jest.Mock).mockResolvedValue(completionOk);
    (sendMessage as jest.Mock).mockResolvedValue(true);
    (sendWhatsAppMessage as jest.Mock).mockResolvedValue(true);
    (isWithinBusinessHours as jest.Mock).mockReturnValue(true);
  });

  describe('Messenger flow', () => {
    it('should process a messenger message and send an AI reply', async () => {
      mockFrom([
        qb => { qb._resolve = { data: mockPage, error: null }; },
        qb => { qb._resolve = { data: mockConversation, error: null }; },
        qb => {}, // update conversation
        qb => {}, // insert user message
        qb => { qb._resolve = { data: mockAiSettings, error: null }; },
        qb => { qb._resolve = { data: [], error: null }; }, // knowledge_base
        qb => { qb._resolve = { data: mockMessages, error: null }; }, // recent messages
        qb => {}, // insert AI reply
        qb => {}, // usage_logs
        qb => {}, // update conversation
      ]);

      await processWebhookMessage({
        platform: 'messenger', senderId: 'sender-1', messageText: 'Hello', recipientId: '123456789', timestamp: Date.now(),
      });

      expect(decrypt).toHaveBeenCalledWith('encrypted-page-token');
      expect(createCompletion).toHaveBeenCalled();
      expect(sendMessage).toHaveBeenCalledWith('sender-1', 'AI reply text', 'decrypted-token', 'messenger');
      const mockSupabase = (createAdminClient as jest.Mock).mock.results.slice(-1)[0]?.value;
      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_credit', { p_user_id: 'user-1' });
    });

    it('should return early when channel is not found', async () => {
      mockFrom([qb => { qb._resolve = { data: null, error: { message: 'not found' } }; }]);

      await processWebhookMessage({
        platform: 'messenger', senderId: 'sender-1', messageText: 'Hello', recipientId: 'unknown', timestamp: Date.now(),
      });

      expect(decrypt).not.toHaveBeenCalled();
    });

    it('should return early when user is inactive', async () => {
      mockFrom([qb => { qb._resolve = { data: { ...mockPage, user: { ...mockPage.user, is_active: false } }, error: null }; }]);

      await processWebhookMessage({
        platform: 'messenger', senderId: 'sender-1', messageText: 'Hello', recipientId: '123456789', timestamp: Date.now(),
      });

      expect(decrypt).not.toHaveBeenCalled();
    });

    it('should return early when conversation AI is paused', async () => {
      mockFrom([
        qb => { qb._resolve = { data: mockPage, error: null }; },
        qb => { qb._resolve = { data: { ...mockConversation, is_ai_paused: true }, error: null }; },
      ]);

      await processWebhookMessage({
        platform: 'messenger', senderId: 'sender-1', messageText: 'Hello', recipientId: '123456789', timestamp: Date.now(),
      });

      expect(decrypt).not.toHaveBeenCalled();
    });

    it('should return early when AI settings are inactive', async () => {
      mockFrom([
        qb => { qb._resolve = { data: mockPage, error: null }; },
        qb => { qb._resolve = { data: mockConversation, error: null }; },
        qb => {}, // update conversation
        qb => {}, // insert user message
        qb => { qb._resolve = { data: { ...mockAiSettings, is_active: false }, error: null }; },
      ]);

      await processWebhookMessage({
        platform: 'messenger', senderId: 'sender-1', messageText: 'Hello', recipientId: '123456789', timestamp: Date.now(),
      });

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('should skip messages with blacklisted keywords', async () => {
      mockFrom([
        qb => { qb._resolve = { data: mockPage, error: null }; },
        qb => { qb._resolve = { data: mockConversation, error: null }; },
        qb => {}, // update
        qb => {}, // insert
        qb => { qb._resolve = { data: { ...mockAiSettings, keywords_blacklist: ['spam'] }, error: null }; },
      ]);

      await processWebhookMessage({
        platform: 'messenger', senderId: 'sender-1', messageText: 'This is spam', recipientId: '123456789', timestamp: Date.now(),
      });

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('should skip messages outside business hours', async () => {
      mockFrom([
        qb => { qb._resolve = { data: mockPage, error: null }; },
        qb => { qb._resolve = { data: mockConversation, error: null }; },
        qb => {},
        qb => {},
        qb => { qb._resolve = { data: { ...mockAiSettings, business_hours_only: true, business_hours_start: '09:00', business_hours_end: '17:00' }, error: null }; },
      ]);

      (isWithinBusinessHours as jest.Mock).mockReturnValue(false);

      await processWebhookMessage({
        platform: 'messenger', senderId: 'sender-1', messageText: 'Hello', recipientId: '123456789', timestamp: Date.now(),
      });

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('should send greeting for first user message', async () => {
      mockFrom([
        qb => { qb._resolve = { data: mockPage, error: null }; },
        qb => { qb._resolve = { data: mockConversation, error: null }; },
        qb => {},
        qb => {}, // insert user msg
        qb => { qb._resolve = { data: { ...mockAiSettings, greeting_enabled: true, greeting_message: 'Welcome!' }, error: null }; },
        qb => { qb._count = 1; qb._resolve = { data: [], error: null, count: 1 }; }, // count check
        qb => {}, // insert greeting msg
        qb => {}, // insert AI reply msg (code continues after greeting)
        qb => { qb._resolve = { data: [], error: null }; }, // kb
        qb => { qb._resolve = { data: mockMessages, error: null }; }, // recent
        qb => {}, // insert AI reply (no data needed)
        qb => {}, // usage_logs
        qb => {}, // update conversation
      ]);

      await processWebhookMessage({
        platform: 'messenger', senderId: 'sender-1', messageText: 'Hello', recipientId: '123456789', timestamp: Date.now(),
      });

      expect(sendMessage).toHaveBeenCalledWith('sender-1', 'Welcome!', 'decrypted-token', 'messenger');
      // After sending the greeting, the code returns early so only the greeting is sent
      expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should send fallback when quota is exceeded', async () => {
      mockFrom([
        qb => { qb._resolve = { data: mockPage, error: null }; },
        qb => { qb._resolve = { data: mockConversation, error: null }; },
        qb => {},
        qb => {},
        qb => { qb._resolve = { data: mockAiSettings, error: null }; },
      ], { data: false, error: null });

      await processWebhookMessage({
        platform: 'messenger', senderId: 'sender-1', messageText: 'Hello', recipientId: '123456789', timestamp: Date.now(),
      });

      expect(sendMessage).toHaveBeenCalledWith('sender-1', "We'll get back to you shortly.", 'decrypted-token', 'messenger');
      expect(createCompletion).not.toHaveBeenCalled();
    });

    it('should send fallback when AI completion fails', async () => {
      mockFrom([
        qb => { qb._resolve = { data: mockPage, error: null }; },
        qb => { qb._resolve = { data: mockConversation, error: null }; },
        qb => {},
        qb => {}, // insert user msg
        qb => { qb._resolve = { data: mockAiSettings, error: null }; },
        qb => { qb._resolve = { data: [], error: null }; }, // kb
        qb => { qb._resolve = { data: mockMessages, error: null }; }, // recent
        qb => {}, // insert fallback msg
      ]);

      (createCompletion as jest.Mock).mockRejectedValue(new Error('API error'));

      await processWebhookMessage({
        platform: 'messenger', senderId: 'sender-1', messageText: 'Hello', recipientId: '123456789', timestamp: Date.now(),
      });

      expect(sendMessage).toHaveBeenCalledWith('sender-1', "We'll get back to you shortly.", 'decrypted-token', 'messenger');
    });

    it('should send fallback when AI returns empty content', async () => {
      mockFrom([
        qb => { qb._resolve = { data: mockPage, error: null }; },
        qb => { qb._resolve = { data: mockConversation, error: null }; },
        qb => {},
        qb => {}, // insert user msg
        qb => { qb._resolve = { data: mockAiSettings, error: null }; },
        qb => { qb._resolve = { data: [], error: null }; }, // kb
        qb => { qb._resolve = { data: mockMessages, error: null }; }, // recent
      ]);

      (createCompletion as jest.Mock).mockResolvedValue({
        choices: [{ message: { content: undefined, tool_calls: undefined } }],
        usage: { total_tokens: 10 },
      });

      await processWebhookMessage({
        platform: 'messenger', senderId: 'sender-1', messageText: 'Hello', recipientId: '123456789', timestamp: Date.now(),
      });

      expect(sendMessage).toHaveBeenCalledWith('sender-1', "We'll get back to you shortly.", 'decrypted-token', 'messenger');
    });

    it('should handle empty message text as attachment', async () => {
      mockFrom([
        qb => { qb._resolve = { data: mockPage, error: null }; },
        qb => { qb._resolve = { data: mockConversation, error: null }; },
        qb => {},
        qb => {}, // insert user msg
        qb => { qb._resolve = { data: mockAiSettings, error: null }; },
        qb => { qb._resolve = { data: [], error: null }; },
        qb => { qb._resolve = { data: mockMessages, error: null }; },
        qb => {}, // insert AI reply
        qb => {}, // usage_logs
        qb => {}, // update
      ]);

      await processWebhookMessage({
        platform: 'messenger', senderId: 'sender-1', messageText: '', recipientId: '123456789', timestamp: Date.now(),
      });

      expect(sendMessage).toHaveBeenCalled();
    });
  });

  describe('Instagram flow', () => {
    it('should process and send an AI reply', async () => {
      mockFrom([
        qb => { qb._resolve = { data: mockIgAccount, error: null }; },
        qb => { qb._resolve = { data: { ...mockConversation, platform: 'instagram' }, error: null }; },
        qb => {},
        qb => {}, // insert user
        qb => { qb._resolve = { data: { ...mockAiSettings, page_id: null as any, instagram_id: 'ig-db-1' }, error: null }; },
        qb => { qb._resolve = { data: [], error: null }; },
        qb => { qb._resolve = { data: mockMessages, error: null }; },
        qb => {}, // insert AI reply
        qb => {}, // usage_logs
        qb => {}, // update
      ]);

      await processWebhookMessage({
        platform: 'instagram', senderId: 'ig-sender-1', messageText: 'Hola', recipientId: '987654321', timestamp: Date.now(),
      });

      expect(decrypt).toHaveBeenCalledWith('encrypted-ig-token');
      expect(sendMessage).toHaveBeenCalledWith('ig-sender-1', 'AI reply text', 'decrypted-token', 'instagram');
    });
  });

  describe('WhatsApp flow', () => {
    it('should process and send an AI reply', async () => {
      mockFrom([
        qb => { qb._resolve = { data: mockWhatsAppAccount, error: null }; },
        qb => { qb._resolve = { data: { ...mockConversation, platform: 'whatsapp' }, error: null }; },
        qb => {},
        qb => {}, // insert user
        qb => { qb._resolve = { data: { ...mockAiSettings, page_id: null as any, instagram_id: null as any }, error: null }; },
        qb => { qb._resolve = { data: [], error: null }; },
        qb => { qb._resolve = { data: mockMessages, error: null }; },
        qb => {}, // insert AI reply
        qb => {}, // usage_logs
        qb => {}, // update
      ]);

      await processWebhookMessage({
        platform: 'whatsapp', senderId: 'wa-sender-1', messageText: 'Order please', recipientId: '5551234567', timestamp: Date.now(),
      });

      expect(decrypt).toHaveBeenCalledWith('encrypted-wa-token');
      expect(sendWhatsAppMessage).toHaveBeenCalledWith('5551234567', 'wa-sender-1', 'AI reply text', 'decrypted-token');
    });
  });

  describe('Order extraction (direct_chat)', () => {
    it('should extract order via tool call and insert order', async () => {
      mockFrom([
        qb => { qb._resolve = { data: { ...mockPage, user: { ...mockPage.user, order_method: 'direct_chat' } }, error: null }; },
        qb => { qb._resolve = { data: mockConversation, error: null }; },
        qb => {},
        qb => {}, // insert user
        qb => { qb._resolve = { data: mockAiSettings, error: null }; },
        qb => { qb._resolve = { data: [], error: null }; }, // kb
        qb => { qb._resolve = { data: mockMessages, error: null }; }, // recent
        qb => {}, // orders insert
        qb => {}, // insert confirmation msg
      ]);

      (createCompletion as jest.Mock).mockResolvedValue({
        choices: [{
          message: {
            content: null,
            tool_calls: [{ function: { name: 'extract_order_details', arguments: JSON.stringify({ customer_name: 'John Doe', phone: '555-1234', delivery_address: '123 Main St', product_details: '2x Widgets' }) } }],
          },
        }],
        usage: { total_tokens: 80 },
      });

      await processWebhookMessage({
        platform: 'messenger', senderId: 'sender-1', messageText: 'I want to order', recipientId: '123456789', timestamp: Date.now(),
      });

      expect(sendMessage).toHaveBeenCalledWith('sender-1', expect.stringContaining('Order confirmed'), 'decrypted-token', 'messenger');
    });
  });

  describe('Unknown platform', () => {
    it('should return early', async () => {
      await processWebhookMessage({
        platform: 'unknown' as any, senderId: 'sender-1', messageText: 'Hello', recipientId: '123456789', timestamp: Date.now(),
      });

      expect(decrypt).not.toHaveBeenCalled();
    });
  });
});