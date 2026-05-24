'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Brain, Plus, RefreshCw, Trash2, Edit3, Save,
  CheckCircle, XCircle, Globe, Key, Cpu, Users, MessageSquare,
  AlertCircle, Send, Loader2, Bot,
} from 'lucide-react';

interface Provider {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  default_model: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const emptyForm = { name: '', base_url: '', api_key: '', default_model: 'gpt-4o-mini', is_active: true };

export default function OwnerProviders() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [masterPrompt, setMasterPrompt] = useState('');
  const [masterPromptDirty, setMasterPromptDirty] = useState(false);
  const [savingMaster, setSavingMaster] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [defaultFreeCredits, setDefaultFreeCredits] = useState('50');
  const [defaultCreditsExpiryDays, setDefaultCreditsExpiryDays] = useState('30');

  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const [reasoningSuppressionPrompt, setReasoningSuppressionPrompt] = useState('');
  const [savingReasoning, setSavingReasoning] = useState(false);
  const [savingAiDefaults, setSavingAiDefaults] = useState(false);
  const [defaultConvMemoryCount, setDefaultConvMemoryCount] = useState('10');
  const [defaultTemperature, setDefaultTemperature] = useState('0.7');
  const [defaultMaxTokens, setDefaultMaxTokens] = useState('500');

  const [testProviderId, setTestProviderId] = useState('');
  const [testModel, setTestModel] = useState('openai/gpt-4o-mini');
  const [testSystemPrompt, setTestSystemPrompt] = useState('');
  const [testInput, setTestInput] = useState('');
  const [testMessages, setTestMessages] = useState<Array<{role: 'user' | 'assistant'; content: string; tokens?: number; timeMs?: number; model?: string}>>([]);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: isAdmin } = await supabase.rpc('is_admin');
      if (!isAdmin) { router.push('/dashboard'); return; }
      await loadData();
      setLoading(false);
    };
    init();
  }, []);

  async function loadData() {
    const [provRes, settingsRes] = await Promise.all([
      fetch('/api/admin/owner/providers'),
      fetch('/api/admin/owner/settings'),
    ]);
    const provData = await provRes.json();
    const settingsData = await settingsRes.json();
    setProviders(provData.providers || []);
    setMasterPrompt(settingsData.master_prompt || '');
    if (settingsData.default_free_credits !== undefined) setDefaultFreeCredits(String(settingsData.default_free_credits));
    if (settingsData.default_credits_expiry_days !== undefined) setDefaultCreditsExpiryDays(String(settingsData.default_credits_expiry_days));
    if (settingsData.default_conversation_memory_count !== undefined) setDefaultConvMemoryCount(String(settingsData.default_conversation_memory_count));
    if (settingsData.default_temperature !== undefined) setDefaultTemperature(String(settingsData.default_temperature));
    if (settingsData.default_max_tokens !== undefined) setDefaultMaxTokens(String(settingsData.default_max_tokens));
    if (settingsData.reasoning_enabled !== undefined) setReasoningEnabled(Boolean(settingsData.reasoning_enabled));
    if (settingsData.reasoning_suppression_prompt !== undefined) setReasoningSuppressionPrompt(String(settingsData.reasoning_suppression_prompt));
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(p: Provider) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      base_url: p.base_url,
      api_key: '',
      default_model: p.default_model,
      is_active: p.is_active,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.base_url) return;
    if (!editingId && !form.api_key) return;
    setSaving(true);
    setStatus(null);
    try {
      const url = editingId ? `/api/admin/owner/providers/${editingId}` : '/api/admin/owner/providers';
      const method = editingId ? 'PUT' : 'POST';
      const body: Record<string, unknown> = { ...form };
      if (editingId && !form.api_key) delete body.api_key;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.provider || data.success) {
        setStatus({ type: 'success', text: editingId ? 'Provider updated' : 'Provider created' });
        setShowModal(false);
        await loadData();
      } else {
        setStatus({ type: 'error', text: data.error || 'Failed' });
      }
    } catch (e: any) {
      setStatus({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this provider?')) return;
    try {
      const res = await fetch(`/api/admin/owner/providers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await loadData();
        setStatus({ type: 'success', text: 'Provider deleted' });
      }
    } catch (e: any) {
      setStatus({ type: 'error', text: e.message });
    }
  }

  async function handleSaveReasoning() {
    setSavingReasoning(true);
    try {
      const res = await fetch('/api/admin/owner/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reasoning_enabled: reasoningEnabled,
          reasoning_suppression_prompt: reasoningSuppressionPrompt,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', text: 'Reasoning settings saved' });
      } else {
        setStatus({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (e: any) {
      setStatus({ type: 'error', text: e.message });
    } finally {
      setSavingReasoning(false);
    }
  }

  async function handleSaveMasterPrompt() {
    setSavingMaster(true);
    try {
      const res = await fetch('/api/admin/owner/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ master_prompt: masterPrompt }),
      });
      const data = await res.json();
      if (data.success) {
        setMasterPromptDirty(false);
        setStatus({ type: 'success', text: 'Master prompt saved' });
      } else {
        setStatus({ type: 'error', text: data.error || 'Failed' });
      }
    } catch (e: any) {
      setStatus({ type: 'error', text: e.message });
    } finally {
      setSavingMaster(false);
    }
  }

  async function handleSaveAiDefaults() {
    setSavingAiDefaults(true);
    setStatus(null);
    try {
      const body: Record<string, unknown> = {
        default_free_credits: parseInt(defaultFreeCredits) || 50,
        default_credits_expiry_days: parseInt(defaultCreditsExpiryDays) || 30,
        default_conversation_memory_count: parseInt(defaultConvMemoryCount) || 10,
        default_temperature: parseFloat(defaultTemperature) || 0.7,
        default_max_tokens: parseInt(defaultMaxTokens) || 500,
      };

      const res = await fetch('/api/admin/owner/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save');
      setStatus({ type: 'success', text: 'AI defaults saved' });
    } catch (e: any) {
      setStatus({ type: 'error', text: e.message });
    } finally {
      setSavingAiDefaults(false);
    }
  }

  async function handleTestSend() {
    if (!testInput.trim() || testLoading) return;
    setTestLoading(true);
    const userMsg = testInput.trim();
    setTestInput('');

    const prevMessages = [...testMessages, { role: 'user' as const, content: userMsg }];
    setTestMessages(prevMessages);

    const apiMessages = prevMessages.filter(m => m.role !== 'assistant' || m.content !== '').map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/admin/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: testModel,
          messages: apiMessages,
          systemPrompt: testSystemPrompt,
          providerId: testProviderId || undefined,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setTestMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}`, timeMs: data.timeMs }]);
      } else {
        setTestMessages(prev => [...prev, { role: 'assistant', content: data.reply, tokens: data.tokens, timeMs: data.timeMs, model: data.model }]);
      }
    } catch (e: any) {
      setTestMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setTestLoading(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-32"><RefreshCw className="h-6 w-6 animate-spin text-violet-400" /></div>;
  }

  const modelOptions = [
    { value: 'openai/gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'openai/gpt-4o', label: 'GPT-4o' },
    { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' },
    { value: 'anthropic/claude-3-sonnet', label: 'Claude 3 Sonnet' },
    { value: 'google/gemini-pro', label: 'Gemini Pro' },
    { value: 'meta-llama/llama-3-70b-instruct', label: 'Llama 3 70B' },
  ];

  return (
    <div className="space-y-6">

      {status && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
          status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {status.text}
        </div>
      )}

      {/* AI Providers */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <Brain className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">AI Providers</h3>
              <p className="text-xs text-white/40">Add any AI provider (OpenAI, Anthropic, Google, OpenRouter, etc.)</p>
            </div>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-purple-500">
            <Plus className="h-4 w-4" /> Add Provider
          </button>
        </div>

        {providers.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/30">No providers configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-wider">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium">Base URL</th>
                  <th className="pb-3 pr-4 font-medium">API Key</th>
                  <th className="pb-3 pr-4 font-medium">Model</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 text-white/70">
                    <td className="py-3 pr-4 font-medium text-white">{p.name}</td>
                    <td className="py-3 pr-4 text-xs text-white/50">{p.base_url}</td>
                    <td className="py-3 pr-4">
                      <code className="rounded bg-white/5 px-2 py-0.5 text-xs text-violet-400">{p.api_key}</code>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded bg-white/5 px-2 py-0.5 text-xs">{p.default_model}</span>
                    </td>
                    <td className="py-3 pr-4">
                      {p.is_active ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle className="h-3 w-3" /> Active</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-white/30"><XCircle className="h-3 w-3" /> Inactive</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(p)} className="rounded-lg bg-white/5 p-2 text-white/40 transition-colors hover:bg-violet-500/20 hover:text-violet-400" title="Edit">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="rounded-lg bg-white/5 p-2 text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-400" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Defaults */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <Cpu className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">AI Defaults</h3>
              <p className="text-xs text-white/40">Default settings applied to new users</p>
            </div>
          </div>
          <button onClick={handleSaveAiDefaults} disabled={savingAiDefaults}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-purple-500 hover:to-pink-500 disabled:opacity-50">
            <Save className="h-4 w-4" /> {savingAiDefaults ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-5">
          <div>
            <label className="text-xs font-medium text-white/60 flex items-center gap-1.5 mb-1.5">
              <Users className="h-3 w-3 text-green-400" /> Default Free Credits
            </label>
            <input type="number" min={0} value={defaultFreeCredits} onChange={(e) => setDefaultFreeCredits(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
            <p className="text-xs text-white/30 mt-1">Credits given to new users on signup</p>
          </div>
          <div>
            <label className="text-xs font-medium text-white/60 flex items-center gap-1.5 mb-1.5">
              <Users className="h-3 w-3 text-amber-400" /> Credit Expiry (days)
            </label>
            <input type="number" min={0} value={defaultCreditsExpiryDays} onChange={(e) => setDefaultCreditsExpiryDays(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
            <p className="text-xs text-white/30 mt-1">Days until free credits expire (0 = no expiry)</p>
          </div>
          <div>
            <label className="text-xs font-medium text-white/60 flex items-center gap-1.5 mb-1.5">
              <MessageSquare className="h-3 w-3 text-blue-400" /> Memory
            </label>
            <input type="number" min={1} max={100} value={defaultConvMemoryCount} onChange={(e) => setDefaultConvMemoryCount(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
            <p className="text-xs text-white/30 mt-1">Recent messages AI remembers</p>
          </div>
          <div>
            <label className="text-xs font-medium text-white/60 flex items-center gap-1.5 mb-1.5">
              <Bot className="h-3 w-3 text-violet-400" /> Temperature
            </label>
            <input type="number" min={0} max={2} step={0.1} value={defaultTemperature} onChange={(e) => setDefaultTemperature(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
            <p className="text-xs text-white/30 mt-1">AI creativity (0=precise, 2=creative)</p>
          </div>
          <div>
            <label className="text-xs font-medium text-white/60 flex items-center gap-1.5 mb-1.5">
              <Cpu className="h-3 w-3 text-cyan-400" /> Max Tokens
            </label>
            <input type="number" min={50} max={4096} step={50} value={defaultMaxTokens} onChange={(e) => setDefaultMaxTokens(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
            <p className="text-xs text-white/30 mt-1">Max response length per reply</p>
          </div>
        </div>
      </div>

      {/* Master Prompt */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
              <Globe className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Master Prompt</h3>
              <p className="text-xs text-white/40">System-wide instructions injected before every AI call (applies to all tenants)</p>
            </div>
          </div>
          <button
            onClick={handleSaveMasterPrompt}
            disabled={savingMaster}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-amber-500 hover:to-orange-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {savingMaster ? 'Saving...' : 'Save'}
          </button>
        </div>
        <textarea
          value={masterPrompt}
          onChange={(e) => { setMasterPrompt(e.target.value); setMasterPromptDirty(true); }}
          placeholder="Enter master prompt instructions that will be prepended to all AI system prompts..."
          rows={6}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
        />
        {masterPromptDirty && (
          <p className="mt-2 text-xs text-amber-400/70">Unsaved changes</p>
        )}
      </div>

      {/* AI Reasoning */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <Brain className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">AI Reasoning</h3>
              <p className="text-xs text-white/40">Control whether AI chain-of-thought reasoning is shown in responses</p>
            </div>
          </div>
          <button
            onClick={handleSaveReasoning}
            disabled={savingReasoning}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-purple-500 hover:to-pink-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {savingReasoning ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-xl border border-white/10 p-4 cursor-pointer hover:bg-white/5 transition-colors">
            <input
              type="checkbox"
              checked={reasoningEnabled}
              onChange={(e) => setReasoningEnabled(e.target.checked)}
              className="h-5 w-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/30"
            />
            <div>
              <span className="text-sm font-medium text-white">Enable AI reasoning output</span>
              <p className="text-xs text-white/30 mt-0.5">When disabled, chain-of-thought reasoning is suppressed and a custom suppression prompt is injected into the system prompt</p>
            </div>
          </label>
          <div>
            <label className="text-xs font-medium text-white/60 flex items-center gap-1.5 mb-1.5">
              <Brain className="h-3 w-3 text-purple-400" /> Reasoning Suppression Prompt
            </label>
            <textarea
              value={reasoningSuppressionPrompt}
              onChange={(e) => setReasoningSuppressionPrompt(e.target.value)}
              placeholder="Enter instructions that tell the AI to suppress chain-of-thought reasoning..."
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
            />
            <p className="text-xs text-white/30 mt-1">This prompt is appended to the system prompt when reasoning is disabled</p>
          </div>
        </div>
      </div>

      {/* Test AI */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
              <Bot className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Test AI</h3>
              <p className="text-xs text-white/40">Test any provider's API key and model with a live conversation</p>
            </div>
          </div>
          {testMessages.length > 0 && (
            <button onClick={() => setTestMessages([])} className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/40 hover:bg-white/5 transition-colors">
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {testMessages.length > 0 && (
          <div className="mb-4 max-h-80 overflow-y-auto space-y-3 rounded-xl bg-white/5 p-4">
            {testMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-violet-500/20 text-white border border-violet-500/20'
                    : msg.content.startsWith('Error:')
                      ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                      : 'bg-white/10 text-white/80 border border-white/10'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === 'assistant' && !msg.content.startsWith('Error:') && (
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-white/30">
                      {msg.tokens !== undefined && <span>{msg.tokens} tokens</span>}
                      {msg.timeMs !== undefined && <span>{msg.timeMs}ms</span>}
                      {msg.model && <span className="truncate max-w-[120px]">{msg.model}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {testLoading && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-white/10 px-4 py-3 border border-white/10">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-4 mb-3">
          <div>
            <label className="text-xs font-medium text-white/60 mb-1 block">Provider</label>
            <select value={testProviderId} onChange={(e) => setTestProviderId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50">
              <option value="">Default (OpenRouter)</option>
              {providers.filter(p => p.is_active).map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.default_model}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="text-xs font-medium text-white/60 mb-1 block">Model</label>
            <input list="test-models" value={testModel} onChange={(e) => setTestModel(e.target.value)} placeholder="e.g. openai/gpt-4o-mini"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
            <datalist id="test-models">
              {modelOptions.map(m => <option key={m.value} value={m.value} />)}
            </datalist>
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs font-medium text-white/60 mb-1 block">System Prompt (optional)</label>
          <input value={testSystemPrompt} onChange={(e) => setTestSystemPrompt(e.target.value)} placeholder="e.g. You are a helpful customer support agent..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
        </div>

        <div className="flex gap-2">
          <input value={testInput} onChange={(e) => setTestInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTestSend(); } }}
            placeholder="Type a customer message and press Enter to test..." disabled={testLoading}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50 disabled:opacity-50" />
          <button onClick={handleTestSend} disabled={testLoading || !testInput.trim()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50">
            {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </div>
        <p className="mt-2 text-[10px] text-white/20">Select a provider above or use the default OpenRouter key. No credits deducted.</p>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !saving && setShowModal(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 p-6 mx-4" style={{ background: 'rgba(15,15,40,0.98)', backdropFilter: 'blur(20px)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{editingId ? 'Edit Provider' : 'Add Provider'}</h3>
                <p className="text-xs text-white/40">{editingId ? 'Update provider configuration' : 'Configure a new AI backend'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-white/60">Name *</label>
                <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. OpenAI, Anthropic, Google, OpenRouter" className="w-full mt-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-white/60">Base URL *</label>
                <input value={form.base_url} onChange={(e) => setForm(f => ({ ...f, base_url: e.target.value }))} placeholder="e.g. https://openrouter.ai/api/v1" className="w-full mt-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-white/60">
                  API Key {editingId ? '(leave empty to keep current)' : '*'}
                </label>
                <div className="relative mt-1">
                  <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    value={form.api_key}
                    onChange={(e) => setForm(f => ({ ...f, api_key: e.target.value }))}
                    type="password"
                    placeholder={editingId ? 'sk-... (leave empty to keep current)' : 'sk-...'}
                    className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-white/60">Default Model</label>
                  <input value={form.default_model} onChange={(e) => setForm(f => ({ ...f, default_model: e.target.value }))} placeholder="gpt-4o-mini" className="w-full mt-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-white/60">Status</label>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => setForm(f => ({ ...f, is_active: true }))}
                      className={`flex-1 rounded-xl py-2 text-sm font-medium transition-all ${form.is_active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-white/40 border border-transparent'}`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => setForm(f => ({ ...f, is_active: false }))}
                      className={`flex-1 rounded-xl py-2 text-sm font-medium transition-all ${!form.is_active ? 'bg-white/10 text-white/70 border border-white/20' : 'bg-white/5 text-white/40 border border-transparent'}`}
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} disabled={saving} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-white/60 transition-all hover:bg-white/5 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving || !form.name || !form.base_url || (!editingId && !form.api_key)} className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-2.5 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-purple-500 disabled:opacity-50">
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
