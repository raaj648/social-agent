# Prepaid Credit Packs — Implementation Plan

## Terminology Decision
- **User-facing text**: Always say **"Credits"**, never "Points"
- **Database columns**: Keep `credits_remaining`, `credits_total` unchanged
- **Internal/SQL**: Keep existing function names (`deduct_points`, `point_cost_*`, `points_charged`, `points_used`, `points_allocated`) — these are backend-only
- **Admin UI**: Admin panel says "Credit Costs" and "Credits" for end-user-facing labels

## Credit Pack Pricing

| Pack | Credits | Price | Price/Credit | Auto-Renew |
|------|---------|-------|-------------|------------|
| Starter Pack | 100 | $5 | $0.050 | No |
| Popular Pack | 500 | $20 | $0.040 | No |
| Pro Pack | 2000 | $70 | $0.035 | No |
| Monthly Auto Pack | 500/mo | $15/mo | $0.030 | Yes (rollover) |

---

## Step 1 — Migration: `supabase/migrations/047_credit_packs.sql`

### 1a. Create `credit_packs` table
- Columns: id, name, slug (unique), credits_amount (>0), price_cents (>=0), is_active, is_auto_renew (bool), sort_order, description, created_at, updated_at

### 1b. Create `credit_purchases` table
- Columns: id, user_id (FK users), pack_id (FK credit_packs, nullable), credits_allocated (>0), amount_paid_cents (>=0), status (pending/approved/rejected/refunded), payment_method (text), reference_id (text), admin_note, approved_by (FK users), approved_at, created_at, updated_at

### 1c. Insert default credit packs
- Starter Pack (100/$5), Popular Pack (500/$20), Pro Pack (2000/$70), Monthly Auto Pack (500/$15/mo)

### 1d. Fix `daily_quota` → `monthly_quota` bug
- The `allocate_subscription_points()` trigger currently selects `daily_quota`
- Column was renamed to `monthly_quota` in migration 019
- Rewrite the function to use `monthly_quota`

### 1e. Add `update_subscription_points_used()` function
- Updates the active subscription's `points_used` column by `p_amount`
- Called by handler.ts and webhook.ts after successful `deduct_points`
- Signature: `update_subscription_points_used(p_user_id uuid, p_amount integer)`

### 1f. Add indexes
- `idx_credit_purchases_user` on purchases(user_id)
- `idx_credit_purchases_status` on purchases(status)
- `idx_credit_packs_slug` on packs(slug)

---

## Step 2 — API Routes

### 2a. `src/app/api/user/credit-packs/route.ts`
- **GET** — Returns all active credit packs ordered by sort_order
- Any authenticated user

### 2b. `src/app/api/user/credits/purchase/route.ts`
- **POST** — Create a purchase request
  - Body: `{ pack_id, payment_method?, reference_id? }`
  - Looks up pack to get credits_amount + price_cents
  - Inserts `credit_purchases` with status `pending`
  - Returns the purchase record

### 2c. `src/app/api/admin/credit-purchases/route.ts`
- **GET** — List all purchases with user info, pagination (admin only)
- **PUT** — Approve or reject a purchase
  - Body: `{ id, status, admin_note? }`
  - If `approved`: increments user's `credits_remaining` and `credits_total`
  - Sets `approved_by` and `approved_at`

### 2d. `src/app/api/admin/credit-packs/route.ts`
- **GET** — List all packs (including inactive)
- **POST** — Create a new pack
- **PUT** — Update a pack
- **DELETE** — Delete a pack

---

## Step 3 — Update AI Handlers

### 3a. `src/lib/ai/handler.ts` (around line 448)
After successful `deduct_points` RPC call, add:
```typescript
await supabase.rpc('update_subscription_points_used', {
  p_user_id: targetUserId,
  p_amount: pointCost,
});
```

### 3b. `src/lib/meta/webhook.ts` (around line 673)
Same change as handler.ts

---

## Step 4 — Terminology Cleanup: "Points" → "Credits"

### Files to change (frontend text only):

#### `src/app/dashboard/page.tsx`
| Line | Current | Replace With |
|------|---------|-------------|
| 61 | `'of ${creditsTotal} total  ·  1 reply = 1 credit'` | Keep (already correct) |
| 139 | `Points Usage (30 days)` | `Credits Usage (30 days)` |
| 142 | `Points Balance` | `Credits Balance` |
| 143 | `pts` suffix (line 155, 162) | `cr` or just number |
| 155 | `{a.points} pts` | `{a.points} cr` |
| 162 | `pts` | `cr` |
| 188 | `Points: X used of Y allocated` | `Credits: X used of Y allocated` |

#### `src/app/dashboard/billing/page.tsx`
| Line | Current | Replace With |
|------|---------|-------------|
| 80 | `Points Balance` | `Credits Balance` |
| 108 | `Points Consumed ({days}d)` | `Credits Used ({days}d)` |
| 111 | `Text: {pointCosts.text_reply}pt · Image: {pointCosts.image_read}pt · Voice: {pointCosts.voice_read}pt` | `Text: {pointCosts.text_reply}cr · Image: {pointCosts.image_read}cr · Voice: {pointCosts.voice_read}cr` |
| 129 | `name="Points"` | `name="Credits"` |
| 148 | `{item.points} pts` | `{item.points} cr` |
| 198 | `Points` (table header) | `Credits` |
| 207 | `{d.points}` (table cell) | Keep (data, not label) |
| 235-236 | `Points Used` | `Credits Used` |

#### `src/app/dashboard/profile/page.tsx`
| Line | Current | Replace With |
|------|---------|-------------|
| 173 | `1 credit = 1 AI reply` | Keep (already correct) |
| 257 | `Points are a simplified cost...` | `Credits are a simplified cost...` |
| 261 | `Points Consumed (30d)` | `Credits Used (30d)` |
| 275 | `Point Costs Per Action` | `Credit Cost Per Action` |
| 279 | `{usageData.pointCosts.text_reply} pt` | `{usageData.pointCosts.text_reply} cr` |
| 283 | Same pattern | Same replacement |
| 287 | Same pattern | Same replacement |

#### `src/app/dashboard/analytics/page.tsx`
- Search for all "point"/"points" in user-facing text → replace with "credit"/"credits"
- Keep internal variable names and dataKey values

#### `src/app/admin/settings/page.tsx`
| Line | Current | Replace With |
|------|---------|-------------|
| 416 | `Point Costs` | `Credit Costs` |
| 417 | `Points charged per action...` | `Credits charged per action...` |
| 427 | `Text Reply (points)` | `Text Reply (credits)` |
| 432 | `Image Read (points)` | `Image Read (credits)` |
| 437 | `Voice Read (points)` | `Voice Read (credits)` |

#### `src/app/admin/page.tsx`
| Line | Current | Replace With |
|------|---------|-------------|
| 277 | `Points Today` | `Credits Today` |
| 278-283 | "points" references | "credits" |

#### `src/app/admin/subscriptions/page.tsx`
| Line | Current | Replace With |
|------|---------|-------------|
| 122 | `points_used / points_allocated` | Keep (data) — but column header label says "Credits" |

#### `src/app/admin/users/page.tsx`
| Line | Current | Replace With |
|------|---------|-------------|
| 341 | Table column header `Credits` | Already correct |

#### `src/app/dashboard/playground/page.tsx`
| Line | Current | Replace With |
|------|---------|-------------|
| 201 | `Playground usage consumes your credits` | Already correct |

#### `src/app/dashboard/settings/page.tsx`
| Line | Current | Replace With |
|------|---------|-------------|
| 88 | `when your credits run out` | Already correct |

### Files with chart dataKeys (DO NOT change — these are internal references):
- `dataKey="points"` in bar charts → keep as-is (internal data property)
- `actionBreakdown[x].points` → keep as-is (API response field)
- `usage.totalPoints` → keep as-is

---

## Step 5 — Redesign Billing Page (`src/app/dashboard/billing/page.tsx`)

### Add to the existing billing page:

#### 5a. "Buy Credits" section (between current stat cards and daily usage chart)
- Show each active credit pack as a card
- Each card shows: pack name, credit amount, price, price/credit label
- "Buy" button → opens a modal/dialog

#### 5b. Purchase modal
- Shows selected pack details
- Dropdown: Payment Method (manual upload reference)
- Input: Transaction/Reference ID
- Submit → POST to `/api/user/credits/purchase`
- Success toast: "Purchase request submitted. Admin will approve shortly."

#### 5c. "Purchase History" section (collapsible, below subscription)
- Table of user's purchases: date, pack, credits, amount, status badge (pending/approved/rejected/refunded)

#### 5d. Remove `credits_expires_at` display
- Line 173 in profile page: remove `Expires ${date}` text — show only "No expiry" or nothing

---

## Step 6 — Admin: Credit Packs CRUD

### Add to `src/app/admin/settings/page.tsx` (Billing tab)

#### 6a. "Credit Packs" section (above Point Costs or below)
- Table: name, slug, credits, price, active, auto-renew, sort order, actions (edit/delete/toggle)
- "Add Pack" button → form with fields: name, slug, credits_amount, price_cents, is_active, is_auto_renew, sort_order, description

#### 6b. API integration
- Fetch packs from `/api/admin/credit-packs` on load
- Create/update/delete via the same endpoint

---

## Step 7 — Admin: Purchase Approvals

### New admin page or section: `src/app/admin/credit-purchases/page.tsx`

Or add as a section within the billing tab of admin settings.

#### 7a. Pending purchases table
- Columns: date, user (name + email), pack, credits, amount, payment method, reference ID, actions
- Actions: Approve (green), Reject (red)
- Approved purchases show approved_by and approved_at

#### 7b. Filters
- Status filter: All / Pending / Approved / Rejected
- Search by user name/email

---

## Step 8 — TypeScript Types

### Add to `src/types/index.ts`

```typescript
export interface CreditPack {
  id: string;
  name: string;
  slug: string;
  credits_amount: number;
  price_cents: number;
  is_active: boolean;
  is_auto_renew: boolean;
  sort_order: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditPurchase {
  id: string;
  user_id: string;
  pack_id: string | null;
  credits_allocated: number;
  amount_paid_cents: number;
  status: 'pending' | 'approved' | 'rejected' | 'refunded';
  payment_method: string | null;
  reference_id: string | null;
  admin_note: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}
```

---

## Step 9 — Remove `credits_expires_at` from Frontend

### Files to modify:

| File | Change |
|------|--------|
| `src/app/dashboard/profile/page.tsx:173` | Remove `Expires ${date}` text, keep "No expiry" |
| `src/app/dashboard/profile/page.tsx:13,36` | Stop selecting/using `credits_expires_at` |
| `src/app/api/user/analytics/route.ts:29,116` | Stop selecting/returning `credits_expires_at` |
| `src/lib/hooks/use-realtime-dashboard.ts:36` | Stop selecting `credits_expires_at` |
| `src/app/admin/users/page.tsx` | Remove from admin edit modal |

---

## Step 10 — Verification

```bash
npx tsc --noEmit
```

Check for:
- No TypeScript errors
- No broken imports
- All renamed labels display correctly

---

## Order of Implementation

1. **Migration** (047_credit_packs.sql) — database first
2. **Types** (src/types/index.ts) — types next
3. **API routes** (credit-packs, credits/purchase, admin/credit-purchases, admin/credit-packs)
4. **Handler updates** (handler.ts + webhook.ts — update_subscription_points_used)
5. **Frontend terminology** (rename Points → Credits everywhere)
6. **Billing page redesign** (credit pack cards + purchase modal + history)
7. **Admin settings** (credit packs CRUD + purchase approvals UI)
8. **Remove credits_expires_at** from frontend
9. **Build verification** (tsc --noEmit)
