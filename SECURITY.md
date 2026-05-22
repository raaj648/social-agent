# Security Checklist & Architecture

## ✅ Data Encryption

### At Rest
- [x] Meta access tokens encrypted with AES-256-GCM before storing in PostgreSQL
- [x] Encryption key stored as environment variable (`ENCRYPTION_KEY`), never in codebase
- [x] Each token encrypted with unique IV (initialization vector)
- [x] Supabase PostgreSQL data encrypted at rest by default

### In Transit
- [x] All API calls use HTTPS/TLS
- [x] Vercel provides automatic TLS/SSL
- [x] Supabase connections encrypted via TLS
- [x] Meta Graph API calls over HTTPS

## ✅ Authentication & Authorization

### Auth System
- [x] Supabase Auth handles user authentication
- [x] JWT-based sessions with httpOnly cookies
- [x] Row Level Security (RLS) enabled on ALL database tables
- [x] Multi-tenant data isolation via RLS policies
- [x] Service role key only used for admin operations (webhooks, AI)

### RLS Policies Applied To:
- `users` — users can read/update only their own row
- `tenants` — access restricted to tenant owner
- `connected_pages` — access via owner's tenant membership
- `instagram_accounts` — access via owner's tenant membership
- `conversations` — access via owner's tenant membership
- `messages` — read/insert via conversation → tenant → owner chain
- `knowledge_base` — access via owner's tenant membership
- `ai_settings` — access via owner's tenant membership
- `usage_logs` — select only via owner's tenant membership

## ✅ Webhook Security

- [x] Webhook verification token checked on GET (subscription verification)
- [x] HMAC-SHA256 signature validation on POST requests (`x-hub-signature-256`)
- [x] Timing-safe comparison to prevent timing attacks
- [x] Webhook endpoint is excluded from auth middleware (public)

## ✅ API Route Protection

- [x] All non-webhook API routes check Supabase session
- [x] Rate limiting on AI endpoints (30 requests/minute per user)
- [x] Daily AI quota enforcement per user (configurable by plan)
- [x] Input validation via TypeScript types

## ✅ Cross-Tenant Data Leakage Prevention

- [x] RLS policies use `auth.uid()` to scope queries to authenticated user
- [x] All queries filter by `tenant_id` derived from user's tenant
- [x] API routes verify user owns the tenant before operations
- [x] Separate tenant slug ensures URL-level isolation
- [x] No shared data between tenants at database level

## ✅ Environment Security

- [x] All secrets stored in Vercel Environment Variables
- [x] `.env` and `.env.local` in `.gitignore`
- [x] Service role key never exposed to client
- [x] No hardcoded credentials in codebase
- [x] Separate keys for development and production

## ✅ HTTP Security Headers

Configured in `next.config.js`:
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — controls referrer info

## ✅ Additional Measures

### Rate Limiting
- Built-in rate limiter checks usage logs in sliding window
- Daily quota per user resets automatically
- Configurable per-plan limits in `users.ai_quota_daily`

### Input Validation
- Supabase client parameterizes queries (SQL injection prevention)
- Zod ready for additional validation (package included)
- TypeScript strict mode enabled

### Session Management
- Supabase SSR handles session refresh automatically
- Middleware checks session on every protected route load
- Cookie-based sessions with security flags

### Logging & Auditing
- `usage_logs` table tracks all AI replies and webhook events
- Audit trail for page connections and knowledge base changes

## 🚨 Pre-Production Security Steps

- [ ] Run `npm audit` to check for vulnerable dependencies
- [ ] Enable Supabase Point-in-Time Recovery
- [ ] Set up Vercel Deployment Protection
- [ ] Configure Meta App Permissions for production review
- [ ] Add Sentry or similar error monitoring
- [ ] Set up database query monitoring (Supabase logs)
- [ ] Implement team member roles (future enhancement)
- [ ] Add IP-based rate limiting for critical endpoints
- [ ] Review RLS policies with test queries
- [ ] Perform penetration test on auth flows
