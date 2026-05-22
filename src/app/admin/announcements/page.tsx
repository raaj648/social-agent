'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Megaphone, Send, RefreshCw, Plus,
  CheckCircle, XCircle, FileText,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';

export default function OwnerAnnouncements() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const fetchTemplates = async () => {
    const res = await fetch('/api/admin/owner/announcements/templates');
    const data = await res.json();
    setTemplates(data.templates || []);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: isAdmin } = await supabase.rpc('is_admin');
      if (!isAdmin) { router.push('/dashboard'); return; }
      setLoading(false);
      fetchTemplates();
    };
    init();
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/owner/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, targetAudience }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', text: 'Announcement sent successfully!' });
        setTitle('');
        setMessage('');
      } else {
        setStatus({ type: 'error', text: data.error || 'Failed to send' });
      }
    } catch (e: any) {
      setStatus({ type: 'error', text: e.message });
    } finally {
      setSending(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !title.trim() || !message.trim()) return;
    try {
      const res = await fetch('/api/admin/owner/announcements/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: templateName, title, message }),
      });
      const data = await res.json();
      if (data.template) {
        setTemplates([data.template, ...templates]);
        setShowTemplateForm(false);
        setTemplateName('');
        setStatus({ type: 'success', text: 'Template saved!' });
      }
    } catch (e: any) {
      setStatus({ type: 'error', text: e.message });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await fetch(`/api/admin/owner/announcements/templates?id=${id}`, { method: 'DELETE' });
      setTemplates(templates.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const loadTemplate = (tpl: any) => {
    setTitle(tpl.title);
    setMessage(tpl.message);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-32"><RefreshCw className="h-6 w-6 animate-spin text-violet-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Announcements</h2>
        <p className="text-sm text-white/40">Broadcast messages to all tenants</p>
      </div>

      {status && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
          status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {status.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <Megaphone className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">New Announcement</h3>
              <p className="text-xs text-white/40">Send to all tenants</p>
            </div>
          </div>

          <div className="space-y-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement message..."
              rows={6}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 resize-none"
            />
            <div className="flex items-center gap-3">
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50"
              >
                <option value="all">All Tenants</option>
                <option value="specific">Specific Tenant</option>
              </select>
              <button
                onClick={handleSend}
                disabled={sending || !title.trim() || !message.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-purple-500 disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {sending ? 'Sending...' : 'Send'}
              </button>
              <button
                onClick={() => setShowTemplateForm(!showTemplateForm)}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 transition-all hover:bg-white/5"
              >
                <Plus className="h-4 w-4" /> Save as Template
              </button>
            </div>

            {showTemplateForm && (
              <div className="flex gap-2 rounded-xl bg-white/5 p-3">
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name..."
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none"
                />
                <button
                  onClick={handleSaveTemplate}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-xs text-white"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <h3 className="mb-4 text-sm font-semibold text-white">Templates</h3>
          {templates.length > 0 ? (
            <div className="space-y-2">
              {templates.map((tpl: any) => (
                <div key={tpl.id} className="group flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 transition-all hover:bg-white/10">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-violet-400" />
                    <div>
                      <p className="text-sm font-medium text-white">{tpl.name}</p>
                      <p className="text-xs text-white/40">{tpl.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => loadTemplate(tpl)}
                      className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/50 hover:text-white"
                    >
                      Use
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(tpl.id)}
                      className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-white/30">
              <FileText className="mb-2 h-8 w-8" />
              <p className="text-xs">No templates yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
