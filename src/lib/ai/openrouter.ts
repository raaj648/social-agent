import { OpenRouterResponse } from '@/types';
import { type ProviderType, detectProviderType } from '@/lib/ai/provider';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

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
  content: string | ContentPart[] | null;
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

  let data: OpenRouterResponse;

  if (providerType === 'google') {
    data = await handleGeminiRequest(params, baseUrl, apiKey, body);
  } else {
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

    data = await res.json();
  }

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

function convertToGeminiFormat(messages: ChatMessage[]): unknown[] {
  const contents: unknown[] = [];
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : msg.role === 'system' ? 'user' : msg.role;
    const parts: unknown[] = [];

    if (typeof msg.content === 'string') {
      parts.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'text') {
          parts.push({ text: part.text });
        } else if (part.type === 'image_url') {
          const match = part.image_url.url.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
            parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
          } else {
            parts.push({ text: `[Image: ${part.image_url.url}]` });
          }
        }
      }
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }
  return contents;
}

async function handleGeminiRequest(
  params: CompletionParams,
  baseUrl: string,
  apiKey: string,
  _originalBody: Record<string, unknown>
): Promise<OpenRouterResponse> {
  const modelName = params.model.replace(/^google\//, '');
  const contents = convertToGeminiFormat(params.messages);

  const geminiBody = {
    contents,
    generationConfig: {
      temperature: params.temperature ?? 0.7,
      maxOutputTokens: params.max_tokens ?? 500,
    },
  };

  const url = `${baseUrl}/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiBody),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errorText}`);
  }

  const geminiData = await res.json();
  const text = geminiData?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text || '').join('') || '';

  return {
    id: `gemini-${Date.now()}`,
    choices: [{
      index: 0,
      message: { content: text, role: 'assistant' },
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: geminiData?.usageMetadata?.promptTokenCount || 0,
      completion_tokens: geminiData?.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: (geminiData?.usageMetadata?.promptTokenCount || 0) +
                    (geminiData?.usageMetadata?.candidatesTokenCount || 0),
    },
    model: params.model,
  };
}
