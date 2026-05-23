import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLongLivedUserToken, getUserPages, subscribePageToWebhook } from '@/lib/meta/graph';
import { getMetaAppId, getMetaAppSecret } from '@/lib/credentials';
import { encrypt } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const stateRaw = searchParams.get('state');

  if (error || !code) {
    return respondOrRedirect(request, `${origin}/dashboard/pages?error=${error || 'no_code'}`, { success: false, error: error || 'no_code' });
  }

  let businessId: string | null = null;
  let mode: 'redirect' | 'popup' = 'redirect';
  if (stateRaw) {
    try {
      const parsed = JSON.parse(stateRaw);
      businessId = parsed.businessId || null;
      if (parsed.mode === 'popup') mode = 'popup';
    } catch {
      // state was a plain CSRF token, no businessId
    }
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return respondOrRedirect(request, `${origin}/login?redirect=/dashboard/pages`, { success: false, error: 'not_authenticated' });
  }

  const [metaAppId, metaAppSecret] = await Promise.all([getMetaAppId(), getMetaAppSecret()]);
  if (!metaAppId || !metaAppSecret) {
    return respondOrRedirect(request, `${origin}/dashboard/pages?error=meta_not_configured`, { success: false, error: 'meta_not_configured' });
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
      return respondOrRedirect(request, `${origin}/dashboard/pages?error=token_exchange_failed`, { success: false, error: 'token_exchange_failed' });
    }

    const longLivedToken = await getLongLivedUserToken(tokenData.access_token, metaAppId, metaAppSecret);

    // Save long-lived Facebook user token for future "add more pages" use
    const encryptedFbToken = encrypt(longLivedToken);
    await supabase.from('users').update({ fb_user_access_token: encryptedFbToken }).eq('id', user.id);

    const pages = await getUserPages(longLivedToken);
    let connected = 0;
    let errors = 0;

    for (const page of pages) {
      try {
        if (!page.access_token) {
          errors++;
          continue;
        }
        const encryptedToken = encrypt(page.access_token);

        const { data: existing } = await supabase
          .from('connected_pages')
          .select('id')
          .eq('user_id', user.id)
          .eq('page_id', page.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('connected_pages')
            .update({
              page_name: page.name,
              page_category: page.category,
              picture_url: page.picture?.data?.url,
              page_access_token: encryptedToken,
              business_id: businessId,
            })
            .eq('id', existing.id);
          connected++;
        } else {
          const { error: insertErr } = await supabase.from('connected_pages').insert({
            user_id: user.id,
            business_id: businessId,
            page_id: page.id,
            page_name: page.name,
            page_category: page.category,
            picture_url: page.picture?.data?.url,
            page_access_token: encryptedToken,
          });
          if (insertErr) {
            errors++;
            continue;
          }
          connected++;

          const { data: saved } = await supabase
            .from('connected_pages')
            .select('id')
            .eq('user_id', user.id)
            .eq('page_id', page.id)
            .maybeSingle();

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
      } catch {
        errors++;
      }
    }

    await supabase.from('usage_logs').insert({
      user_id: user.id,
      action: 'page_connect',
      metadata: { pages_count: pages.length, connected, errors },
    });

    const redirectUrl = connected > 0
      ? `${origin}/dashboard/pages?connected=true&count=${connected}${errors > 0 ? `&errors=${errors}` : ''}`
      : `${origin}/dashboard/pages?error=connect_failed`;

    return respondOrRedirect(request, redirectUrl, { success: connected > 0, count: connected, errors });
  } catch (err) {
    console.error('Page OAuth callback error:', err);
    return respondOrRedirect(request, `${origin}/dashboard/pages?error=connect_failed`, { success: false, error: 'connect_failed' });
  }
}

function respondOrRedirect(request: NextRequest, redirectUrl: string, payload: Record<string, unknown>) {
  const url = new URL(request.url);
  const stateRaw = url.searchParams.get('state');
  let mode = 'redirect';
  if (stateRaw) {
    try { const parsed = JSON.parse(stateRaw); if (parsed.mode === 'popup') mode = 'popup'; } catch {}
  }

  if (mode === 'popup') {
    const html = `<html><body><script>
      if (window.opener) {
        window.opener.postMessage(${JSON.stringify({ type: 'fb-connect', ...payload })}, '*');
      }
      window.close();
    </script></body></html>`;
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  }

  return NextResponse.redirect(redirectUrl);
}
