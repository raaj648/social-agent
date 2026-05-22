# Deployment Guide

## 1. GitHub Setup

```bash
# Initialize repository
cd social-reply-ai
git init
git add .
git commit -m "Initial commit: SocialReply AI multi-tenant SaaS"

# Create GitHub repo and push
gh repo create social-reply-ai --public --push
```

## 2. Supabase Setup

### Create Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose a strong database password
3. Select region closest to your users (e.g., Singapore for Bangladesh)

### Run Migrations
```bash
# Install Supabase CLI
npm install -g supabase

# Link your project
supabase link --project-ref <your-project-ref>

# Push the schema
supabase db push

# Or run manually in Supabase SQL Editor:
# - Open supabase/migrations/001_schema.sql
# - Open supabase/migrations/002_rpc.sql
# - Paste and run both in order
```

### Configure Auth
1. Go to Authentication → Providers → Email
2. Enable email/password auth
3. (Optional) Enable Google provider
4. Go to Authentication → URL Configuration
5. Set Site URL to `https://your-app.vercel.app`
6. Add redirect URLs: `https://your-app.vercel.app/api/auth/callback`

### Get API Keys
- Go to Project Settings → API
- Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- Copy `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

## 3. Meta/Facebook Developer Setup

### Create App
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a new app → Business type
3. Add Facebook Login product
4. Add Webhooks product
5. Add Messenger product

### Configure Facebook Login
1. Settings → Basic: Copy `App ID` → `META_APP_ID` and `App Secret` → `META_APP_SECRET`
2. Facebook Login → Settings:
   - Valid OAuth Redirect URIs: `https://your-app.vercel.app/api/auth/callback`
   - Login with JavaScript SDK: Yes

### Configure Webhooks
1. Webhooks → Page → Subscribe to:
   - `messages`
   - `messaging_postbacks`
   - `message_deliveries`
2. Callback URL: `https://your-app.vercel.app/api/webhooks/meta`
3. Verify Token: Generate a random string → `META_WEBHOOK_VERIFY_TOKEN`

### Get Instagram Graph API Access
1. Add Instagram Graph API to your app
2. Go to Products → Instagram Graph API → Configure
3. Link your Facebook Page (must have Instagram Business connected)

## 4. OpenRouter Setup

1. Go to [openrouter.ai](https://openrouter.ai) and sign up
2. Generate API key → `OPENROUTER_API_KEY`
3. Add credits to your account

## 5. Encryption Key

Generate a secure encryption key for storing Meta tokens:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output → `ENCRYPTION_KEY`

## 6. Vercel Deployment

### Connect Repository
1. Go to [vercel.com](https://vercel.com)
2. Import `social-reply-ai` from GitHub
3. Use framework preset: Next.js

### Environment Variables
Add all variables from `.env.example`:

| Variable | Where to Get |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings → API |
| `OPENROUTER_API_KEY` | OpenRouter dashboard |
| `OPENROUTER_SITE_URL` | `https://your-app.vercel.app` |
| `OPENROUTER_SITE_NAME` | `SocialReply AI` |
| `META_APP_ID` | Meta Developer App settings |
| `NEXT_PUBLIC_META_APP_ID` | Same as META_APP_ID |
| `META_APP_SECRET` | Meta Developer App settings |
| `META_WEBHOOK_VERIFY_TOKEN` | Your random verify token |
| `ENCRYPTION_KEY` | Generated 32-byte hex key |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | `SocialReply AI` |

### Set Build Command
```
npm run build
```

### Set Output Directory
Keep default: `.next`

## 7. Post-Deployment

### Verify Webhook
1. Go to `https://your-app.vercel.app/api/webhooks/meta`
2. You should see `Webhook verification failed` (expected without verify token)
3. Configure webhook in Meta Developer dashboard with your verify token
4. Meta will send a GET request to verify → should return 200

### Test the System
1. Sign up at `https://your-app.vercel.app`
2. Connect Facebook Page
3. Add knowledge base entries
4. Configure AI settings
5. Send a test message to your Facebook Page
6. Check conversations dashboard for AI reply

## 8. Production Checklist

- [ ] Set up custom domain on Vercel
- [ ] Enable Vercel Analytics
- [ ] Set up Supabase backup schedule
- [ ] Configure rate limiting (already implemented)
- [ ] Set up monitoring (Sentry, etc.)
- [ ] Add SSL certificate (automatic with Vercel)
- [ ] Configure Meta App review for production
- [ ] Set up OpenRouter credits auto-top-up
- [ ] Test with real Facebook user
- [ ] Verify Instagram DM auto-reply works
