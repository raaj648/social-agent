# SocialReply AI

Multi-tenant SaaS platform for **Facebook Messenger Auto Reply**, **Instagram DM Auto Reply**, and **Facebook Page AI Chatbot**.

Built for businesses in Bangladesh and global markets.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Vercel (Next.js)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Frontend   │  │  API Routes  │  │  Webhook Endpoint │  │
│  │  (React/     │  │  (Serverless)│  │  /api/webhooks/   │  │
│  │   Tailwind)  │  │              │  │  meta              │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                 │                    │             │
└─────────┼─────────────────┼────────────────────┼─────────────┘
          │                 │                    │
          ▼                 ▼                    ▼
   ┌────────────┐   ┌────────────┐   ┌────────────────────┐
   │  Supabase  │   │  OpenRouter │   │  Meta Graph API   │
   │  Auth + DB │   │  AI API     │   │  Messenger/IG     │
   │  Storage   │   │             │   │  Webhooks         │
   └────────────┘   └────────────┘   └────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Radix UI |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL) with Row Level Security |
| Auth | Supabase Auth (email/password + Google OAuth) |
| AI | OpenRouter API (GPT-4o, Claude, Gemini, Llama, etc.) |
| Messaging | Meta Graph API v19.0 |
| Hosting | Vercel |
| Encryption | AES-256-GCM for Meta tokens |

## Project Structure

```
social-reply-ai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── webhooks/meta/     → Webhook receiver for Meta
│   │   │   ├── auth/callback/     → OAuth callback handler
│   │   │   ├── pages/connect/     → Facebook Page connector
│   │   │   └── instagram/connect/ → Instagram connector
│   │   ├── dashboard/
│   │   │   ├── conversations/     → View & manage conversations
│   │   │   ├── pages/             → Connected pages management
│   │   │   ├── knowledge-base/    → FAQ & business info editor
│   │   │   ├── settings/          → AI model & behavior config
│   │   │   └── analytics/         → Usage stats & monitoring
│   │   ├── login/                 → Login page
│   │   └── signup/                → Signup page
│   ├── components/
│   │   ├── ui/                    → Reusable UI (Button, Card, Input)
│   │   └── layout/                → Sidebar, navigation
│   ├── lib/
│   │   ├── supabase/              → Client, server, admin clients
│   │   ├── ai/                    → OpenRouter handler + prompts
│   │   └── meta/                  → Graph API + webhook processor
│   ├── types/                     → TypeScript types
│   └── middleware.ts              → Auth middleware
├── supabase/
│   └── migrations/                → Database schema + RPCs
├── DEPLOYMENT.md                  → Step-by-step deployment guide
└── SECURITY.md                    → Security architecture & checklist
```

## Quick Start

```bash
# Clone
git clone https://github.com/your-org/social-reply-ai
cd social-reply-ai

# Install
npm install

# Copy env
cp .env.example .env.local

# Fill in env variables (see DEPLOYMENT.md)

# Run dev
npm run dev
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles, quota, plan info |
| `tenants` | Multi-tenant workspaces |
| `connected_pages` | Facebook Pages with encrypted tokens |
| `instagram_accounts` | Instagram Business accounts |
| `conversations` | Customer conversations |
| `messages` | Individual messages with role tracking |
| `knowledge_base` | Business info, FAQs, pricing, policies |
| `ai_settings` | Per-tenant AI model configuration |
| `usage_logs` | Audit trail for all actions |

## Key Features

- **Multi-tenant isolation** via Row Level Security
- **Encrypted Meta tokens** with AES-256-GCM
- **Smart prompt engineering** with dynamic knowledge injection
- **Conversation memory** (last N messages)
- **Fallback responses** when AI fails or quota exceeded
- **Rate limiting** per user (sliding window + daily quota)
- **Business hours** support
- **Keyword blacklist** for sensitive topics
- **Multiple AI models** via OpenRouter
- **Webhook signature verification**

## License

MIT
