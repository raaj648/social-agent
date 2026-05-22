'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  MessageSquare, Bot, User, ArrowLeft, Clock, PauseCircle, PlayCircle, Loader2, Send
} from 'lucide-react';
import { usePageTitle } from '@/lib/use-page-title';
import type { Conversation, Message } from '@/types';

export default function ConversationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();

  usePageTitle(conversation?.sender_name || 'Conversation');

  useEffect(() => { loadData(); }, []);

  interface WhatsAppAccount {
  id: string;
  phone_number_id: string;
  phone_number: string;
  business_name: string | null;
  waba_id: string | null;
  is_active: boolean;
}

interface ConversationWithWhatsApp extends Conversation {
  whatsapp_accounts?: WhatsAppAccount;
}

async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data: conv } = await supabase
      .from('conversations')
      .select(`
        *,
        whatsapp_accounts:whatsapp_id (
          id,
          phone_number_id,
          phone_number,
          business_name,
          waba_id
        )
      `)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!conv) { router.push('/dashboard/conversations'); return; }
    setConversation(conv as ConversationWithWhatsApp);

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', params.id)
      .order('created_at', { ascending: true });

    setMessages(msgs || []);
    setLoading(false);
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function toggleAiPause() {
    if (!conversation) return;
    setToggling(true);
    const newPaused = !conversation.is_ai_paused;
    await supabase.from('conversations').update({
      is_ai_paused: newPaused,
      ai_enabled: !newPaused,
    }).eq('id', conversation.id);
    setConversation(prev => prev ? { ...prev, is_ai_paused: newPaused, ai_enabled: !newPaused } : prev);
    setToggling(false);
  }

  async function acceptHandoff() {
    if (!conversation || accepting) return;
    setAccepting(true);
    try {
      const res = await fetch('/api/conversations/accept-handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conversation.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to accept');
      setConversation(prev => prev ? { ...prev, is_ai_paused: true, ai_enabled: false, is_urgent: false } : prev);
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });
      if (msgs) setMessages(msgs);
    } catch (e) {
      console.error('Accept error:', e);
    } finally {
      setAccepting(false);
    }
  }

  async function handleSendReply() {
    if (!replyText.trim() || !conversation || sending) return;
    setSending(true);
    const text = replyText.trim();
    setReplyText('');

    const tempMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversation.id,
      role: 'user',
      content: text,
      platform_msg_id: null,
      is_read: true,
      sent_via_ai: false,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await fetch('/api/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          messageText: text,
          platform: conversation.platform,
        }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error || 'Failed to send reply');
      }
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });
      if (msgs) setMessages(msgs);
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      console.error('Send reply error:', e);
    } finally {
      setSending(false);
    }
  }

  const isWithin24h = conversation
    ? (Date.now() - new Date(conversation.last_interaction || conversation.last_message_at).getTime()) < 24 * 60 * 60 * 1000
    : false;

  const hoursRemaining = conversation
    ? Math.max(0, Math.floor((24 * 60 * 60 * 1000 - (Date.now() - new Date(conversation.last_interaction || conversation.last_message_at).getTime())) / (1000 * 60 * 60)))
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) return null;

  const isAiPaused = conversation.is_ai_paused;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/conversations"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to conversations
      </Link>

      <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950 border border-blue-100 dark:border-blue-900 p-6">
        <div className="flex items-start gap-4">
          {conversation.sender_picture ? (
            <img
              src={conversation.sender_picture}
              alt={conversation.sender_name || conversation.sender_id}
              className="h-14 w-14 shrink-0 rounded-xl object-cover shadow-md"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
              <MessageSquare className="h-7 w-7" />
            </div>
          )}
          <div className="flex-1 min-w-0">
           <div className="flex items-start justify-between gap-4">
               <div>
                 <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                   {conversation.sender_name || conversation.sender_id}
                 </h1>
               {conversation.platform === 'whatsapp' && (
                 <div className="space-y-1">
                   <p className="text-sm font-medium">
                     {(conversation as any).whatsapp_accounts?.business_name || 'WhatsApp Business'}
                   </p>
                   {(conversation as any).whatsapp_accounts?.phone_number && (
                     <p className="text-xs text-muted-foreground">
                       {(conversation as any).whatsapp_accounts?.phone_number}
                     </p>
                   )}
                 </div>
               )}
               <p className="text-muted-foreground capitalize flex items-center gap-2 mt-1">
                 <span className={`inline-block h-2 w-2 rounded-full ${
                   conversation.platform === 'instagram' ? 'bg-pink-500' :
                   conversation.platform === 'whatsapp' ? 'bg-green-500' : 'bg-blue-500'
                 }`} />
                 {conversation.platform} conversation
                 {conversation.unread_count > 0 && (
                   <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                     {conversation.unread_count} unread
                   </span>
                 )}
               </p>
             </div>

              {/* AI Pause Toggle */}
              <button
                onClick={toggleAiPause}
                disabled={toggling}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  isAiPaused
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-300'
                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
                }`}
              >
                {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : isAiPaused ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                {isAiPaused ? 'Resume AI' : 'Pause AI'}
              </button>
            </div>

            {/* 24-hour window indicator */}
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {isWithin24h ? (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  Free messaging window: {hoursRemaining}h remaining
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Outside 24h window — next user message opens new window
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Urgent human handoff banner */}
      {conversation.is_urgent && !isAiPaused && (
        <div className="rounded-2xl border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20 p-4 animate-pulse">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <MessageSquare className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-red-800 dark:text-red-300">Customer requested human support</p>
                <p className="text-sm text-red-600 dark:text-red-400">This customer asked to speak to a real person</p>
              </div>
            </div>
            <button
              onClick={acceptHandoff}
              disabled={accepting}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-green-700 transition-all disabled:opacity-50"
            >
              {accepting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              {accepting ? 'Accepting...' : 'Accept'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Messages</span>
          <span className="ml-auto text-xs text-muted-foreground">{messages.length} messages</span>
        </div>

        <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
                <MessageSquare className="h-8 w-8 text-gray-400" />
              </div>
              <p className="font-medium text-gray-900 dark:text-white">No messages yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Messages will appear here when the conversation continues.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const isAI = msg.sent_via_ai;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-start' : 'justify-end'} animate-fade-in-up`}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className={`flex gap-3 max-w-[75%] ${isUser ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isUser
                        ? 'bg-gray-100 dark:bg-gray-800'
                        : isAI
                        ? 'bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900 dark:to-blue-900'
                        : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                    }`}>
                      {isUser && conversation?.sender_picture ? (
                        <img src={conversation.sender_picture} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : isUser ? (
                        <User className="h-4 w-4 text-gray-500" />
                      ) : isAI ? (
                        <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                        isUser
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-tl-none'
                          : isAI
                          ? 'bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 border border-purple-200 dark:border-purple-800 text-gray-900 dark:text-white rounded-tr-none'
                          : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-tr-none'
                      }`}>
                        <p>{msg.content}</p>
                      </div>
                      <div className={`flex items-center gap-2 mt-1 ${isUser ? 'ml-1' : 'mr-1 justify-end'}`}>
                        <span className="text-xs text-muted-foreground">{formatDate(msg.created_at)}</span>
                        {isAI && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300">
                            <Bot className="h-3 w-3" />
                            AI
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={`border-t ${isAiPaused ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20' : 'border-gray-100 dark:border-gray-800'} p-4`}>
          <div className="flex gap-2">
            <Input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
              placeholder={isAiPaused ? "AI is paused — reply manually" : "Type a message to send via AI..."}
              disabled={sending}
              className="flex-1"
            />
            <Button
              onClick={handleSendReply}
              disabled={sending || !replyText.trim()}
              className={`gap-2 ${isAiPaused ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isAiPaused ? 'Send (Manual)' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
