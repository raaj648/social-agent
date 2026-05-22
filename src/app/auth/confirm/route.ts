import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token = searchParams.get('token');
  const type = searchParams.get('type');

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options: { [key: string]: unknown } }[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          },
        },
      }
    );
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      const fbIdentity = data.session.user.identities?.find(i => i.provider === 'facebook');
      if (fbIdentity && data.session.provider_token) {
        try {
          const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${data.session.provider_token}`);
          const pagesData = await pagesRes.json();
          if (pagesData.data) {
            for (const page of pagesData.data) {
              const { data: existing } = await supabase
                .from('connected_pages')
                .select('id')
                .eq('page_id', page.id)
                .maybeSingle();
              if (!existing) {
                await supabase.from('connected_pages').insert({
                  user_id: data.session.user.id,
                  page_id: page.id,
                  page_name: page.name,
                  page_access_token: encrypt(page.access_token),
                  subscribed: false,
                  is_active: true,
                });
              }
              await fetch(`https://graph.facebook.com/v18.0/${page.id}/subscribed_apps?access_token=${page.access_token}&subscribed_fields=conversations,messages`, {
                method: 'POST',
              });
            }
          }
        } catch (fbErr) {
          console.error('Facebook auto-connect error:', fbErr);
        }
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  if (token && type === 'signup') {
    return NextResponse.redirect(`${origin}/login?message=Email confirmed! Please sign in.`);
  }

  if (token && type === 'recovery') {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  return NextResponse.redirect(`${origin}/login?error=Verification failed. Please try again.`);
}
