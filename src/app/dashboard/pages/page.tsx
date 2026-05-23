'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Facebook, Instagram, MessageCircle, Loader2, Trash2, Link2, Plus, CheckCircle2, AlertCircle, Smartphone, X, Save, RefreshCw, Send, Gamepad2, LayoutDashboard, Building2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { usePageTitle } from '@/lib/use-page-title';
import BusinessSelector from '@/components/business/BusinessSelector';

interface ConnectedPage {
  id: string;
  page_id: string;
  page_name: string;
  picture_url: string | null;
  page_category: string | null;
  subscribed: boolean;
  instagram?: { id: string; username: string; name: string };
}

interface WhatsAppAccount {
  id: string;
  phone_number_id: string;
  phone_number: string;
  business_name: string | null;
  waba_id: string | null;
  is_active: boolean;
}

interface TelegramBot {
  id: string;
  bot_username: string | null;
  is_active: boolean;
}

interface DiscordBot {
  id: string;
  bot_username: string | null;
  guild_id: string | null;
  channel_id: string | null;
  client_id: string | null;
  is_active: boolean;
}

function PagesPageInner() {
  usePageTitle('Connected Accounts');
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [pages, setPages] = useState<ConnectedPage[]>([]);
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
  const [confirmDisconnect, setConfirmDisconnect] = useState<{ type: 'page' | 'whatsapp' | 'telegram' | 'discord'; id: string } | null>(null);
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
  const [discordForm, setDiscordForm] = useState({ botToken: '', clientId: '', guildId: '', channelId: '' });
  const [connectingDiscord, setConnectingDiscord] = useState(false);
  const [disconnectingTg, setDisconnectingTg] = useState<string | null>(null);
  const [disconnectingDc, setDisconnectingDc] = useState<string | null>(null);
  const fbSectionRef = useRef<HTMLDivElement>(null);
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

    setPages((pagesRes.data || []).map((p) => ({
      ...p, instagram: (igRes.data || []).find((ig) => ig.page_id === p.id),
    })));
    setWhatsappAccounts(waRes.data || []);
    setTelegramBots(tgRes.data || []);
    setDiscordBots(dcRes.data || []);
    setLoading(false);
  }, [activeBusinessId]);

  useEffect(() => {
    setLoading(true);
    loadPages();
  }, [loadPages, activeBusinessId]);

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
    const state = crypto.randomUUID();
    sessionStorage.setItem('fb_wa_oauth_state', state);
    let appId = '';
    try { const r = await fetch('/api/meta/app-id'); const d = await r.json(); if (d.appId) appId = d.appId; } catch {}
    if (!appId) {
        setConnectingWaFb(false);
        toast.error('Meta App ID not configured');
        return;
    }
    window.location.href = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${origin}/api/auth/callback/whatsapp&response_type=code&state=${state}&scope=business_management,whatsapp_business_management,whatsapp_business_messaging`;
}

async function handleFacebookConnect() {
    setConnecting(true);
    const origin = window.location.origin;
    const state = crypto.randomUUID();
    sessionStorage.setItem('fb_oauth_state', state);
    let appId = '';
    try { const r = await fetch('/api/meta/app-id'); const d = await r.json(); if (d.appId) appId = d.appId; } catch {}
    if (!appId) {
        setConnecting(false);
        toast.error('Meta App ID not configured');
        return;
    }
    window.location.href = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${origin}/api/auth/callback/pages&response_type=code&state=${state}&scope=pages_show_list,pages_messaging,pages_manage_metadata,business_management,instagram_basic,pages_read_engagement,whatsapp_business_messaging`;
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
        body: JSON.stringify({ pages: selected }),
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

  async function handleConnectDiscord() {
    if (!discordForm.botToken) return;
    setConnectingDiscord(true);
    try {
      const res = await fetch('/api/discord/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...discordForm, businessId: activeBusinessId }),
      });
      const data = await res.json();
      if (data.success) {
        setShowDiscordForm(false);
        setDiscordForm({ botToken: '', clientId: '', guildId: '', channelId: '' });
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

  async function handleLinkInstagram(pageId: string) {
    setLinkingInstagram(pageId);
    try {
      const res = await fetch('/api/instagram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      });
      const data = await res.json();
      if (data.success) {
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
    instagram: pages.filter(p => p.instagram).length,
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
        <button onClick={() => scrollToSection(fbSectionRef)} className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${platformCounts.instagram > 0 ? 'border-pink-200 bg-pink-50/50 dark:border-pink-800 dark:bg-pink-950/20' : 'border-muted'}`}>
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
                  {page.picture_url ? (
                    <img
                      src={page.picture_url}
                      alt={page.page_name}
                      className="h-12 w-12 shrink-0 rounded-xl object-cover shadow"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow">
                      <Facebook className="h-6 w-6" />
                    </div>
                  )}
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

                    {page.instagram && (
                      <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-pink-50 to-rose-50 p-3 text-sm">
                        <Instagram className="h-4 w-4 shrink-0 text-pink-600" />
                        <span className="font-medium">@{page.instagram.username}</span>
                        <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-green-600 shrink-0" />
                      </div>
                    )}
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
                      {!page.instagram ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleLinkInstagram(page.page_id)}
                          disabled={linkingInstagram === page.page_id}
                        >
                          {linkingInstagram === page.page_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Instagram className="h-4 w-4" />
                          )}
                          {linkingInstagram === page.page_id ? 'Linking...' : 'Link Instagram'}
                        </Button>
                      ) : null}
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
          {telegramBots.length === 0 && (
            <Button onClick={() => setShowTelegramForm(true)} className="gap-2 bg-blue-500 hover:bg-blue-600 text-white">
              <Plus className="h-4 w-4" /> Connect Telegram Bot
            </Button>
          )}
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
          {discordBots.length === 0 && (
            <Button onClick={() => setShowDiscordForm(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="h-4 w-4" /> Connect Discord Bot
            </Button>
          )}
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
                    <p className="text-xs text-muted-foreground">{bot.guild_id ? `Guild: ${bot.guild_id}` : 'Discord Bot'}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`h-2 w-2 rounded-full ${bot.is_active ? 'bg-green-500' : 'bg-amber-500'}`} />
                      <span>{bot.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
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

      {/* Discord Connect Modal */}
      {showDiscordForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => !connectingDiscord && setShowDiscordForm(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
                  <Gamepad2 className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold">Connect Discord Bot</h3>
              </div>
              <button onClick={() => !connectingDiscord && setShowDiscordForm(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create a bot in the <strong>Discord Developer Portal</strong>, enable Message Content Intent, get the bot token and invite it to your server.
              </p>

              <div className="space-y-1">
                <label className="text-sm font-medium">Bot Token *</label>
                <input
                  value={discordForm.botToken}
                  onChange={(e) => setDiscordForm(f => ({ ...f, botToken: e.target.value }))}
                  placeholder="e.g. MTK4Nz...NzY5MA.GkZ...KJHg"
                  type="password"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Client ID</label>
                <input
                  value={discordForm.clientId}
                  onChange={(e) => setDiscordForm(f => ({ ...f, clientId: e.target.value }))}
                  placeholder="From Discord Developer Portal"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Guild (Server) ID</label>
                <input
                  value={discordForm.guildId}
                  onChange={(e) => setDiscordForm(f => ({ ...f, guildId: e.target.value }))}
                  placeholder="Right-click server → Copy ID"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Channel ID (for replies)</label>
                <input
                  value={discordForm.channelId}
                  onChange={(e) => setDiscordForm(f => ({ ...f, channelId: e.target.value }))}
                  placeholder="Right-click channel → Copy ID"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowDiscordForm(false)} disabled={connectingDiscord} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleConnectDiscord}
                  disabled={connectingDiscord || !discordForm.botToken}
                  className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {connectingDiscord ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {connectingDiscord ? 'Connecting...' : 'Connect'}
                </Button>
              </div>
            </div>
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

      <ConfirmDialog
        open={confirmDisconnect !== null}
        onClose={() => setConfirmDisconnect(null)}
        onConfirm={() => {
          if (confirmDisconnect?.type === 'page') handleDisconnectPage(confirmDisconnect.id);
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
