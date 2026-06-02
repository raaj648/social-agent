'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { usePageTitle } from '@/lib/use-page-title';
import {
  CreditCard, RefreshCw, Loader2, DollarSign,
  TrendingUp, ChevronDown, ChevronUp,
  Crown, BarChart3, ShoppingBag, Zap, Check,
  X, History,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { toast } from 'sonner';
import type { CreditPack, CreditPurchase } from '@/types';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

export default function BillingPage() {
  usePageTitle('Billing');
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [days, setDays] = useState(30);

  const [creditPacks, setCreditPacks] = useState<CreditPack[]>([]);
  const [purchases, setPurchases] = useState<CreditPurchase[]>([]);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedPack, setSelectedPack] = useState<CreditPack | null>(null);
  const [purchaseMethod, setPurchaseMethod] = useState('');
  const [purchaseRef, setPurchaseRef] = useState('');
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => { fetchAll(); }, [days]);

  async function fetchAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    try {
      const [anaRes, packsRes] = await Promise.all([
        fetch(`/api/user/analytics?days=${days}`),
        fetch('/api/user/credit-packs'),
      ]);
      const result = await anaRes.json();
      setData(result);
      const packsData = await packsRes.json();
      setCreditPacks(packsData.packs || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!data?.profile?.id) return;
    supabase
      .from('credit_purchases')
      .select('*')
      .eq('user_id', data.profile.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data: purchasesData }) => setPurchases(purchasesData || []));
  }, [data?.profile?.id]);

  async function handlePurchase() {
    if (!selectedPack) return;
    setPurchasing(true);
    try {
      const res = await fetch('/api/user/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack_id: selectedPack.id,
          payment_method: purchaseMethod || 'manual',
          reference_id: purchaseRef || null,
        }),
      });
      const result = await res.json();
      if (!result.purchase) throw new Error(result.error || 'Failed to submit purchase');
      toast.success('Purchase request submitted! An admin will approve it shortly.');
      setShowBuyModal(false);
      setSelectedPack(null);
      setPurchaseMethod('');
      setPurchaseRef('');
      setPurchases(prev => [result.purchase, ...prev]);
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit purchase');
    }
    setPurchasing(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!data) {
    return <div className="py-20 text-center text-muted-foreground">Failed to load billing data.</div>;
  }

  const { profile, subscription, usage, dailyUsage, actionBreakdown, pointCosts } = data;
  const creditsPct = Math.min((profile.credits_remaining / Math.max(profile.credits_total, 1)) * 100, 100);

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      refunded: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
    return styles[status] || styles.pending;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing & Usage</h1>
          <p className="text-muted-foreground">Track your usage, buy credits, and manage your subscription</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-input bg-background p-1">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${days === d ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {d}d
              </button>
            ))}
          </div>
          <button onClick={fetchAll} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5">
          <div className="absolute right-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 opacity-10" />
          <p className="text-sm font-medium text-muted-foreground">Credits Balance</p>
          <p className="mt-3 text-3xl font-bold">{profile.credits_remaining.toLocaleString()} <span className="text-lg text-muted-foreground">/ {profile.credits_total.toLocaleString()}</span></p>
          <div className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all" style={{ width: `${creditsPct}%` }} />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5">
          <div className="absolute right-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 opacity-10" />
          <p className="text-sm font-medium text-muted-foreground">AI Cost ({days}d)</p>
          <p className="mt-3 text-3xl font-bold text-amber-600">${usage.totalCost.toFixed(2)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{usage.totalCalls} AI calls, {usage.totalTokens.toLocaleString()} tokens</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5">
          <div className="absolute right-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 opacity-10" />
          <p className="text-sm font-medium text-muted-foreground">Plan</p>
          <p className="mt-3 text-3xl font-bold capitalize flex items-center gap-2">
            <Crown className={`h-6 w-6 ${profile.plan === 'free' ? 'text-gray-400' : 'text-amber-500'}`} />
            {profile.plan}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {subscription ? `${subscription.plan_name || profile.plan} — $${(subscription.price_monthly_cents / 100).toFixed(2)}/mo` : 'Free tier'}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5">
          <div className="absolute right-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 opacity-10" />
          <p className="text-sm font-medium text-muted-foreground">Credits Used ({days}d)</p>
          <p className="mt-3 text-3xl font-bold text-emerald-600">{usage.totalPoints.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Text: {pointCosts.text_reply}cr · Image: {pointCosts.image_read}cr · Voice: {pointCosts.voice_read}cr
          </p>
        </div>
      </div>

      {/* Buy Credits */}
      {creditPacks.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <ShoppingBag className="h-5 w-5 text-emerald-600" />
              Buy Credits
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {creditPacks.map((pack) => (
              <button key={pack.id} onClick={() => { setSelectedPack(pack); setShowBuyModal(true); }}
                className="relative group rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-left hover:border-emerald-400 dark:hover:border-emerald-500 transition-all hover:shadow-md hover:-translate-y-0.5 bg-white dark:bg-gray-900">
                {pack.is_auto_renew && (
                  <span className="absolute -top-2 right-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Auto
                  </span>
                )}
                <p className="text-sm text-muted-foreground mb-1">{pack.name}</p>
                <p className="text-2xl font-bold">{pack.credits_amount.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">cr</span></p>
                <p className="mt-2 text-lg font-semibold text-emerald-600">${(pack.price_cents / 100).toFixed(2)}</p>
                {pack.description && <p className="mt-1 text-xs text-muted-foreground">{pack.description}</p>}
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Zap className="h-3 w-3" /> Buy Now
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {showBuyModal && selectedPack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowBuyModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Purchase Credits</h3>
              <button onClick={() => setShowBuyModal(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="rounded-xl bg-muted/30 p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{selectedPack.name}</p>
                  <p className="text-2xl font-bold mt-1">{selectedPack.credits_amount.toLocaleString()} <span className="text-sm text-muted-foreground">credits</span></p>
                </div>
                <p className="text-2xl font-bold text-emerald-600">${(selectedPack.price_cents / 100).toFixed(2)}</p>
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Payment Method</label>
                <input type="text" value={purchaseMethod} onChange={(e) => setPurchaseMethod(e.target.value)}
                  placeholder="e.g. bKash, Nagad, Bank Transfer"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Transaction / Reference ID</label>
                <input type="text" value={purchaseRef} onChange={(e) => setPurchaseRef(e.target.value)}
                  placeholder="Optional — enter your payment reference"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-emerald-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Your purchase request will be reviewed and approved by an admin. You will receive the credits once approved.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowBuyModal(false)}
                className="flex-1 rounded-xl border border-input px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={handlePurchase} disabled={purchasing}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2.5 text-sm font-medium hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50">
                {purchasing ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold mb-6">
            <BarChart3 className="h-5 w-5 text-violet-600" />
            Daily Usage ({days}d)
          </h3>
          {dailyUsage.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }} />
                <Bar dataKey="points" name="Credits" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="py-12 text-center text-sm text-muted-foreground">No usage data for this period.</p>}
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold mb-6">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Action Type Breakdown
          </h3>
          {actionBreakdown.length > 0 ? (
            <div className="space-y-5">
              {actionBreakdown.map((item: any, idx: number) => {
                const maxCount = Math.max(...actionBreakdown.map((a: any) => a.count), 1);
                return (
                  <div key={item.type}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium capitalize">{item.type.replace(/_/g, ' ')}</span>
                      <span className="text-muted-foreground">{item.count} calls · {item.points} cr · ${item.cost.toFixed(2)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(item.count / maxCount) * 100}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="py-12 text-center text-sm text-muted-foreground">No action data yet.</p>}
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden">
        <button onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            Advanced — Real Token Costs
          </h3>
          {showAdvanced ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {showAdvanced && (
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Behind-the-scenes AI provider costs. Credits are a simplified representation; actual costs vary by model and token count.
            </p>
            <div className="rounded-xl bg-muted/30 p-4">
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Total AI Cost</p>
                  <p className="text-lg font-bold text-amber-600">${usage.totalCost.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Tokens</p>
                  <p className="text-lg font-bold">{usage.totalTokens.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Calls</p>
                  <p className="text-lg font-bold">{usage.totalCalls.toLocaleString()}</p>
                </div>
              </div>
            </div>
            {dailyUsage.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="pb-2 pr-3 font-medium">Date</th>
                      <th className="pb-2 pr-3 font-medium">Tokens</th>
                      <th className="pb-2 pr-3 font-medium">Credits</th>
                      <th className="pb-2 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {dailyUsage.map((d: any) => (
                      <tr key={d.date} className="text-muted-foreground">
                        <td className="py-2 pr-3">{d.date}</td>
                        <td className="py-2 pr-3">{d.tokens.toLocaleString()}</td>
                        <td className="py-2 pr-3">{d.points}</td>
                        <td className="py-2 font-medium text-amber-600">${d.cost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Purchase History */}
      {purchases.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <History className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Purchase History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Pack</th>
                  <th className="px-4 py-3 font-medium">Credits</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium">{creditPacks.find(c => c.id === p.pack_id)?.name || '—'}</td>
                    <td className="px-4 py-3">{p.credits_allocated.toLocaleString()}</td>
                    <td className="px-4 py-3">${(p.amount_paid_cents / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{p.payment_method || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(p.status)}`}>
                        {p.status === 'approved' && <Check className="h-3 w-3 mr-1" />}
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subscription && (
        <div className="rounded-2xl bg-gradient-to-br from-violet-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-purple-950 border border-violet-100 dark:border-violet-900 p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
            <CreditCard className="h-5 w-5 text-violet-600" />
            Current Subscription
          </h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
              <p className="text-2xl font-bold text-violet-600">{subscription.plan_name || profile.plan}</p>
              <p className="text-xs text-muted-foreground">Plan</p>
            </div>
            <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600 capitalize">{subscription.status}</p>
              <p className="text-xs text-muted-foreground">Status</p>
            </div>
            <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
              <p className="text-2xl font-bold">{subscription.points_used}/{subscription.points_allocated}</p>
              <p className="text-xs text-muted-foreground">Credits Used</p>
            </div>
            <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">${(subscription.price_monthly_cents / 100).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Monthly Price</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span>Started: {new Date(subscription.start_date).toLocaleDateString()}</span>
            {subscription.end_date && <span>Ends: {new Date(subscription.end_date).toLocaleDateString()}</span>}
            <span>Auto-renew: {subscription.auto_renew ? 'Yes' : 'No'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
