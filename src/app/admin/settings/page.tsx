'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  Save, Settings, ExternalLink, RefreshCw,
  CheckCircle, AlertCircle, Shield, Globe,
  CreditCard, Key, Plus, Trash2, X, Edit3, Gamepad2, Banknote,
  ShoppingBag, Check, Cpu,
} from 'lucide-react';
import { toast } from 'sonner';
import type { BillingPlan } from '@/types';

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'integrations', label: 'Integrations', icon: Globe },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

  const emptyPlan = {
    slug: '',
    name: '',
    description: '',
    price_monthly_cents: 0,
    monthly_quota: 100,
    max_pages: 1,
    allowed_models: [] as string[],
    features: [] as string[],
    allowed_actions: ['text_reply', 'image_read', 'voice_read'] as string[],
    is_popular: false,
    sort_order: 0,
  };

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const supabase = createClient();
  const router = useRouter();

  const [signupsEnabled, setSignupsEnabled] = useState(true);
  const [metaAppId, setMetaAppId] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [metaAppSecretSet, setMetaAppSecretSet] = useState(false);
  const [platformName, setPlatformName] = useState('SocialReply AI');
  const [supportEmail, setSupportEmail] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [rateLimitPerMin, setRateLimitPerMin] = useState('60');
  const [adminStatsRefreshInterval, setAdminStatsRefreshInterval] = useState('30');
  const [messageRetentionDays, setMessageRetentionDays] = useState('3');
  const [cleanupCronInterval, setCleanupCronInterval] = useState('60');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('');
  const [webhookVerifyTokenSet, setWebhookVerifyTokenSet] = useState(false);
  const [appUrl, setAppUrl] = useState('');
  const [discordPublicKey, setDiscordPublicKey] = useState('');
  const [discordPublicKeySet, setDiscordPublicKeySet] = useState(false);

  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [planSaving, setPlanSaving] = useState(false);
  const [newFeature, setNewFeature] = useState('');

  const [gateways, setGateways] = useState<any[]>([]);
  const [gatewayForm, setGatewayForm] = useState({ name: '', slug: '', is_active: false, config: '{}', sort_order: 0 });
  const [showGatewayForm, setShowGatewayForm] = useState(false);
  const [editingGatewayId, setEditingGatewayId] = useState<string | null>(null);
  const [gatewaySaving, setGatewaySaving] = useState(false);
  const [profitEstimates, setProfitEstimates] = useState<any[]>([]);

  const [creditPacks, setCreditPacks] = useState<any[]>([]);
  const [creditPackForm, setCreditPackForm] = useState({ name: '', slug: '', credits_amount: 100, price_cents: 1000, is_active: true, is_auto_renew: false, sort_order: 0, description: '' });
  const [showCreditPackForm, setShowCreditPackForm] = useState(false);
  const [editingCreditPackId, setEditingCreditPackId] = useState<string | null>(null);
  const [creditPackSaving, setCreditPackSaving] = useState(false);

  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchaseFilter, setPurchaseFilter] = useState('pending');
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const [modelPricing, setModelPricing] = useState<Array<{ id: string; provider_id: string; model_name: string; input_price_per_1m_tokens: number; output_price_per_1m_tokens: number; pricing_unit: string; is_auto_fetched: boolean; ai_providers?: { name: string } }>>([]);
  const [allProviders, setAllProviders] = useState<Array<{ id: string; name: string }>>([]);
  const [fetchAllLoading, setFetchAllLoading] = useState(false);
  const [fetchSelectedLoading, setFetchSelectedLoading] = useState(false);
  const [populateDefaultsLoading, setPopulateDefaultsLoading] = useState(false);
  const [rowSaving, setRowSaving] = useState(false);
  const [deleteSelectedLoading, setDeleteSelectedLoading] = useState(false);
  const [selectedPricingIds, setSelectedPricingIds] = useState<Set<string>>(new Set());
  const [fetchModelInput, setFetchModelInput] = useState('');

  useEffect(() => { checkAdminAndLoad(); }, []);

  async function checkAdminAndLoad() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) { router.push('/dashboard'); return; }

    try {
      const [settingsRes, plansRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/plans'),
      ]);
      const data = await settingsRes.json();
      if (data.signups_enabled !== undefined) setSignupsEnabled(Boolean(data.signups_enabled));
      if (data.meta_app_id !== undefined) setMetaAppId(String(data.meta_app_id));
      if (data.meta_app_secret === true) { setMetaAppSecretSet(true); setMetaAppSecret(''); }
      else if (data.meta_app_secret !== undefined) { setMetaAppSecretSet(true); setMetaAppSecret(String(data.meta_app_secret)); }
      if (data.platform_name !== undefined) setPlatformName(String(data.platform_name));
      if (data.support_email !== undefined) setSupportEmail(String(data.support_email));
      if (data.maintenance_mode !== undefined) setMaintenanceMode(Boolean(data.maintenance_mode));
      if (data.rate_limit_per_min !== undefined) setRateLimitPerMin(String(data.rate_limit_per_min));
      if (data.admin_stats_refresh_interval !== undefined) setAdminStatsRefreshInterval(String(data.admin_stats_refresh_interval));
      if (data.message_retention_days !== undefined) setMessageRetentionDays(String(data.message_retention_days));
      if (data.cleanup_cron_interval !== undefined) setCleanupCronInterval(String(data.cleanup_cron_interval));
      if (data.meta_webhook_verify_token === true) { setWebhookVerifyTokenSet(true); setWebhookVerifyToken(''); }
      else if (data.meta_webhook_verify_token !== undefined) { setWebhookVerifyTokenSet(true); setWebhookVerifyToken(String(data.meta_webhook_verify_token)); }
      if (data.app_url !== undefined) setAppUrl(String(data.app_url));
      if (data.discord_public_key === true) { setDiscordPublicKeySet(true); setDiscordPublicKey(''); }
      else if (data.discord_public_key !== undefined) { setDiscordPublicKeySet(true); setDiscordPublicKey(String(data.discord_public_key)); }

      const plansData = await plansRes.json();
      setPlans(plansData.plans || []);


      // Load remaining data in parallel
      const [gwRes, peRes, cpRes, mpRes, provRes] = await Promise.all([
        fetch('/api/admin/payment-gateways'),
        fetch('/api/admin/profit-estimate'),
        fetch('/api/admin/credit-packs'),
        fetch('/api/admin/owner/pricing'),
        fetch('/api/admin/owner/providers'),
      ]);

      const [gwData, peData, cpData] = await Promise.all([
        gwRes.json(),
        peRes.json(),
        cpRes.json(),
      ]);
      setGateways(gwData.gateways || []);
      setProfitEstimates(peData.estimates || []);
      setCreditPacks(cpData.packs || []);

      if (mpRes.ok) { const mpData = await mpRes.json(); setModelPricing(mpData.pricing || []); }
      if (provRes.ok) { const provData = await provRes.json(); setAllProviders((provData.providers || []).map((p: any) => ({ id: p.id, name: p.name }))); }

      // Load purchases (parallel fetch inside)
      loadPurchases();
    } catch (e) { console.error('Failed to load settings', e); }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        signups_enabled: signupsEnabled,
        meta_app_id: metaAppId,
        platform_name: platformName,
        support_email: supportEmail,
        maintenance_mode: maintenanceMode,
        rate_limit_per_min: parseInt(rateLimitPerMin) || 60,
        admin_stats_refresh_interval: parseInt(adminStatsRefreshInterval) || 30,
        message_retention_days: parseInt(messageRetentionDays) || 3,
        cleanup_cron_interval: parseInt(cleanupCronInterval) || 60,
        app_url: appUrl,
      };
      if (metaAppSecret) body.meta_app_secret = metaAppSecret;
      if (webhookVerifyToken) body.meta_webhook_verify_token = webhookVerifyToken;
      if (discordPublicKey) body.discord_public_key = discordPublicKey;

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save');
      toast.success('Settings saved successfully!');
      if (metaAppSecret) { setMetaAppSecretSet(true); setMetaAppSecret(''); }
      if (webhookVerifyToken) { setWebhookVerifyTokenSet(true); setWebhookVerifyToken(''); }
      if (discordPublicKey) { setDiscordPublicKeySet(true); setDiscordPublicKey(''); }
    } catch (e: any) { toast.error(e.message || 'Failed to save settings'); }
    setSaving(false);
  }

  async function handleSavePlan(plan: BillingPlan) {
    setPlanSaving(true);
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: plan.name,
          description: plan.description,
          price_monthly_cents: plan.price_monthly_cents,
          monthly_quota: plan.monthly_quota,
          max_pages: plan.max_pages,
          allowed_models: plan.allowed_models,
          features: plan.features,
          is_popular: plan.is_popular,
          sort_order: plan.sort_order,
        }),
      });
      const data = await res.json();
      if (!data.plan) throw new Error(data.error || 'Failed to save');
      setPlans(prev => prev.map(p => p.id === plan.id ? data.plan : p));
      toast.success('Plan updated');
    } catch (e: any) { toast.error(e.message); }
    setPlanSaving(false);
  }

  async function handleDeletePlan(id: string) {
    if (!confirm('Delete this plan? Users on this plan will need to be reassigned.')) return;
    try {
      const res = await fetch(`/api/admin/plans/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setPlans(prev => prev.filter(p => p.id !== id));
      toast.success('Plan deleted');
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleCreatePlan() {
    if (!planForm.name || !planForm.slug) { toast.error('Name and slug are required'); return; }
    setPlanSaving(true);
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planForm),
      });
      const data = await res.json();
      if (!data.plan) throw new Error(data.error || 'Failed to create');
      setPlans(prev => [...prev, data.plan].sort((a, b) => a.sort_order - b.sort_order));
      setEditingPlan(null);
      setPlanForm(emptyPlan);
      toast.success('Plan created');
    } catch (e: any) { toast.error(e.message); }
    setPlanSaving(false);
  }

  async function loadPurchases() {
    setPurchaseLoading(true);
    try {
      const res = await fetch(`/api/admin/credit-purchases?status=${purchaseFilter}&limit=50`);
      const data = await res.json();
      setPurchases(data.purchases || []);
    } catch { /* ignore */ }
    setPurchaseLoading(false);
  }

  async function handleSaveCreditPack() {
    if (!creditPackForm.name || !creditPackForm.slug) { toast.error('Name and slug are required'); return; }
    setCreditPackSaving(true);
    try {
      if (editingCreditPackId) {
        const res = await fetch('/api/admin/credit-packs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCreditPackId, ...creditPackForm }),
        });
        const d = await res.json();
        if (d.pack) { setCreditPacks(prev => prev.map(p => p.id === editingCreditPackId ? d.pack : p)); toast.success('Pack updated'); }
      } else {
        const res = await fetch('/api/admin/credit-packs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(creditPackForm),
        });
        const d = await res.json();
        if (d.pack) { setCreditPacks(prev => [...prev, d.pack].sort((a, b) => a.sort_order - b.sort_order)); toast.success('Pack created'); }
      }
      setShowCreditPackForm(false);
      setEditingCreditPackId(null);
      setCreditPackForm({ name: '', slug: '', credits_amount: 100, price_cents: 1000, is_active: true, is_auto_renew: false, sort_order: 0, description: '' });
    } catch (e: any) { toast.error(e.message); }
    setCreditPackSaving(false);
  }

  async function handleDeleteCreditPack(id: string) {
    if (!confirm('Delete this credit pack?')) return;
    try {
      const res = await fetch(`/api/admin/credit-packs?id=${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) { setCreditPacks(prev => prev.filter(p => p.id !== id)); toast.success('Pack deleted'); }
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleApprovePurchase(id: string) {
    try {
      const res = await fetch('/api/admin/credit-purchases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'approved' }),
      });
      const d = await res.json();
      if (d.purchase) { setPurchases(prev => prev.map(p => p.id === id ? d.purchase : p)); toast.success('Purchase approved'); loadPurchases(); }
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleRejectPurchase(id: string) {
    const note = prompt('Rejection reason (optional):');
    try {
      const res = await fetch('/api/admin/credit-purchases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'rejected', admin_note: note || null }),
      });
      const d = await res.json();
      if (d.purchase) { setPurchases(prev => prev.map(p => p.id === id ? d.purchase : p)); toast.success('Purchase rejected'); loadPurchases(); }
    } catch (e: any) { toast.error(e.message); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex items-center gap-3 text-white/40">
          <RefreshCw className="h-5 w-5 animate-spin" /> Loading settings...
        </div>
      </div>
    );
  }

  const TabButton = ({ tab }: { tab: typeof TABS[number] }) => {
    const Icon = tab.icon;
    return (
      <button onClick={() => setActiveTab(tab.id)}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
          activeTab === tab.id
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-white/40 hover:bg-white/5 hover:text-white/70'
        }`}>
        <Icon className="h-4 w-4" /> {tab.label}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Platform Settings</h1>
          <p className="text-sm text-white/40 mt-0.5">Configure global platform behavior</p>
        </div>
        {activeTab !== 'billing' && (
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white px-5 py-2.5 text-sm font-medium hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {TABS.map(t => <TabButton key={t.id} tab={t} />)}
      </div>

      {activeTab === 'general' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-5"><Settings className="h-4 w-4 text-violet-400" /> Platform Info</h3>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Platform Name</label>
                <input type="text" value={platformName} onChange={(e) => setPlatformName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Support Email</label>
                <input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@example.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-white/10 p-4 cursor-pointer hover:bg-white/5 transition-colors">
                <input type="checkbox" checked={signupsEnabled} onChange={(e) => setSignupsEnabled(e.target.checked)}
                  className="h-5 w-5 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500/30" />
                <div><span className="text-sm font-medium text-white">Allow new user registrations</span><p className="text-xs text-white/30 mt-0.5">When disabled, only existing users can log in</p></div>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-white/10 p-4 cursor-pointer hover:bg-white/5 transition-colors">
                <input type="checkbox" checked={maintenanceMode} onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="h-5 w-5 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/30" />
                <div><span className="text-sm font-medium text-white">Maintenance Mode</span><p className="text-xs text-white/30 mt-0.5">Users will see a maintenance notice when enabled</p></div>
              </label>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-5"><Shield className="h-4 w-4 text-red-400" /> Rate Limiting</h3>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">API Rate Limit (requests/min)</label>
                <input type="number" min={1} value={rateLimitPerMin} onChange={(e) => setRateLimitPerMin(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                <p className="text-xs text-white/30 mt-1">Maximum API requests per minute per user</p>
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Admin Stats Refresh Interval (sec)</label>
                <input type="number" min={10} max={600} value={adminStatsRefreshInterval} onChange={(e) => setAdminStatsRefreshInterval(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                <p className="text-xs text-white/30 mt-1">How often the admin dashboard auto-refreshes (10–600s)</p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs font-medium text-white/60 mb-1">Supabase Project URL</p>
                <p className="text-xs font-mono text-white/30 break-all">{process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not configured'}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs font-medium text-white/60 mb-1">Auth Status</p>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-xs text-white/40">Email/Password authentication active</span></div>
                <div className="flex items-center gap-2 mt-1"><span className="h-2 w-2 rounded-full bg-amber-500" /><span className="text-xs text-white/40">Google OAuth — enable in Supabase Dashboard</span></div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-5"><Trash2 className="h-4 w-4 text-orange-400" /> Message Cleanup</h3>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Retention Days</label>
                <input type="number" min={1} max={365} value={messageRetentionDays} onChange={(e) => setMessageRetentionDays(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                <p className="text-xs text-white/30 mt-1">Messages older than this many days will be deleted during cleanup</p>
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Cleanup Interval (minutes)</label>
                <input type="number" min={5} max={1440} value={cleanupCronInterval} onChange={(e) => setCleanupCronInterval(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                <p className="text-xs text-white/30 mt-1">Minimum time between cleanup runs (prevents running too often)</p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs font-medium text-white/60 mb-1">Cleanup Endpoint</p>
                <p className="text-xs font-mono text-white/30 break-all">GET /api/cron/cleanup-messages</p>
                <p className="text-xs text-white/30 mt-1">Set up a cron job (Vercel Cron, cron-job.org, etc.) to call this endpoint periodically. The <code className="text-violet-400">cleanupCronInterval</code> setting above controls how often actual cleanup runs.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-5"><Globe className="h-4 w-4 text-blue-400" /> Meta / Facebook</h3>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Meta App ID</label>
                <input type="text" value={metaAppId} onChange={(e) => setMetaAppId(e.target.value)} placeholder="123456789012345"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                <p className="text-xs text-white/30 mt-1">Facebook App ID for OAuth and page connection</p>
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Meta App Secret</label>
                <input type="password" value={metaAppSecret} onChange={(e) => setMetaAppSecret(e.target.value)}
                  placeholder={metaAppSecretSet ? 'Leave empty to keep current value' : 'App secret for webhook verification'}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                <p className="text-xs text-white/30 mt-1">Used for webhook signature verification</p>
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Webhook Verify Token</label>
                <input type="password" value={webhookVerifyToken} onChange={(e) => setWebhookVerifyToken(e.target.value)}
                  placeholder={webhookVerifyTokenSet ? 'Leave empty to keep current value' : 'Token for webhook verification handshake'}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                <p className="text-xs text-white/30 mt-1">Must match what you enter in Meta Developer Console</p>
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">App URL</label>
                <input type="url" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://example.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                <p className="text-xs text-white/30 mt-1">Base URL for webhook callbacks and internal job dispatching</p>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-5"><Gamepad2 className="h-4 w-4 text-indigo-400" /> Discord</h3>
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1.5 block">Discord Public Key</label>
                  <input type="password" value={discordPublicKey} onChange={(e) => setDiscordPublicKey(e.target.value)}
                    placeholder={discordPublicKeySet ? 'Leave empty to keep current value' : 'Public key from Discord Developer Portal'}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                  <p className="text-xs text-white/30 mt-1">Used to verify Discord interaction webhook signatures. Find it in your Discord Application under General Information.</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-4"><ExternalLink className="h-4 w-4 text-blue-400" /> Quick Links</h3>
              <div className="space-y-2">
                {[
                  { href: 'https://supabase.com/dashboard/project/nsppwrfzmvaiyeaqfryt/settings/api', label: 'Supabase Dashboard' },
                  { href: 'https://openrouter.ai/keys', label: 'OpenRouter Dashboard' },
                  { href: 'https://developers.facebook.com/apps', label: 'Meta Developer Console' },
                  { href: 'https://vercel.com/raaj648/social-agent', label: 'Vercel Dashboard' },
                  { href: 'https://github.com/raaj648/social-agent', label: 'GitHub Repository' },
                ].map((link) => (
                  <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl px-4 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white/80 transition-colors group">
                    <span className="font-medium">{link.label}</span>
                    <ExternalLink className="h-4 w-4 text-white/30 group-hover:text-white/60 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="space-y-4">
          {/* Credit Costs (auto-calculated) */}
          <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2"><CreditCard className="h-4 w-4 text-amber-400" /> Credit Costs</h3>
                <p className="text-xs text-white/40 mt-0.5">Credits are auto-calculated from Model Pricing. 1 credit = cost of ~250 tokens with the default text model.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <label className="text-xs font-medium text-white/60 mb-1 block">Text Reply</label>
                <p className="text-sm text-white font-medium">Auto-calculated</p>
                <p className="text-xs text-white/40 mt-0.5">Based on token usage × model price</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <label className="text-xs font-medium text-white/60 mb-1 block">Image Read</label>
                <p className="text-sm text-white font-medium">Auto-calculated</p>
                <p className="text-xs text-white/40 mt-0.5">Based on token usage × vision model price</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <label className="text-xs font-medium text-white/60 mb-1 block">Voice Read</label>
                <p className="text-sm text-white font-medium">Auto-calculated</p>
                <p className="text-xs text-white/40 mt-0.5">Whisper ($0.04–0.36/hr) + reply token cost</p>
              </div>
            </div>
          </div>

          {/* Model Pricing */}
          <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Cpu className="h-4 w-4 text-violet-400" /> Model Pricing</h3>
                <p className="text-xs text-white/40 mt-0.5">Per-model token costs used for cost analytics. Set prices for any provider.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={async () => {
                  setFetchAllLoading(true);
                  try {
                    const res = await fetch('/api/admin/owner/pricing/fetch', { method: 'POST' });
                    if (res.ok) {
                      const d = await res.json();
                      toast.success(`Updated ${d.updated} model prices from OpenRouter`);
                      checkAdminAndLoad();
                    } else {
                      const err = await res.json().catch(() => null);
                      toast.error(err?.error || 'Failed to fetch pricing');
                    }
                  } catch { toast.error('Failed to fetch pricing'); }
                  finally { setFetchAllLoading(false); }
                }} disabled={fetchAllLoading}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-amber-500 hover:to-orange-500 disabled:opacity-50">
                  <RefreshCw className={`h-4 w-4 ${fetchAllLoading ? 'animate-spin' : ''}`} />
                  {fetchAllLoading ? 'Fetching...' : 'Fetch All'}
                </button>
                <button id="fetch-selected-btn" onClick={async () => {
                  if (!fetchModelInput.trim()) { toast.error('Enter model names separated by commas'); return; }
                  setFetchSelectedLoading(true);
                  const models = fetchModelInput.split(',').map(m => m.trim()).filter(Boolean);
                  try {
                    const res = await fetch('/api/admin/owner/pricing/fetch', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ models }),
                    });
                    if (res.ok) {
                      const d = await res.json();
                      toast.success(`Updated ${d.updated} model prices from OpenRouter`);
                      setFetchModelInput('');
                      checkAdminAndLoad();
                    } else {
                      const err = await res.json().catch(() => null);
                      toast.error(err?.error || 'Failed to fetch pricing');
                    }
                  } catch { toast.error('Failed to fetch pricing'); }
                  finally { setFetchSelectedLoading(false); }
                }} disabled={fetchSelectedLoading || !fetchModelInput.trim()}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-cyan-500 hover:to-teal-500 disabled:opacity-50">
                  <RefreshCw className={`h-4 w-4 ${fetchSelectedLoading ? 'animate-spin' : ''}`} />
                  {fetchSelectedLoading ? 'Fetching...' : 'Fetch Selected'}
                </button>
                <button onClick={async () => {
                  setPopulateDefaultsLoading(true);
                  try {
                    const res = await fetch('/api/admin/owner/pricing/defaults', { method: 'POST' });
                    if (res.ok) {
                      const d = await res.json();
                      toast.success(`Populated ${d.updated} default model prices`);
                      checkAdminAndLoad();
                    } else {
                      const err = await res.json().catch(() => null);
                      toast.error(err?.error || 'Failed to populate defaults');
                    }
                  } catch { toast.error('Failed to populate defaults'); }
                  finally { setPopulateDefaultsLoading(false); }
                }} disabled={populateDefaultsLoading}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-purple-500 disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  {populateDefaultsLoading ? 'Saving...' : 'Populate Defaults'}
                </button>
                {selectedPricingIds.size > 0 && (
                  <button onClick={async () => {
                    if (!confirm(`Delete ${selectedPricingIds.size} selected model pricing rows?`)) return;
                    setDeleteSelectedLoading(true);
                    try {
                      const res = await fetch('/api/admin/owner/pricing', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: Array.from(selectedPricingIds) }),
                      });
                      if (res.ok) {
                        toast.success(`Deleted ${selectedPricingIds.size} rows`);
                        setSelectedPricingIds(new Set());
                        checkAdminAndLoad();
                      } else toast.error('Failed to delete selected');
                    } catch { toast.error('Failed to delete selected'); }
                    finally { setDeleteSelectedLoading(false); }
                  }} disabled={deleteSelectedLoading}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-red-500 hover:to-rose-500 disabled:opacity-50">
                    <Trash2 className="h-4 w-4" />
                    {deleteSelectedLoading ? 'Deleting...' : `Delete Selected (${selectedPricingIds.size})`}
                  </button>
                )}
                <button onClick={() => {
                  const newRow = { id: '', provider_id: allProviders[0]?.id || '', model_name: '', input_price_per_1m_tokens: 0, output_price_per_1m_tokens: 0, pricing_unit: 'per_1m_tokens', is_auto_fetched: false, ai_providers: undefined, _isNew: true };
                  setModelPricing(prev => [...prev, newRow as any]);
                }} disabled={allProviders.length === 0}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-purple-500 disabled:opacity-50">
                  <Plus className="h-4 w-4" /> Add Model
                </button>
              </div>
            </div>
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <input value={fetchModelInput} onChange={(e) => setFetchModelInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { document.getElementById('fetch-selected-btn')?.click(); } }}
                  placeholder="Specific models to fetch: openai/gpt-4o, openai/whisper-large-v3-turbo, ..."
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
              </div>
              <p className="text-xs text-white/30 mt-1.5">Enter model names separated by commas. "Fetch All" auto-detects models used in your project. "Populate Defaults" adds hardcoded prices for all known models.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-wider">
                      <th className="pb-3 pr-3 w-8">
                        <input type="checkbox" checked={modelPricing.length > 0 && modelPricing.every(p => p.id && selectedPricingIds.has(p.id))}
                          onChange={() => {
                            if (modelPricing.every(p => p.id && selectedPricingIds.has(p.id))) {
                              setSelectedPricingIds(new Set());
                            } else {
                              setSelectedPricingIds(new Set(modelPricing.filter(p => p.id).map(p => p.id)));
                            }
                          }}
                          className="rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500" />
                      </th>
                      <th className="pb-3 pr-3 font-medium">Provider</th>
                      <th className="pb-3 pr-3 font-medium">Model</th>
                      <th className="pb-3 pr-3 font-medium">Price</th>
                      <th className="pb-3 pr-3 font-medium">Unit</th>
                      <th className="pb-3 pr-3 font-medium">Source</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {modelPricing.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-sm text-white/30">
                        No pricing data yet. Click "Fetch All" or "Add Model" to add prices.
                      </td>
                    </tr>
                  )}
                    {modelPricing.map((pr, idx) => (
                    <tr key={pr.id || `new-${idx}`} className={`hover:bg-white/5 transition-colors ${pr.id && selectedPricingIds.has(pr.id) ? 'bg-violet-500/10' : ''}`}>
                      <td className="py-2.5 pr-3">
                        {pr.id && (
                          <input type="checkbox" checked={selectedPricingIds.has(pr.id)}
                            onChange={() => {
                              const next = new Set(selectedPricingIds);
                              if (next.has(pr.id)) next.delete(pr.id); else next.add(pr.id);
                              setSelectedPricingIds(next);
                            }}
                            className="rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500" />
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <select value={pr.provider_id} onChange={(e) => {
                          const updated = [...modelPricing];
                          updated[idx] = { ...updated[idx], provider_id: e.target.value };
                          setModelPricing(updated);
                        }}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-violet-500/50">
                          {allProviders.map(p => (
                            <option key={p.id} value={p.id} className="bg-gray-900">{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 pr-3">
                        <input value={pr.model_name} onChange={(e) => {
                          const updated = [...modelPricing];
                          updated[idx] = { ...updated[idx], model_name: e.target.value };
                          setModelPricing(updated);
                        }} placeholder="e.g. openai/gpt-4o"
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50 font-mono" />
                      </td>
                      <td className="py-2.5 pr-3">
                        {pr.pricing_unit === 'per_hour' ? (
                          <input type="number" step={0.001} min={0} value={pr.input_price_per_1m_tokens} onChange={(e) => {
                            const updated = [...modelPricing];
                            updated[idx] = { ...updated[idx], input_price_per_1m_tokens: parseFloat(e.target.value) || 0, output_price_per_1m_tokens: 0 };
                            setModelPricing(updated);
                          }}
                            className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-violet-500/50" />
                        ) : (
                          <div className="flex gap-1">
                            <input type="number" step={0.000001} min={0} value={pr.input_price_per_1m_tokens} onChange={(e) => {
                              const updated = [...modelPricing];
                              updated[idx] = { ...updated[idx], input_price_per_1m_tokens: parseFloat(e.target.value) || 0 };
                              setModelPricing(updated);
                            }}
                              className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-violet-500/50" placeholder="Input" />
                            <span className="text-white/20 self-center">/</span>
                            <input type="number" step={0.000001} min={0} value={pr.output_price_per_1m_tokens} onChange={(e) => {
                              const updated = [...modelPricing];
                              updated[idx] = { ...updated[idx], output_price_per_1m_tokens: parseFloat(e.target.value) || 0 };
                              setModelPricing(updated);
                            }}
                              className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-violet-500/50" placeholder="Output" />
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <select value={pr.pricing_unit} onChange={(e) => {
                          const updated = [...modelPricing];
                          updated[idx] = { ...updated[idx], pricing_unit: e.target.value };
                          setModelPricing(updated);
                        }}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-violet-500/50">
                          <option value="per_1m_tokens" className="bg-gray-900">per 1M tokens</option>
                          <option value="per_hour" className="bg-gray-900">per hour</option>
                        </select>
                      </td>
                      <td className="py-2.5 pr-3 text-sm text-white/40">{pr.is_auto_fetched ? 'Auto' : 'Manual'}</td>
                      <td className="py-2.5">
                        <div className="flex gap-1">
                          <button onClick={async () => {
                            // Save single row
                            if (!pr.provider_id || !pr.model_name.trim()) { toast.error('Provider and model required'); return; }
                            setRowSaving(true);
                            try {
                              const res = await fetch('/api/admin/owner/pricing', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ pricing: [{
                                  provider_id: pr.provider_id,
                                  model_name: pr.model_name.trim(),
                                  input_price_per_1m_tokens: pr.input_price_per_1m_tokens,
                                  output_price_per_1m_tokens: pr.output_price_per_1m_tokens,
                                  pricing_unit: pr.pricing_unit || 'per_1m_tokens',
                                  is_auto_fetched: false,
                                }]}),
                              });
                              if (res.ok) {
                                toast.success('Pricing saved');
                                checkAdminAndLoad();
                              } else toast.error('Failed to save');
                            } catch { toast.error('Failed to save'); }
                            finally { setRowSaving(false); }
                          }} disabled={rowSaving}
                            className="rounded-lg bg-white/5 p-1.5 text-white/40 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors" title="Save">
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          {pr.id && (
                            <button onClick={async () => {
                              if (!confirm('Delete this model pricing?')) return;
                              const res = await fetch('/api/admin/owner/pricing', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ids: [pr.id] }),
                              });
                              if (res.ok) {
                                toast.success('Deleted');
                                checkAdminAndLoad();
                              } else toast.error('Failed to delete');
                            }}
                              className="rounded-lg bg-white/5 p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-colors" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Gateways */}
          <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Banknote className="h-4 w-4 text-emerald-400" /> Payment Gateways</h3>
                <p className="text-xs text-white/40 mt-0.5">Configure payment gateway credentials. Checkout processing coming in a future update.</p>
              </div>
              <button onClick={() => { setShowGatewayForm(true); setEditingGatewayId(null); setGatewayForm({ name: '', slug: '', is_active: false, config: '{}', sort_order: 0 }); }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 text-sm font-medium hover:from-emerald-500 hover:to-teal-500 transition-all">
                <Plus className="h-4 w-4" /> Add Gateway
              </button>
            </div>

            {gateways.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/30">No payment gateways configured yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-wider">
                    <th className="pb-3 pr-3 font-medium">Name</th>
                    <th className="pb-3 pr-3 font-medium">Slug</th>
                    <th className="pb-3 pr-3 font-medium">Status</th>
                    <th className="pb-3 pr-3 font-medium">Config</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {gateways.map((gw: any) => (
                    <tr key={gw.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-3 font-medium text-white">{gw.name}</td>
                      <td className="py-3 pr-3 text-sm text-white/50 font-mono">{gw.slug}</td>
                      <td className="py-3 pr-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${gw.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/40'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${gw.is_active ? 'bg-emerald-400' : 'bg-white/20'}`} />
                          {gw.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-xs text-white/40 font-mono truncate max-w-[200px]">{JSON.stringify(gw.config)}</td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <button onClick={async () => {
                            const name = prompt('Gateway name:', gw.name); if (!name) return;
                            const slug = prompt('Slug:', gw.slug); if (!slug) return;
                            const res = await fetch('/api/admin/payment-gateways', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: gw.id, name, slug }) });
                            const d = await res.json(); if (d.gateway) { setGateways(prev => prev.map(g => g.id === gw.id ? d.gateway : g)); }
                          }} className="rounded-lg bg-white/5 p-1.5 text-white/40 hover:bg-violet-500/20 hover:text-violet-400 transition-colors" title="Edit">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={async () => {
                            const active = !gw.is_active;
                            const res = await fetch('/api/admin/payment-gateways', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: gw.id, is_active: active }) });
                            const d = await res.json(); if (d.gateway) { setGateways(prev => prev.map(g => g.id === gw.id ? d.gateway : g)); }
                          }} className="rounded-lg bg-white/5 p-1.5 text-white/40 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors" title="Toggle active">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={async () => {
                            if (!confirm(`Delete gateway "${gw.name}"?`)) return;
                            const res = await fetch(`/api/admin/payment-gateways?id=${gw.id}`, { method: 'DELETE' });
                            const d = await res.json(); if (d.success) { setGateways(prev => prev.filter(g => g.id !== gw.id)); }
                          }} className="rounded-lg bg-white/5 p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-colors" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {showGatewayForm && (
              <div className="mt-4 rounded-xl border border-white/10 p-4 bg-white/5">
                <div className="grid gap-4 sm:grid-cols-2 mb-4">
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Name</label>
                    <input value={gatewayForm.name} onChange={(e) => setGatewayForm(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') }))}
                      placeholder="e.g. Amarpay" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Slug</label>
                    <input value={gatewayForm.slug} onChange={(e) => setGatewayForm(f => ({ ...f, slug: e.target.value }))}
                      placeholder="e.g. amarpay" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Sort Order</label>
                    <input type="number" min={0} value={gatewayForm.sort_order} onChange={(e) => setGatewayForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={gatewayForm.is_active} onChange={(e) => setGatewayForm(f => ({ ...f, is_active: e.target.checked }))}
                        className="h-5 w-5 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30" />
                      <span className="text-sm text-white/60">Active</span>
                    </label>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-xs font-medium text-white/60 mb-1 block">Config (JSON)</label>
                  <textarea value={gatewayForm.config} onChange={(e) => setGatewayForm(f => ({ ...f, config: e.target.value }))}
                    rows={3} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white font-mono outline-none focus:border-violet-500/50" placeholder='{"api_key": "...", "endpoint_url": "..."}' />
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    setGatewaySaving(true);
                    try {
                      let config: Record<string, unknown> = {};
                      try { config = JSON.parse(gatewayForm.config); } catch { config = {}; }
                      const res = await fetch('/api/admin/payment-gateways', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...gatewayForm, config }),
                      });
                      const d = await res.json();
                      if (d.gateway) { setGateways(prev => [...prev, d.gateway].sort((a, b) => a.sort_order - b.sort_order)); setShowGatewayForm(false); }
                    } finally { setGatewaySaving(false); }
                  }} disabled={gatewaySaving || !gatewayForm.name || !gatewayForm.slug}
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-sm font-medium text-white hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50">
                    {gatewaySaving ? 'Saving...' : 'Create Gateway'}
                  </button>
                  <button onClick={() => setShowGatewayForm(false)} className="rounded-xl border border-white/10 px-5 py-2 text-sm font-medium text-white/60 hover:bg-white/5">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Credit Packs */}
          <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-emerald-400" /> Credit Packs</h3>
                <p className="text-xs text-white/40 mt-0.5">Predefined credit packs users can purchase. Admins manually approve purchases.</p>
              </div>
              <button onClick={() => { setShowCreditPackForm(true); setEditingCreditPackId(null); setCreditPackForm({ name: '', slug: '', credits_amount: 100, price_cents: 1000, is_active: true, is_auto_renew: false, sort_order: 0, description: '' }); }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 text-sm font-medium hover:from-emerald-500 hover:to-teal-500 transition-all">
                <Plus className="h-4 w-4" /> Add Pack
              </button>
            </div>

            {creditPacks.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/30">No credit packs configured yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-wider">
                    <th className="pb-3 pr-3 font-medium">Name</th>
                    <th className="pb-3 pr-3 font-medium">Credits</th>
                    <th className="pb-3 pr-3 font-medium">Price</th>
                    <th className="pb-3 pr-3 font-medium">Per Credit</th>
                    <th className="pb-3 pr-3 font-medium">Auto</th>
                    <th className="pb-3 pr-3 font-medium">Active</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {creditPacks.map((pack: any) => (
                    <tr key={pack.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-3 font-medium text-white">{pack.name}</td>
                      <td className="py-3 pr-3 text-white/70">{pack.credits_amount.toLocaleString()}</td>
                      <td className="py-3 pr-3 text-white/70">${(pack.price_cents / 100).toFixed(2)}</td>
                      <td className="py-3 pr-3 text-white/50">${(pack.price_cents / Math.max(pack.credits_amount, 1) / 100).toFixed(3)}</td>
                      <td className="py-3 pr-3">{pack.is_auto_renew ? <span className="text-emerald-400">Yes</span> : <span className="text-white/30">No</span>}</td>
                      <td className="py-3 pr-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${pack.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/40'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${pack.is_active ? 'bg-emerald-400' : 'bg-white/20'}`} />
                          {pack.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <button onClick={() => {
                            setEditingCreditPackId(pack.id);
                            setCreditPackForm({
                              name: pack.name,
                              slug: pack.slug,
                              credits_amount: pack.credits_amount,
                              price_cents: pack.price_cents,
                              is_active: pack.is_active,
                              is_auto_renew: pack.is_auto_renew,
                              sort_order: pack.sort_order,
                              description: pack.description || '',
                            });
                            setShowCreditPackForm(true);
                          }} className="rounded-lg bg-white/5 p-1.5 text-white/40 hover:bg-violet-500/20 hover:text-violet-400 transition-colors" title="Edit">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={async () => {
                            const res = await fetch('/api/admin/credit-packs', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: pack.id, is_active: !pack.is_active }),
                            });
                            const d = await res.json();
                            if (d.pack) { setCreditPacks(prev => prev.map(p => p.id === pack.id ? d.pack : p)); }
                          }} className="rounded-lg bg-white/5 p-1.5 text-white/40 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors" title="Toggle active">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDeleteCreditPack(pack.id)} className="rounded-lg bg-white/5 p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-colors" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {showCreditPackForm && (
              <div className="mt-4 rounded-xl border border-white/10 p-4 bg-white/5">
                <div className="grid gap-4 sm:grid-cols-2 mb-4">
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Name *</label>
                    <input value={creditPackForm.name} onChange={(e) => setCreditPackForm(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') }))}
                      placeholder="e.g. Starter Pack" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Slug *</label>
                    <input value={creditPackForm.slug} onChange={(e) => setCreditPackForm(f => ({ ...f, slug: e.target.value }))}
                      placeholder="e.g. starter" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Credits Amount</label>
                    <input type="number" min={1} value={creditPackForm.credits_amount} onChange={(e) => setCreditPackForm(f => ({ ...f, credits_amount: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Price (cents)</label>
                    <input type="number" min={0} value={creditPackForm.price_cents} onChange={(e) => setCreditPackForm(f => ({ ...f, price_cents: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Sort Order</label>
                    <input type="number" min={0} value={creditPackForm.sort_order} onChange={(e) => setCreditPackForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Description</label>
                    <input value={creditPackForm.description} onChange={(e) => setCreditPackForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="e.g. 100 credits — perfect for getting started" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
                  </div>
                  <div className="flex items-end gap-4 pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={creditPackForm.is_active} onChange={(e) => setCreditPackForm(f => ({ ...f, is_active: e.target.checked }))}
                        className="h-5 w-5 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30" />
                      <span className="text-sm text-white/60">Active</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={creditPackForm.is_auto_renew} onChange={(e) => setCreditPackForm(f => ({ ...f, is_auto_renew: e.target.checked }))}
                        className="h-5 w-5 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30" />
                      <span className="text-sm text-white/60">Auto-Renew</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveCreditPack} disabled={creditPackSaving || !creditPackForm.name || !creditPackForm.slug}
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-sm font-medium text-white hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50">
                    {creditPackSaving ? 'Saving...' : editingCreditPackId ? 'Update Pack' : 'Create Pack'}
                  </button>
                  <button onClick={() => { setShowCreditPackForm(false); setEditingCreditPackId(null); }} className="rounded-xl border border-white/10 px-5 py-2 text-sm font-medium text-white/60 hover:bg-white/5">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Credit Purchases */}
          <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Banknote className="h-4 w-4 text-amber-400" /> Credit Purchases</h3>
                <p className="text-xs text-white/40 mt-0.5">Review and approve user credit purchase requests.</p>
              </div>
              <div className="flex items-center gap-2">
                {['pending', 'approved', 'rejected'].map(s => (
                  <button key={s} onClick={() => { setPurchaseFilter(s); loadPurchases(); }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${purchaseFilter === s ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
                <button onClick={loadPurchases} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 transition-colors">
                  <RefreshCw className={`h-3.5 w-3.5 text-white/40 ${purchaseLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {purchases.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/30">No {purchaseFilter} purchases.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-wider">
                    <th className="pb-3 pr-3 font-medium">Date</th>
                    <th className="pb-3 pr-3 font-medium">User</th>
                    <th className="pb-3 pr-3 font-medium">Pack</th>
                    <th className="pb-3 pr-3 font-medium">Credits</th>
                    <th className="pb-3 pr-3 font-medium">Amount</th>
                    <th className="pb-3 pr-3 font-medium">Method</th>
                    <th className="pb-3 pr-3 font-medium">Reference</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {purchases.map((p: any) => (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-3 text-white/50 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="py-3 pr-3">
                        <div>
                          <p className="text-sm text-white font-medium">{p.user?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-white/40">{p.user?.email || ''}</p>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-white/70">{p.pack?.name || '—'}</td>
                      <td className="py-3 pr-3 text-white/70">{p.credits_allocated.toLocaleString()}</td>
                      <td className="py-3 pr-3 text-white/70">${(p.amount_paid_cents / 100).toFixed(2)}</td>
                      <td className="py-3 pr-3 text-white/50 capitalize">{p.payment_method || '—'}</td>
                      <td className="py-3 pr-3 text-white/50 font-mono text-xs">{p.reference_id || '—'}</td>
                      <td className="py-3">
                        {p.status === 'pending' ? (
                          <div className="flex gap-1">
                            <button onClick={() => handleApprovePurchase(p.id)}
                              className="rounded-lg bg-emerald-500/20 p-1.5 text-emerald-400 hover:bg-emerald-500/30 transition-colors" title="Approve">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleRejectPurchase(p.id)}
                              className="rounded-lg bg-red-500/20 p-1.5 text-red-400 hover:bg-red-500/30 transition-colors" title="Reject">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            p.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                            p.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                            'bg-white/5 text-white/40'
                          }`}>
                            {p.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Plan Pricing */}
          <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2"><CreditCard className="h-4 w-4 text-green-400" /> Plan Pricing</h3>
                <p className="text-xs text-white/40 mt-0.5">Configure plan pricing and features. Changes reflect live on the website.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-wider">
                    <th className="pb-3 pr-3 font-medium">Plan</th>
                    <th className="pb-3 pr-3 font-medium">Price/mo</th>
                    <th className="pb-3 pr-3 font-medium">Credits per Month</th>
                    <th className="pb-3 pr-3 font-medium">Max Pages</th>
                    <th className="pb-3 pr-3 font-medium">Features</th>
                    <th className="pb-3 pr-3 font-medium">Popular</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {plans.map((plan) => (
                    <PlanRow
                      key={plan.id}
                      plan={plan}
                      onSave={handleSavePlan}
                      onDelete={handleDeletePlan}
                      saving={planSaving}
                    />
                  ))}
                  {plans.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-white/30">No plans configured yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add New Plan */}
          <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2"><Plus className="h-4 w-4 text-violet-400" /> Add New Plan</h4>
            </div>
            {editingPlan === null ? (
              <div>
                <div className="grid gap-4 sm:grid-cols-3 mb-4">
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Slug *</label>
                    <input value={planForm.slug} onChange={(e) => setPlanForm(p => ({ ...p, slug: e.target.value }))} placeholder="e.g. premium"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Name *</label>
                    <input value={planForm.name} onChange={(e) => setPlanForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Premium"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Description</label>
                    <input value={planForm.description} onChange={(e) => setPlanForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. For power users"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Price (cents) *</label>
                    <input type="number" min={0} value={planForm.price_monthly_cents} onChange={(e) => setPlanForm(p => ({ ...p, price_monthly_cents: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Credits per Month</label>
                    <input type="number" min={0} value={planForm.monthly_quota} onChange={(e) => setPlanForm(p => ({ ...p, monthly_quota: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
                    <p className="text-xs text-white/30 mt-1">Credits allocated each month on subscription renewal</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Max Pages</label>
                    <input type="number" min={0} value={planForm.max_pages} onChange={(e) => setPlanForm(p => ({ ...p, max_pages: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Sort Order</label>
                    <input type="number" min={0} value={planForm.sort_order} onChange={(e) => setPlanForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={planForm.is_popular} onChange={(e) => setPlanForm(p => ({ ...p, is_popular: e.target.checked }))}
                        className="h-5 w-5 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500/30" />
                      <span className="text-sm text-white/60">Show as "Most Popular"</span>
                    </label>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-xs font-medium text-white/60 mb-1 block">Features</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {planForm.features.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs text-white/70">
                        {f}
                        <button onClick={() => setPlanForm(p => ({ ...p, features: p.features.filter((_, j) => j !== i) }))}>
                          <X className="h-3 w-3 text-white/40 hover:text-white" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={newFeature} onChange={(e) => setNewFeature(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newFeature.trim()) { setPlanForm(p => ({ ...p, features: [...p.features, newFeature.trim()] })); setNewFeature(''); } } }}
                      placeholder="Type a feature and press Enter..." className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                    <button onClick={() => { if (newFeature.trim()) { setPlanForm(p => ({ ...p, features: [...p.features, newFeature.trim()] })); setNewFeature(''); } }}
                      className="rounded-xl bg-white/5 px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/10 transition-colors">Add</button>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-xs font-medium text-white/60 mb-2 block">Allowed Actions</label>
                  <div className="flex flex-wrap gap-3">
                    {['text_reply', 'image_read', 'voice_read'].map(action => (
                      <label key={action} className="flex items-center gap-2 cursor-pointer rounded-xl border border-white/10 px-3 py-2 hover:bg-white/5 transition-colors">
                        <input type="checkbox" checked={planForm.allowed_actions.includes(action)}
                          onChange={(e) => setPlanForm(p => ({
                            ...p,
                            allowed_actions: e.target.checked
                              ? [...p.allowed_actions, action]
                              : p.allowed_actions.filter(a => a !== action),
                          }))}
                          className="h-4 w-4 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500/30" />
                        <span className="text-sm text-white/70 capitalize">{action.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {profitEstimates.length > 0 && (
                  <div className="mb-4 rounded-xl bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border border-emerald-500/10 p-4">
                    <h4 className="text-xs font-semibold text-emerald-400 mb-2">Profit Estimate (based on last 30d avg)</h4>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-white/40">Avg cost/user</span>
                        <p className="text-sm font-semibold text-white">${profitEstimates[0]?.avg_cost_per_user.toFixed(4) || '0.00'}</p>
                      </div>
                      <div>
                        <span className="text-white/40">Plan price</span>
                        <p className="text-sm font-semibold text-white">${((planForm.price_monthly_cents || 0) / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-white/40">Est. profit</span>
                        <p className="text-sm font-semibold" style={{ color: (planForm.price_monthly_cents / 100) > (profitEstimates[0]?.avg_cost_per_user || 0) ? '#34d399' : '#f87171' }}>
                          ${(((planForm.price_monthly_cents || 0) / 100) - (profitEstimates[0]?.avg_cost_per_user || 0)).toFixed(4)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <button onClick={handleCreatePlan} disabled={planSaving || !planForm.name || !planForm.slug}
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:from-violet-500 hover:to-purple-500 disabled:opacity-50">
                  {planSaving ? 'Creating...' : 'Create Plan'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-white/40">Close the editing plan above to add a new one.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanRow({ plan, onSave, onDelete, saving }: {
  plan: BillingPlan;
  onSave: (p: BillingPlan) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState(plan);
  const [newFeature, setNewFeature] = useState('');

  async function handleSave() {
    await onSave(edit);
    setEditing(false);
  }

  return editing ? (
    <tr className="bg-violet-500/5">
      <td className="py-3 pr-3">
        <input value={edit.name} onChange={(e) => setEdit(p => ({ ...p, name: e.target.value }))}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none focus:border-violet-500/50" />
      </td>
      <td className="py-3 pr-3">
        <input type="number" min={0} value={edit.price_monthly_cents} onChange={(e) => setEdit(p => ({ ...p, price_monthly_cents: parseInt(e.target.value) || 0 }))}
          className="w-24 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none focus:border-violet-500/50" />
      </td>
      <td className="py-3 pr-3">
        <input type="number" min={0} value={edit.monthly_quota} onChange={(e) => setEdit(p => ({ ...p, monthly_quota: parseInt(e.target.value) || 0 }))}
          className="w-20 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none focus:border-violet-500/50" />
      </td>
      <td className="py-3 pr-3">
        <input type="number" min={0} value={edit.max_pages} onChange={(e) => setEdit(p => ({ ...p, max_pages: parseInt(e.target.value) || 0 }))}
          className="w-20 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none focus:border-violet-500/50" />
      </td>
      <td className="py-3 pr-3">
        <div className="flex flex-wrap gap-1">
          {edit.features.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-0.5 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60">
              {f}
              <button onClick={() => setEdit(p => ({ ...p, features: p.features.filter((_, j) => j !== i) }))}><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-1 mt-1">
          <input value={newFeature} onChange={(e) => setNewFeature(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newFeature.trim()) { setEdit(p => ({ ...p, features: [...p.features, newFeature.trim()] })); setNewFeature(''); } } }}
            placeholder="+ feature" className="w-20 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white placeholder-white/30 outline-none" />
          <button onClick={() => { if (newFeature.trim()) { setEdit(p => ({ ...p, features: [...p.features, newFeature.trim()] })); setNewFeature(''); } }}
            className="text-[10px] text-violet-400">Add</button>
        </div>
      </td>
      <td className="py-3 pr-3">
        <input type="checkbox" checked={edit.is_popular} onChange={(e) => setEdit(p => ({ ...p, is_popular: e.target.checked }))}
          className="h-4 w-4 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500/30" />
      </td>
      <td className="py-3">
        <div className="flex items-start gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex gap-1.5">
              {['text_reply', 'image_read', 'voice_read'].map(action => (
                <button key={action} onClick={() => setEdit(p => ({
                  ...p,
                  allowed_actions: p.allowed_actions?.includes(action)
                    ? p.allowed_actions.filter((a: string) => a !== action)
                    : [...(p.allowed_actions || ['text_reply', 'image_read', 'voice_read']), action],
                }))}
                  className={`rounded px-1.5 py-0.5 text-[9px] uppercase font-medium transition-colors ${
                    edit.allowed_actions?.includes(action)
                      ? 'bg-violet-500/20 text-violet-300'
                      : 'bg-white/5 text-white/30'
                  }`}>
                  {action === 'text_reply' ? 'T' : action === 'image_read' ? 'IMG' : 'VO'}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button onClick={handleSave} disabled={saving} className="rounded-lg bg-emerald-500/20 p-1.5 text-emerald-400 hover:bg-emerald-500/30 transition-colors" title="Save">
                <Save className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setEditing(false)} className="rounded-lg bg-white/5 p-1.5 text-white/40 hover:bg-white/10 transition-colors" title="Cancel">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  ) : (
    <tr className="hover:bg-white/5 transition-colors">
      <td className="py-3 pr-3 font-medium text-white">{plan.name}</td>
      <td className="py-3 pr-3 text-sm text-white/70">${(plan.price_monthly_cents / 100).toFixed(2)}</td>
      <td className="py-3 pr-3 text-sm text-white/70">{plan.monthly_quota.toLocaleString()}</td>
      <td className="py-3 pr-3 text-sm text-white/70">{plan.max_pages === 999 ? 'Unlimited' : plan.max_pages}</td>
      <td className="py-3 pr-3">
        <div className="flex flex-wrap gap-1">
          {plan.features.slice(0, 2).map((f, i) => (
            <span key={i} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">{f}</span>
          ))}
          {plan.features.length > 2 && <span className="text-[10px] text-white/30">+{plan.features.length - 2}</span>}
        </div>
        {plan.allowed_actions && (
          <div className="flex gap-1 mt-1">
            {plan.allowed_actions.map((a: string) => (
              <span key={a} className="rounded bg-violet-500/10 px-1 py-0.5 text-[9px] uppercase text-violet-400 font-medium">
                {a === 'text_reply' ? 'T' : a === 'image_read' ? 'IMG' : 'VO'}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="py-3 pr-3">{plan.is_popular && <span className="text-xs text-amber-400">★</span>}</td>
      <td className="py-3">
        <div className="flex gap-1">
          <button onClick={() => setEditing(true)} className="rounded-lg bg-white/5 p-1.5 text-white/40 hover:bg-violet-500/20 hover:text-violet-400 transition-colors" title="Edit">
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(plan.id)} className="rounded-lg bg-white/5 p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-colors" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
