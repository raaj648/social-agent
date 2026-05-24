import { OpenRouterResponse } from '@/types';
import { type ProviderType, detectProviderType } from '@/lib/ai/provider';

interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ChatMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type?: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface CompletionParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDef[];
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  providerType?: ProviderType;
}

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

function addReasoningBody(
  body: Record<string, unknown>,
  providerType: ProviderType,
  suppressReasoning: boolean,
  reasoningMaxTokens?: number,
  reasoningStrategy?: string
): void {
  switch (providerType) {
    case 'openrouter':
      body.include_reasoning = false;
      body.transforms = ['remove-reasoning'];
      if (suppressReasoning) {
        body.reasoning = { max_tokens: 0 };
      } else {
        body.reasoning = { max_tokens: reasoningMaxTokens ?? 512 };
      }
      break;
    case 'deepseek':
      if (suppressReasoning) {
        body.thinking = 'disabled';
      } else if (reasoningStrategy && reasoningStrategy !== 'default') {
        body.thinking = reasoningStrategy;
      } else {
        body.thinking = 'high';
      }
      break;
    case 'generic':
      break;
  }
}

export async function createCompletion(
  params: CompletionParams,
  providerConfig?: ProviderConfig,
  suppressReasoning?: boolean,
  reasoningMaxTokens?: number,
  reasoningStrategy?: string
): Promise<OpenRouterResponse> {
  const apiKey = providerConfig?.apiKey;
  if (!apiKey) throw new Error('AI_API_KEY is not set');

  const baseUrl = providerConfig?.baseUrl || DEFAULT_BASE_URL;
  const providerType = detectProviderType(baseUrl, providerConfig?.providerType);

  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.max_tokens ?? 500,
  };

  addReasoningBody(body, providerType, suppressReasoning ?? false, reasoningMaxTokens, reasoningStrategy);

  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools;
    body.tool_choice = 'auto';
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'SocialReply AI',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`AI API error (${res.status}): ${errorText}`);
  }

  const data: OpenRouterResponse = await res.json();

  // Strip reasoning patterns from content as a safety net
  if (data.choices) {
    for (const choice of data.choices) {
      // Remove provider-specific reasoning fields
      if (choice.message) {
        delete (choice.message as any).reasoning;
        delete (choice.message as any).reasoning_content;
      }
      if (choice?.message?.content) {
        choice.message.content = choice.message.content
          .replace(/^<thinking>[\s\S]*?<\/thinking>\s*/i, '')
          .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
          .replace(/^(?:Okay|Let me|First|I think|I need to|I'll start).*?\n/gi, '');
      }
    }
  }

  return data;
}

export async function createFallbackResponse(): Promise<string> {
  return "Thanks for your message! We'll get back to you shortly.";
}
