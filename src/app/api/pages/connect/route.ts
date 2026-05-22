import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto';
import { getLongLivedUserToken, getUserPages, subscribePageToWebhook } from '@/lib/meta/graph';
import { getMetaAppId, getMetaAppSecret } from '@/lib/credentials';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shortLivedToken } = await request.json();
    if (!shortLivedToken) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 400 });
    }

    const [metaAppId, metaAppSecret] = await Promise.all([
  getMetaAppId(),
  getMetaAppSecret()
]);
const longLivedToken = await getLongLivedUserToken(shortLivedToken, metaAppId, metaAppSecret);

    const pages = await getUserPages(longLivedToken);

    const results: Array<{ page_id: string; page_name: string; status: string }> = [];

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
        await supabase.from('connected_pages').insert({
          user_id: user.id,
          page_id: page.id,
          page_name: page.name,
          page_category: page.category,
          picture_url: page.picture?.data?.url,
          page_access_token: encryptedToken,
        });
      }

      const subscribed = await subscribePageToWebhook(page.id, page.access_token);

      if (subscribed) {
        await supabase
          .from('connected_pages')
          .update({ subscribed: true })
          .eq('user_id', user.id)
          .eq('page_id', page.id);
      }

      results.push({
        page_id: page.id,
        page_name: page.name,
        status: 'connected',
      });
    }

    await supabase.from('usage_logs').insert({
      user_id: user.id,
      action: 'page_connect',
      metadata: { pages_count: pages.length },
    });

    return NextResponse.json({ success: true, pages: results }, { status: 200 });
  } catch (error) {
    console.error('Page connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect pages' },
      { status: 500 }
    );
  }
}
