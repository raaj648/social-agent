import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';
import { sendMessage, sendWhatsAppMessage } from '@/lib/meta/graph';

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

    const { data: aiSettings } = await adminSupabase
      .from('ai_settings')
      .select('agent_display_name, human_handoff_message, show_handoff_on_pause, auto_resume_minutes')
      .eq('user_id', user.id)
      .is('page_id', null)
      .is('instagram_id', null)
      .maybeSingle();

    const agentName = aiSettings?.agent_display_name || 'Support Agent';
    const handoffTemplate = aiSettings?.human_handoff_message || '{agent_name} has joined the chat';
    const handoffMsg = handoffTemplate.replace('{agent_name}', agentName);

    let accessToken = '';
    const platform = conversation.platform as string;

    if (platform === 'messenger' && conversation.connected_pages) {
      accessToken = decrypt(conversation.connected_pages.page_access_token);
      await sendMessage(conversation.sender_id, handoffMsg, accessToken, 'messenger');
    } else if (platform === 'instagram' && conversation.instagram_accounts) {
      accessToken = decrypt(conversation.instagram_accounts.ig_access_token);
      await sendMessage(conversation.sender_id, handoffMsg, accessToken, 'instagram');
    } else if (platform === 'whatsapp' && conversation.whatsapp_accounts) {
      accessToken = decrypt(conversation.whatsapp_accounts.access_token);
      await sendWhatsAppMessage(
        conversation.whatsapp_accounts.phone_number_id,
        conversation.sender_id,
        handoffMsg,
        accessToken
      );
    }

    await adminSupabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: handoffMsg,
      sent_via_ai: true,
    });

    const updateData: Record<string, unknown> = {
      is_ai_paused: true,
      ai_enabled: false,
      is_urgent: false,
    };

    if (aiSettings?.auto_resume_minutes) {
      const autoResumeAt = new Date(Date.now() + aiSettings.auto_resume_minutes * 60 * 1000).toISOString();
      updateData.auto_resume_at = autoResumeAt;
    }

    await adminSupabase.from('conversations').update(updateData).eq('id', conversationId);

    return NextResponse.json({ success: true, message: handoffMsg });
  } catch (error) {
    console.error('Accept handoff error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
