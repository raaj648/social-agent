# Model Pricing Fix + Universal Pricing Support — Implementation Plan

## Issues Found

### Issue 1 — Model Pricing section is NOT in the admin settings page
- **Current location:** `/admin/providers` page (section "Model Pricing" at providers.tsx:421-476)
- **User expectation:** Model pricing should be in the **Billing tab** of `/admin/settings` page alongside Credit Costs, Payment Gateways, Credit Packs
- **Problem:** The user navigates to Settings → Billing tab and sees no model pricing. It's hidden in a separate page.

### Issue 2 — Model Pricing table is read-only (no inline editing)
- The pricing table (providers.tsx:446-475) only **displays** rows with Provider, Model, Input/Output prices, Source
- The `PUT /api/admin/owner/pricing` endpoint **does** support upsert — but there's **no UI** to add/edit/delete rows
- Only action: "Fetch from OpenRouter" button which auto-populates from OpenRouter API

### Issue 3 — Only OpenRouter fetch — no universal pricing option
- `fetchOpenRouterPricing()` in `pricing.ts` only calls `https://openrouter.ai/api/v1/models`
- The fetch route (`fetch/route.ts`) only queries `ai_providers WHERE provider_type = 'openrouter'`
- User wants to set prices for **any** provider (OpenAI Direct, Google Gemini, DeepSeek, Anthropic, custom endpoints)
- Three methods needed:
  1. **Auto-fetch from OpenRouter** (existing — keep as-is)
  2. **Manual entry** (need inline editing UI)
  3. **Bulk paste/import** (optional, nice-to-have)

### Issue 4 — "Credit Expiry (days)" still present on admin panel
- **Location:** providers.tsx:504-511 (in "AI Defaults" section)
- **State:** `defaultCreditsExpiryDays` (line 45), saved as `default_credits_expiry_days` (line 213)
- **DB impact:** Used in `handle_new_user()` SQL function (016_monthly_credits.sql:41) to set `credits_expires_at` on new user signup
- **Runtime impact:** `checkCredits()` in `rate-limit.ts:40-61` checks `credits_expires_at` and rejects expired credits
- **Type impact:** `UserProfile.credits_expires_at: string | null` in `types/index.ts:11`
- **Why it should be removed:** Prepaid model means credits never expire. All user-facing text already says "Credits never expire" (dashboard/profile/page.tsx:173)

### Issue 5 — DEFAULT_PRICING hardcoded map may miss direct API models
- `pricing.ts:3-13` hardcodes prices for OpenRouter-style model IDs (`openai/gpt-4o`, `google/gemini-2.0-flash`)
- When using a direct provider with model name `gpt-4o` (without `openai/` prefix), fallback fails
- Allowed but produces `$0.00` cost logging — not ideal

### Issue 6 — Frontend still selects `credits_expires_at` in 3+ places
- `src/app/dashboard/profile/page.tsx:13,36` — selects `credits_expires_at`
- `src/app/api/user/analytics/route.ts:29,116` — selects/returns it
- `src/lib/hooks/use-realtime-dashboard.ts:36` — selects it (was partly done but needs verification)

---

## Fix Strategy — Step by Step

### Step 1 — Remove "Credit Expiry (days)" from admin providers page
**Files to edit:**
- `src/app/admin/providers/page.tsx`
  - Remove state: `defaultCreditsExpiryDays` (line 45)
  - Remove load: `if (settingsData.default_credits_expiry_days...)` (line 103)
  - Remove save: `default_credits_expiry_days: ...` (line 213)
  - Remove UI: "Credit Expiry (days)" input block (lines 504-511)
  - Keep `defaultFreeCredits` for new-user signup credits (they just won't expire)

**Files to read-only (no edit needed — plan reference):**
- `src/app/api/admin/owner/settings/route.ts` — can keep accepting the key (harmless)
- `src/types/index.ts` — `credits_expires_at` will be removed later in Step 2

### Step 2 — Remove `credits_expires_at` from frontend selects
**Files to edit:**
- `src/app/dashboard/profile/page.tsx:13,36` — remove `credits_expires_at` from select
- `src/app/api/user/analytics/route.ts:29,116` — remove from select and response
- `src/lib/hooks/use-realtime-dashboard.ts:36` — remove from select
- `src/types/index.ts:11` — remove `credits_expires_at` from `UserProfile`

### Step 3 — Remove `credits_expires_at` from runtime check
**File to edit:**
- `src/lib/rate-limit.ts:40-61` — Remove `expired` check and `expiresAt` from return value. Change return type to `{ allowed, remaining, total }` (remove `expiresAt`)

### Step 4 — Remove `credits_expires_at` from DB (migration 048)
**New file:** `supabase/migrations/048_remove_credit_expiry.sql`

SQL operations:
```sql
-- Alter handle_new_user() function to remove expiry logic
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  free_credits integer;
begin
  select coalesce((select (value#>>'{}')::integer from public.platform_settings where key = 'default_free_credits'), 50) into free_credits;
  insert into public.users (id, email, full_name, plan, credits_total, credits_remaining, created_at, updated_at)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'free', free_credits, free_credits, now(), now());
  return new;
end;
$$;

-- Drop credits_expires_at column from users
alter table public.users drop column if exists credits_expires_at;

-- Remove the platform setting
delete from public.platform_settings where key = 'default_credits_expiry_days';
```

### Step 5 — Move Model Pricing section to Settings Billing tab
**File to edit:** `src/app/admin/settings/page.tsx`

Add a new "Model Pricing" section after "Credit Costs" (after line 533) that:
1. Fetches pricing from `GET /api/admin/owner/pricing`
2. Displays an editable table with columns: Provider, Model, Input Price, Output Price, Source, Actions
3. Each row has inline editing (click to edit input/output prices)
4. "Add Model" button to add a new pricing row (dropdown for provider, text for model, number inputs for prices)
5. Delete button per row
6. "Fetch from OpenRouter" button (keep existing logic)

**Design note:** The model_pricing table stores `provider_id` (FK to `ai_providers`) but this page needs a provider selector. Reuse the `GET /api/admin/owner/providers` endpoint to load the provider list for the dropdown.

State to add:
```ts
const [modelPricing, setModelPricing] = useState<ModelPricingRecord[]>([]);
const [allProviders, setAllProviders] = useState<Provider[]>([]);
const [modelPricingLoading, setModelPricingLoading] = useState(false);
```

On mount, fetch both pricing and providers:
```
GET /api/admin/owner/pricing  -> { pricing: [...] }
GET /api/admin/owner/providers -> { providers: [...] }
```

Save logic: `PUT /api/admin/owner/pricing` with `{ pricing: [...updatedRows] }`

### Step 6 — Remove Model Pricing section from providers page
**File to edit:** `src/app/admin/providers/page.tsx`
- Remove the entire "Model Pricing" section block (lines 421-476)
- Remove `pricing` state (line 64)
- Remove `pricingLoading` state (line 65)
- Remove `pricing` fetch from `loadData()` (lines 92-97)
- It's now in the Settings page instead

### Step 7 — Enhance DEFAULT_PRICING to match by base model name
**File to edit:** `src/lib/ai/pricing.ts`

Modify `getModelPrice()` to also try matching by the **base model name** (the part after `/`):
```ts
// Current key: "openai/gpt-4o"
// Also need to match: "gpt-4o" (for direct API providers)
const baseModel = modelName.includes('/') ? modelName.split('/').pop()! : modelName;
```

So the lookup priority becomes:
1. `dbPrices.get("providerId:modelName")` — exact match in DB
2. `DEFAULT_PRICING[modelName]` — full name match
3. `DEFAULT_PRICING[baseModel]` — base name match
4. `{ input: 0, output: 0 }` — fallback

### Step 8 — DB migration 048 (from Step 4)
Apply the migration after all code changes are verified.

---

## Implementation Order

| Step | Description | Est. Files Changed | Priority |
|------|-------------|-------------------|----------|
| 1 | Remove "Credit Expiry (days)" from providers page UI | 1 | High |
| 2 | Remove `credits_expires_at` from frontend selects | 4 | High |
| 3 | Remove expiry check from runtime (`rate-limit.ts`) | 1 | High |
| 4 | Create DB migration 048 (drop column, update function) | 1 | High |
| 5 | Move Model Pricing section to Settings billing tab | 2 | High |
| 6 | Remove Model Pricing section from providers page | 1 | Medium |
| 7 | Enhance DEFAULT_PRICING fallback matching | 1 | Low |
| 8 | Apply DB migration 048 to Supabase | 1 | High |

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/app/admin/providers/page.tsx` | Current home of Model Pricing + Credit Expiry Days setting |
| `src/app/admin/settings/page.tsx` | Main admin settings page — target for moved Model Pricing |
| `src/app/api/admin/owner/pricing/route.ts` | GET/PUT model pricing CRUD (already exists, will reuse) |
| `src/app/api/admin/owner/pricing/fetch/route.ts` | POST fetch from OpenRouter (keep as-is) |
| `src/lib/ai/pricing.ts` | Core pricing engine (`getModelPrice`, `calculateCost`, `fetchOpenRouterPricing`, `DEFAULT_PRICING`) |
| `src/lib/rate-limit.ts` | Credit check function (needs expiry removal) |
| `src/app/dashboard/profile/page.tsx` | User profile (remove `credits_expires_at`) |
| `src/app/api/user/analytics/route.ts` | User analytics (remove `credits_expires_at`) |
| `src/lib/hooks/use-realtime-dashboard.ts` | Dashboard realtime hook (remove `credits_expires_at`) |
| `src/types/index.ts` | Type definitions (remove `credits_expires_at` from `UserProfile`) |
| `src/app/api/admin/owner/providers/route.ts` | Provider list (for model pricing provider dropdown) |
| `supabase/migrations/048_remove_credit_expiry.sql` | New migration to drop column and update function |

---

## What "Universal Pricing" Means in This Context

The Model Pricing section will let admins set per-model token prices for **any provider** in the system — not just OpenRouter. The three ways to populate prices:

1. **Auto-fetch from OpenRouter** (existing button): Scrapes OpenRouter API, stores prices for all OpenRouter-type providers
2. **Manual per-row entry** (new): Admin selects a provider from dropdown, types a model name, enters input/output prices
3. **Fallback via DEFAULT_PRICING** (existing): If no DB entry and no match, tries hardcoded map; enhanced to match base model names

This does NOT add automatic price fetching from non-OpenRouter APIs (like OpenAI's direct API). That would require separate provider-specific scrapers, which is out of scope. For non-OpenRouter providers, the admin sets prices manually.
