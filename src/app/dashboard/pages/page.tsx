'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Facebook, Instagram, MessageCircle, Loader2, Trash2, Link2, Plus, CheckCircle2, AlertCircle, Smartphone, X, Save, RefreshCw, Send, Gamepad2, LayoutDashboard, Building2, ChevronDown } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { usePageTitle } from '@/lib/use-page-title';
import BusinessSelector from '@/components/business/BusinessSelector';
import type { Business } from '@/types';

interface ConnectedPage {
  id: string;
  page_id: string;
  page_name: string;
  picture_url: string | null;
  page_category: string | null;
  subscribed: boolean;
  business_id: string | null;
}

interface InstagramAccount {
  id: string;
  user_id: string;
  page_id: string | null;
  ig_account_id: string;
  ig_username: string;
  ig_name: string | null;
  ig_profile_pic: string | null;
  is_active: boolean;
  business_id: string | null;
}

interface WhatsAppAccount {
  id: string;
  phone_number_id: string;
  phone_number: string;
  business_name: string | null;
  waba_id: string | null;
  is_active: boolean;
  business_id: string | null;
}

interface TelegramBot {
  id: string;
  bot_username: string | null;
  is_active: boolean;
  business_id: string | null;
}

interface DiscordBot {
  id: string;
  bot_username: string | null;
  guild_id: string | null;
  channel_id: string | null;
  channel_ids: string[];
  client_id: string | null;
  is_active: boolean;
  business_id: string | null;
  display_name: string | null;
  command_name: string | null;
}

function PagesPageInner() {
  usePageTitle('Connected Accounts');
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [pages, setPages] = useState<ConnectedPage[]>([]);
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([]);
  const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [linkingInstagram, setLinkingInstagram] = useState<string | null>(null);
  const [disconnectingWa, setDisconnectingWa] = useState<string | null>(null);
  const [showWaForm, setShowWaForm] = useState(false);
  const [waForm, setWaForm] = useState({ phoneNumberId: '', phoneNumber: '', businessName: '', wabaId: '', accessToken: '' });
  const [connectingWa, setConnectingWa] = useState(false);
  const [connectingWaFb, setConnectingWaFb] = useState(false);
  const [waError, setWaError] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState<{ type: 'page' | 'whatsapp' | 'telegram' | 'discord' | 'instagram'; id: string } | null>(null);
  const [showAddPages, setShowAddPages] = useState(false);
  const [availablePages, setAvailablePages] = useState<Array<{ page_id: string; page_name: string; page_category: string | null; picture_url: string | null }>>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [connectingPages, setConnectingPages] = useState(false);
  const [selectedAvailablePages, setSelectedAvailablePages] = useState<Set<string>>(new Set());
  const [telegramBots, setTelegramBots] = useState<TelegramBot[]>([]);
  const [discordBots, setDiscordBots] = useState<DiscordBot[]>([]);
  const [showTelegramForm, setShowTelegramForm] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [connectingTelegram, setConnectingTelegram] = useState(false);
  const [showDiscordForm, setShowDiscordForm] = useState(false);
  const [discordWizardStep, setDiscordWizardStep] = useState(1);
  const [discordToken, setDiscordToken] = useState('');
  const [discordBotInfo, setDiscordBotInfo] = useState<{ id: string; username: string } | null>(null);
  const [discordGuilds, setDiscordGuilds] = useState<Array<{ id: string; name: string }>>([]);
  const [discordChannels, setDiscordChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [discordSelectedGuild, setDiscordSelectedGuild] = useState('');
  const [discordSelectedChannels, setDiscordSelectedChannels] = useState<string[]>([]);
  const [discordDisplayName, setDiscordDisplayName] = useState('');
  const [discordCommandName, setDiscordCommandName] = useState('chat');
  const discordPopupRef = useRef<Window | null>(null);
  const [discordInvitedGuild, setDiscordInvitedGuild] = useState<string | null>(null);
  const [discordInviting, setDiscordInviting] = useState(false);
  const [connectingDiscord, setConnectingDiscord] = useState(false);
  const [discoveringDiscord, setDiscoveringDiscord] = useState(false);
  const [disconnectingTg, setDisconnectingTg] = useState<string | null>(null);
  const [dismissedPermWarnings, setDismissedPermWarnings] = useState<Set<string>>(() => { try { if (typeof window !== 'undefined') { const s = localStorage.getItem('discordPermDismissed'); return s ? new Set(JSON.parse(s)) : new Set(); } } catch {} return new Set(); });const [disconnectingDc, setDisconnectingDc] = useState<string | null>(null);const [permCheckStatus, setPermCheckStatus] = useState<Record<string, 'loading' | 'ok' | 'missing'>>({});
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [showInstagramConnect, setShowInstagramConnect] = useState(false);
  const [availableIgPages, setAvailableIgPages] = useState<Array<{ page_id: string; page_name: string; id: string; ig_id: string; ig_username: string; ig_name: string; ig_profile_pic: string | null }>>([]);
  const [loadingAvailableIg, setLoadingAvailableIg] = useState(false);
  const [assigningBusiness, setAssigningBusiness] = useState<{ type: 'page' | 'whatsapp' | 'telegram' | 'discord' | 'instagram'; id: string } | null>(null);
  const fbSectionRef = useRef<HTMLDivElement>(null);
  const igSectionRef = useRef<HTMLDivElement>(null);
  const waSectionRef = useRef<HTMLDivElement>(null);
  const tgSectionRef = useRef<HTMLDivElement>(null);
  const dcSectionRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const searchParams = useSearchParams();

  const loadPages = useCallback(async (businessId?: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const bid = businessId !== undefined ? businessId : activeBusinessId;

    let baseQuery = supabase.from('connected_pages').select('*').eq('user_id', user.id);
    let igQuery = supabase.from('instagram_accounts').select('*').eq('user_id', user.id);
    let waQuery = supabase.from('whatsapp_accounts').select('*').eq('user_id', user.id);
    let tgQuery = supabase.from('telegram_bots').select('*').eq('user_id', user.id);
    let dcQuery = supabase.from('discord_bots').select('*').eq('user_id', user.id);

    if (bid) {
      baseQuery = baseQuery.eq('business_id', bid);
      igQuery = igQuery.eq('business_id', bid);
      waQuery = waQuery.eq('business_id', bid);
      tgQuery = tgQuery.eq('business_id', bid);
      dcQuery = dcQuery.eq('business_id', bid);
    }

    const [pagesRes, igRes, waRes, tgRes, dcRes] = await Promise.all([
      baseQuery,
      igQuery,
      waQuery,
      tgQuery,
      dcQuery,
    ]);

    setPages(pagesRes.data || []);
    setInstagramAccounts(igRes.data || []);
    setWhatsappAccounts(waRes.data || []);
    setTelegramBots(tgRes.data || []);
    setDiscordBots(dcRes.data || []);
    setLoading(false);
  }, [activeBusinessId]);

  const loadBusinesses = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('businesses').select('*').eq('user_id', user.id).order('created_at');
    setBusinesses(data || []);
  }, []);

  async function handleAssignBusiness(type: string, id: string, businessId: string | null) {
    const table = type === 'page' ? 'connected_pages'
      : type === 'whatsapp' ? 'whatsapp_accounts'
      : type === 'telegram' ? 'telegram_bots'
      : type === 'discord' ? 'discord_bots'
      : 'instagram_accounts';
    const idColumn = 'id';
    await supabase.from(table).update({ business_id: businessId }).eq(idColumn, id);
    await loadPages();
    setAssigningBusiness(null);
    toast.success('Business assigned');
  }

  useEffect(() => {
    setLoading(true);
    loadPages();
    loadBusinesses();
  }, [loadPages, activeBusinessId, loadBusinesses]);

  useEffect(() => {
    if (discordBots.length === 0) return;
    const ids = discordBots.map(b => b.id).filter(Boolean);
    setPermCheckStatus(prev => {
      const next = { ...prev };
      for (const id of ids) {
        if (!next[id]) next[id] = 'loading';
      }
      return next;
    });
    for (const bot of discordBots) {
      if (!bot.id) continue;
      (async () => {
        try {
          const res = await fetch('/api/discord/check-permissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ botId: bot.id }),
          });
          const data = await res.json();
          setPermCheckStatus(prev => ({ ...prev, [bot.id]: data.ok ? 'ok' : 'missing' }));
        } catch {
          setPermCheckStatus(prev => ({ ...prev, [bot.id]: 'missing' }));
        }
      })();
    }
  }, [discordBots]);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setConnecting(false);
      setConnectingWaFb(false);
      const messages: Record<string, string> = {
        token_exchange_failed: 'Facebook token exchange failed. Check Meta App configuration.',
        connect_failed: 'Failed to connect your account. Please try again.',
        meta_not_configured: 'Meta App is not configured in Admin Settings.',
        no_code: 'No authorization code received from Facebook.',
      };
      if (messages[error]) toast.error(messages[error]);
    }
    if (searchParams.get('connected') === 'true') {
      setConnecting(false);
      loadPages();
    }
    if (searchParams.get('whatsapp_connected') === 'true') {
      setConnectingWaFb(false);
      loadPages();
      const count = searchParams.get('count');
      if (count && parseInt(count) > 0) {
        toast.success(`Connected ${count} WhatsApp account(s) via Facebook`);
      } else {
        toast.success('WhatsApp connected via Facebook');
      }
    }
    if (searchParams.get('wa_error')) {
      setConnectingWaFb(false);
      toast.error('Failed to connect WhatsApp via Facebook: ' + searchParams.get('wa_error'));
    }
  }, [searchParams]);

async function handleWhatsAppFacebookConnect() {
    setConnectingWaFb(true);
    const origin = window.location.origin;
    const state = JSON.stringify({ csrf: crypto.randomUUID(), businessId: activeBusinessId });
    sessionStorage.setItem('fb_wa_oauth_state', state);
    let appId = '';
    try { const r = await fetch('/api/meta/app-id'); const d = await r.json(); if (d.appId) appId = d.appId; } catch {}
    if (!appId) {
        setConnectingWaFb(false);
        toast.error('Meta App ID not configured');
        return;
    }
    window.location.href = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${origin}/api/auth/callback/whatsapp&response_type=code&state=${encodeURIComponent(state)}&scope=business_management,whatsapp_business_management,whatsapp_business_messaging`;
}

async function handleFacebookConnect() {
    setConnecting(true);
    const origin = window.location.origin;
    const state = JSON.stringify({ csrf: crypto.randomUUID(), businessId: activeBusinessId, mode: 'popup' });
    sessionStorage.setItem('fb_oauth_state', state);
    let appId = '';
    try { const r = await fetch('/api/meta/app-id'); const d = await r.json(); if (d.appId) appId = d.appId; } catch {}
    if (!appId) {
        setConnecting(false);
        toast.error('Meta App ID not configured');
        return;
    }
    const fbUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${origin}/api/auth/callback/pages&response_type=code&state=${encodeURIComponent(state)}&scope=pages_show_list,pages_messaging,pages_manage_metadata,instagram_manage_messages,business_management,instagram_basic,pages_read_engagement,whatsapp_business_messaging`;

    const popup = window.open(fbUrl, 'fb-connect', 'width=600,height=700');
    if (!popup) {
      // Popup blocked — fall back to full redirect
      window.location.href = fbUrl;
      return;
    }

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'fb-connect') {
        window.removeEventListener('message', handler);
        setConnecting(false);
        loadPages();
        if (event.data.success) {
          toast.success(`Connected ${event.data.count || 0} page(s) successfully`);
        } else {
          toast.error('Failed to connect Facebook page');
        }
      }
    };
    window.addEventListener('message', handler);

    // Fallback: if popup closes without message (user closed it), reset state
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handler);
        setConnecting(false);
      }
    }, 1000);
}

  async function handleOpenAddPages() {
    setShowAddPages(true);
    setLoadingAvailable(true);
    setAvailablePages([]);
    setSelectedAvailablePages(new Set());
    try {
      const res = await fetch('/api/pages/available');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load available pages');
        setShowAddPages(false);
        return;
      }
      setAvailablePages(data.pages || []);
      if (!data.pages || data.pages.length === 0) {
        toast.info('No new pages available to connect');
      }
    } catch {
      toast.error('Failed to load available pages');
      setShowAddPages(false);
    } finally {
      setLoadingAvailable(false);
    }
  }

  async function handleConnectSelectedPages() {
    const selected = availablePages.filter((p) => selectedAvailablePages.has(p.page_id));
    if (selected.length === 0) return;
    setConnectingPages(true);
    try {
      const res = await fetch('/api/pages/connect-more', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: selected, businessId: activeBusinessId }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddPages(false);
        toast.success(`Connected ${data.connected} page(s) successfully`);
        if (data.errors > 0) toast.error(`${data.errors} page(s) failed to connect`);
        loadPages();
      } else {
        toast.error(data.error || 'Failed to connect pages');
      }
    } catch {
      toast.error('Failed to connect pages');
    } finally {
      setConnectingPages(false);
    }
  }

  function toggleAvailablePage(pageId: string) {
    setSelectedAvailablePages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  }

  async function handleConnectTelegram() {
    if (!telegramToken) return;
    setConnectingTelegram(true);
    try {
      const res = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: telegramToken, businessId: activeBusinessId }),
      });
      const data = await res.json();
      if (data.success) {
        setShowTelegramForm(false);
        setTelegramToken('');
        toast.success('Telegram bot connected successfully');
        loadPages();
      } else {
        toast.error(data.error || 'Failed to connect Telegram bot');
      }
    } catch {
      toast.error('Failed to connect Telegram bot');
    } finally {
      setConnectingTelegram(false);
    }
  }

  async function handleDisconnectTelegram(id: string) {
    setDisconnectingTg(id);
    try {
      const res = await fetch(`/api/telegram/disconnect`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to disconnect');
      await loadPages();
      toast.success('Telegram bot disconnected');
    } catch (e: any) {
      toast.error(e.message || 'Failed to disconnect');
    } finally {
      setDisconnectingTg(null);
    }
  }

  function dismissPermWarning(id: string){setDismissedPermWarnings(function(p){var x=new Set(p);x.add(id);try{localStorage.setItem('discordPermDismissed',JSON.stringify(Array.from(x)))}catch{}return x;})}function resetDiscordWizard() {
    setShowDiscordForm(false);
    setDiscordWizardStep(1);
    setDiscordToken('');
    setDiscordBotInfo(null);
    setDiscordGuilds([]);
    setDiscordChannels([]);
    setDiscordSelectedGuild('');
    setDiscordSelectedChannels([]);
    setDiscordDisplayName('');
    setDiscordCommandName('chat');
  }

  async function handleDiscordVerifyToken() {
    if (!discordToken) return;
    setDiscoveringDiscord(true);
    try {
      const res = await fetch('/api/discord/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: discordToken }),
      });
      const data = await res.json();
      if (data.botInfo) {
        setDiscordBotInfo(data.botInfo);
        setDiscordGuilds(data.guilds || []);
        if (data.guilds && data.guilds.length > 0) {
          handleDiscordLoadChannels(data.guilds[0].id);
        } else {
          setDiscordWizardStep(2);
        }
      } else {
        toast.error(data.error || 'Invalid Discord bot token');
      }
    } catch {
      toast.error('Failed to verify Discord bot token');
    } finally {
      setDiscoveringDiscord(false);
    }
  }

  async function handleDiscordLoadChannels(guildId: string) {
    if (!guildId || !discordToken) return;
    setDiscordSelectedGuild(guildId);
    setDiscordChannels([]);
    setDiscordSelectedChannels([]);
    try {
      const res = await fetch('/api/discord/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: discordToken, guildId }),
      });
      const data = await res.json();
      if (data.channels) {
        setDiscordChannels(data.channels);
        setDiscordWizardStep(3);
        setDiscordSelectedChannels(data.channels.map((c: { id: string }) => c.id));
      }
    } catch {
      toast.error('Failed to load channels');
    }
  }

  async function handleDiscordRefreshGuilds() {
    if (!discordToken) return;
    try {
      const res = await fetch('/api/discord/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: discordToken }),
      });
      const data = await res.json();
      if (data.guilds && data.guilds.length > 0) {
        setDiscordGuilds(data.guilds);
        setDiscordInvitedGuild(data.guilds[0].name);
        setDiscordInviting(false);
        toast.success(`Bot added to "${data.guilds[0].name}"`);
      }
    } catch {
      // Silently retry
    }
  }

  function handleDiscordInvite() {
    if (!discordBotInfo?.id) return;
    setDiscordInviting(true);
    setDiscordInvitedGuild(null);
    const initialGuildCount = discordGuilds.length;
    discordPopupRef.current = window.open(
      `https://discord.com/api/oauth2/authorize?client_id=${discordBotInfo.id}&permissions=463960656960&scope=bot%20applications.commands`,
      'discord-auth',
      'width=600,height=700'
    );
    const checkInterval = setInterval(async () => {
      if (discordPopupRef.current?.closed) {
        clearInterval(checkInterval);
        discordPopupRef.current = null;
        handleDiscordRefreshGuilds();
        return;
      }
      try {
        const res = await fetch('/api/discord/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botToken: discordToken }),
        });
        const data = await res.json();
        if (data.guilds && data.guilds.length > initialGuildCount) {
          setDiscordGuilds(data.guilds);
          setDiscordInvitedGuild(data.guilds[0].name);
          setDiscordInviting(false);
          if (discordPopupRef.current && !discordPopupRef.current.closed) {
            discordPopupRef.current.close();
          }
          clearInterval(checkInterval);
          discordPopupRef.current = null;
          toast.success(`Bot added to "${data.guilds[0].name}"`);
        }
      } catch {
        // Silently retry
      }
    }, 2000);
  }

  async function handleFinishDiscordConnect() {
    if (!discordToken || !discordSelectedGuild || discordSelectedChannels.length === 0) return;
    setConnectingDiscord(true);
    try {
      const res = await fetch('/api/discord/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: discordToken,
          clientId: discordBotInfo?.id || '',
          guildId: discordSelectedGuild,
          channelIds: discordSelectedChannels,
          businessId: activeBusinessId,
          displayName: discordDisplayName,
          commandName: discordCommandName || 'chat',
        }),
      });
      const data = await res.json();
      if (data.success) {
        resetDiscordWizard();
        toast.success('Discord bot connected successfully');
        loadPages();
      } else {
        toast.error(data.error || 'Failed to connect Discord bot');
      }
    } catch {
      toast.error('Failed to connect Discord bot');
    } finally {
      setConnectingDiscord(false);
    }
  }

  async function handleDisconnectDiscord(id: string) {
    setDisconnectingDc(id);
    try {
      const res = await fetch(`/api/discord/disconnect`, {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to disconnect');
      await loadPages();
      toast.success('Discord bot disconnected');
    } catch (e: any) {
      toast.error(e.message || 'Failed to disconnect');
    } finally {
      setDisconnectingDc(null);
    }
  }

  async function handleOpenInstagramConnect() {
    if (pages.length === 0) {
      toast.info('Connect a Facebook Page first to link Instagram');
      return;
    }
    setShowInstagramConnect(true);
    setLoadingAvailableIg(true);
    setAvailableIgPages([]);
    try {
      const res = await fetch('/api/instagram/available-pages');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load available Instagram accounts');
        setShowInstagramConnect(false);
        return;
      }
      setAvailableIgPages(data.pages || []);
      if (!data.pages || data.pages.length === 0) {
        toast.info('No Instagram Business accounts found. Make sure your Instagram is a Professional account linked to a Facebook Page.');
      }
    } catch {
      toast.error('Failed to load available Instagram accounts');
      setShowInstagramConnect(false);
    } finally {
      setLoadingAvailableIg(false);
    }
  }

  async function handleConnectInstagram(pageId: string) {
    setLinkingInstagram(pageId);
    try {
      const res = await fetch('/api/instagram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, businessId: activeBusinessId }),
      });
      const data = await res.json();
      if (data.success) {
        setShowInstagramConnect(false);
        await loadPages();
        toast.success('Instagram linked successfully');
      } else {
        toast.error(data.error || 'Failed to link Instagram');
      }
    } catch {
      toast.error('Failed to link Instagram account');
    } finally {
      setLinkingInstagram(null);
    }
  }

  async function handleResubscribe(pageId: string) {
    try {
      const res = await fetch('/api/webhooks/resubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Webhook resubscribed');
        loadPages();
      } else {
        toast.error(data.error || 'Failed to resubscribe');
      }
    } catch {
      toast.error('Failed to resubscribe webhook');
    }
  }

  async function handleDisconnectPage(pageId: string) {
    setConfirmDisconnect(null);
    const { error } = await supabase.from('connected_pages').delete().eq('id', pageId);
    if (error) {
      toast.error('Failed to disconnect page');
      return;
    }
    setPages((prev) => prev.filter((p) => p.id !== pageId));
    toast.success('Page disconnected');
  }

  async function handleDisconnectInstagram(id: string) {
    setConfirmDisconnect(null);
    const { error } = await supabase.from('instagram_accounts').delete().eq('id', id);
    if (error) {
      toast.error('Failed to disconnect Instagram');
      return;
    }
    setInstagramAccounts((prev) => prev.filter((ig) => ig.id !== id));
    toast.success('Instagram account disconnected');
  }

  async function handleDisconnectWhatsApp(id: string) {
    setConfirmDisconnect(null);
    setDisconnectingWa(id);
    try {
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to disconnect');
      setWhatsappAccounts((prev) => prev.filter((a) => a.id !== id));
      toast.success('WhatsApp account disconnected');
    } catch (e: any) {
      toast.error(e.message || 'Failed to disconnect');
    } finally {
      setDisconnectingWa(null);
    }
  }

  async function handleConnectWhatsApp() {
    if (!waForm.phoneNumberId || !waForm.phoneNumber || !waForm.accessToken) return;
    setConnectingWa(true);
    setWaError('');
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...waForm, businessId: activeBusinessId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to connect');
      setShowWaForm(false);
      setWaForm({ phoneNumberId: '', phoneNumber: '', businessName: '', wabaId: '', accessToken: '' });
      loadPages();
      toast.success('WhatsApp account connected');
    } catch (e: any) {
      setWaError(e.message);
    } finally {
      setConnectingWa(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const platformCounts = {
    facebook: pages.length,
    instagram: instagramAccounts.length,
    whatsapp: whatsappAccounts.length,
    telegram: telegramBots.length,
    discord: discordBots.length,
  };

  function scrollToSection(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="space-y-8">
      {/* Business Selector */}
      <div className="flex flex-wrap items-center gap-3 pb-2">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <BusinessSelector activeBusinessId={activeBusinessId} onSelect={setActiveBusinessId} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Connected Accounts</h1>
          <p className="text-muted-foreground mt-1">
            {activeBusinessId
              ? 'Manage accounts for the selected business'
              : 'Manage all your connected platforms'}
          </p>
        </div>
        <Button onClick={handleFacebookConnect} disabled={connecting} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {connecting ? 'Connecting...' : 'Connect Facebook'}
        </Button>
      </div>

      {/* Platform Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button onClick={() => scrollToSection(fbSectionRef)} className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${pages.length > 0 ? 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20' : 'border-muted'}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <Facebook className={`h-5 w-5 ${pages.length > 0 ? 'text-blue-600' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{platformCounts.facebook}</p>
              <p className="text-xs text-muted-foreground">Facebook Pages</p>
            </div>
          </div>
        </button>
        <button onClick={() => scrollToSection(igSectionRef)} className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${platformCounts.instagram > 0 ? 'border-pink-200 bg-pink-50/50 dark:border-pink-800 dark:bg-pink-950/20' : 'border-muted'}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-900/50">
              <Instagram className={`h-5 w-5 ${platformCounts.instagram > 0 ? 'text-pink-600' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{platformCounts.instagram}</p>
              <p className="text-xs text-muted-foreground">Instagram</p>
            </div>
          </div>
        </button>
        <button onClick={() => scrollToSection(waSectionRef)} className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${platformCounts.whatsapp > 0 ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' : 'border-muted'}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
              <MessageCircle className={`h-5 w-5 ${platformCounts.whatsapp > 0 ? 'text-green-600' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{platformCounts.whatsapp}</p>
              <p className="text-xs text-muted-foreground">WhatsApp</p>
            </div>
          </div>
        </button>
        <button onClick={() => scrollToSection(tgSectionRef)} className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${platformCounts.telegram > 0 ? 'border-blue-300 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20' : 'border-muted'}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/50">
              <Send className={`h-5 w-5 ${platformCounts.telegram > 0 ? 'text-sky-600' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{platformCounts.telegram}</p>
              <p className="text-xs text-muted-foreground">Telegram</p>
            </div>
          </div>
        </button>
        <button onClick={() => scrollToSection(dcSectionRef)} className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${platformCounts.discord > 0 ? 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20' : 'border-muted'}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
              <Gamepad2 className={`h-5 w-5 ${platformCounts.discord > 0 ? 'text-indigo-600' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{platformCounts.discord}</p>
              <p className="text-xs text-muted-foreground">Discord</p>
            </div>
          </div>
        </button>
      </div>

      {/* Facebook Pages */}
      <div ref={fbSectionRef}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            Facebook Pages
          </h2>
          {pages.length > 0 && (
            <Button onClick={handleOpenAddPages} variant="outline" size="sm" className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-50">
              <Plus className="h-4 w-4" /> Add More Pages
            </Button>
          )}
        </div>
        {pages.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100">
                <Facebook className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="font-medium">No pages connected yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Connect your Facebook Page to start automating replies</p>
              </div>
              <Button onClick={handleFacebookConnect} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4" /> Connect Your First Page
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pages.map((page) => (
              <Card key={page.id} className="card-hover overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-blue-500 to-purple-500" />
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="relative h-12 w-12 shrink-0">
                    {page.picture_url ? (
                      <img
                        src={page.picture_url}
                        alt={page.page_name}
                        className="h-12 w-12 rounded-xl object-cover shadow"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.querySelector('.fallback')?.classList.remove('hidden'); }}
                      />
                    ) : null}
                    <div className={`fallback absolute inset-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow ${page.picture_url ? 'hidden' : ''}`}>
                      <Facebook className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-lg truncate">{page.page_name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{page.page_category || 'Page'}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`h-2 w-2 rounded-full ${page.subscribed ? 'bg-green-500' : 'bg-amber-500'}`} />
                      <span>{page.subscribed ? 'Webhook active' : 'Webhook not subscribed'}</span>
                    </div>

                    {!page.subscribed && (
                      <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-sm border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                        <span className="flex-1 text-amber-700 dark:text-amber-400">Webhook not subscribed</span>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleResubscribe(page.id)}>
                          <RefreshCw className="h-3 w-3" /> Resubscribe
                        </Button>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      {!activeBusinessId && businesses.length > 0 && !page.business_id && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setAssigningBusiness({ type: 'page', id: page.id })}>
                          <Building2 className="h-4 w-4" /> Assign
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => setConfirmDisconnect({ type: 'page', id: page.id })}>
                        <Trash2 className="h-4 w-4" /> Disconnect
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Instagram Accounts */}
      <div ref={igSectionRef}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-600" />
            Instagram
          </h2>
          {pages.length > 0 && (
            <Button onClick={handleOpenInstagramConnect} className="gap-2 bg-pink-600 hover:bg-pink-700 text-white" size="sm">
              <Plus className="h-4 w-4" /> Connect Instagram
            </Button>
          )}
        </div>
        {instagramAccounts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-100">
                <Instagram className="h-8 w-8 text-pink-600" />
              </div>
              <div className="text-center">
                <p className="font-medium">No Instagram accounts connected</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Connect a Facebook Page first, then click "Connect Instagram" to link your Instagram Business account.
                </p>
              </div>
              {pages.length === 0 ? (
                <Button onClick={handleFacebookConnect} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                  <Facebook className="h-4 w-4" /> Connect Facebook Page First
                </Button>
              ) : (
                <Button onClick={handleOpenInstagramConnect} className="gap-2 bg-pink-600 hover:bg-pink-700 text-white">
                  <Plus className="h-4 w-4" /> Connect Instagram
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {instagramAccounts.map((ig) => {
              const linkedPage = pages.find((p) => p.id === ig.page_id);
              return (
                <Card key={ig.id} className="card-hover overflow-hidden">
                  <div className="h-1.5 bg-gradient-to-r from-pink-500 to-rose-500" />
                  <CardHeader className="flex flex-row items-center gap-4">
                    {ig.ig_profile_pic ? (
                      <div className="relative h-12 w-12 shrink-0">
                        <img
                          src={ig.ig_profile_pic}
                          alt={ig.ig_username}
                          className="h-12 w-12 rounded-xl object-cover shadow"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.querySelector('.fallback')?.classList.remove('hidden'); }}
                        />
                        <div className="fallback absolute inset-0 hidden items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow">
                          <Instagram className="h-6 w-6" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow">
                        <Instagram className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="text-lg truncate">@{ig.ig_username}</CardTitle>
                      <p className="text-xs text-muted-foreground">{ig.ig_name || 'Instagram Account'}</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <div className={`h-2 w-2 rounded-full ${ig.is_active ? 'bg-green-500' : 'bg-amber-500'}`} />
                        <span>{ig.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                      {linkedPage && (
                        <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-sm border border-blue-100 dark:border-blue-800">
                          <Facebook className="h-4 w-4 shrink-0 text-blue-600" />
                          <span className="text-muted-foreground">Connected to: <strong>{linkedPage.page_name}</strong></span>
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        {!activeBusinessId && businesses.length > 0 && !ig.business_id && (
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => setAssigningBusiness({ type: 'instagram', id: ig.id })}>
                            <Building2 className="h-4 w-4" /> Assign
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => setConfirmDisconnect({ type: 'instagram', id: ig.id })}>
                          <Trash2 className="h-4 w-4" /> Disconnect
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* WhatsApp Accounts */}
      <div ref={waSectionRef}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            WhatsApp Business
          </h2>
          <div className="flex gap-2">
            <Button onClick={handleWhatsAppFacebookConnect} disabled={connectingWaFb} variant="outline" className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-50">
              {connectingWaFb ? <Loader2 className="h-4 w-4 animate-spin" /> : <Facebook className="h-4 w-4" />}
              {connectingWaFb ? 'Connecting...' : 'Connect via Facebook'}
            </Button>
            <Button onClick={() => setShowWaForm(true)} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
              <Plus className="h-4 w-4" /> Manual Setup
            </Button>
          </div>
        </div>

        {whatsappAccounts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {whatsappAccounts.map((wa) => (
              <Card key={wa.id} className="card-hover overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-green-500 to-emerald-500" />
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-lg truncate">{wa.business_name || 'WhatsApp Business'}</CardTitle>
                    <p className="text-xs text-muted-foreground">{wa.phone_number}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`h-2 w-2 rounded-full ${wa.is_active ? 'bg-green-500' : 'bg-amber-500'}`} />
                      <span>{wa.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    {wa.waba_id && (
                      <p className="text-xs text-muted-foreground">WABA ID: {wa.waba_id}</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      {!activeBusinessId && businesses.length > 0 && !wa.business_id && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setAssigningBusiness({ type: 'whatsapp', id: wa.id })}>
                          <Building2 className="h-4 w-4" /> Assign
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive"
                        onClick={() => setConfirmDisconnect({ type: 'whatsapp', id: wa.id })}
                        disabled={disconnectingWa === wa.id}
                      >
                        {disconnectingWa === wa.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
                <Smartphone className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center">
                <p className="font-medium">No WhatsApp accounts connected</p>
                <p className="mt-1 text-sm text-muted-foreground">Connect WhatsApp to reply to customers via the WhatsApp Business API.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Telegram */}
      <div ref={tgSectionRef}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-500" />
            Telegram
          </h2>
          <Button onClick={() => setShowTelegramForm(true)} className="gap-2 bg-blue-500 hover:bg-blue-600 text-white">
            <Plus className="h-4 w-4" /> {telegramBots.length === 0 ? 'Connect Telegram Bot' : 'Add Another Bot'}
          </Button>
        </div>

        {telegramBots.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100">
                <Send className="h-8 w-8 text-blue-500" />
              </div>
              <div className="text-center">
                <p className="font-medium">No Telegram bot connected</p>
                <p className="mt-1 text-sm text-muted-foreground">Connect a Telegram bot to automate replies via Telegram Bot API.</p>
              </div>
              <Button onClick={() => setShowTelegramForm(true)} className="gap-2 bg-blue-500 hover:bg-blue-600 text-white">
                <Plus className="h-4 w-4" /> Connect Telegram Bot
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {telegramBots.map((bot) => (
              <Card key={bot.id} className="card-hover overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-blue-400 to-cyan-500" />
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow">
                    <Send className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-lg truncate">@{bot.bot_username || 'Telegram Bot'}</CardTitle>
                    <p className="text-xs text-muted-foreground">Telegram Bot</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`h-2 w-2 rounded-full ${bot.is_active ? 'bg-green-500' : 'bg-amber-500'}`} />
                      <span>{bot.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      {!activeBusinessId && businesses.length > 0 && !bot.business_id && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setAssigningBusiness({ type: 'telegram', id: bot.id })}>
                          <Building2 className="h-4 w-4" /> Assign
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive"
                        onClick={() => handleDisconnectTelegram(bot.id)}
                        disabled={disconnectingTg === bot.id}
                      >
                        {disconnectingTg === bot.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Discord */}
      <div ref={dcSectionRef}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-indigo-500" />
            Discord
          </h2>
          <Button onClick={() => setShowDiscordForm(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="h-4 w-4" /> {discordBots.length === 0 ? 'Connect Discord Bot' : 'Add Another Bot'}
          </Button>
        </div>

        {discordBots.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100">
                <Gamepad2 className="h-8 w-8 text-indigo-500" />
              </div>
              <div className="text-center">
                <p className="font-medium">No Discord bot connected</p>
                <p className="mt-1 text-sm text-muted-foreground">Connect a Discord bot to automate replies via slash commands.</p>
              </div>
              <Button onClick={() => setShowDiscordForm(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="h-4 w-4" /> Connect Discord Bot
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {discordBots.map((bot) => (
              <Card key={bot.id} className="card-hover overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow">
                    <Gamepad2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-lg truncate">{bot.bot_username || 'Discord Bot'}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {bot.display_name ? `${bot.display_name} — /${bot.command_name || 'chat'}` : bot.guild_id ? `Guild: ${bot.guild_id}` : 'Discord Bot'}
                      {bot.channel_ids && bot.channel_ids.length > 0 && (
                        <span className="ml-2 text-[10px] text-muted-foreground/60">
                          {bot.channel_ids.length} channel{bot.channel_ids.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`h-2 w-2 rounded-full ${bot.is_active ? 'bg-green-500' : 'bg-amber-500'}`} />
                      <span>{bot.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    {permCheckStatus[bot.id] === 'loading' && (
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-950/20 border border-gray-200 dark:border-gray-800 p-3 text-xs text-gray-500 space-y-1">
                      <p>Checking permissions...</p>
                    </div>
                    )}
                    {permCheckStatus[bot.id] === 'missing' && !dismissedPermWarnings.has(bot.id) && (
                    <div className="relative rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                      <button onClick={() => dismissPermWarning(bot.id)} className="absolute top-1 right-1 p-0.5 rounded hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors"><X className="h-3 w-3" /></button>
                      <p className="font-medium">Permissions Required</p>
                      <p>If the bot responds with &quot;Missing Permissions&quot;, it needs updated Discord permissions. Re-invite using the button below.</p>
                    </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {!activeBusinessId && businesses.length > 0 && !bot.business_id && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setAssigningBusiness({ type: 'discord', id: bot.id })}>
                          <Building2 className="h-4 w-4" /> Assign
                        </Button>
                      )}
                      <a
                        href={`https://discord.com/api/oauth2/authorize?client_id=${bot.client_id}&permissions=463960656960&integration_type=0&scope=bot%20applications.commands`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-medium transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" /> Re-invite
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive"
                        onClick={() => handleDisconnectDiscord(bot.id)}
                        disabled={disconnectingDc === bot.id}
                      >
                        {disconnectingDc === bot.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Telegram Connect Modal */}
      {showTelegramForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => !connectingTelegram && setShowTelegramForm(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600">
                  <Send className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold">Connect Telegram Bot</h3>
              </div>
              <button onClick={() => !connectingTelegram && setShowTelegramForm(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create a bot via <strong>@BotFather</strong> on Telegram, then enter the bot token below.
              </p>

              <div className="space-y-1">
                <label className="text-sm font-medium">Bot Token *</label>
                <input
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="e.g. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  type="password"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowTelegramForm(false)} disabled={connectingTelegram} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleConnectTelegram}
                  disabled={connectingTelegram || !telegramToken}
                  className="flex-1 gap-2 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {connectingTelegram ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {connectingTelegram ? 'Connecting...' : 'Connect'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discord Connect Modal — Guided 4-Step Wizard */}
      {showDiscordForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => !connectingDiscord && !discoveringDiscord && setShowDiscordForm(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
                  <Gamepad2 className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold">Connect Discord Bot</h3>
              </div>
              <button onClick={() => !connectingDiscord && !discoveringDiscord && setShowDiscordForm(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((step) => (
                <div key={step} className="flex items-center gap-2 flex-1">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    discordWizardStep === step
                      ? 'bg-indigo-600 text-white'
                      : discordWizardStep > step
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {discordWizardStep > step ? <CheckCircle2 className="h-4 w-4" /> : step}
                  </div>
                  {step < 5 && <div className={`h-0.5 flex-1 ${discordWizardStep > step ? 'bg-green-500' : 'bg-muted'}`} />}
                </div>
              ))}
            </div>

            {/* Step 1: Create App & Enter Token */}
            {discordWizardStep === 1 && (
              <div className="space-y-4">
                <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 p-4 text-sm">
                  <p className="font-medium text-indigo-700 dark:text-indigo-300 mb-2">Step 1: Create a Discord Application</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                    <li>Open the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">Discord Developer Portal</a></li>
                    <li>Click <strong>New Application</strong> and give it a name (e.g. &quot;My Support Bot&quot;)</li>
                    <li>Go to <strong>Bot</strong> → <strong>Reset Token</strong> → copy the token</li>
                    <li>Under <strong>Privileged Gateway Intents</strong>, enable <strong>Message Content Intent</strong></li>
                  </ol>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Bot Token *</label>
                  <input
                    value={discordToken}
                    onChange={(e) => setDiscordToken(e.target.value)}
                    placeholder="e.g. MTK4Nz...NzY5MA.GkZ...KJHg"
                    type="password"
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setShowDiscordForm(false)} disabled={discoveringDiscord} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDiscordVerifyToken}
                    disabled={discoveringDiscord || !discordToken}
                    className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {discoveringDiscord ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {discoveringDiscord ? 'Verifying...' : 'Verify Token'}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Invite Bot to Server */}
            {discordWizardStep === 2 && (
              <div className="space-y-4">
                <div className="rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 text-sm">
                  <p className="font-medium text-green-700 dark:text-green-300 mb-1">✓ Token Verified</p>
                  <p className="text-muted-foreground">Bot: <strong>{discordBotInfo?.username || 'Unknown'}</strong></p>
                </div>

                {discordInvitedGuild ? (
                  <div className="rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 text-sm">
                    <p className="font-medium text-green-700 dark:text-green-300">✓ Bot added to <strong>{discordInvitedGuild}</strong></p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 text-sm">
                    <p className="font-medium text-amber-700 dark:text-amber-300 mb-2">Step 2: Invite Bot to Your Server</p>
                    <p className="text-muted-foreground mb-3">
                      Click the button below to add the bot to your Discord server. Make sure you have &quot;Manage Server&quot; permissions.
                    </p>
                    <Button
                      onClick={handleDiscordInvite}
                      disabled={discordInviting}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-sm font-medium transition-colors w-full"
                    >
                      {discordInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {discordInviting ? 'Waiting for authorization...' : 'Add to Server'}
                    </Button>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setDiscordWizardStep(1)} className="flex-1">
                    Back
                  </Button>
                  <Button
                    onClick={() => handleDiscordLoadChannels(discordGuilds[0]?.id || '')}
                    disabled={discordGuilds.length === 0}
                    className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <ChevronDown className="h-4 w-4" />
                    Continue
                  </Button>
                </div>
                {discordGuilds.length === 0 && !discordInviting && (
                  <p className="text-xs text-muted-foreground text-center">
                    After adding the bot, return here and click Continue.
                  </p>
                )}
              </div>
            )}

            {/* Step 3: Select Server & Channel */}
            {discordWizardStep === 3 && (
              <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Step 3: Select the server and channels where you want the AI bot to reply.
                  </p>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Server</label>
                    <select
                      value={discordSelectedGuild}
                      onChange={(e) => handleDiscordLoadChannels(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Select a server...</option>
                      {discordGuilds.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Channels</label>
                      {discordChannels.length > 0 && (
                        <button
                          onClick={() => {
                            if (discordSelectedChannels.length === discordChannels.length) {
                              setDiscordSelectedChannels([]);
                            } else {
                              setDiscordSelectedChannels(discordChannels.map(c => c.id));
                            }
                          }}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {discordSelectedChannels.length === discordChannels.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-input bg-background p-1 space-y-0.5">
                      {discordChannels.length === 0 ? (
                        <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                          {discordSelectedGuild ? 'No text channels found.' : 'Select a server first.'}
                        </p>
                      ) : (
                        discordChannels.map((c) => {
                          const checked = discordSelectedChannels.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                                checked ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-muted'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setDiscordSelectedChannels(prev =>
                                    checked ? prev.filter(id => id !== c.id) : [...prev, c.id]
                                  );
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-sm">#{c.name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {discordSelectedChannels.length} channel{discordSelectedChannels.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setDiscordWizardStep(2)} className="flex-1">
                      Back
                    </Button>
                    <Button
                      onClick={() => {
                        const bizName = businesses.find(b => b.id === activeBusinessId)?.name || businesses[0]?.name || '';
                        if (!discordDisplayName) setDiscordDisplayName(bizName);
                        setDiscordWizardStep(4);
                      }}
                      disabled={discordSelectedChannels.length === 0}
                      className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <ChevronDown className="h-4 w-4" />
                      Next — Configure Bot
                    </Button>
                  </div>
              </div>
            )}

            {/* Step 4: Configure Bot */}
            {discordWizardStep === 4 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configure how your bot appears in Discord.
                </p>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Bot Display Name *</label>
                  <input
                    value={discordDisplayName}
                    onChange={(e) => setDiscordDisplayName(e.target.value)}
                    placeholder="e.g. My Support Bot"
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="text-xs text-muted-foreground">This will be set as the bot&apos;s nickname in your server.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Slash Command Name</label>
                  <input
                    value={discordCommandName}
                    onChange={(e) => setDiscordCommandName(e.target.value.replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'chat')}
                    placeholder="chat"
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                  />
                  <p className="text-xs text-muted-foreground">Users will type <code className="bg-muted px-1 rounded">/{discordCommandName || 'chat'} &lt;message&gt;</code></p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setDiscordWizardStep(3)} className="flex-1">
                    Back
                  </Button>
                  <Button
                    onClick={() => setDiscordWizardStep(5)}
                    disabled={!discordDisplayName}
                    className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <ChevronDown className="h-4 w-4" />
                    Next — Set Webhook URL
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Webhook URL & Finish */}
            {discordWizardStep === 5 && (
              <div className="space-y-4">
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 text-sm">
                  <p className="font-medium text-amber-700 dark:text-amber-300 mb-2">Step 5: Set Interaction Endpoint URL</p>
                  <p className="text-muted-foreground mb-3">
                    Go to the Discord Developer Portal → Your Application → <strong>General Information</strong>.
                    Paste the URL below as the <strong>Interaction Endpoint URL</strong> and click Save Changes.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value="https://social-agent-iota.vercel.app/api/webhooks/discord"
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText('https://social-agent-iota.vercel.app/api/webhooks/discord');
                        toast.success('URL copied to clipboard');
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setDiscordWizardStep(4)} disabled={connectingDiscord} className="flex-1">
                    Back
                  </Button>
                  <Button
                    onClick={handleFinishDiscordConnect}
                    disabled={connectingDiscord}
                    className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {connectingDiscord ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {connectingDiscord ? 'Connecting...' : 'Finish Setup'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp Connect Modal */}
      {showWaForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => !connectingWa && setShowWaForm(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                  <MessageCircle className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold">Connect WhatsApp</h3>
              </div>
              <button onClick={() => !connectingWa && setShowWaForm(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your WhatsApp Business Account details from the Meta Business Platform.
              </p>

              {waError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {waError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">Phone Number ID *</label>
                <input
                  value={waForm.phoneNumberId}
                  onChange={(e) => setWaForm(f => ({ ...f, phoneNumberId: e.target.value }))}
                  placeholder="e.g. 123456789012345"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Phone Number *</label>
                <input
                  value={waForm.phoneNumber}
                  onChange={(e) => setWaForm(f => ({ ...f, phoneNumber: e.target.value }))}
                  placeholder="e.g. +8801712345678"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Business Name</label>
                <input
                  value={waForm.businessName}
                  onChange={(e) => setWaForm(f => ({ ...f, businessName: e.target.value }))}
                  placeholder="e.g. My Business"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">WABA ID</label>
                <input
                  value={waForm.wabaId}
                  onChange={(e) => setWaForm(f => ({ ...f, wabaId: e.target.value }))}
                  placeholder="WhatsApp Business Account ID"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Access Token *</label>
                <input
                  value={waForm.accessToken}
                  onChange={(e) => setWaForm(f => ({ ...f, accessToken: e.target.value }))}
                  placeholder="Permanent access token from Meta"
                  type="password"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowWaForm(false)} disabled={connectingWa} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleConnectWhatsApp}
                  disabled={connectingWa || !waForm.phoneNumberId || !waForm.phoneNumber || !waForm.accessToken}
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {connectingWa ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {connectingWa ? 'Connecting...' : 'Connect'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add More Pages Modal */}
      {showAddPages && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => !connectingPages && setShowAddPages(false)}>
          <div className="w-full max-w-lg max-h-[80vh] rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6 mx-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                  <Facebook className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold">Add More Pages</h3>
              </div>
              <button onClick={() => !connectingPages && setShowAddPages(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingAvailable ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : availablePages.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
                  <CheckCircle2 className="h-7 w-7 text-blue-600" />
                </div>
                <p className="font-medium text-center">No new pages available</p>
                <p className="text-sm text-muted-foreground text-center">All your Facebook pages are already connected.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4 shrink-0">
                  Select the pages you want to add:
                </p>
                <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                  {availablePages.map((page) => (
                    <button
                      key={page.page_id}
                      onClick={() => toggleAvailablePage(page.page_id)}
                      className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        selectedAvailablePages.has(page.page_id)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-input hover:bg-muted/50'
                      }`}
                    >
                      {page.picture_url ? (
                        <img src={page.picture_url} alt={page.page_name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                          <Facebook className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{page.page_name}</p>
                        {page.page_category && (
                          <p className="text-xs text-muted-foreground truncate">{page.page_category}</p>
                        )}
                      </div>
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        selectedAvailablePages.has(page.page_id)
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-muted-foreground/30'
                      }`}>
                        {selectedAvailablePages.has(page.page_id) && (
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 pt-4 shrink-0 border-t border-border mt-4">
                  <Button variant="outline" onClick={() => setShowAddPages(false)} disabled={connectingPages} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConnectSelectedPages}
                    disabled={connectingPages || selectedAvailablePages.size === 0}
                    className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {connectingPages ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {connectingPages ? 'Connecting...' : `Connect (${selectedAvailablePages.size})`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Instagram Connect Modal */}
      {showInstagramConnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => !loadingAvailableIg && setShowInstagramConnect(false)}>
          <div className="w-full max-w-lg max-h-[80vh] rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6 mx-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600">
                  <Instagram className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold">Connect Instagram</h3>
              </div>
              <button onClick={() => !loadingAvailableIg && setShowInstagramConnect(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingAvailableIg ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : availableIgPages.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-700 dark:text-amber-400">
                  <p className="font-medium mb-2">No Instagram Business accounts detected.</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Open the <strong>Instagram app</strong> on your phone</li>
                    <li>Go to <strong>Settings → Account → Switch to Professional Account</strong></li>
                    <li>Choose <strong>Business</strong> or <strong>Creator</strong> and link it to your Facebook Page</li>
                    <li>Come back here and try again</li>
                  </ol>
                </div>
                <Button variant="outline" onClick={() => setShowInstagramConnect(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4 shrink-0">
                  Select an Instagram account to connect:
                </p>
                <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                  {availableIgPages.map((item) => (
                    <div key={item.ig_id} className="flex items-center gap-3 rounded-xl border border-input p-3">
                      {item.ig_profile_pic ? (
                        <img src={item.ig_profile_pic} alt={item.ig_username} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 text-white">
                          <Instagram className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">@{item.ig_username}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.ig_name} · {item.page_name}</p>
                      </div>
                      <Button
                        size="sm"
                        className="gap-2 shrink-0 bg-pink-600 hover:bg-pink-700 text-white"
                        onClick={() => handleConnectInstagram(item.page_id)}
                        disabled={linkingInstagram === item.page_id}
                      >
                        {linkingInstagram === item.page_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {linkingInstagram === item.page_id ? 'Connecting...' : 'Connect'}
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 pt-4 shrink-0 border-t border-border mt-4">
                  <Button variant="outline" onClick={() => setShowInstagramConnect(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Assign Business Modal */}
      {assigningBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setAssigningBusiness(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Assign to Business
              </h3>
              <button onClick={() => setAssigningBusiness(null)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Select a business to assign this account to:</p>
            <div className="space-y-1">
              <button
                onClick={() => handleAssignBusiness(assigningBusiness.type, assigningBusiness.id, null)}
                className="w-full text-left rounded-xl border border-input px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
              >
                <span className="text-muted-foreground">No business (unassigned)</span>
              </button>
              {businesses.map((biz) => (
                <button
                  key={biz.id}
                  onClick={() => handleAssignBusiness(assigningBusiness.type, assigningBusiness.id, biz.id)}
                  className="w-full text-left rounded-xl border border-input px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                >
                  {biz.name}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Button variant="outline" onClick={() => setAssigningBusiness(null)} className="w-full">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDisconnect !== null}
        onClose={() => setConfirmDisconnect(null)}
        onConfirm={() => {
          if (confirmDisconnect?.type === 'page') handleDisconnectPage(confirmDisconnect.id);
          if (confirmDisconnect?.type === 'instagram') handleDisconnectInstagram(confirmDisconnect.id);
          if (confirmDisconnect?.type === 'whatsapp') handleDisconnectWhatsApp(confirmDisconnect.id);
        }}
        title="Disconnect Account"
        message="Are you sure you want to disconnect this account? The AI will stop replying to messages from this platform."
        confirmLabel="Disconnect"
      />
    </div>
  );
}

export default function PagesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <PagesPageInner />
    </Suspense>
  );
}
