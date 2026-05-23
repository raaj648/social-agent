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
    return NextResponse.redirect(`${origin}/dashboard/pages?error=${error || 'no_code'}`);
  }

  let businessId: string | null = null;
  if (stateRaw) {
    try {
      const parsed = JSON.parse(stateRaw);
      businessId = parsed.businessId || null;
    } catch {
      // state was a plain CSRF token, no businessId
    }
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

        let savedId: string | null = existing?.id || null;

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
            savedId = saved.id;
            const subscribed = await subscribePageToWebhook(page.id, page.access_token);
            if (subscribed) {
              await supabase
                .from('connected_pages')
                .update({ subscribed: true })
                .eq('id', saved.id);
            }
          }
        }

        // Auto-detect Instagram Business Account
        try {
          const igRes = await fetch(
            `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account{ig_id,username,name,profile_picture_url}&access_token=${page.access_token}`
          );
          if (igRes.ok) {
            const igData = await igRes.json();
            if (igData.instagram_business_account) {
              const ig = igData.instagram_business_account;
              const { data: existingIg } = await supabase
                .from('instagram_accounts')
                .select('id')
                .eq('user_id', user.id)
                .eq('ig_account_id', String(ig.ig_id))
                .maybeSingle();
              if (existingIg) {
                await supabase
                  .from('instagram_accounts')
                  .update({
                    page_id: savedId,
                    business_id: businessId,
                    ig_username: ig.username,
                    ig_name: ig.name,
                    ig_profile_pic: ig.profile_picture_url || null,
                    ig_access_token: encryptedToken,
                    is_active: true,
                  })
                  .eq('id', existingIg.id);
              } else {
                await supabase.from('instagram_accounts').insert({
                  user_id: user.id,
                  page_id: savedId,
                  business_id: businessId,
                  ig_account_id: String(ig.ig_id),
                  ig_username: ig.username,
                  ig_name: ig.name,
                  ig_profile_pic: ig.profile_picture_url || null,
                  ig_access_token: encryptedToken,
                  is_active: true,
                });
              }
            }
          }
        } catch {
          // Instagram detection is optional
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
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('Page OAuth callback error:', err);
    return NextResponse.redirect(`${origin}/dashboard/pages?error=connect_failed`);
  }
}
