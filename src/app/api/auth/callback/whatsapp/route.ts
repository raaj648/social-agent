import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLongLivedUserToken, getUserBusinesses, getOwnedWhatsAppBusinessAccounts, getWAPhoneNumbers } from '@/lib/meta/graph';
import { getMetaAppId, getMetaAppSecret } from '@/lib/credentials';
import { encrypt } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${origin}/dashboard/pages?wa_error=${error || 'no_code'}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?redirect=/dashboard/pages`);
  }

  const [metaAppId, metaAppSecret] = await Promise.all([getMetaAppId(), getMetaAppSecret()]);
  if (!metaAppId || !metaAppSecret) {
    return NextResponse.redirect(`${origin}/dashboard/pages?wa_error=meta_not_configured`);
  }

  try {
    const tokenUrl = 'https://graph.facebook.com/v19.0/oauth/access_token';
    const tokenParams = new URLSearchParams({
      client_id: metaAppId,
      client_secret: metaAppSecret,
      redirect_uri: `${origin}/api/auth/callback/whatsapp`,
      code,
    });

    const tokenRes = await fetch(`${tokenUrl}?${tokenParams}`, { method: 'GET' });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${origin}/dashboard/pages?wa_error=token_exchange_failed`);
    }

    const longLivedToken = await getLongLivedUserToken(tokenData.access_token, metaAppId, metaAppSecret);
    const businesses = await getUserBusinesses(longLivedToken);

    let connectedCount = 0;

    for (const business of businesses) {
      const wabas = await getOwnedWhatsAppBusinessAccounts(business.id, longLivedToken);

      for (const waba of wabas) {
        const phoneNumbers = await getWAPhoneNumbers(waba.id, longLivedToken);

        for (const pn of phoneNumbers) {
          const encryptedToken = encrypt(longLivedToken);

          const { data: existing } = await supabase
            .from('whatsapp_accounts')
            .select('id')
            .eq('user_id', user.id)
            .eq('phone_number_id', pn.id)
            .single();

          if (existing) {
            await supabase
              .from('whatsapp_accounts')
              .update({
                phone_number: pn.display_phone_number,
                business_name: pn.verified_name,
                waba_id: waba.id,
                access_token: encryptedToken,
              })
              .eq('id', existing.id);
          } else {
            await supabase.from('whatsapp_accounts').insert({
              user_id: user.id,
              phone_number_id: pn.id,
              phone_number: pn.display_phone_number,
              business_name: pn.verified_name,
              waba_id: waba.id,
              access_token: encryptedToken,
            });
          }

          connectedCount++;
        }
      }
    }

    await supabase.from('usage_logs').insert({
      user_id: user.id,
      action: 'whatsapp_connect',
      platform: 'whatsapp',
      metadata: { method: 'facebook_oauth', accounts_connected: connectedCount },
    });

    return NextResponse.redirect(`${origin}/dashboard/pages?whatsapp_connected=true&count=${connectedCount}`);
  } catch (err) {
    console.error('WhatsApp OAuth callback error:', err);
    return NextResponse.redirect(`${origin}/dashboard/pages?wa_error=discovery_failed`);
  }
}
