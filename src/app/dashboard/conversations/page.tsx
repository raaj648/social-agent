'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare, Facebook, Instagram, MessageCircle, Inbox, Archive, Search, RefreshCw, Loader2
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { usePageTitle } from '@/lib/use-page-title';
import type { Conversation } from '@/types';

export default function ConversationsPage() {
  usePageTitle('Conversations');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [erroredAvatars, setErroredAvatars] = useState<Set<string>>(new Set());
  const supabase = createClient();
  const showArchivedRef = useRef(showArchived);
  showArchivedRef.current = showArchived;

  useEffect(() => { loadConversations(); }, []);

  async function loadConversations() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(50);

    if (!showArchivedRef.current) {
      query = query.eq('is_archived', false);
    }

    const { data } = await query;
    const convs = data || [];
    setConversations(convs);

    // Fetch last message preview for each conversation
    if (convs.length > 0) {
      const ids = convs.map(c => c.id);
      const { data: msgs } = await supabase
        .from('messages')
        .select('conversation_id, content')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false });
      const lastMap: Record<string, string> = {};
      if (msgs) {
        for (const msg of msgs) {
          if (!lastMap[msg.conversation_id]) {
            lastMap[msg.conversation_id] = msg.content.substring(0, 100);
          }
        }
      }
      setLastMessages(lastMap);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadConversations();
  }, [showArchived]);

  useEffect(() => {
    let channel: any;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const tid = user.id;
      channel = supabase
        .channel('conversations-realtime')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${tid}`,
        }, () => {
          loadConversations();
        })
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  async function handleArchive(convId: string, archived: boolean) {
    await supabase.from('conversations').update({ is_archived: archived }).eq('id', convId);
    setConversations(prev => archived ? prev.filter(c => c.id !== convId) : prev);
  }

  const filtered = useMemo(() => {
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c =>
      c.sender_name?.toLowerCase().includes(q) ||
      c.sender_id.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conversations</h1>
          <p className="text-muted-foreground">View and manage customer conversations</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              showArchived ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            <Archive className="h-4 w-4" />
            {showArchived ? 'Hide Archived' : `Show Archived`}
          </button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Inbox className="h-4 w-4" />
            {filtered.length} {showArchived ? 'total' : 'active'}
          </div>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">No conversations yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                When customers message your connected pages, their conversations will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((conv, i) => (
            <div
              key={conv.id}
              className="group animate-fade-in-up relative"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Link href={`/dashboard/conversations/${conv.id}`}>
                <Card className={`transition-all hover:border-blue-200 hover:shadow-md hover:-translate-y-0.5 ${conv.is_urgent ? 'border-red-300 bg-red-50/30 dark:border-red-800 dark:bg-red-950/10' : ''}`}>
                  <CardHeader className="flex flex-row items-center gap-4 py-4">
                    {conv.sender_picture && !erroredAvatars.has(conv.id) ? (
                      <img
                        src={conv.sender_picture}
                        alt={conv.sender_name || conv.sender_id}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                        onError={() => setErroredAvatars(prev => new Set(prev).add(conv.id))}
                      />
                    ) : (
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        conv.platform === 'instagram' ? 'bg-gradient-to-br from-pink-100 to-rose-100' :
                        conv.platform === 'whatsapp' ? 'bg-gradient-to-br from-green-100 to-emerald-100' : 'bg-blue-100'
                      }`}>
                        {conv.platform === 'instagram'
                          ? <Instagram className="h-5 w-5 text-pink-600" />
                          : conv.platform === 'whatsapp'
                          ? <MessageCircle className="h-5 w-5 text-green-600" />
                          : <Facebook className="h-5 w-5 text-blue-600" />
                        }
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base truncate">
                          {conv.sender_name || conv.sender_id}
                        </CardTitle>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(conv.last_message_at)}
                        </span>
                      </div>
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="capitalize">{conv.platform}</span>
                        {conv.is_urgent && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300 animate-pulse">
                            Urgent
                          </span>
                        )}
                        {conv.unread_count > 0 && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {conv.unread_count} new
                          </span>
                        )}
                        {conv.is_archived && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            Archived
                          </span>
                        )}
                      </p>
                      {lastMessages[conv.id] && (
                        <p className="mt-1 text-xs text-muted-foreground truncate leading-relaxed">
                          {lastMessages[conv.id]}
                        </p>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleArchive(conv.id, !conv.is_archived);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
                title={conv.is_archived ? 'Unarchive' : 'Archive'}
              >
                <Archive className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}