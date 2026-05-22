'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  Save, Settings, ExternalLink, RefreshCw,
  CheckCircle, AlertCircle, Shield, Globe,
  CreditCard, Key, Plus, Trash2, X, Edit3,
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

  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [planSaving, setPlanSaving] = useState(false);
  const [newFeature, setNewFeature] = useState('');

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

      const plansData = await plansRes.json();
      setPlans(plansData.plans || []);
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
                    <th className="pb-3 pr-3 font-medium">Monthly Quota</th>
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
                    <label className="text-xs font-medium text-white/60 mb-1 block">Monthly Quota</label>
                    <input type="number" min={0} value={planForm.monthly_quota} onChange={(e) => setPlanForm(p => ({ ...p, monthly_quota: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
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
        <div className="flex gap-1">
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-emerald-500/20 p-1.5 text-emerald-400 hover:bg-emerald-500/30 transition-colors" title="Save">
            <Save className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setEditing(false)} className="rounded-lg bg-white/5 p-1.5 text-white/40 hover:bg-white/10 transition-colors" title="Cancel">
            <X className="h-3.5 w-3.5" />
          </button>
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
          {plan.features.slice(0, 3).map((f, i) => (
            <span key={i} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">{f}</span>
          ))}
          {plan.features.length > 3 && <span className="text-[10px] text-white/30">+{plan.features.length - 3}</span>}
        </div>
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
