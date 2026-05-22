'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Plus, Trash2, Save, Loader2, Download, Upload, ArrowUp, ArrowDown, Globe, Facebook, Instagram, MessageCircle, Package, DollarSign, Image as ImageIcon, Tags } from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { usePageTitle } from '@/lib/use-page-title';
import BusinessSelector from '@/components/business/BusinessSelector';
import type { KnowledgeBaseItem, ConnectedPage, InstagramAccount, WhatsAppAccount, Product, Business } from '@/types';

const CATEGORIES = ['general', 'faq', 'pricing', 'delivery', 'products', 'policy'] as const;
const PLATFORMS = [
  { value: 'all', label: 'All Platforms', icon: Globe },
  { value: 'messenger', label: 'Messenger', icon: Facebook },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
] as const;

export default function KnowledgeBasePage() {
  usePageTitle('Knowledge Base');
  const [activeTab, setActiveTab] = useState<'kb' | 'products'>('kb');
  const [items, setItems] = useState<KnowledgeBaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [kbPlatforms, setKbPlatforms] = useState<Record<string, Array<{ platform: string; platform_ref_id: string | null }>>>({});
  const [editing, setEditing] = useState<Record<string, { title: string; content: string; category: KnowledgeBaseItem['category']; selectedPlatforms: Array<{ platform: string; platform_ref_id: string | null }> }>>({});
  const [filter, setFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [connectedPages, setConnectedPages] = useState<ConnectedPage[]>([]);
  const [igAccounts, setIgAccounts] = useState<InstagramAccount[]>([]);
  const [waAccounts, setWaAccounts] = useState<WhatsAppAccount[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productForm, setProductForm] = useState<{ id?: string; name: string; description: string; price: string; category: string; image_url: string; platform: string; platform_ref_id: string; is_active: boolean }>({
    name: '', description: '', price: '', category: '', image_url: '', platform: 'messenger', platform_ref_id: '', is_active: true,
  });
  const [editingProduct, setEditingProduct] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [importingProducts, setImportingProducts] = useState(false);
  const [agentSettings, setAgentSettings] = useState<{
    agent_display_name: string;
    ai_agent_name: string;
    human_handoff_enabled: boolean;
    human_handoff_message: string;
    show_handoff_on_pause: boolean;
    auto_resume_minutes: number | null;
    business_name: string | null;
    agent_role: string;
    saving: boolean;
  }>({
    agent_display_name: 'Support Agent',
    ai_agent_name: 'AI Assistant',
    human_handoff_enabled: true,
    human_handoff_message: '{agent_name} has joined the chat',
    show_handoff_on_pause: false,
    auto_resume_minutes: null,
    business_name: null,
    agent_role: 'Sales Agent',
    saving: false,
  });
  const supabase = createClient();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    if (!activeBusinessId) return;
    loadItems();
    loadConnectedPlatforms();
    loadAgentSettings();
    loadProducts();
  }, [activeBusinessId]);

  async function loadBusinesses() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('businesses').select('*').eq('user_id', user.id).order('created_at');
    const bizList = data || [];
    setBusinesses(bizList);
    if (bizList.length > 0) {
      setActiveBusinessId(bizList[0].id);
    } else {
      setLoading(false);
    }
  }

  async function loadAgentSettings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !activeBusinessId) return;
    const { data } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('user_id', user.id)
      .eq('business_id', activeBusinessId)
      .maybeSingle();
    if (data) {
      setAgentSettings(prev => ({ ...prev, ...data }));
    }
  }

  async function handleSaveAgentSettings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !activeBusinessId) return;
    setAgentSettings(prev => ({ ...prev, saving: true }));
    const { data: existing } = await supabase
      .from('ai_settings')
      .select('id')
      .eq('user_id', user.id)
      .eq('business_id', activeBusinessId)
      .maybeSingle();

    const payload = {
      agent_display_name: agentSettings.agent_display_name,
      ai_agent_name: agentSettings.ai_agent_name,
      human_handoff_enabled: agentSettings.human_handoff_enabled,
      human_handoff_message: agentSettings.human_handoff_message,
      show_handoff_on_pause: agentSettings.show_handoff_on_pause,
      auto_resume_minutes: agentSettings.auto_resume_minutes,
      business_name: agentSettings.business_name,
      agent_role: agentSettings.agent_role,
    };

    if (existing) {
      await supabase.from('ai_settings').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('ai_settings').insert({
        ...payload,
        user_id: user.id,
        business_id: activeBusinessId,
      });
    }
    setAgentSettings(prev => ({ ...prev, saving: false }));
    toast.success('Agent settings saved');
  }

  async function loadConnectedPlatforms() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !activeBusinessId) return;
    const [pagesRes, igRes, waRes] = await Promise.all([
      supabase.from('connected_pages').select('*').eq('user_id', user.id).eq('business_id', activeBusinessId),
      supabase.from('instagram_accounts').select('*').eq('user_id', user.id).eq('business_id', activeBusinessId),
      supabase.from('whatsapp_accounts').select('*').eq('user_id', user.id).eq('business_id', activeBusinessId),
    ]);
    setConnectedPages(pagesRes.data || []);
    setIgAccounts(igRes.data || []);
    setWaAccounts(waRes.data || []);
  }

  async function loadItems() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !activeBusinessId) return;
    const { data } = await supabase.from('knowledge_base').select('*').eq('user_id', user.id).eq('business_id', activeBusinessId).order('sort_order');
    setItems(data || []);
    if (data && data.length > 0) {
      const ids = data.map(i => i.id);
      const { data: links } = await supabase
        .from('knowledge_base_platforms')
        .select('kb_id, platform, platform_ref_id')
        .in('kb_id', ids);
      const map: Record<string, Array<{ platform: string; platform_ref_id: string | null }>> = {};
      for (const link of links || []) {
        if (!map[link.kb_id]) map[link.kb_id] = [];
        map[link.kb_id].push({ platform: link.platform, platform_ref_id: link.platform_ref_id });
      }
      setKbPlatforms(map);
    }
    setLoading(false);
  }

  async function loadProducts() {
    setLoadingProducts(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !activeBusinessId) { setLoadingProducts(false); return; }
    const { data } = await supabase.from('products').select('*').eq('user_id', user.id).eq('business_id', activeBusinessId).order('sort_order');
    setProducts(data || []);
    setLoadingProducts(false);
  }

  async function handleSave(item: KnowledgeBaseItem) {
    const edit = editing[item.id];
    if (!edit) return;
    const primaryPlatform = edit.selectedPlatforms[0]?.platform || null;
    const primaryRefId = edit.selectedPlatforms[0]?.platform_ref_id || null;
    const { error } = await supabase.from('knowledge_base').update({
      title: edit.title,
      content: edit.content,
      category: edit.category,
      platform: primaryPlatform,
      platform_ref_id: primaryRefId,
    }).eq('id', item.id);
    if (error) {
      toast.error('Failed to save entry');
      return;
    }
    await supabase.from('knowledge_base_platforms').delete().eq('kb_id', item.id);
    if (edit.selectedPlatforms.length > 0) {
      await supabase.from('knowledge_base_platforms').insert(
        edit.selectedPlatforms.map(sp => ({
          kb_id: item.id,
          platform: sp.platform,
          platform_ref_id: sp.platform_ref_id || null,
        }))
      );
    }
    const updatedItem = { ...item, title: edit.title, content: edit.content, category: edit.category, platform: primaryPlatform, platform_ref_id: primaryRefId };
    setItems((prev) => prev.map((i) => (i.id === item.id ? updatedItem as KnowledgeBaseItem : i)));
    setKbPlatforms(prev => ({ ...prev, [item.id]: edit.selectedPlatforms }));
    setEditing((prev) => { const { [item.id]: _, ...rest } = prev; return rest; });
    toast.success('Entry saved');
  }

  async function handleAdd() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !activeBusinessId) return;
    const { data } = await supabase.from('knowledge_base').insert({
      user_id: user.id,
      business_id: activeBusinessId,
      category: 'general',
      title: 'New Entry',
      content: 'Add your content here...',
      sort_order: items.length,
      platform: null,
    }).select().single();
    if (data) {
      setItems((prev) => [...prev, data]);
      setEditing((prev) => ({
        ...prev,
        [data.id]: { title: data.title, content: data.content, category: data.category, selectedPlatforms: [] }
      }));
      setKbPlatforms(prev => ({ ...prev, [data.id]: [] }));
      toast.success('New entry created');
    }
  }

  async function handleMoveUp(id: string) {
    const idx = items.findIndex(i => i.id === id);
    if (idx <= 0) return;
    const prev = items[idx - 1];
    await Promise.all([
      supabase.from('knowledge_base').update({ sort_order: prev.sort_order }).eq('id', id),
      supabase.from('knowledge_base').update({ sort_order: items[idx].sort_order }).eq('id', prev.id),
    ]);
    setItems(prevItems => {
      const next = [...prevItems];
      // Fix: Swap the sort_order properties so local state matches DB
      const tempSort = next[idx - 1].sort_order;
      next[idx - 1] = { ...next[idx - 1], sort_order: next[idx].sort_order };
      next[idx] = { ...next[idx], sort_order: tempSort };
      
      // Swap their positions in the array
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  async function handleMoveDown(id: string) {
    const idx = items.findIndex(i => i.id === id);
    if (idx < 0 || idx >= items.length - 1) return;
    const nextItem = items[idx + 1];
    await Promise.all([
      supabase.from('knowledge_base').update({ sort_order: nextItem.sort_order }).eq('id', id),
      supabase.from('knowledge_base').update({ sort_order: items[idx].sort_order }).eq('id', nextItem.id),
    ]);
    setItems(prevItems => {
      const next = [...prevItems];
      // Fix: Swap the sort_order properties so local state matches DB
      const tempSort = next[idx + 1].sort_order;
      next[idx + 1] = { ...next[idx + 1], sort_order: next[idx].sort_order };
      next[idx] = { ...next[idx], sort_order: tempSort };

      // Swap their positions in the array
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  async function handleDelete(id: string) {
    setConfirmDelete(null);
    const { error } = await supabase.from('knowledge_base').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete entry');
      return;
    }
    const remaining = items.filter((i) => i.id !== id);
    // Rebalance sort_order
    const updates = remaining.map((item, idx) =>
      supabase.from('knowledge_base').update({ sort_order: idx }).eq('id', item.id)
    );
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    setItems(remaining.map((item, idx) => ({ ...item, sort_order: idx })));
    toast.success('Entry deleted');
  }

  function handleExport() {
    const csv = Papa.unparse(items.map(i => ({
      category: i.category,
      title: i.title,
      content: i.content,
    })), { quotes: true });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'knowledge-base.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !activeBusinessId) return;
    const text = await file.text();
    const parsed = Papa.parse<{ category: string; title: string; content: string }>(text, {
      header: true,
      skipEmptyLines: true,
    });
    const entries = parsed.data.map((row, i) => ({
      user_id: user.id,
      business_id: activeBusinessId,
      category: (row.category || 'general').trim(),
      title: (row.title || 'Imported Entry').trim(),
      content: (row.content || '').trim(),
      sort_order: items.length + i,
    }));

    if (entries.length > 0) {
      const { data } = await supabase.from('knowledge_base').insert(entries).select();
      if (data) {
        setItems(prev => [...prev, ...data]);
        toast.success(`Imported ${data.length} entries`);
      }
    } else {
      toast.error('No valid entries found in CSV');
    }
    e.target.value = '';
  }

  async function handleSaveProduct() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !activeBusinessId || !productForm.name) return;
    const payload: Record<string, any> = {
      user_id: user.id,
      business_id: activeBusinessId,
      name: productForm.name,
      description: productForm.description || null,
      price: productForm.price ? parseFloat(productForm.price) : null,
      category: productForm.category || null,
      image_url: productForm.image_url || null,
      platform: productForm.platform,
      platform_ref_id: productForm.platform_ref_id || null,
      is_active: productForm.is_active,
    };
    if (editingProduct && productForm.id) {
      await supabase.from('products').update(payload).eq('id', productForm.id);
      toast.success('Product updated');
    } else {
      const { data } = await supabase.from('products').insert(payload).select().single();
      if (data) setProducts(prev => [...prev, data]);
      toast.success('Product added');
    }
    await loadProducts();
    setShowProductForm(false);
    setEditingProduct(false);
    setProductForm({ name: '', description: '', price: '', category: '', image_url: '', platform: 'messenger', platform_ref_id: '', is_active: true });
  }

  async function handleDeleteProduct(id: string) {
    await supabase.from('products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
    toast.success('Product deleted');
  }

  function handleExportProducts() {
    const csv = Papa.unparse(products.map(p => ({
      name: p.name,
      description: p.description || '',
      price: p.price?.toString() || '',
      category: p.category || '',
      image_url: p.image_url || '',
      platform: p.platform,
    })), { quotes: true });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportProducts(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !activeBusinessId) return;
    setImportingProducts(true);
    const text = await file.text();
    const parsed = Papa.parse<{ name: string; description: string; price: string; category: string; image_url: string; platform: string }>(text, {
      header: true,
      skipEmptyLines: true,
    });
    const entries = parsed.data
      .filter(row => row.name?.trim())
      .map(row => ({
        user_id: user.id,
        business_id: activeBusinessId,
        name: row.name.trim(),
        description: row.description?.trim() || null,
        price: row.price ? parseFloat(row.price) : null,
        category: row.category?.trim() || null,
        image_url: row.image_url?.trim() || null,
        platform: (row.platform?.trim() || 'messenger') as 'messenger' | 'instagram' | 'whatsapp',
        platform_ref_id: null,
        is_active: true,
      }));
    if (entries.length > 0) {
      const { data } = await supabase.from('products').insert(entries).select();
      if (data) {
        setProducts(prev => [...prev, ...data]);
        toast.success(`Imported ${data.length} products`);
      }
    } else {
      toast.error('No valid products found in CSV (name column required)');
    }
    setImportingProducts(false);
    e.target.value = '';
  }

  const filtered = items.filter((i) => {
    if (filter !== 'all' && i.category !== filter) return false;
    if (platformFilter !== 'all') {
      const itemPlatforms = kbPlatforms[i.id]?.map(p => p.platform) || [];
      if (i.platform === 'all' || itemPlatforms.some(p => p === 'all') || itemPlatforms.some(p => p === platformFilter)) return true;
      if (!itemPlatforms.length && !i.platform) return true;
      return itemPlatforms.some(p => p === platformFilter);
    }
    return true;
  });

   if (loading) {
     return (
       <div className="flex items-center justify-center py-20">
         <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
       </div>
     );
   }

  return (
    <div className="space-y-6">
      {/* Business Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10 p-3">
        <BusinessSelector activeBusinessId={activeBusinessId} onSelect={setActiveBusinessId} />
        {activeBusinessId && businesses.find(b => b.id === activeBusinessId) && (
          <span className="text-xs text-muted-foreground">
            Managing: <span className="font-medium text-foreground">{businesses.find(b => b.id === activeBusinessId)?.name}</span>
          </span>
        )}
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 rounded-xl bg-muted p-1 w-fit">
        <button
          onClick={() => setActiveTab('kb')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'kb' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <BookOpen className="inline h-4 w-4 mr-1.5" />
          Knowledge Base
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Package className="inline h-4 w-4 mr-1.5" />
          Products
        </button>
      </div>

      {activeTab === 'kb' ? (
      <div className="kb-section">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">Train your AI with business info — it reads this before replying</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={items.length === 0} className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <label className="cursor-pointer">
            <Button variant="outline" className="gap-2 pointer-events-none">
              <Upload className="h-4 w-4" /> Import
            </Button>
            <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
          </label>
          <Button onClick={handleAdd} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" /> Add Entry
          </Button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {['all', ...CATEGORIES].map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)} className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            filter === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}>
            {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Platform filter */}
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          return (
            <button key={p.value} onClick={() => setPlatformFilter(p.value)} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              platformFilter === p.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}>
              <Icon className="h-3.5 w-3.5" />
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Agent Settings Card */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              <BookOpen className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">Agent Settings</CardTitle>
          </div>
          <Button size="sm" onClick={handleSaveAgentSettings} disabled={agentSettings.saving} className="gap-1">
            {agentSettings.saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Agent Display Name</label>
              <p className="text-xs text-muted-foreground">Shown in "has joined the chat" messages</p>
              <Input value={agentSettings.agent_display_name} onChange={(e) => setAgentSettings(prev => ({ ...prev, agent_display_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">AI Agent Name</label>
              <p className="text-xs text-muted-foreground">How the AI introduces itself</p>
              <Input value={agentSettings.ai_agent_name} onChange={(e) => setAgentSettings(prev => ({ ...prev, ai_agent_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Business Name</label>
              <p className="text-xs text-muted-foreground">Auto-detected from connected platform, editable</p>
              <Input value={agentSettings.business_name ?? ''} onChange={(e) => setAgentSettings(prev => ({ ...prev, business_name: e.target.value || null }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Agent Role</label>
              <p className="text-xs text-muted-foreground">Defines how the AI presents itself to customers</p>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-blue-500/20"
                value={agentSettings.agent_role}
                onChange={(e) => setAgentSettings(prev => ({ ...prev, agent_role: e.target.value }))}
              >
                <option value="Sales Agent">Sales Agent — Promotes products, answers questions, closes sales. Best for e-commerce & product businesses.</option>
                <option value="Virtual Assistant">Virtual Assistant — Handles any type of inquiry without a fixed role. Best for diverse businesses.</option>
                <option value="Customer Support Agent">Customer Support Agent — After-sales support, troubleshooting, returns. Best for post-purchase service.</option>
                <option value="Order Taker">Order Taker — Collects orders simply without upselling. Best for order-only businesses.</option>
                <option value="Booking Agent">Booking Agent — Manages reservations. Best for restaurants, salons, hotels.</option>
                <option value="Appointment Scheduler">Appointment Scheduler — Handles consultation bookings. Best for clinics, consultants.</option>
                <option value="FAQ Assistant">FAQ Assistant — Answers common questions concisely. Best for high-volume repetitive queries.</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Handoff Message Template</label>
              <p className="text-xs text-muted-foreground">Use {'{agent_name}'} as placeholder</p>
              <Input value={agentSettings.human_handoff_message} onChange={(e) => setAgentSettings(prev => ({ ...prev, human_handoff_message: e.target.value }))} />
            </div>
            <div className="space-y-3 sm:pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={agentSettings.human_handoff_enabled} onChange={(e) => setAgentSettings(prev => ({ ...prev, human_handoff_enabled: e.target.checked }))} />
                <span className="text-sm">Enable human handoff</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={agentSettings.show_handoff_on_pause} onChange={(e) => setAgentSettings(prev => ({ ...prev, show_handoff_on_pause: e.target.checked }))} />
                <span className="text-sm">Show handoff message when manually pausing AI</span>
              </label>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Auto-resume AI after (minutes)</label>
              <p className="text-xs text-muted-foreground">Leave empty to keep AI paused until manually resumed</p>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 30"
                value={agentSettings.auto_resume_minutes ?? ''}
                onChange={(e) => setAgentSettings(prev => ({ ...prev, auto_resume_minutes: e.target.value ? parseInt(e.target.value) : null }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">No entries yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Add FAQs, pricing, and business info so the AI can answer accurately</p>
            </div>
            <Button onClick={handleAdd} variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Add Your First Entry</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, i) => {
            const isEditing = !!editing[item.id];
            return (
              <Card key={item.id} className="animate-fade-in-up overflow-hidden" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {isEditing ? editing[item.id]?.category || item.category : item.category}
                    </span>
                    {!isEditing && (
                      <>
                        {(kbPlatforms[item.id]?.length > 0 ? kbPlatforms[item.id] : []).map((link) => (
                          <span key={link.platform + (link.platform_ref_id || '')} className={`rounded-full px-2.5 py-0.5 text-xs font-medium inline-flex items-center gap-1 ${
                            link.platform === 'messenger' ? 'bg-blue-100 text-blue-700' :
                            link.platform === 'instagram' ? 'bg-pink-100 text-pink-700' :
                            link.platform === 'whatsapp' ? 'bg-green-100 text-green-700' : ''
                          }`}>
                            {link.platform === 'messenger' ? <Facebook className="h-3 w-3" /> :
                             link.platform === 'instagram' ? <Instagram className="h-3 w-3" /> :
                             link.platform === 'whatsapp' ? <MessageCircle className="h-3 w-3" /> : null}
                            {link.platform}
                          </span>
                        ))}
                        {(!kbPlatforms[item.id] || kbPlatforms[item.id].length === 0) && (
                          <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium inline-flex items-center gap-1 text-muted-foreground">
                            <Globe className="h-3 w-3" />
                            All
                          </span>
                        )}
                        <CardTitle className="text-base">{item.title}</CardTitle>
                      </>
                    )}
                  </div> {/* Fix: Added missing closing div tag */}
                  <div className="flex gap-2">
                    {isEditing ? (
                      <Button size="sm" onClick={() => handleSave(item)} className="gap-1"><Save className="h-3 w-3" /> Save</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setEditing((prev) => ({
                        ...prev,
                        [item.id]: {
                          title: item.title,
                          content: item.content,
                          category: item.category,
                          selectedPlatforms: kbPlatforms[item.id] ? [...kbPlatforms[item.id]] : [],
                        }
                      }))}>Edit</Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => handleMoveUp(item.id)}><ArrowUp className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" disabled={i === filtered.length - 1} onClick={() => handleMoveDown(item.id)}><ArrowDown className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(item.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <select className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" value={editing[item.id].category} onChange={(e) => setEditing((prev) => ({ ...prev, [item.id]: { ...prev[item.id], category: e.target.value as KnowledgeBaseItem['category'] } }))}>
                          {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <div className="flex items-center gap-3 flex-wrap">
                          {['messenger', 'instagram', 'whatsapp'].map((p) => {
                            const checked = editing[item.id].selectedPlatforms.some(sp => sp.platform === p);
                            return (
                              <label key={p} className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300"
                                  checked={checked}
                                  onChange={() => {
                                    const current = editing[item.id].selectedPlatforms;
                                    const updated = checked
                                      ? current.filter(sp => sp.platform !== p)
                                      : [...current, { platform: p, platform_ref_id: null }];
                                    setEditing((prev) => ({ ...prev, [item.id]: { ...prev[item.id], selectedPlatforms: updated } }));
                                  }}
                                />
                                {p === 'messenger' ? <Facebook className="h-3.5 w-3.5 text-blue-600" /> : p === 'instagram' ? <Instagram className="h-3.5 w-3.5 text-pink-600" /> : <MessageCircle className="h-3.5 w-3.5 text-green-600" />}
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      {editing[item.id].selectedPlatforms.map((sp) => (
                        sp.platform_ref_id === null && (
                          <div key={sp.platform}>
                            <select
                              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                              value={sp.platform_ref_id || ''}
                              onChange={(e) => {
                                const updated = editing[item.id].selectedPlatforms.map(s =>
                                  s.platform === sp.platform ? { ...s, platform_ref_id: e.target.value || null } : s
                                );
                                setEditing((prev) => ({ ...prev, [item.id]: { ...prev[item.id], selectedPlatforms: updated } }));
                              }}
                            >
                              <option value="">-- All {sp.platform} accounts --</option>
                              {sp.platform === 'messenger' && connectedPages.map((p) => (
                                <option key={p.id} value={p.id}>{p.page_name}</option>
                              ))}
                              {sp.platform === 'instagram' && igAccounts.map((ig) => (
                                <option key={ig.id} value={ig.id}>{ig.ig_name || ig.ig_username}</option>
                              ))}
                              {sp.platform === 'whatsapp' && waAccounts.map((wa) => (
                                <option key={wa.id} value={wa.id}>{wa.business_name || wa.phone_number}</option>
                              ))}
                            </select>
                          </div>
                        )
                      ))}
                      <Input value={editing[item.id].title} onChange={(e) => setEditing((prev) => ({ ...prev, [item.id]: { ...prev[item.id], title: e.target.value } }))} />
                      <textarea className="flex min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20" value={editing[item.id].content} onChange={(e) => setEditing((prev) => ({ ...prev, [item.id]: { ...prev[item.id], content: e.target.value } }))} />
                    </div>
                  ) : (
                    <div>
                      {/* Fix: Removed duplicate <CardTitle> from here as it's already displayed in the <CardHeader> */}
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.content}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Delete Entry"
        message="Are you sure you want to delete this knowledge base entry? This cannot be undone."
        confirmLabel="Delete"
      />
      </div>
      ) : (
        
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Products</h1>
              <p className="text-muted-foreground">Manage your product catalog — AI searches this when customers ask</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportProducts} disabled={products.length === 0} className="gap-2">
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <label className="cursor-pointer">
                <Button variant="outline" className="gap-2 pointer-events-none" disabled={importingProducts}>
                  {importingProducts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import CSV
                </Button>
                <input type="file" accept=".csv" onChange={handleImportProducts} className="hidden" />
              </label>
              <Button onClick={() => { setProductForm({ name: '', description: '', price: '', category: '', image_url: '', platform: 'messenger', platform_ref_id: '', is_active: true }); setEditingProduct(false); setShowProductForm(true); }} className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" /> Add Product
              </Button>
            </div>
          </div>

          {/* Product form */}
          {showProductForm && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="py-3">
                <CardTitle className="text-base">{editingProduct ? 'Edit Product' : 'Add Product'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Name *</label>
                    <Input value={productForm.name} onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Product name" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Price</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={productForm.price} onChange={(e) => setProductForm(prev => ({ ...prev, price: e.target.value }))} placeholder="0.00" className="pl-9" type="number" step="0.01" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Category</label>
                    <div className="relative">
                      <Tags className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={productForm.category} onChange={(e) => setProductForm(prev => ({ ...prev, category: e.target.value }))} placeholder="e.g. Electronics" className="pl-9" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Image URL</label>
                    <div className="relative">
                      <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={productForm.image_url} onChange={(e) => setProductForm(prev => ({ ...prev, image_url: e.target.value }))} placeholder="https://..." className="pl-9" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Platform</label>
                    <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={productForm.platform} onChange={(e) => setProductForm(prev => ({ ...prev, platform: e.target.value, platform_ref_id: '' }))}>
                      <option value="messenger">Messenger</option>
                      <option value="instagram">Instagram</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Account (optional)</label>
                    <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={productForm.platform_ref_id} onChange={(e) => setProductForm(prev => ({ ...prev, platform_ref_id: e.target.value }))}>
                      <option value="">All {productForm.platform} accounts</option>
                      {productForm.platform === 'messenger' && connectedPages.map((p) => (
                        <option key={p.id} value={p.id}>{p.page_name}</option>
                      ))}
                      {productForm.platform === 'instagram' && igAccounts.map((ig) => (
                        <option key={ig.id} value={ig.id}>{ig.ig_name || ig.ig_username}</option>
                      ))}
                      {productForm.platform === 'whatsapp' && waAccounts.map((wa) => (
                        <option key={wa.id} value={wa.id}>{wa.business_name || wa.phone_number}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-sm font-medium">Description</label>
                    <textarea className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20" value={productForm.description} onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Product description..." />
                  </div>
                </div>
                <div className="flex gap-2 mt-4 justify-end">
                  <Button variant="outline" onClick={() => setShowProductForm(false)}>Cancel</Button>
                  <Button onClick={handleSaveProduct} disabled={!productForm.name}>{editingProduct ? 'Update' : 'Add'} Product</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Products list */}
          {loadingProducts ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 && !showProductForm ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="font-medium">No products yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Add products so the AI can search and recommend them to customers</p>
                </div>
                <Button onClick={() => { setProductForm({ name: '', description: '', price: '', category: '', image_url: '', platform: 'messenger', platform_ref_id: '', is_active: true }); setEditingProduct(false); setShowProductForm(true); }} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Add Your First Product
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <Card key={p.id} className="overflow-hidden">
                  {p.image_url ? (
                    <div className="h-40 bg-muted overflow-hidden">
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  ) : (
                    <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground/40" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate">{p.name}</h3>
                        {p.price && <p className="text-sm font-medium text-green-600 dark:text-green-400">${Number(p.price).toFixed(2)}</p>}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium inline-flex items-center gap-1 shrink-0 ${
                        p.platform === 'messenger' ? 'bg-blue-100 text-blue-700' :
                        p.platform === 'instagram' ? 'bg-pink-100 text-pink-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {p.platform === 'messenger' ? <Facebook className="h-2.5 w-2.5" /> :
                         p.platform === 'instagram' ? <Instagram className="h-2.5 w-2.5" /> :
                         <MessageCircle className="h-2.5 w-2.5" />}
                        {p.platform}
                      </span>
                    </div>
                    {p.category && <p className="text-xs text-muted-foreground mt-1">{p.category}</p>}
                    {p.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.description}</p>}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => {
                        setProductForm({
                          id: p.id, name: p.name, description: p.description || '', price: p.price?.toString() || '',
                          category: p.category || '', image_url: p.image_url || '', platform: p.platform,
                          platform_ref_id: p.platform_ref_id || '', is_active: p.is_active,
                        });
                        setEditingProduct(true);
                        setShowProductForm(true);
                      }}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive hover:text-destructive" onClick={() => handleDeleteProduct(p.id)}>Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}