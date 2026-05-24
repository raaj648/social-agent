import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';
import { sendSenderAction } from '@/lib/meta/graph';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await request.json();
    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
    }

    const adminSupabase = await createAdminClient();

    const { data: conversation } = await adminSupabase
      .from('conversations')
      .select('*, connected_pages!page_id(*), instagram_accounts!instagram_id(*), whatsapp_accounts!whatsapp_id(*)')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    let accessToken = '';
    let senderId = conversation.sender_id;
    let fbPageId: string | undefined;

    if (conversation.platform === 'messenger') {
      const page = conversation.connected_pages;
      if (!page?.page_access_token) {
        return NextResponse.json({ error: 'No page access token' }, { status: 400 });
      }
      accessToken = decrypt(page.page_access_token);
      fbPageId = page.page_id;
    } else if (conversation.platform === 'instagram') {
      const ig = conversation.instagram_accounts;
      if (!ig?.page_id) {
        return NextResponse.json({ error: 'No linked Facebook page for this Instagram account' }, { status: 400 });
      }
      // Look up the linked Facebook Page for the correct token and page ID
      const { data: linkedPage } = await adminSupabase
        .from('connected_pages')
        .select('page_id, page_access_token')
        .eq('id', ig.page_id)
        .single();
      if (!linkedPage?.page_access_token) {
        return NextResponse.json({ error: 'Could not find linked Facebook page token' }, { status: 400 });
      }
      accessToken = decrypt(linkedPage.page_access_token);
      fbPageId = linkedPage.page_id;
    } else if (conversation.platform === 'whatsapp') {
      const wa = conversation.whatsapp_accounts;
      if (!wa?.access_token) {
        return NextResponse.json({ error: 'No WhatsApp access token' }, { status: 400 });
      }
      accessToken = decrypt(wa.access_token);
    } else {
      return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'Could not decrypt access token' }, { status: 500 });
    }

    const ok = await sendSenderAction(senderId, accessToken, 'mark_seen', fbPageId);
    if (!ok) {
      console.error(`[mark-seen] sendSenderAction failed for conversation ${conversationId}`);
    }

    return NextResponse.json({ ok });
  } catch (error) {
    console.error('mark-seen error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
