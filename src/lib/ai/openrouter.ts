import { OpenRouterResponse } from '@/types';

interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface CompletionParams {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDef[];
}

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
}

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export async function createCompletion(
  params: CompletionParams,
  providerConfig?: ProviderConfig
): Promise<OpenRouterResponse> {
  const apiKey = providerConfig?.apiKey;
  if (!apiKey) throw new Error('AI_API_KEY is not set');

  const baseUrl = providerConfig?.baseUrl || DEFAULT_BASE_URL;

  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.max_tokens ?? 500,
  };

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

  return res.json();
}

export async function createFallbackResponse(): Promise<string> {
  return "Thanks for your message! We'll get back to you shortly.";
}
