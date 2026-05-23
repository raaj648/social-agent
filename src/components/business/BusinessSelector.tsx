'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { Business } from '@/types';

interface Props {
  activeBusinessId: string | null;
  onSelect: (businessId: string | null) => void;
}

export default function BusinessSelector({ activeBusinessId, onSelect }: Props) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const supabase = createClient();

  useEffect(() => { loadBusinesses(); }, []);

  async function loadBusinesses() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at');
    setBusinesses(data || []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }
    const { data, error } = await supabase
      .from('businesses')
      .insert({ user_id: user.id, name: newName.trim() })
      .select()
      .single();
    if (error || !data) {
      toast.error('Failed to create business');
      setCreating(false);
      return;
    }
    setBusinesses(prev => [...prev, data]);
    onSelect(data.id);
    setNewName('');
    setShowCreate(false);
    setCreating(false);
    toast.success(`Business "${data.name}" created`);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading businesses...
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <button
        onClick={() => onSelect(null)}
        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          activeBusinessId === null
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-accent'
        }`}
      >
        All Businesses
      </button>
      {businesses.map((biz) => (
        <button
          key={biz.id}
          onClick={() => onSelect(biz.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            activeBusinessId === biz.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          {biz.name}
        </button>
      ))}
      {showCreate ? (
        <div className="flex items-center gap-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Business name"
            className="h-7 w-40 text-xs"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            autoFocus
          />
          <Button size="sm" className="h-7 text-xs" onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCreate(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 transition-colors"
        >
          <Plus className="h-3 w-3" />
          New Business
        </button>
      )}
    </div>
  );
}
