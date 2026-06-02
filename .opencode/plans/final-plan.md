# FINAL PLAN: Social Agent Universal Provider + Points + Analytics

> **Goal**: Complete media processing, multi-provider routing, retry logic, token-pricing analytics, points system, subscriptions, payment gateway config, and full admin/user analytics dashboards.

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Phase 0: Universal Provider + Retry + Pricing](#2-phase-0-universal-provider--retry--pricing)
3. [Phase 1: Points System & Subscriptions](#3-phase-1-points-system--subscriptions)
4. [Phase 2: Admin Analytics Overhaul](#4-phase-2-admin-analytics-overhaul)
5. [Phase 3: User Dashboard Analytics Overhaul](#5-phase-3-user-dashboard-analytics-overhaul)
6. [Phase 4: Enhanced Plans & Payment Gateways](#6-phase-4-enhanced-plans--payment-gateways)
7. [Verification Plan](#7-verification-plan)
8. [Execution Order](#8-execution-order)

---

## 1. Architecture Overview

```
                    ┌─────────────────────────────────────┐
                    │           Admin Panel                │
                    │  (providers, pricing, plans,         │
                    │   analytics, gateways, settings)      │
                    └──────┬───────────────────┬───────────┘
                           │                   │
                    ┌──────▼───────────────────▼───────────┐
                    │          Database (Supabase)           │
                    │                                       │
                    │  ai_providers [+roles, +google type]   │
                    │  model_pricing (per-model token cost)  │
                    │  usage_logs [+provider_id, +cost, +pts]│
                    │  user_subscriptions (plan tracking)    │
                    │  payment_gateways (config only)        │
                    │  billing_plans [+monthly_points]       │
                    │  platform_settings [+point_costs]      │
                    └──────┬───────────────────┬───────────┘
                           │                   │
          ┌────────────────▼───────┬───────────▼────────────┐
          │      AI Pipeline        │      Webhooks          │
          │                         │                        │
          │  retry.ts → router.ts   │  handler.ts            │
          │  → openrouter.ts        │  meta/webhook.ts       │
          │  → pricing.ts           │  telegram webhook      │
          │  → resize.ts (sharp)    │  discord webhook       │
          │  → log to usage_logs    │  playground            │
          └─────────────────────────┴────────────────────────┘
```

### Key Design Decisions

- **Points are action-type based** (text=1, image=3, voice=2) — simple for users, with real token costs tracked invisibly for admin analytics
- **1 point ≈ 1 text reply** — users understand "1 text reply costs 1 point"
- **Real token costs** tracked per-call for both admin and user transparency (user sees collapsed "Advanced" section)
- **Subscriptions are admin-managed initially** — no payment processing yet, but gateway config infrastructure ready
- **`deduct_points(user_id, amount)` replaces `deduct_credit`** as primary function; old function kept as backward-compatible wrapper
- **Retry logic** cycles through providers by role (text/vision/voice), max 3 attempts, with last-resort fallback to text provider for image/voice

---

## 2. Phase 0: Universal Provider + Retry + Pricing

> **Effort**: ~8-10 days  
> **Files**: 6 new, 9 modified

### 2.1 Database Migration: `044_universal_providers.sql`

#### ai_providers — Add roles column + google provider type
```sql
-- Roles define what this provider can handle
alter table public.ai_providers
add column roles jsonb not null default '["text"]'::jsonb
  check (roles <@ '["text", "vision", "voice"]'::jsonb);

-- Add google to provider_type enum
alter table public.ai_providers drop constraint if exists ai_providers_provider_type_check;
alter table public.ai_providers add constraint ai_providers_provider_type_check
  check (provider_type in ('openrouter', 'deepseek', 'google', 'generic'));

-- Auto-detect roles: existing providers default to ["text"]
-- Admin sets vision/voice roles manually in UI
```

#### model_pricing — New table
```sql
create table if not exists public.model_pricing (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.ai_providers(id) on delete cascade,
  model_name text not null,
  input_price_per_1m_tokens numeric(10,6) not null default 0,
  output_price_per_1m_tokens numeric(10,6) not null default 0,
  is_auto_fetched boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(provider_id, model_name)
);

alter table public.model_pricing enable row level security;
create policy "Admins can manage model_pricing"
  on public.model_pricing for all
  using (public.is_admin());
```

#### usage_logs — Expand columns
```sql
alter table public.usage_logs
  add column if not exists provider_id uuid references public.ai_providers(id) on delete set null,
  add column if not exists model_name text,
  add column if not exists input_tokens integer default 0,
  add column if not exists output_tokens integer default 0,
  add column if not exists reasoning_tokens integer default 0,
  add column if not exists input_cost numeric(12,8) default 0,
  add column if not exists output_cost numeric(12,8) default 0,
  add column if not exists total_cost numeric(12,8) default 0,
  add column if not exists points_charged integer default 0,
  add column if not exists action_type text check (action_type in ('text_reply', 'image_read', 'voice_read'));

-- New indexes for analytics queries
create index if not exists idx_usage_logs_provider on public.usage_logs(provider_id);
create index if not exists idx_usage_logs_action_type on public.usage_logs(action_type);
create index if not exists idx_usage_logs_cost on public.usage_logs(created_at, total_cost);
```

#### RPC for admin financial summary
```sql
create or replace function public.get_admin_financial_summary()
returns jsonb
language plpgsql security definer
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'total_cost', coalesce(sum(total_cost), 0),
    'total_points_charged', coalesce(sum(points_charged), 0),
    'total_input_tokens', coalesce(sum(input_tokens), 0),
    'total_output_tokens', coalesce(sum(output_tokens), 0),
    'total_reasoning_tokens', coalesce(sum(reasoning_tokens), 0),
    'total_calls', count(*)
  ) into result
  from public.usage_logs
  where created_at >= now() - interval '30 days';
  return result;
end;
$$;
```

### 2.2 New Files

| File | Purpose |
|------|---------|
| `src/lib/ai/types.ts` | Shared types: `RetryableProvider`, `TokenUsage`, `CostBreakdown`, `ActionType`, `UsageRecord` |
| `src/lib/ai/retry.ts` | Core retry engine with model fallback chain |
| `src/lib/ai/pricing.ts` | Pricing defaults map, DB lookup, OpenRouter auto-fetch |
| `src/app/api/admin/owner/pricing/route.ts` | GET/PUT model_pricing CRUD |
| `src/app/api/admin/owner/pricing/fetch/route.ts` | POST — auto-fetch OpenRouter pricing |
| `src/app/api/admin/owner/usage/summary/route.ts` | GET — aggregated usage stats |

#### 2.2.1 `src/lib/ai/types.ts`

```typescript
export type ProviderRole = 'text' | 'vision' | 'voice';
export type ActionType = 'text_reply' | 'image_read' | 'voice_read';

export interface RetryableProvider {
  id: string;
  config: {
    baseUrl: string;
    apiKey: string;
    providerType: string;  // 'openrouter' | 'deepseek' | 'google' | 'generic'
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
}
```

#### 2.2.2 `src/lib/ai/retry.ts`

**Algorithm:**
1. Accept `providers: RetryableProvider[]` (pre-filtered by role)
2. Accept `options.maxAttempts` (default 3), `options.fallbackProviders` (optional)
3. For attempt = 0 to maxAttempts-1:
   - Pick `provider = providers[attempt % providers.length]` (cycles through available providers)
   - Call `callFn(provider)`
   - On success → return `{ result, providerUsed, attempts: attempt + 1 }`
   - On rate-limit (429) or network error → log warning, continue loop
4. All attempts exhausted:
   - If fallbackProviders exist → try each fallback provider once
   - Still failing → throw `AggregateError` with all errors

```typescript
export async function executeWithFallback<T>(
  providers: RetryableProvider[],
  callFn: (provider: RetryableProvider) => Promise<T>,
  options?: { maxAttempts?: number; fallbackProviders?: RetryableProvider[] }
): Promise<{ result: T; providerUsed: RetryableProvider; attempts: number }>
```

**Behavior per action type:**
| Action Type | Primary Role | Fallback |
|------------|-------------|----------|
| text_reply | text | none (throw error) |
| image_read | vision | fallback to text providers |
| voice_read | voice | fallback to text providers |

#### 2.2.3 `src/lib/ai/pricing.ts`

**Default pricing (per 1M tokens, USD) — auto-fetched from OpenRouter for OpenRouter providers, hardcoded fallbacks for others:**

```typescript
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o':                { input: 2.50,  output: 10.00 },
  'openai/gpt-4o-mini':          { input: 0.15,  output: 0.60 },
  'openai/gpt-4o-audio-preview': { input: 2.50,  output: 10.00 },
  'google/gemini-2.0-flash':     { input: 0.10,  output: 0.40 },
  'google/gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
  'google/gemini-2.5-pro':       { input: 1.25,  output: 5.00 },
  'deepseek/deepseek-chat':      { input: 0.27,  output: 1.10 },
  'deepseek/deepseek-reasoner':  { input: 0.55,  output: 2.19 },
  'openai/whisper-1':            { input: 6.00,  output: 0 },  // per minute
};
```

- `getModelPrice(modelName, providerId, dbPrices)` — lookup chain: DB > hardcoded > zero
- `fetchOpenRouterPricing()` — calls `/api/v1/models`, extracts `{ model.id → { prompt, completion } }`
- `calculateCost(tokens, modelPricing)` — returns `CostBreakdown`

#### 2.2.4 `src/app/api/admin/owner/pricing/route.ts`

```typescript
// GET /api/admin/owner/pricing
// Returns { pricing: ModelPricing[] }

// PUT /api/admin/owner/pricing  
// Body: { pricing: Array<{ provider_id, model_name, input_price, output_price }> }
// Upserts each entry
```

#### 2.2.5 `src/app/api/admin/owner/pricing/fetch/route.ts`

```typescript
// POST /api/admin/owner/pricing/fetch
// 1. Find all OpenRouter providers
// 2. Call fetchOpenRouterPricing()
// 3. Upsert matching models into model_pricing
// Returns { updated: number }
```

#### 2.2.6 `src/app/api/admin/owner/usage/summary/route.ts`

```typescript
// GET /api/admin/owner/usage/summary?from=...&to=...
// Returns aggregated:
// {
//   totalCost: number,
//   totalPointsCharged: number,
//   totalTokens: { input, output, reasoning },
//   costByModel: [{ model, provider_id, cost, tokens, count }],
//   costByProvider: [{ provider_id, cost, tokens, count }],
//   costByActionType: [{ type: 'text_reply' | 'image_read' | 'voice_read', cost, count, points }],
//   daily: [{ date, cost, tokens, points }]
// }
```

### 2.3 Modified Files

| File | Changes |
|------|---------|
| `src/lib/ai/provider.ts` | Add `'google'` to ProviderType; detect `googleapis.com` in `detectProviderType()` |
| `src/lib/ai/router.ts` | Full rewrite — accept RetryableProvider[], resolve vision/voice providers |
| `src/lib/ai/openrouter.ts` | Add Gemini format adapter branch; strip retry logic (now in retry.ts) |
| `src/lib/ai/handler.ts` | Major: fetch ALL providers, build retry chains, resize images with sharp, calculate costs, log to usage_logs |
| `src/lib/meta/webhook.ts` | Same retry + logging changes as handler.ts |
| `src/lib/media/resize.ts` | Replace placeholder with sharp implementation |
| `src/app/admin/providers/page.tsx` | Add roles checkboxes per provider; model pricing table section |
| `src/types/index.ts` | Add `ProviderRole` type, update `BillingPlan.monthly_points` |
| `package.json` | Add `sharp` and `@types/sharp` |

#### 2.3.1 `src/lib/ai/router.ts` — Full Rewrite

```typescript
interface RouterInput {
  hasImage: boolean;
  hasVoice: boolean;
  mediaSettings: Record<string, unknown>;
  providers: RetryableProvider[];
}

interface RouterOutput {
  visionProvider: RetryableProvider | null;
  voiceProvider: RetryableProvider | null;
  visionModel: string;
  voiceModel: string;
}

export function resolveMediaProviders(input: RouterInput): RouterOutput {
  // Resolve vision provider:
  // 1. If media_image_provider_id is set, find that provider
  // 2. If found and has 'vision' role, return it
  // 3. If not found, find first provider with 'vision' role
  // 4. If none, return null
  //
  // Resolve voice provider:
  // Same pattern with media_voice_provider_id
  // Returns null if no voice provider found
}
```

#### 2.3.2 `src/lib/ai/openrouter.ts` — Gemini Format Adapter

```typescript
// Inside createCompletion():
if (providerType === 'google') {
  return handleGeminiRequest(params, baseUrl, apiKey);
}

// Gemini response parser:
function parseGeminiResponse(geminiData: any): OpenRouterResponse {
  const text = geminiData?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text).join('') || '';
  return {
    choices: [{ message: { content: text, role: 'assistant' } }],
    usage: {
      prompt_tokens: geminiData?.usageMetadata?.promptTokenCount || 0,
      completion_tokens: geminiData?.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: (geminiData?.usageMetadata?.promptTokenCount || 0) +
                    (geminiData?.usageMetadata?.candidatesTokenCount || 0),
    },
    model: params.model,
  };
}
```

#### 2.3.3 `src/lib/ai/handler.ts` — Major Changes

**Flow summary:**
```
1. Fetch ALL active ai_providers → build providerMap (decrypted)
2. Group by role → textProviders[], visionProviders[], voiceProviders[]
3. Resolve vision/voice with router.ts
4. Build content arrays (with resized images if present)
5. Execute text reply via executeWithFallback(textProviders, ...)
6. If images: executeWithFallback(visionProviders, ...) → merge vision output
7. If voice: executeWithFallback(voiceProviders, ...) → transcribe
8. Calculate cost for each successful call via pricing.ts
9. Calculate total points: (text_calls × point_cost_text_reply) + (image_calls × point_cost_image_read) + (voice_calls × point_cost_voice_read)
10. Call deduct_points(user_id, total_points)
11. Insert usage_logs rows with all tracking data
12. Fallback: if points insufficient, send no-credits message
```

**Key parameters:**
- Point costs read from `platform_settings` at request time:
  - `point_cost_text_reply` (default 1)
  - `point_cost_image_read` (default 3)
  - `point_cost_voice_read` (default 2)

**Image resize integration:**
```typescript
if (mediaBundle?.images?.length) {
  const maxSize = Number(mediaSettings.media_image_max_size) || 2048;
  for (const img of mediaBundle.images) {
    try {
      const resized = await resizeImage(img.data, img.mimeType, maxSize);
      // Use resized.data for base64 encoding
    } catch {
      // Fall back to original
    }
  }
}
```

**Usage logging:**
```typescript
const usageRecord: UsageRecord = {
  user_id: targetUserId,
  platform,
  provider_id: providerUsed.id,
  model_name: modelUsed,
  action_type: 'text_reply',  // or 'image_read', 'voice_read'
  tokens: { input_tokens, output_tokens, reasoning_tokens },
  cost: { input_cost, output_cost, total_cost },
  points_charged: pointCost,
};

await supabase.from('usage_logs').insert({
  user_id: usageRecord.user_id,
  platform: usageRecord.platform,
  provider_id: usageRecord.provider_id,
  model_name: usageRecord.model_name,
  action: 'ai_reply',
  action_type: usageRecord.action_type,
  input_tokens: usageRecord.tokens.input_tokens,
  output_tokens: usageRecord.tokens.output_tokens,
  reasoning_tokens: usageRecord.tokens.reasoning_tokens,
  input_cost: usageRecord.cost.input_cost,
  output_cost: usageRecord.cost.output_cost,
  total_cost: usageRecord.cost.total_cost,
  points_charged: usageRecord.points_charged,
  tokens_used: usageRecord.tokens.input_tokens + usageRecord.tokens.output_tokens,
  created_at: new Date().toISOString(),
});
```

#### 2.3.4 `src/lib/media/resize.ts` — Sharp Implementation

```typescript
import sharp from 'sharp';

export async function resizeImage(
  buffer: Buffer,
  mimeType: string,
  maxSize: number
): Promise<{ data: Buffer; width: number; height: number; mimeType: string }> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const longest = Math.max(metadata.width || 0, metadata.height || 0);
  if (longest <= maxSize) {
    return { data: buffer, width: metadata.width || 0, height: metadata.height || 0, mimeType };
  }
  const resized = await image
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const newMeta = await sharp(resized).metadata();
  return {
    data: resized,
    width: newMeta.width || 0,
    height: newMeta.height || 0,
    mimeType: 'image/jpeg',
  };
}

export function parseImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  // Keep existing implementation (JPEG/PNG header parsing)
}

// checkImageSize becomes a convenience wrapper
export async function checkImageSize(
  image: ImageData,
  maxSize: number
): Promise<{ needsResize: boolean; dimensions: { width: number; height: number } | null }> {
  const dims = image.width && image.height
    ? { width: image.width, height: image.height }
    : parseImageDimensions(image.data);
  if (!dims) return { needsResize: false, dimensions: null };
  return {
    needsResize: Math.max(dims.width, dims.height) > maxSize,
    dimensions: dims,
  };
}
```

#### 2.3.5 `src/app/admin/providers/page.tsx` — Roles + Pricing

**Provider Form Additions:**
- Roles section with 3 checkboxes: `["text"]` / `["vision"]` / `["voice"]` / any combination
- Role descriptions: "Text = handles AI replies", "Vision = handles image analysis", "Voice = handles voice transcription"

**Model Pricing Section (below provider list):**
- Table: Provider Name | Model | Input Price (per 1M) | Output Price (per 1M) | Auto-fetched | Actions (Edit/Delete)
- "Add Pricing" button → modal form
- "Fetch from OpenRouter" button → calls pricing/fetch API
- Inline editing for each row

---

## 3. Phase 1: Points System & Subscriptions

> **Effort**: ~4-5 days  
> **Files**: 1 migration, 4 modified

### 3.1 Database Migration: `045_points_system.sql`

```sql
-- 1. user_subscriptions
create table public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan_id uuid not null references public.billing_plans(id),
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'expired', 'past_due')),
  start_date timestamptz not null default now(),
  end_date timestamptz,
  points_allocated integer not null default 0,
  points_used integer not null default 0,
  auto_renew boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_user_subscriptions_user on public.user_subscriptions(user_id);
create index idx_user_subscriptions_status on public.user_subscriptions(status);

alter table public.user_subscriptions enable row level security;

create policy "Users can view own subscriptions"
  on public.user_subscriptions for select
  using (user_id = auth.uid() OR public.is_admin());

create policy "Admins can manage subscriptions"
  on public.user_subscriptions for all
  using (public.is_admin());

-- 2. deduct_points function (replaces deduct_credit)
create or replace function public.deduct_points(
  p_user_id uuid,
  p_amount integer default 1
)
returns boolean
language plpgsql
security definer
as $$
declare
  current_points integer;
begin
  select credits_remaining into current_points
  from public.users
  where id = p_user_id
  for update;

  if current_points is null or current_points < p_amount then
    return false;
  end if;

  update public.users
  set credits_remaining = credits_remaining - p_amount,
      updated_at = now()
  where id = p_user_id;

  return true;
end;
$$;

-- 3. Backward-compatible wrapper
create or replace function public.deduct_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  return public.deduct_points(p_user_id, 1);
end;
$$;

-- 4. payment_gateways table (config only, no processing)
create table public.payment_gateways (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  -- config stores: { api_key, secret_key, endpoint_url, merchant_id, ... }
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_gateways enable row level security;
create policy "Admins can manage payment_gateways"
  on public.payment_gateways for all
  using (public.is_admin());

-- 5. Default point costs
INSERT INTO public.platform_settings (key, value) VALUES
  ('point_cost_text_reply', 1),
  ('point_cost_image_read', 3),
  ('point_cost_voice_read', 2)
ON CONFLICT (key) DO NOTHING;

-- 6. Trigger: when user subscribes, allocate points
create or replace function public.allocate_subscription_points()
returns trigger
language plpgsql
security definer
as $$
declare
  plan_quota integer;
begin
  select daily_quota into plan_quota
  from public.billing_plans
  where id = new.plan_id;

  update public.users
  set credits_total = credits_total + plan_quota,
      credits_remaining = credits_remaining + plan_quota,
      updated_at = now()
  where id = new.user_id;

  new.points_allocated = plan_quota;
  return new;
end;
$$;

create trigger trg_allocate_subscription_points
  before insert on public.user_subscriptions
  for each row execute function public.allocate_subscription_points();
```

### 3.2 Modified Files

| File | Changes |
|------|---------|
| `src/lib/ai/handler.ts` | Replace `deduct_credit()` call with `deduct_points(user_id, totalPoints)` |
| `src/lib/meta/webhook.ts` | Same replacement |
| `src/app/api/admin/owner/settings/route.ts` | Add `point_cost_text_reply`, `point_cost_image_read`, `point_cost_voice_read` to AI_KEYS / AI_NUMERIC_KEYS |
| `src/app/admin/settings/page.tsx` | Add Point Costs panel + Payment Gateways section |

#### 3.2.1 Point Cost Configuration in Admin Settings

**Location**: Admin → Settings → General tab (new "Point Costs" card)

```
┌─────────────────────────────────────────┐
│ Point Costs                              │
│                                          │
│ Text Reply Cost:    [1] point            │
│ Image Read Cost:    [3] points           │
│ Voice Read Cost:    [2] points           │
│                                          │
│ [Save Changes]                           │
│                                          │
│ ℹ Point costs determine how many points  │
│   each action costs the user.            │
│   1 point ≈ 1 text AI reply.            │
└─────────────────────────────────────────┘
```

#### 3.2.2 Payment Gateways in Admin Settings

**Location**: Admin → Settings → General tab (new "Payment Gateways" card)

```
┌─────────────────────────────────────────┐
│ Payment Gateways                         │
│                                          │
│ Name              Status    Actions       │
│ ─────────────────────────────────────── │
│ Amarpay          ● Active  [Edit] [Del]  │
│ Surjopay         ○ Inactive [Edit] [Del] │
│                                          │
│ [+ Add Gateway]                          │
│                                          │
│ ℹ Configure payment gateway credentials  │
│   here. Checkout processing will be       │
│   implemented in a future update.        │
└─────────────────────────────────────────┘
```

**Add/Edit Gateway form:**
- Name (e.g., "Amarpay")
- Slug (e.g., "amarpay") — auto-generated from name
- Active toggle
- Config fields (dynamic JSON editor or predefined fields):
  - API Key / Merchant ID
  - Secret Key
  - Endpoint URL
  - Additional config as JSON

---

## 4. Phase 2: Admin Analytics Overhaul

> **Effort**: ~5-6 days  
> **Files**: 3 new API routes, 2-3 page rewrites

### 4.1 New / Rewritten Pages

#### 4.1.1 `/admin` — Dashboard Cards Additions

**New analytics cards added below existing KPIs:**
- **Revenue** (points_charged × avg point value) vs **Cost** (real AI cost) → profit/margin %
- **Active Subscriptions** count + trend
- **Cost by Action Type** mini pie chart
- **Most Expensive Models** mini table (top 5 by cost)

#### 4.1.2 `/admin/ai-usage` — Full Rewrite

**Tabs:**
1. **Overview** — Date range picker, summary cards, daily cost/token chart
2. **By Model** — Table: Provider | Model | Input Tokens | Output Tokens | Total Cost | Points Charged | Profit | Calls
3. **By Provider** — Table: Provider | Models Count | Total Cost | Total Tokens | Avg Cost/Call
4. **By Action Type** — Pie chart + table: Action | Calls | Cost | Points Charged | Profit Margin
5. **By User** — Table: User | Plan | Calls | Cost | Points Charged | Profit

**Features:**
- All tables sortable by any column
- Date range filter (7d, 30d, 90d, custom)
- Export to CSV
- Real cost vs points charged comparison (profit analysis)

#### 4.1.3 `/admin/subscriptions` — New Page

**Table:**
| User | Plan | Status | Points Allocated | Points Used | Start Date | End Date | Actions |
|------|------|--------|-----------------|-------------|------------|----------|---------|

**Filters:** status (active/cancelled/expired), plan, date range

**Actions per row:** Edit (change plan, adjust points), Cancel, Reactivate

**Bulk actions:** Export CSV

### 4.2 New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/owner/subscriptions` | GET | List all subscriptions with user + plan JOIN |
| `/api/admin/owner/subscriptions/[id]` | PUT | Update status, plan_id, points |
| `/api/admin/owner/usage/summary` | GET | Full aggregation (see 2.2.6) |

---

## 5. Phase 3: User Dashboard Analytics Overhaul

> **Effort**: ~4-5 days  
> **Files**: 2-3 page rewrites, 1 new API route

### 5.1 Modified Pages

#### 5.1.1 `/dashboard` — Points + Plan Card

**Points section (replaces current Credits bar):**
```
┌─────────────────────────────────────────────┐
│  Points Balance                              │
│                                              │
│  ████████████████████░░░░░░░░  428 / 500     │
│                                              │
│  Text: 42 calls  ·  Image: 8  ·  Voice: 3   │
│                                              │
│  Usage this period (points):                 │
│  Text replies   42 calls   42 pts            │
│  Image reads     8 calls   24 pts            │
│  Voice reads     3 calls    6 pts            │
│  ─────────────────────────────────────       │
│  Total used                72 of 500 pts     │
└─────────────────────────────────────────────┘
```

**Plan card:**
```
┌─────────────────────────────────────────────┐
│  Pro Plan                                     │
│  $49/month  ·  Renews Jul 15, 2026           │
│  [Manage Plan →]                              │
└─────────────────────────────────────────────┘
```

**Token transparency (collapsible):**
```
▼ Show advanced token details
┌─────────────────────────────────────────────┐
│  Real AI Token Usage                          │
│                                              │
│  Text replies:  12,450 tokens                │
│  Image reads:   38,200 tokens                │
│  Voice reads:   15,000 tokens                │
│  ─────────────────────────────────────       │
│  Total tokens:  65,650 tokens                │
│                                              │
│  ℹ Your plan uses a simplified point system  │
│    for easy tracking. Real AI token costs    │
│    vary by model and complexity.              │
└─────────────────────────────────────────────┘
```

#### 5.1.2 `/dashboard/analytics` — Rewrite

**Charts:**
1. **Points Usage** (bar chart, last 30 days) — daily point consumption
2. **Action Type Distribution** (pie chart) — text vs image vs voice
3. **Platform Breakdown** (bar/horizontal) — points used per platform

**Stats cards:**
- Total points used this period
- Average points per day
- Most used action type
- Total AI tokens consumed (advanced)

#### 5.1.3 `/dashboard/billing` — New Page

**Plan cards:**
- Current plan (highlighted) with remaining points
- Available plans (upgrade/downgrade options)
- Each card shows: plan name, price, points/mo, features list

**Subscription history table:**
| Period | Plan | Points Allocated | Points Used | Status |
|--------|------|-----------------|-------------|--------|

### 5.2 New API Route

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/user/usage/summary?period=30d` | GET | User-specific aggregation |

**Response shape:**
```json
{
  "total_points_used": 72,
  "total_points_allocated": 500,
  "action_breakdown": [
    { "action_type": "text_reply", "calls": 42, "points": 42, "tokens": 12450 },
    { "action_type": "image_read", "calls": 8, "points": 24, "tokens": 38200 },
    { "action_type": "voice_read", "calls": 3, "points": 6, "tokens": 15000 }
  ],
  "platform_breakdown": [
    { "platform": "messenger", "points": 30, "calls": 20 },
    { "platform": "whatsapp", "points": 25, "calls": 18 }
  ],
  "daily_usage": [
    { "date": "2026-06-01", "points": 5, "tokens": 1200 },
    { "date": "2026-06-02", "points": 8, "tokens": 3400 }
  ],
  "current_plan": {
    "name": "Pro",
    "price_monthly_cents": 4900,
    "points_per_month": 500
  },
  "subscription": {
    "status": "active",
    "start_date": "2026-06-01",
    "end_date": "2026-07-01",
    "points_allocated": 500,
    "points_used": 72
  }
}
```

---

## 6. Phase 4: Enhanced Plans & Payment Gateways

> **Effort**: ~3-4 days  
> **Files**: 2 modified

### 6.1 Admin Plans Enhancement (`/admin/settings#billing`)

**Plan table additions:**
- Rename "Monthly Quota" → "Points per Month" (uses existing `daily_quota` column but clearer label)
- Add "Allowed Actions" column: Text ☑ / Image ☑ / Voice ☑
- Add "Profit Estimate" column: calculated from average usage patterns

**Plan form additions:**
- Allowed action types: 3 toggles
- Points per month: clearer label + tooltip "Points allocated each month"

### 6.2 Profit Estimator

In the plan editor, show:
```
┌─────────────────────────────────────────────┐
│  Profit Estimate (based on last 30d avg)     │
│                                              │
│  Average tokens per user: 65,650/mo          │
│  Average cost per user:    $0.32/mo          │
│  Plan price:              $49.00/mo          │
│  Estimated profit:        $48.68/mo          │
│  ─────────────────────────────────────       │
│  Margin: 99.3%                               │
└─────────────────────────────────────────────┘
```

---

## 7. Verification Plan

### 7.1 Phase 0 Verification

| # | Test | Expected Result | How to Verify |
|---|------|-----------------|---------------|
| 0.1 | `sharp` installed & resize works | Large image resized before API call | Send image >2048px → check logs show "Resized from 4000x3000 to 2048x1536" |
| 0.2 | Multi-provider routing | Text uses provider A, image uses provider B | Create 2 providers with different models → check usage_logs.provider_id differs |
| 0.3 | Retry on rate limit | 3 attempts logged, next provider tried | Mock 429 response → check 3 retry logs |
| 0.4 | Retry fallback to text for vision | After 3 vision failures, text provider used | Delete vision provider → image read still works (uses text provider) |
| 0.5 | Gemini format adapter | Google provider sends correct format | Add Google provider → check API call format in logs |
| 0.6 | OpenRouter pricing fetch | Prices populated in model_pricing | Click "Fetch" in admin → check DB has pricing rows |
| 0.7 | Usage logs populated | All new columns have data | Make AI call → check usage_logs has provider_id, model_name, tokens, cost, points |
| 0.8 | TypeScript compilation | Zero errors | Run `npm run typecheck` |
| 0.9 | `roles` column | Providers correctly categorized | Check DB ai_providers.roles after admin saves |

### 7.2 Phase 1 Verification

| # | Test | Expected Result | How to Verify |
|---|------|-----------------|---------------|
| 1.1 | `deduct_points(user_id, 3)` | credits_remaining decreases by 3 | Call RPC directly from Supabase SQL editor |
| 1.2 | `deduct_credit(user_id)` still works | Decreases by 1 | Call old RPC → verify 1 deducted |
| 1.3 | Point costs editable | Change image_read to 5 → image deducts 5 | Update setting → send image → check points_charged in usage_logs |
| 1.4 | Insufficient points | No AI reply, fallback message sent | Set user to 0 points → send message → user gets "no credits" reply |
| 1.5 | Subscribe user | Points allocated | Create subscription → check credits_remaining increased by plan quota |
| 1.6 | Payment gateway CRUD | Gateway saved and retrievable | Add gateway in admin → verify in API response |

### 7.3 Phase 2 Verification

| # | Test | Expected Result | How to Verify |
|---|------|-----------------|---------------|
| 2.1 | Admin dashboard shows correct cost | Sum of usage_logs.total_cost matches | Compare dashboard number with manual SQL query |
| 2.2 | Per-model breakdown | Models listed with correct totals | Check table matches GROUP BY query |
| 2.3 | Date filter works | Different date range changes data | Switch between 7d/30d/custom → verify filtering |
| 2.4 | CSV export | File downloads with correct data | Click export → open CSV → verify columns and rows |
| 2.5 | Subscriptions list | All subscriptions visible with user info | Check table against SQL JOIN query |

### 7.4 Phase 3 Verification

| # | Test | Expected Result | How to Verify |
|---|------|-----------------|---------------|
| 3.1 | User sees correct points | `credits_remaining` displayed | Compare dashboard with DB value |
| 3.2 | Action type breakdown | Counts match usage_logs | Compare with SQL GROUP BY query |
| 3.3 | Token transparency | Real tokens shown | Expand section → verify against usage_logs |
| 3.4 | Billing page has plans | All active plans shown | Check against billing_plans table |

### 7.5 Phase 4 Verification

| # | Test | Expected Result | How to Verify |
|---|------|-----------------|---------------|
| 4.1 | Create plan | All fields saved | Create plan → verify in DB |
| 4.2 | Edit plan | Changes reflected | Edit → verify updated_at changed + new values |
| 4.3 | Delete plan | Removed from list | Delete → verify is_active = false or row deleted |

### 7.6 Final Integration Test

| # | Test | Expected Result |
|---|------|-----------------|
| F.1 | Full flow: user sends image → AI processes | Image resized, vision provider called, cost calculated, points deducted, usage_logged |
| F.2 | Full flow: user sends voice → AI transcribes | Voice provider called, transcription done, cost calculated, points deducted |
| F.3 | Full flow: user on Pro plan with 500 points | 500 points at start, deductions reduce balance, analytics show action breakdown |
| F.4 | Admin views analytics | Correct cost, revenue, profit for period, per-model breakdown matches actual usage |

---

## 8. Execution Order

```
Phase 0: ████████████████████░░░░░░░░░░░░░░  40%  ~8-10 days
  ├─ Install sharp + npm deps                   Day 1
  ├─ Database migration 044                      Day 1-2
  ├─ retry.ts + types.ts + pricing.ts            Day 2-4
  ├─ router.ts rewrite + openrouter gemini       Day 3-5
  ├─ resize.ts + handler.ts + meta/webhook.ts    Day 4-7
  ├─ Pricing API routes                          Day 6-7
  ├─ Admin UI (provider roles + pricing table)   Day 7-9
  └─ Verify Phase 0                              Day 9-10

Phase 1: ██████████░░░░░░░░░░░░░░░░░░░░░░░░  20%  ~4-5 days
  ├─ Database migration 045                      Day 10-11
  ├─ deduct_points() integration in handlers     Day 11-12
  ├─ Admin settings: point costs + gateways      Day 12-14
  └─ Verify Phase 1                              Day 14-15

Phase 2: ██████████████░░░░░░░░░░░░░░░░░░░░  25%  ~5-6 days
  ├─ Usage summary API route                     Day 15-16
  ├─ Subscriptions API routes                    Day 16-17
  ├─ Admin dashboard cards                       Day 17-18
  ├─ Admin ai-usage page rewrite                 Day 18-20
  ├─ Admin subscriptions page                    Day 20-21
  └─ Verify Phase 2                              Day 21

Phase 3: ██████████░░░░░░░░░░░░░░░░░░░░░░░░  15%  ~4-5 days
  ├─ User usage summary API route                Day 21-22
  ├─ Dashboard: points + plan card               Day 22-23
  ├─ Dashboard: token transparency               Day 23-24
  ├─ Analytics page rewrite                      Day 24-25
  ├─ Billing page (new)                          Day 25-26
  └─ Verify Phase 3                              Day 26

Phase 4: ████████░░░░░░░░░░░░░░░░░░░░░░░░░░  <10%  ~3-4 days
  ├─ Enhanced plan editor (allowed actions, profit) Day 26-27
  ├─ Final integration testing                   Day 27-29
  └─ Full TypeScript verification                Day 29-30
```

**Total**: ~24-30 days of implementation

### Parallelization Opportunities

- Phase 2 API routes can start once Phase 0 handler logging is complete (mid-Phase 0)
- Phase 3 API route can start once Phase 1 points system is done
- Phase 4 UI changes are independent of data pipeline — can overlap with Phase 2/3
- Frontend work (admin pages, user pages) can sometimes proceed with mocked data before backend is complete

### Rollback Safety

Each phase is designed to be backward compatible:
- **Phase 0**: Old `deduct_credit()` still works; old `usage_logs` rows have nulls for new columns
- **Phase 1**: New `deduct_points()` function coexists with `deduct_credit()`; point costs default to 1 for text
- **Phase 2-3**: New analytics pages are additive — no existing functionality removed
- **Phase 4**: Plan changes are additive (new columns + UI)

---

> **Document status**: Final — approved for implementation
