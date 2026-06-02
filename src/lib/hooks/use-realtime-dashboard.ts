'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Profile = Record<string, unknown> | null;
type Conversation = Record<string, unknown>;

interface DashboardData {
  loading: boolean;
  profile: Profile;
  pageCount: number;
  igCount: number;
  waCount: number;
  conversationCount: number;
  recentConversations: Conversation[];
}

export function useRealtimeDashboard(): DashboardData {
  const supabase = createClient();
  const channelsRef = useRef<RealtimeChannel[]>([]);

  const [state, setState] = useState<DashboardData>({
    loading: true,
    profile: null,
    pageCount: 0,
    igCount: 0,
    waCount: 0,
    conversationCount: 0,
    recentConversations: [],
  });

  const fetchInitialData = useCallback(async (userId: string) => {
    const [profileRes, pageRes, igRes, waRes, convCountRes, recentRes] = await Promise.all([
      supabase.from('users').select('id, full_name, email, plan, credits_remaining, credits_total, business_name, user_number').eq('id', userId).single(),
      supabase.from('connected_pages').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('instagram_accounts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('whatsapp_accounts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_archived', false),
      supabase.from('conversations').select('id, sender_id, sender_name, sender_picture, platform, last_message_at, unread_count').eq('user_id', userId).eq('is_archived', false).order('last_message_at', { ascending: false }).limit(5),
    ]);

    setState({
      loading: false,
      profile: profileRes.data as Profile,
      pageCount: pageRes.count ?? 0,
      igCount: igRes.count ?? 0,
      waCount: waRes.count ?? 0,
      conversationCount: convCountRes.count ?? 0,
      recentConversations: (recentRes.data ?? []) as Conversation[],
    });
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;

      fetchInitialData(user.id);

      const userId = user.id;
      const channels: RealtimeChannel[] = [];
      channelsRef.current = channels;

      const userChannel = supabase.channel(`dashboard-users-${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        }, (payload) => {
          setState(prev => ({ ...prev, profile: payload.new as Profile }));
        })
        .subscribe();
      channels.push(userChannel);

      const pagesChannel = supabase.channel(`dashboard-pages-${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'connected_pages',
          filter: `user_id=eq.${userId}`,
        }, () => {
          setState(prev => ({ ...prev, pageCount: prev.pageCount + 1 }));
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'connected_pages',
          filter: `user_id=eq.${userId}`,
        }, () => {
          setState(prev => ({ ...prev, pageCount: Math.max(0, prev.pageCount - 1) }));
        })
        .subscribe();
      channels.push(pagesChannel);

      const igChannel = supabase.channel(`dashboard-ig-${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'instagram_accounts',
          filter: `user_id=eq.${userId}`,
        }, () => {
          setState(prev => ({ ...prev, igCount: prev.igCount + 1 }));
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'instagram_accounts',
          filter: `user_id=eq.${userId}`,
        }, () => {
          setState(prev => ({ ...prev, igCount: Math.max(0, prev.igCount - 1) }));
        })
        .subscribe();
      channels.push(igChannel);

      const waChannel = supabase.channel(`dashboard-wa-${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_accounts',
          filter: `user_id=eq.${userId}`,
        }, () => {
          setState(prev => ({ ...prev, waCount: prev.waCount + 1 }));
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'whatsapp_accounts',
          filter: `user_id=eq.${userId}`,
        }, () => {
          setState(prev => ({ ...prev, waCount: Math.max(0, prev.waCount - 1) }));
        })
        .subscribe();
      channels.push(waChannel);

      const convChannel = supabase.channel(`dashboard-convs-${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${userId}`,
        }, (payload) => {
          const conv = payload.new as Record<string, unknown>;
          if (conv.is_archived) return;
          setState(prev => {
            const next = [conv as Conversation, ...prev.recentConversations].slice(0, 5);
            return { ...prev, conversationCount: prev.conversationCount + 1, recentConversations: next };
          });
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${userId}`,
        }, (payload) => {
          const updated = payload.new as Record<string, unknown>;
          if (updated.is_archived) {
            setState(prev => ({
              ...prev,
              conversationCount: Math.max(0, prev.conversationCount - 1),
              recentConversations: prev.recentConversations.filter(c => c.id !== updated.id),
            }));
            return;
          }
          setState(prev => {
            const filtered = prev.recentConversations.filter(c => c.id !== updated.id);
            const next = [updated as Conversation, ...filtered].slice(0, 5);
            const countDelta = filtered.length === prev.recentConversations.length ? 0 : 0;
            return { ...prev, recentConversations: next };
          });
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${userId}`,
        }, (payload) => {
          const old = payload.old as Record<string, unknown>;
          setState(prev => ({
            ...prev,
            conversationCount: Math.max(0, prev.conversationCount - 1),
            recentConversations: prev.recentConversations.filter(c => c.id !== old.id),
          }));
        })
        .subscribe();
      channels.push(convChannel);
    });

    return () => {
      cancelled = true;
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [supabase, fetchInitialData]);

  return state;
}
