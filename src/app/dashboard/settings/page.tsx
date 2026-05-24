'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Bot, Sliders, Clock, Shield, Loader2, CheckCircle, ShoppingCart, Link as LinkIcon, Globe } from 'lucide-react';
import { usePageTitle } from '@/lib/use-page-title';
import type { AISettings } from '@/types';

const MODELS = [
  'openai/gpt-3.5-turbo',
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'anthropic/claude-3-haiku',
  'anthropic/claude-3-sonnet',
  'google/gemini-pro',
  'meta-llama/llama-3-70b-instruct',
];

export default function SettingsPage() {
  usePageTitle('AI Settings');
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [settingsMeta, setSettingsMeta] = useState<{ id: string; order_method: string; order_link: string | null; business_name: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: meta } = await supabase.from('users').select('id, order_method, order_link, business_name').eq('id', user.id).single();
    if (!meta) { setLoading(false); return; }
    setSettingsMeta(meta);

    let { data } = await supabase
      .from('ai_settings').select('*').eq('user_id', user.id).is('page_id', null).is('instagram_id', null).single();

    if (!data) {
      const { data: newSettings } = await supabase.from('ai_settings').insert({ user_id: user.id }).select().single();
      data = newSettings;
    }
    setSettings(data);
    setLoading(false);
  }

  async function handleSave() {
    if (!settings || !settingsMeta) return;
    setSaving(true); setSaved(false);
    await supabase.from('ai_settings').upsert(settings, { onConflict: 'id' });
    await supabase.from('users').update({
      order_method: settingsMeta.order_method,
      order_link: settingsMeta.order_link,
    }).eq('id', settingsMeta.id);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function update<K extends keyof AISettings>(key: K, value: AISettings[K]) {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!settings) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Settings</h1>
          <p className="text-muted-foreground">Configure how your AI bot behaves</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-blue-600" /> AI Model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-blue-500/20" value={settings.model} onChange={(e) => update('model', e.target.value)}>
                {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Temperature ({settings.temperature})</label>
              <input type="range" min="0" max="2" step="0.1" value={settings.temperature} onChange={(e) => update('temperature', parseFloat(e.target.value))} className="w-full accent-blue-600" />
              <div className="flex justify-between text-xs text-muted-foreground"><span>Precise</span><span>Creative</span></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Tokens per Response</label>
              <Input type="number" value={settings.max_tokens} onChange={(e) => update('max_tokens', parseInt(e.target.value))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sliders className="h-5 w-5 text-purple-600" /> Behavior</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">System Prompt (optional)</label>
              <textarea className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20" value={settings.system_prompt || ''} onChange={(e) => update('system_prompt', e.target.value)} placeholder="Leave empty for default — AI will use knowledge base content" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">No Credits Message</label>
              <textarea className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20" value={settings.fallback_response} onChange={(e) => update('fallback_response', e.target.value)} placeholder="Leave empty to send nothing" />
              <p className="text-xs text-muted-foreground">Sent to customers when your credits run out. Leave empty to send nothing.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Conversation Memory</label>
              <Input type="number" min={1} max={50} value={settings.conversation_memory_count} onChange={(e) => update('conversation_memory_count', parseInt(e.target.value))} />
              <p className="text-xs text-muted-foreground">Number of recent messages AI remembers</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-amber-600" /> Greeting & Hours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <input type="checkbox" checked={settings.greeting_enabled} onChange={(e) => update('greeting_enabled', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
              <div><span className="text-sm font-medium">Enable greeting message</span><p className="text-xs text-muted-foreground">Send a welcome message when a new conversation starts</p></div>
            </label>
            {settings.greeting_enabled && <Input value={settings.greeting_message || ''} onChange={(e) => update('greeting_message', e.target.value)} placeholder="Hello! How can we help you today?" />}

            <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <input type="checkbox" checked={settings.business_hours_only} onChange={(e) => update('business_hours_only', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
              <div><span className="text-sm font-medium">Business hours only</span><p className="text-xs text-muted-foreground">Only reply during business hours</p></div>
            </label>
            {settings.business_hours_only && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-xs font-medium">Start</label><Input type="time" value={settings.business_hours_start || '09:00'} onChange={(e) => update('business_hours_start', e.target.value)} /></div>
                <div className="space-y-1"><label className="text-xs font-medium">End</label><Input type="time" value={settings.business_hours_end || '18:00'} onChange={(e) => update('business_hours_end', e.target.value)} /></div>
              </div>
            )}
            <div className="space-y-1"><label className="text-xs font-medium">Timezone</label><Input value={settings.timezone} onChange={(e) => update('timezone', e.target.value)} placeholder="Asia/Dhaka" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-red-600" /> Blacklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <label className="text-sm font-medium">Keywords to block</label>
            <Input value={settings.keywords_blacklist?.join(', ') || ''} onChange={(e) => update('keywords_blacklist', e.target.value.split(',').map((k) => k.trim()).filter(Boolean))} placeholder="spam, abuse, offensive" />
            <p className="text-xs text-muted-foreground">Comma-separated. AI won&apos;t reply to messages containing these keywords.</p>
          </CardContent>
        </Card>

        {/* Order Collection Strategy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-emerald-600" /> Order Collection Strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="text-sm font-medium">How should the AI collect orders?</label>
            <div className="grid gap-3">
              {[
                { value: 'direct_chat', label: 'Direct Chat Extraction', desc: 'AI asks for Name, Phone, Address, Product and saves order automatically', icon: Bot },
                { value: 'website', label: 'Send Website Link', desc: 'AI directs customers to your website/store to place orders', icon: Globe },
                { value: 'form', label: 'Send Form Link', desc: 'AI provides a Google Form or order form link', icon: LinkIcon },
              ].map(opt => {
                const Icon = opt.icon;
                const isSelected = ((settingsMeta?.order_method as string) || 'direct_chat') === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSettingsMeta(prev => prev ? { ...prev, order_method: opt.value } : prev)}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                      isSelected ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      isSelected ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{opt.label}</p>
                        {isSelected && <span className="text-xs text-emerald-600 font-medium">Active</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {(settingsMeta?.order_method === 'website' || settingsMeta?.order_method === 'form') && (
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {settingsMeta?.order_method === 'website' ? 'Website URL' : 'Form URL'}
                </label>
                <Input
                  value={settingsMeta?.order_link || ''}
                  onChange={(e) => setSettingsMeta(prev => prev ? { ...prev, order_link: e.target.value } : prev)}
                  placeholder={settingsMeta?.order_method === 'website' ? 'https://yourstore.com/checkout' : 'https://forms.google.com/...'}
                />
                <p className="text-xs text-muted-foreground">The AI will send this link when customers want to order</p>
              </div>
            )}

            {settingsMeta?.order_method === 'direct_chat' && (
              <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3">
                <p className="text-xs text-purple-700 dark:text-purple-300">
                  AI will extract Name, Phone, Address, and Product details using function calling.
                  Orders appear on the Order CRM page automatically.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
