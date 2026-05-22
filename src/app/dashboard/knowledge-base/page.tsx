'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Plus, Trash2, Save, Loader2, Download, Upload, ArrowUp, ArrowDown, Globe, Facebook, Instagram, MessageCircle } from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { usePageTitle } from '@/lib/use-page-title';
import type { KnowledgeBaseItem, ConnectedPage, InstagramAccount, WhatsAppAccount } from '@/types';

const CATEGORIES = ['general', 'faq', 'pricing', 'delivery', 'products', 'policy'] as const;
const PLATFORMS = [
  { value: 'all', label: 'All Platforms', icon: Globe },
  { value: 'messenger', label: 'Messenger', icon: Facebook },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
] as const;

export default function KnowledgeBasePage() {
  usePageTitle('Knowledge Base');
  const [items, setItems] = useState<KnowledgeBaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, { title: string; content: string; category: KnowledgeBaseItem['category']; platform: KnowledgeBaseItem['platform']; platform_ref_id: string | null }>>({});
  const [filter, setFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [connectedPages, setConnectedPages] = useState<ConnectedPage[]>([]);
  const [igAccounts, setIgAccounts] = useState<InstagramAccount[]>([]);
  const [waAccounts, setWaAccounts] = useState<WhatsAppAccount[]>([]);
  const [agentSettings, setAgentSettings] = useState<{
    agent_display_name: string;
    ai_agent_name: string;
    human_handoff_enabled: boolean;
    human_handoff_message: string;
    show_handoff_on_pause: boolean;
    saving: boolean;
  }>({
    agent_display_name: 'Support Agent',
    ai_agent_name: 'AI Assistant',
    human_handoff_enabled: true,
    human_handoff_message: '{agent_name} has joined the chat',
    show_handoff_on_pause: false,
    saving: false,
  });
  const supabase = createClient();

  useEffect(() => { loadItems(); loadConnectedPlatforms(); loadAgentSettings(); }, []);

  async function loadAgentSettings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('ai_settings')
      .select('agent_display_name, ai_agent_name, human_handoff_enabled, human_handoff_message, show_handoff_on_pause')
      .eq('user_id', user.id)
      .is('page_id', null)
      .is('instagram_id', null)
      .maybeSingle();
    if (data) {
      setAgentSettings(prev => ({ ...prev, ...data }));
    }
  }

  async function handleSaveAgentSettings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setAgentSettings(prev => ({ ...prev, saving: true }));
    const { data: existing } = await supabase
      .from('ai_settings')
      .select('id')
      .eq('user_id', user.id)
      .is('page_id', null)
      .is('instagram_id', null)
      .maybeSingle();

    if (existing) {
      await supabase.from('ai_settings').update({
        agent_display_name: agentSettings.agent_display_name,
        ai_agent_name: agentSettings.ai_agent_name,
        human_handoff_enabled: agentSettings.human_handoff_enabled,
        human_handoff_message: agentSettings.human_handoff_message,
        show_handoff_on_pause: agentSettings.show_handoff_on_pause,
      }).eq('id', existing.id);
    } else {
      // Fix: Insert new settings if user doesn't have an ai_settings row yet
      await supabase.from('ai_settings').insert({
        user_id: user.id,
        agent_display_name: agentSettings.agent_display_name,
        ai_agent_name: agentSettings.ai_agent_name,
        human_handoff_enabled: agentSettings.human_handoff_enabled,
        human_handoff_message: agentSettings.human_handoff_message,
        show_handoff_on_pause: agentSettings.show_handoff_on_pause,
      });
    }
    setAgentSettings(prev => ({ ...prev, saving: false }));
    toast.success('Agent settings saved');
  }

  async function loadConnectedPlatforms() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [pagesRes, igRes, waRes] = await Promise.all([
      // Fix: Changed select to '*' so the result matches your strict TypeScript state
      supabase.from('connected_pages').select('*').eq('user_id', user.id),
      supabase.from('instagram_accounts').select('*').eq('user_id', user.id),
      supabase.from('whatsapp_accounts').select('*').eq('user_id', user.id),
    ]);
    setConnectedPages(pagesRes.data || []);
    setIgAccounts(igRes.data || []);
    setWaAccounts(waRes.data || []);
  }

  async function loadItems() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('knowledge_base').select('*').eq('user_id', user.id).order('sort_order');
    setItems(data || []);
    setLoading(false);
  }

  async function handleSave(item: KnowledgeBaseItem) {
    const edit = editing[item.id];
    if (!edit) return;
    const { error } = await supabase.from('knowledge_base').update({
      title: edit.title,
      content: edit.content,
      category: edit.category,
      platform: edit.platform || null,
      platform_ref_id: edit.platform_ref_id || null,
    }).eq('id', item.id);
    if (error) {
      toast.error('Failed to save entry');
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...edit } as KnowledgeBaseItem : i)));
    setEditing((prev) => { const { [item.id]: _, ...rest } = prev; return rest; });
    toast.success('Entry saved');
  }

  async function handleAdd() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('knowledge_base').insert({
      user_id: user.id,
      category: 'general',
      title: 'New Entry',
      content: 'Add your content here...',
      sort_order: items.length,
      platform: 'all',
    }).select().single();
    if (data) {
      setItems((prev) => [...prev, data]);
      setEditing((prev) => ({ ...prev, [data.id]: { title: data.title, content: data.content, category: data.category, platform: data.platform, platform_ref_id: data.platform_ref_id } }));
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
    setItems((prev) => prev.filter((i) => i.id !== id));
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
    if (!user) return;
    const text = await file.text();
    const parsed = Papa.parse<{ category: string; title: string; content: string }>(text, {
      header: true,
      skipEmptyLines: true,
    });
    const entries = parsed.data.map((row, i) => ({
      user_id: user.id,
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

  const filtered = items.filter((i) => {
    if (filter !== 'all' && i.category !== filter) return false;
    if (platformFilter !== 'all' && (i.platform || 'all') !== platformFilter) return false;
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
                        {item.platform && item.platform !== 'all' && (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium inline-flex items-center gap-1 ${
                            item.platform === 'messenger' ? 'bg-blue-100 text-blue-700' :
                            item.platform === 'instagram' ? 'bg-pink-100 text-pink-700' :
                            item.platform === 'whatsapp' ? 'bg-green-100 text-green-700' : ''
                          }`}>
                            {item.platform === 'messenger' ? <Facebook className="h-3 w-3" /> :
                             item.platform === 'instagram' ? <Instagram className="h-3 w-3" /> :
                             item.platform === 'whatsapp' ? <MessageCircle className="h-3 w-3" /> : null}
                            {item.platform}
                          </span>
                        )}
                        {(!item.platform || item.platform === 'all') && (
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
                        // Fix: Included missing platform and platform_ref_id fields for TypeScript
                        [item.id]: { 
                          title: item.title, 
                          content: item.content, 
                          category: item.category, 
                          platform: item.platform || null, 
                          platform_ref_id: item.platform_ref_id || null 
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
                        <select className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" value={editing[item.id].platform || 'all'} onChange={(e) => {
  const val = e.target.value === 'all' ? null : (e.target.value as KnowledgeBaseItem['platform']);
  setEditing((prev) => ({ ...prev, [item.id]: { ...prev[item.id], platform: val, platform_ref_id: null } }));
                        }}>
                          {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </div>
                      {editing[item.id].platform && editing[item.id].platform !== 'all' && editing[item.id].platform !== null && (
                        <select className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" value={editing[item.id].platform_ref_id || ''} onChange={(e) => setEditing((prev) => ({ ...prev, [item.id]: { ...prev[item.id], platform_ref_id: e.target.value || null } }))}>
                          <option value="">-- Select {editing[item.id].platform} account --</option>
                          {editing[item.id].platform === 'messenger' && connectedPages.map((p) => (
                            <option key={p.id} value={p.id}>{p.page_name}</option>
                          ))}
                          {editing[item.id].platform === 'instagram' && igAccounts.map((ig) => (
                            <option key={ig.id} value={ig.id}>{ig.ig_name || ig.ig_username}</option>
                          ))}
                          {editing[item.id].platform === 'whatsapp' && waAccounts.map((wa) => (
                            <option key={wa.id} value={wa.id}>{wa.business_name || wa.phone_number}</option>
                          ))}
                        </select>
                      )}
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
  );
}