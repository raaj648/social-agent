'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  MessageSquare, Bot, User, ArrowLeft, Clock, PauseCircle, PlayCircle, Loader2, Send, Trash2, CheckCircle,
  Facebook, Instagram, MessageCircle
} from 'lucide-react';
import { usePageTitle } from '@/lib/use-page-title';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { Conversation, Message } from '@/types';

interface WhatsAppAccount {
  id: string;
  phone_number_id: string;
  phone_number: string;
  business_name: string | null;
  waba_id: string | null;
  is_active: boolean;
}

interface ConnectedPageInfo {
  picture_url: string | null;
  page_name: string | null;
}

interface InstagramAccountInfo {
  ig_profile_pic: string | null;
  ig_username: string | null;
}

interface ConversationWithAccounts extends Conversation {
  whatsapp_accounts?: WhatsAppAccount;
  connected_pages?: ConnectedPageInfo;
  instagram_accounts?: InstagramAccountInfo;
}

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
  const [avatarError, setAvatarError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();

  function isMachineId(name: string): boolean {
    return /^\d+$/.test(name) || /^[a-f0-9-]{32,36}$/i.test(name);
  }

  function getDisplayName(conv: Conversation | null): string {
    if (!conv?.sender_name) return 'Customer';
    if (conv.sender_name === conv.sender_id) return 'Customer';
    if (isMachineId(conv.sender_name)) return 'Customer';
    return conv.sender_name;
  }

  function getAgentAvatar(conv: ConversationWithAccounts | null): string | null {
    if (!conv) return null;
    if (conv.platform === 'messenger') return conv.connected_pages?.picture_url || null;
    if (conv.platform === 'instagram') return conv.instagram_accounts?.ig_profile_pic || null;
    return null;
  }

  const pageTitle = conversation ? getDisplayName(conversation) : 'Conversation';
  usePageTitle(pageTitle);

  useEffect(() => { loadData(); }, []);

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
        ),
        connected_pages:page_id (
          picture_url,
          page_name
        ),
        instagram_accounts:instagram_id (
          ig_profile_pic,
          ig_username
        )
      `)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!conv) { router.push('/dashboard/conversations'); return; }
    setConversation(conv as ConversationWithAccounts);

    if (conv.unread_count > 0) {
      await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', params.id);
      setConversation(prev => prev ? { ...prev, unread_count: 0 } : null);
    }

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
      auto_resume_at: null,
    }).eq('id', conversation.id);
    setConversation(prev => prev ? { ...prev, is_ai_paused: newPaused, ai_enabled: !newPaused, auto_resume_at: null } : prev);
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

  async function handleDelete() {
    if (!conversation || deleting) return;
    setDeleting(true);
    setConfirmDelete(false);
    await supabase.from('conversations').delete().eq('id', conversation.id).eq('user_id', conversation.user_id);
    router.push('/dashboard/conversations');
  }

  async function handleSendReply() {
    if (!replyText.trim() || !conversation || sending) return;
    setSending(true);
    const text = replyText.trim();
    setReplyText('');

    const tempMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversation.id,
      role: 'assistant',
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
  const displayName = getDisplayName(conversation);
  const agentAvatar = getAgentAvatar(conversation as ConversationWithAccounts);

  const platformIcons: Record<string, React.ReactNode> = {
    messenger: <Facebook className="h-3.5 w-3.5 text-blue-600" />,
    instagram: <Instagram className="h-3.5 w-3.5 text-pink-600" />,
    whatsapp: <MessageCircle className="h-3.5 w-3.5 text-green-600" />,
  };

  const platformBadgeColors: Record<string, string> = {
    messenger: 'bg-blue-500',
    instagram: 'bg-pink-500',
    whatsapp: 'bg-green-500',
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Back link */}
      <Link
        href="/dashboard/conversations"
        className="inline-flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to conversations
      </Link>

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Customer avatar */}
          {conversation.sender_picture && !avatarError ? (
            <img
              src={conversation.sender_picture}
              alt={displayName}
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-gray-900"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${platformBadgeColors[conversation.platform] || 'bg-blue-500'} text-white`}>
              <User className="h-5 w-5" />
            </div>
          )}

          {/* Name + platform info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 dark:text-white truncate leading-tight">
              {displayName}
            </h1>
            <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1 capitalize">
                {platformIcons[conversation.platform]}
                {conversation.platform}
              </span>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              {isWithin24h ? (
                <span className="text-green-600 dark:text-green-400 font-medium">{hoursRemaining}h remaining</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">Outside 24h</span>
              )}
              {conversation.unread_count > 0 && (
                <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                  {conversation.unread_count} new
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={toggleAiPause}
              disabled={toggling}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                isAiPaused
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-300'
                  : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
              }`}
            >
              {toggling ? <Loader2 className="h-3 w-3 animate-spin" /> : isAiPaused ? <PlayCircle className="h-3 w-3" /> : <PauseCircle className="h-3 w-3" />}
              {isAiPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-all"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Urgent handoff banner */}
      {conversation.is_urgent && !isAiPaused && (
        <div className="mx-4 mt-2 rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20 p-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 dark:bg-red-900 shrink-0">
                <MessageSquare className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300 leading-tight">Human support requested</p>
                <p className="text-xs text-red-600 dark:text-red-400">Accept to take over this conversation</p>
              </div>
            </div>
            <button
              onClick={acceptHandoff}
              disabled={accepting}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-green-700 transition-all disabled:opacity-50 shrink-0"
            >
              {accepting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              {accepting ? 'Accepting...' : 'Accept'}
            </button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
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
                className={`flex ${isUser ? 'justify-start' : 'justify-end'} animate-fade-in-up items-end gap-2`}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {/* Customer avatar (left side) */}
                {isUser && (
                  <div className="shrink-0">
                    {conversation.sender_picture ? (
                      <img src={conversation.sender_picture} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                        <User className="h-3.5 w-3.5 text-gray-500" />
                      </div>
                    )}
                  </div>
                )}

                {/* Message bubble */}
                <div className={`max-w-[70%] ${isUser ? '' : 'items-end flex flex-col'}`}>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-tl-none'
                      : 'rounded-tr-none'
                  } ${
                    !isUser && isAI
                      ? 'bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 border border-purple-200 dark:border-purple-800 text-gray-900 dark:text-white'
                      : ''
                  } ${
                    !isUser && !isAI
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                      : ''
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 mt-1 ${isUser ? 'ml-1 justify-start' : 'mr-1 justify-end'}`}>
                    <span className="text-[10px] text-muted-foreground">{formatDate(msg.created_at)}</span>
                    <span className="text-[10px] text-muted-foreground/60">{platformIcons[conversation.platform]}</span>
                    {isAI && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 dark:bg-purple-900 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300">
                        <Bot className="h-2.5 w-2.5" />
                        AI
                      </span>
                    )}
                  </div>
                </div>

                {/* Agent avatar (right side) */}
                {!isUser && (
                  <div className="shrink-0">
                    {agentAvatar ? (
                      <img src={agentAvatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full ${
                        conversation.platform === 'instagram'
                          ? 'bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-900 dark:to-rose-900'
                          : conversation.platform === 'whatsapp'
                          ? 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900'
                          : 'bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900'
                      }`}>
                        {conversation.platform === 'instagram'
                          ? <Instagram className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
                          : conversation.platform === 'whatsapp'
                          ? <MessageCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                          : <Facebook className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        }
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className={`border-t ${isAiPaused ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20' : 'border-gray-200 dark:border-gray-800'} px-4 py-3 shrink-0`}>
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
            className={`gap-2 text-sm ${isAiPaused ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isAiPaused ? 'Send (Manual)' : 'Send'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete Conversation"
        message="Are you sure you want to delete this conversation and all its messages? This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        variant="destructive"
      />
    </div>
  );
}
