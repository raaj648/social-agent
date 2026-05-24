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

    if (conversation.platform === 'messenger') {
      const page = conversation.connected_pages;
      if (!page?.page_access_token) {
        return NextResponse.json({ error: 'No page access token' }, { status: 400 });
      }
      accessToken = decrypt(page.page_access_token);
    } else if (conversation.platform === 'instagram') {
      const ig = conversation.instagram_accounts;
      if (!ig?.ig_access_token) {
        return NextResponse.json({ error: 'No Instagram access token' }, { status: 400 });
      }
      accessToken = decrypt(ig.ig_access_token);
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

    const ok = await sendSenderAction(senderId, accessToken, 'mark_seen');
    if (!ok) {
      console.error(`[mark-seen] sendSenderAction failed for conversation ${conversationId}`);
    }

    return NextResponse.json({ ok });
  } catch (error) {
    console.error('mark-seen error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
