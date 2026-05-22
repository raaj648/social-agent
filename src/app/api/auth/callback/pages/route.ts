import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLongLivedUserToken, getUserPages, subscribePageToWebhook } from '@/lib/meta/graph';
import { getMetaAppId, getMetaAppSecret } from '@/lib/credentials';
import { encrypt } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${origin}/dashboard/pages?error=${error || 'no_code'}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?redirect=/dashboard/pages`);
  }

  const [metaAppId, metaAppSecret] = await Promise.all([getMetaAppId(), getMetaAppSecret()]);
  if (!metaAppId || !metaAppSecret) {
    return NextResponse.redirect(`${origin}/dashboard/pages?error=meta_not_configured`);
  }

  try {
    const tokenUrl = 'https://graph.facebook.com/v19.0/oauth/access_token';
    const tokenParams = new URLSearchParams({
      client_id: metaAppId,
      client_secret: metaAppSecret,
      redirect_uri: `${origin}/api/auth/callback/pages`,
      code,
    });

    const tokenRes = await fetch(`${tokenUrl}?${tokenParams}`, { method: 'GET' });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${origin}/dashboard/pages?error=token_exchange_failed`);
    }

    const longLivedToken = await getLongLivedUserToken(tokenData.access_token, metaAppId, metaAppSecret);
    const pages = await getUserPages(longLivedToken);

    for (const page of pages) {
      const encryptedToken = encrypt(page.access_token);

      const { data: existing } = await supabase
        .from('connected_pages')
        .select('id')
        .eq('user_id', user.id)
        .eq('page_id', page.id)
        .single();

      if (existing) {
        await supabase
          .from('connected_pages')
          .update({
            page_name: page.name,
            page_category: page.category,
            picture_url: page.picture?.data?.url,
            page_access_token: encryptedToken,
          })
          .eq('id', existing.id);
      } else {
        const { error: insertErr } = await supabase.from('connected_pages').insert({
          user_id: user.id,
          page_id: page.id,
          page_name: page.name,
          page_category: page.category,
          picture_url: page.picture?.data?.url,
          page_access_token: encryptedToken,
        });
        if (insertErr) throw new Error('Insert connected_page failed: ' + insertErr.message);
      }

      const { data: saved } = await supabase
        .from('connected_pages')
        .select('id')
        .eq('user_id', user.id)
        .eq('page_id', page.id)
        .single();

      if (saved) {
        const subscribed = await subscribePageToWebhook(page.id, page.access_token);
        if (subscribed) {
          await supabase
            .from('connected_pages')
            .update({ subscribed: true })
            .eq('id', saved.id);
        }
      }
    }

    await supabase.from('usage_logs').insert({
      user_id: user.id,
      action: 'page_connect',
      metadata: { pages_count: pages.length },
    });

    return NextResponse.redirect(`${origin}/dashboard/pages?connected=true`);
  } catch (err) {
    console.error('Page OAuth callback error:', err);
    return NextResponse.redirect(`${origin}/dashboard/pages?error=connect_failed`);
  }
}
