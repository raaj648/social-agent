import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const requiredVars: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY,
    META_APP_ID: process.env.META_APP_ID,
    NEXT_PUBLIC_META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  };

  const missing = Object.entries(requiredVars)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  return NextResponse.json({
    allPresent: missing.length === 0,
    missing,
    present: Object.entries(requiredVars)
      .filter(([, v]) => !!v)
      .map(([k]) => k),
  });
}
