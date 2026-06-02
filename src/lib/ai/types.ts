export type ProviderRole = 'text' | 'vision' | 'voice';
export type ActionType = 'text_reply' | 'image_read' | 'voice_read';

export interface RetryableProvider {
  id: string;
  config: {
    baseUrl: string;
    apiKey: string;
    providerType?: string;
  };
  model: string;
  roles: ProviderRole[];
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
}

export interface CostBreakdown {
  input_cost: number;
  output_cost: number;
  total_cost: number;
}

export interface UsageRecord {
  user_id: string;
  platform: string;
  provider_id: string;
  model_name: string;
  action_type: ActionType;
  tokens: TokenUsage;
  cost: CostBreakdown;
  points_charged: number;
  conversation_id?: string;
}
