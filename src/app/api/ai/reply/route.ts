import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handleAIResponse } from '@/lib/ai/handler';
import { checkRateLimit } from '@/lib/rate-limit';
import { decrypt } from '@/lib/crypto';
import { sendMessage, sendInstagramMessage, sendWhatsAppMessage } from '@/lib/meta/graph';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed } = await checkRateLimit(user.id, 'ai_reply');
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { conversationId, messageText, platform = 'messenger' } = await request.json();

    if (!conversationId || !messageText) {
      return NextResponse.json({ error: 'Missing conversation ID or message text' }, { status: 400 });
    }

    const { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    let accessToken = '';
    if (platform === 'messenger' && conversation.page_id) {
      const { data: page } = await supabase
        .from('connected_pages')
        .select('page_access_token')
        .eq('id', conversation.page_id)
        .single();
      if (page) accessToken = decrypt(page.page_access_token);
    } else if (platform === 'instagram' && conversation.instagram_id) {
      const { data: ig } = await supabase
        .from('instagram_accounts')
        .select('ig_access_token')
        .eq('id', conversation.instagram_id)
        .single();
      if (ig) accessToken = decrypt(ig.ig_access_token);
    } else if (platform === 'whatsapp' && conversation.whatsapp_id) {
      const { data: wa } = await supabase
        .from('whatsapp_accounts')
        .select('access_token')
        .eq('id', conversation.whatsapp_id)
        .single();
      if (wa) accessToken = decrypt(wa.access_token);
    }

    // Save user message to database
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: messageText,
      sent_via_ai: false,
    });

    // If conversation is paused, send message directly to platform without AI
    if (conversation.is_ai_paused) {
      let sent = false;
      if (platform === 'messenger') {
        sent = await sendMessage(conversation.sender_id, messageText, accessToken, 'messenger');
      } else if (platform === 'instagram' && conversation.instagram_id) {
        const { data: igAccount } = await supabase
          .from('instagram_accounts')
          .select('ig_account_id')
          .eq('id', conversation.instagram_id)
          .single();
        if (igAccount) {
          sent = await sendInstagramMessage(igAccount.ig_account_id, conversation.sender_id, messageText, accessToken);
        }
      } else if (platform === 'whatsapp' && conversation.whatsapp_id) {
        const { data: waAccount } = await supabase
          .from('whatsapp_accounts')
          .select('phone_number_id')
          .eq('id', conversation.whatsapp_id)
          .single();
        if (waAccount) {
          sent = await sendWhatsAppMessage(waAccount.phone_number_id, conversation.sender_id, messageText, accessToken);
        }
      }
      return NextResponse.json({ success: true, manual: true, sent }, { status: 200 });
    }

    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('user_id', conversation.user_id)
      .single();

    if (!aiSettings) {
      return NextResponse.json({ error: 'AI settings not configured' }, { status: 400 });
    }

    await handleAIResponse(
      conversation.user_id,
      user.id,
      conversation.page_id,
      conversation.instagram_id,
      conversation.whatsapp_id,
      conversationId,
      conversation.sender_id,
      messageText,
      accessToken,
      platform as 'messenger' | 'instagram' | 'whatsapp',
      aiSettings
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('AI reply error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
