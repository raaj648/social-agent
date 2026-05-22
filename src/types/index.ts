export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  user_number: number;
  avatar_url: string | null;
  role: 'user' | 'admin';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  credits_remaining: number;
  credits_total: number;
  credits_expires_at: string | null;
  business_name: string | null;
  order_method: 'direct_chat' | 'website' | 'form';
  order_link: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ConnectedPage {
  id: string;
  user_id: string;
  page_id: string;
  page_name: string;
  page_access_token: string;
  page_category: string | null;
  picture_url: string | null;
  subscribed: boolean;
  is_active: boolean;
}

export interface InstagramAccount {
  id: string;
  user_id: string;
  page_id: string | null;
  ig_account_id: string;
  ig_username: string;
  ig_name: string | null;
  ig_profile_pic: string | null;
  ig_access_token: string;
  is_active: boolean;
}

export interface Conversation {
  id: string;
  user_id: string;
  page_id: string | null;
  instagram_id: string | null;
  whatsapp_id: string | null;
  platform: Platform;
  sender_id: string;
  sender_name: string | null;
  sender_picture: string | null;
  last_message_at: string;
  last_interaction: string;
  unread_count: number;
  is_archived: boolean;
  ai_enabled: boolean;
  is_ai_paused: boolean;
  is_urgent: boolean;
  requested_human_at: string | null;
  auto_resume_at: string | null;
  metadata: Record<string, unknown>;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  platform_msg_id: string | null;
  is_read: boolean;
  sent_via_ai: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KnowledgeBaseItem {
  id: string;
  user_id: string;
  category: 'general' | 'faq' | 'pricing' | 'delivery' | 'products' | 'policy' | 'custom';
  title: string;
  content: string;
  tags: string[];
  is_active: boolean;
  sort_order: number;
  platform: 'messenger' | 'instagram' | 'whatsapp' | 'all' | null;
  platform_ref_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  user_id: string;
  platform: 'messenger' | 'instagram' | 'whatsapp';
  platform_ref_id: string | null;
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AISettings {
  id: string;
  user_id: string;
  business_id: string | null;
  page_id: string | null;
  instagram_id: string | null;
  model: string;
  system_prompt: string | null;
  temperature: number;
  max_tokens: number;
  fallback_response: string;
  greeting_enabled: boolean;
  greeting_message: string | null;
  business_hours_only: boolean;
  business_hours_start: string | null;
  business_hours_end: string | null;
  timezone: string;
  keywords_blacklist: string[];
  conversation_memory_count: number;
  is_active: boolean;
  agent_display_name: string;
  ai_agent_name: string;
  human_handoff_enabled: boolean;
  human_handoff_message: string;
  show_handoff_on_pause: boolean;
  auto_resume_minutes: number | null;
  business_name: string | null;
  agent_role: string;
}

export interface UsageLog {
  id: string;
  user_id: string;
  page_id: string | null;
  action: 'ai_reply' | 'webhook_received' | 'message_sent' | 'login' | 'page_connect' | 'instagram_connect' | 'knowledge_update';
  platform: 'messenger' | 'instagram' | null;
  tokens_used: number;
  model_used: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
}

export interface MetaWebhookEntry {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    messaging?: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        attachments?: Array<{
          type: string;
          payload: { url?: string; sticker_id?: number };
        }>;
      };
      postback?: {
        title: string;
        payload: string;
      };
    }>;
    changes?: Array<{
      field: string;
      value: Record<string, unknown>;
    }>;
  }>;
}

export interface WhatsAppAccount {
  id: string;
  user_id: string;
  phone_number_id: string;
  phone_number: string;
  business_name: string | null;
  waba_id: string | null;
  access_token: string;
  is_active: boolean;
}

export interface Order {
  id: string;
  user_id: string;
  conversation_id: string | null;
  customer_name: string | null;
  phone: string | null;
  delivery_address: string | null;
  product_details: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  source: 'direct_chat' | 'website' | 'form';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterToolCall {
  id: string;
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface BillingPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  currency: string;
  monthly_quota: number;
  max_pages: number;
  allowed_models: string[];
  features: string[];
  is_popular: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type Platform = 'messenger' | 'instagram' | 'whatsapp';
