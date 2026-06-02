'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Brain, Plus, RefreshCw, Trash2, Edit3, Save,
  CheckCircle, XCircle, Globe, Key, Cpu, Users, MessageSquare,
  AlertCircle, Send, Loader2, Bot, Camera,
} from 'lucide-react';

interface Provider {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  default_model: string;
  provider_type: string;
  roles: string[];
  reasoning_max_tokens: number | null;
  reasoning_strategy: string | null;
  reasoning_media_max_tokens: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const emptyForm = { name: '', base_url: '', api_key: '', default_model: 'gpt-4o-mini', provider_type: 'generic', roles: ['text'] as string[], reasoning_max_tokens: '', reasoning_strategy: '', reasoning_media_max_tokens: '', is_active: true };

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

  const [savingAiDefaults, setSavingAiDefaults] = useState(false);
  const [defaultConvMemoryCount, setDefaultConvMemoryCount] = useState('10');
  const [defaultTemperature, setDefaultTemperature] = useState('0.7');
  const [defaultMaxTokens, setDefaultMaxTokens] = useState('500');

  const [mediaImageEnabled, setMediaImageEnabled] = useState(true);
  const [mediaImageProviderType, setMediaImageProviderType] = useState('openrouter');
  const [mediaImageModel, setMediaImageModel] = useState('openai/gpt-4o-mini');
  const [mediaImageMaxSize, setMediaImageMaxSize] = useState('2048');
  const [mediaImageMaxCount, setMediaImageMaxCount] = useState('3');
  const [mediaImageFallbackText, setMediaImageFallbackText] = useState('[User sent an image]');

  const [mediaVoiceEnabled, setMediaVoiceEnabled] = useState(true);
  const [mediaVoiceProviderType, setMediaVoiceProviderType] = useState('openrouter');
  const [mediaVoiceModel, setMediaVoiceModel] = useState('openai/whisper-large-v3-turbo');
  const [mediaVoiceMaxSeconds, setMediaVoiceMaxSeconds] = useState('120');
  const [mediaVoiceFallbackText, setMediaVoiceFallbackText] = useState('[User sent a voice message]');
  const [pricing, setPricing] = useState<Array<{ id: string; provider_id: string; model_name: string; input_price_per_1m_tokens: number; output_price_per_1m_tokens: number; is_auto_fetched: boolean; ai_providers?: { name: string } }>>([]);
  const [pricingLoading, setPricingLoading] = useState(false);

  const [savingMedia, setSavingMedia] = useState(false);

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
    const [provRes, settingsRes, pricingRes] = await Promise.all([
      fetch('/api/admin/owner/providers'),
      fetch('/api/admin/owner/settings'),
      fetch('/api/admin/owner/pricing'),
    ]);
    if (pricingRes.ok) {
      const pricingData = await pricingRes.json();
      setPricing(pricingData.pricing || []);
    }
    const provData = await provRes.json();
    const settingsData = await settingsRes.json();
    setProviders(provData.providers || []);
    setMasterPrompt(settingsData.master_prompt || '');
    if (settingsData.default_free_credits !== undefined) setDefaultFreeCredits(String(settingsData.default_free_credits));
    if (settingsData.default_credits_expiry_days !== undefined) setDefaultCreditsExpiryDays(String(settingsData.default_credits_expiry_days));
    if (settingsData.default_conversation_memory_count !== undefined) setDefaultConvMemoryCount(String(settingsData.default_conversation_memory_count));
    if (settingsData.default_temperature !== undefined) setDefaultTemperature(String(settingsData.default_temperature));
    if (settingsData.default_max_tokens !== undefined) setDefaultMaxTokens(String(settingsData.default_max_tokens));

    // Load media settings
    if (settingsData.media_image_enabled !== undefined) setMediaImageEnabled(Boolean(settingsData.media_image_enabled));
    if (settingsData.media_image_provider_type !== undefined) setMediaImageProviderType(String(settingsData.media_image_provider_type));
    if (settingsData.media_image_model !== undefined) setMediaImageModel(String(settingsData.media_image_model));
    if (settingsData.media_image_max_size !== undefined) setMediaImageMaxSize(String(settingsData.media_image_max_size));
    if (settingsData.media_image_max_count !== undefined) setMediaImageMaxCount(String(settingsData.media_image_max_count));
    if (settingsData.media_image_fallback_text !== undefined) setMediaImageFallbackText(String(settingsData.media_image_fallback_text));
    if (settingsData.media_voice_enabled !== undefined) setMediaVoiceEnabled(Boolean(settingsData.media_voice_enabled));
    if (settingsData.media_voice_provider_type !== undefined) setMediaVoiceProviderType(String(settingsData.media_voice_provider_type));
    if (settingsData.media_voice_model !== undefined) setMediaVoiceModel(String(settingsData.media_voice_model));
    if (settingsData.media_voice_max_seconds !== undefined) setMediaVoiceMaxSeconds(String(settingsData.media_voice_max_seconds));
    if (settingsData.media_voice_fallback_text !== undefined) setMediaVoiceFallbackText(String(settingsData.media_voice_fallback_text));
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
      provider_type: p.provider_type || 'generic',
      roles: p.roles || ['text'],
      reasoning_max_tokens: p.reasoning_max_tokens !== null && p.reasoning_max_tokens !== undefined ? String(p.reasoning_max_tokens) : '',
      reasoning_strategy: p.reasoning_strategy || '',
      reasoning_media_max_tokens: p.reasoning_media_max_tokens !== null && p.reasoning_media_max_tokens !== undefined ? String(p.reasoning_media_max_tokens) : '',
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

  async function handleSaveMedia() {
    setSavingMedia(true);
    setStatus(null);
    try {
      const body: Record<string, unknown> = {
        media_image_enabled: mediaImageEnabled,
        media_image_provider_type: mediaImageProviderType,
        media_image_model: mediaImageModel,
        media_image_max_size: parseInt(mediaImageMaxSize) || 2048,
        media_image_max_count: parseInt(mediaImageMaxCount) || 3,
        media_image_fallback_text: mediaImageFallbackText,
        media_voice_enabled: mediaVoiceEnabled,
        media_voice_provider_type: mediaVoiceProviderType,
        media_voice_model: mediaVoiceModel,
        media_voice_max_seconds: parseInt(mediaVoiceMaxSeconds) || 120,
        media_voice_fallback_text: mediaVoiceFallbackText,
      };
      const res = await fetch('/api/admin/owner/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save');
      setStatus({ type: 'success', text: 'Media settings saved' });
    } catch (e: any) {
      setStatus({ type: 'error', text: e.message });
    } finally {
      setSavingMedia(false);
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
                  <th className="pb-3 pr-4 font-medium">Type</th>
                  <th className="pb-3 pr-4 font-medium">Base URL</th>
                  <th className="pb-3 pr-4 font-medium">Model</th>
                  <th className="pb-3 pr-4 font-medium">Reasoning</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                  {providers.map((p) => {
                    const typeColor = p.provider_type === 'openrouter' ? 'text-violet-400 bg-violet-500/10 border-violet-500/20' :
                      p.provider_type === 'deepseek' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                      'text-white/50 bg-white/5 border-white/10';
                    const reasoningDisplay = () => {
                      if (p.provider_type === 'openrouter') {
                        if (p.reasoning_max_tokens === 0) return <span className="text-xs text-white/30">Off</span>;
                        if (p.reasoning_max_tokens) return <span className="text-xs text-purple-400">{p.reasoning_max_tokens}</span>;
                        return <span className="text-xs text-white/30">Default</span>;
                      }
                      if (p.provider_type === 'deepseek') {
                        if (p.reasoning_strategy === 'disabled') return <span className="text-xs text-white/30">Off</span>;
                        if (p.reasoning_strategy === 'high') return <span className="text-xs text-emerald-400">High</span>;
                        if (p.reasoning_strategy === 'max') return <span className="text-xs text-amber-400">Max</span>;
                        return <span className="text-xs text-white/30">Default</span>;
                      }
                      return <span className="text-xs text-white/20">N/A</span>;
                    };
                    return (
                    <tr key={p.id} className="border-b border-white/5 text-white/70">
                      <td className="py-3 pr-4 font-medium text-white">{p.name}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${typeColor}`}>
                          {p.provider_type || 'generic'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-white/50 max-w-[180px] truncate" title={p.base_url}>{p.base_url}</td>
                      <td className="py-3 pr-4">
                        <span className="rounded bg-white/5 px-2 py-0.5 text-xs">{p.default_model}</span>
                      </td>
                      <td className="py-3 pr-4">
                        {reasoningDisplay()}
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
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Model Pricing */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Model Pricing</h3>
            <p className="text-xs text-white/40 mt-0.5">Per-model token costs used for cost analytics</p>
          </div>
          <button onClick={async () => {
            setPricingLoading(true);
            try {
              const res = await fetch('/api/admin/owner/pricing/fetch', { method: 'POST' });
              if (res.ok) {
                const data = await res.json();
                alert(`Updated ${data.updated} model prices from OpenRouter`);
                loadData();
              }
            } catch { alert('Failed to fetch pricing'); }
            finally { setPricingLoading(false); }
          }} disabled={pricingLoading}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-amber-500 hover:to-orange-500 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${pricingLoading ? 'animate-spin' : ''}`} />
            {pricingLoading ? 'Fetching...' : 'Fetch from OpenRouter'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-wider">
                <th className="pb-3 pr-3 font-medium">Provider</th>
                <th className="pb-3 pr-3 font-medium">Model</th>
                <th className="pb-3 pr-3 font-medium">Input (per 1M)</th>
                <th className="pb-3 pr-3 font-medium">Output (per 1M)</th>
                <th className="pb-3 pr-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pricing.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-white/30">
                    No pricing data yet. Click "Fetch from OpenRouter" to auto-populate.
                  </td>
                </tr>
              )}
              {pricing.map((pr) => (
                <tr key={pr.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 pr-3 text-sm text-white/70">{pr.ai_providers?.name || pr.provider_id}</td>
                  <td className="py-2.5 pr-3 text-sm font-mono text-white/80">{pr.model_name}</td>
                  <td className="py-2.5 pr-3 text-sm text-white/70">${Number(pr.input_price_per_1m_tokens).toFixed(4)}</td>
                  <td className="py-2.5 pr-3 text-sm text-white/70">${Number(pr.output_price_per_1m_tokens).toFixed(4)}</td>
                  <td className="py-2.5 text-sm text-white/40">{pr.is_auto_fetched ? 'Auto' : 'Manual'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      {/* Media Settings */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20">
              <Camera className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Media Processing</h3>
              <p className="text-xs text-white/40">Configure how images and voice messages are handled across all platforms</p>
            </div>
          </div>
          <button onClick={handleSaveMedia} disabled={savingMedia}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-cyan-500 hover:to-teal-500 disabled:opacity-50">
            <Save className="h-4 w-4" /> {savingMedia ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Image Settings */}
          <div className="rounded-xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <h4 className="text-xs font-semibold text-white/70 mb-3 flex items-center gap-2">
              <Camera className="h-3.5 w-3.5 text-cyan-400" /> Image Processing
            </h4>
            <div className="space-y-4">
              <label className="flex items-center gap-3 rounded-lg border border-white/10 p-3 cursor-pointer hover:bg-white/5 transition-colors">
                <input type="checkbox" checked={mediaImageEnabled} onChange={(e) => setMediaImageEnabled(e.target.checked)}
                  className="h-5 w-5 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/30" />
                <div>
                  <span className="text-sm font-medium text-white">Enable Image Processing</span>
                  <p className="text-xs text-white/30">Send images to AI vision models for analysis</p>
                </div>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">Vision Model</label>
                  <input value={mediaImageModel} onChange={(e) => setMediaImageModel(e.target.value)} placeholder="openai/gpt-4o-mini"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-500/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">Provider Type</label>
                  <select value={mediaImageProviderType} onChange={(e) => setMediaImageProviderType(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50">
                    <option value="openrouter">OpenRouter</option>
                    <option value="openai">OpenAI Direct</option>
                    <option value="google">Google Gemini</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">Max Image Size (px)</label>
                  <input type="number" min={256} max={4096} step={256} value={mediaImageMaxSize} onChange={(e) => setMediaImageMaxSize(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">Max Images Per Message</label>
                  <input type="number" min={1} max={10} value={mediaImageMaxCount} onChange={(e) => setMediaImageMaxCount(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1 block">Fallback Text (when image fails)</label>
                <input value={mediaImageFallbackText} onChange={(e) => setMediaImageFallbackText(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-500/50" />
                <p className="text-xs text-white/30 mt-1">Replaces image in AI context when download fails</p>
              </div>
            </div>
          </div>

          {/* Voice Settings */}
          <div className="rounded-xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <h4 className="text-xs font-semibold text-white/70 mb-3 flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-teal-400" /> Voice Transcription
            </h4>
            <div className="space-y-4">
              <label className="flex items-center gap-3 rounded-lg border border-white/10 p-3 cursor-pointer hover:bg-white/5 transition-colors">
                <input type="checkbox" checked={mediaVoiceEnabled} onChange={(e) => setMediaVoiceEnabled(e.target.checked)}
                  className="h-5 w-5 rounded border-white/20 bg-white/5 text-teal-500 focus:ring-teal-500/30" />
                <div>
                  <span className="text-sm font-medium text-white">Enable Voice Transcription</span>
                  <p className="text-xs text-white/30">Transcribe voice messages using Whisper STT</p>
                </div>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">STT Model</label>
                  <input value={mediaVoiceModel} onChange={(e) => setMediaVoiceModel(e.target.value)} placeholder="openai/whisper-large-v3-turbo"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-teal-500/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">Provider Type</label>
                  <select value={mediaVoiceProviderType} onChange={(e) => setMediaVoiceProviderType(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-teal-500/50">
                    <option value="openrouter">OpenRouter</option>
                    <option value="openai">OpenAI Direct</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">Max Voice Duration (sec)</label>
                  <input type="number" min={10} max={600} step={10} value={mediaVoiceMaxSeconds} onChange={(e) => setMediaVoiceMaxSeconds(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-teal-500/50" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1 block">Fallback Text (when transcription fails)</label>
                <input value={mediaVoiceFallbackText} onChange={(e) => setMediaVoiceFallbackText(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-teal-500/50" />
                <p className="text-xs text-white/30 mt-1">Shown in AI context when voice transcription fails</p>
              </div>
            </div>
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

              {/* Roles checkboxes */}
              <div>
                <label className="text-xs font-medium text-white/60 mb-2 block">Provider Roles</label>
                <div className="flex gap-4">
                  {['text', 'vision', 'voice'].map(role => (
                    <label key={role} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.roles.includes(role)}
                        onChange={(e) => setForm(f => ({
                          ...f,
                          roles: e.target.checked
                            ? [...f.roles, role]
                            : f.roles.filter(r => r !== role),
                        }))}
                        className="h-4 w-4 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500/30" />
                      <span className="text-sm capitalize text-white/70">{role}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-white/30 mt-1">Text = AI replies, Vision = image analysis, Voice = voice transcription</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-white/60">Provider Type</label>
                  <select value={form.provider_type} onChange={(e) => setForm(f => ({ ...f, provider_type: e.target.value }))}
                    className="w-full mt-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50">
                    <option value="generic">Generic (auto-detect)</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="google">Google Gemini</option>
                  </select>
                </div>
                {form.provider_type === 'openrouter' && (
                  <div>
                    <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                      <Brain className="h-3 w-3 text-violet-400" /> Max Reasoning Tokens
                    </label>
                    <input type="number" min={0} max={4096} step={64} value={form.reasoning_max_tokens}
                      onChange={(e) => setForm(f => ({ ...f, reasoning_max_tokens: e.target.value }))}
                      placeholder="0 = Off, empty = Default (512)"
                      className="w-full mt-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                  </div>
                )}
                {form.provider_type === 'deepseek' && (
                  <div>
                    <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                      <Brain className="h-3 w-3 text-emerald-400" /> Thinking Mode
                    </label>
                    <select value={form.reasoning_strategy} onChange={(e) => setForm(f => ({ ...f, reasoning_strategy: e.target.value }))}
                      className="w-full mt-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50">
                      <option value="">Default (High)</option>
                      <option value="disabled">Disabled</option>
                      <option value="high">High</option>
                      <option value="max">Max</option>
                    </select>
                  </div>
                )}
                {form.provider_type === 'generic' && (
                  <div>
                    <p className="mt-2 text-xs text-white/30">Reasoning not supported for this provider type.</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {form.provider_type === 'openrouter' && (
                  <div>
                    <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                      <Camera className="h-3 w-3 text-violet-400" /> Media Reasoning Tokens
                    </label>
                    <input type="number" min={0} max={4096} step={64} value={form.reasoning_media_max_tokens}
                      onChange={(e) => setForm(f => ({ ...f, reasoning_media_max_tokens: e.target.value }))}
                      placeholder="0 = Off, empty = use normal setting"
                      className="w-full mt-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
                    <p className="text-xs text-white/30 mt-1">Auto-enables reasoning when customer sends images/voice</p>
                  </div>
                )}
                {form.provider_type === 'deepseek' && (
                  <div>
                    <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                      <Camera className="h-3 w-3 text-emerald-400" /> Media Thinking Mode
                    </label>
                    <select value={form.reasoning_media_max_tokens} onChange={(e) => setForm(f => ({ ...f, reasoning_media_max_tokens: e.target.value }))}
                      className="w-full mt-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50">
                      <option value="">Same as normal</option>
                      <option value="0">Off</option>
                      <option value="1">High</option>
                      <option value="2">Max</option>
                    </select>
                    <p className="text-xs text-white/30 mt-1">Thinking level when customer sends images/voice</p>
                  </div>
                )}
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
