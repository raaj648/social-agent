import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { getMetaAppId, getMetaAppSecret, getWebhookVerifyToken, getAppUrl } from '@/lib/credentials';

export async function POST(request: NextRequest) {
  try {
    const { pageId } = await request.json();
    if (!pageId) {
      return NextResponse.json({ success: false, error: 'Missing pageId' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: page } = await supabase
      .from('connected_pages')
      .select('id, page_id, page_access_token')
      .eq('id', pageId)
      .single();

    if (!page) {
      return NextResponse.json({ success: false, error: 'Page not found' }, { status: 404 });
    }

    const [metaAppId, metaAppSecret, appUrl, verifyToken] = await Promise.all([
      getMetaAppId(), getMetaAppSecret(), getAppUrl(), getWebhookVerifyToken(),
    ]);
    const accessToken = decrypt(page.page_access_token);

    const appAccessToken = `${metaAppId}|${metaAppSecret}`;

    const subscribeRes = await fetch(
      `https://graph.facebook.com/v19.0/${page.page_id}/subscribed_apps?access_token=${accessToken}&subscribed_fields=messages,message_deliveries,messaging_optins,messaging_postbacks`,
      { method: 'POST' }
    );
    const subscribeData = await subscribeRes.json();

    if (!subscribeData.success) {
      return NextResponse.json({ success: false, error: subscribeData.error?.message || 'Failed to subscribe' }, { status: 400 });
    }

    const callbackUrl = `${appUrl}/api/webhooks/meta`;
    const callbackRes = await fetch(
      `https://graph.facebook.com/v19.0/${metaAppId}/subscriptions?access_token=${appAccessToken}&object=page&callback_url=${encodeURIComponent(callbackUrl)}&verify_token=${verifyToken}&fields=messages,message_deliveries,messaging_optins,messaging_postbacks`,
      { method: 'POST' }
    );
    const callbackData = await callbackRes.json();

    if (!callbackData.success && callbackData.error?.code !== 100) {
      console.error('Failed to set callback URL:', callbackData);
    }

    await supabase.from('connected_pages').update({ subscribed: true }).eq('id', pageId);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Resubscribe error:', e);
    return NextResponse.json({ success: false, error: e.message || 'Internal error' }, { status: 500 });
  }
}
