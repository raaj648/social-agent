import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encrypt, decrypt } from '@/lib/crypto';
import { getInstagramBusinessAccount } from '@/lib/meta/graph';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pageId } = await request.json();
    if (!pageId) {
      return NextResponse.json({ error: 'Missing page ID' }, { status: 400 });
    }

    const { data: connectedPage } = await supabase
      .from('connected_pages')
      .select('id, page_access_token')
      .eq('user_id', user.id)
      .eq('page_id', pageId)
      .single();

    if (!connectedPage) {
      return NextResponse.json({ error: 'Page not connected' }, { status: 404 });
    }

    const pageAccessToken = decrypt(connectedPage.page_access_token);
    const igAccount = await getInstagramBusinessAccount(pageId, pageAccessToken);
    if (!igAccount) {
      return NextResponse.json(
        { error: 'No Instagram Business account linked to this page' },
        { status: 400 }
      );
    }

    const encryptedToken = encrypt(pageAccessToken);

    const { data: existing } = await supabase
      .from('instagram_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('ig_account_id', String(igAccount.ig_id))
      .single();

    if (existing) {
      await supabase
        .from('instagram_accounts')
        .update({
          ig_username: igAccount.username,
          ig_name: igAccount.name,
          ig_profile_pic: igAccount.profile_picture_url,
          ig_access_token: encryptedToken,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('instagram_accounts').insert({
        user_id: user.id,
        page_id: connectedPage.id,
        ig_account_id: String(igAccount.ig_id),
        ig_username: igAccount.username,
        ig_name: igAccount.name,
        ig_profile_pic: igAccount.profile_picture_url,
        ig_access_token: encryptedToken,
      });
    }

    await supabase.from('usage_logs').insert({
      user_id: user.id,
      action: 'instagram_connect',
      metadata: { ig_username: igAccount.username, page_id: pageId },
    });

    return NextResponse.json(
      {
        success: true,
        account: {
          id: String(igAccount.ig_id),
          username: igAccount.username,
          name: igAccount.name,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Instagram connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect Instagram' },
      { status: 500 }
    );
  }
}
