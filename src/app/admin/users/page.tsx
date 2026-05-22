'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  Search, Shield, ShieldOff, Trash2, X, Save,
  Users, RefreshCw, Filter, Crown, ChevronUp, ChevronDown,
  CheckSquare, Square, Download
} from 'lucide-react';
import { toast } from 'sonner';
import type { UserProfile } from '@/types';
import { formatDate } from '@/lib/utils';

const PLANS = ['free', 'starter', 'pro', 'enterprise'] as const;
const PAGE_SIZES = [10, 25, 50, 100];

type SortField = 'full_name' | 'email' | 'plan' | 'role' | 'created_at' | 'credits_remaining';
type SortDir = 'asc' | 'desc';

interface EditModalData {
  user: UserProfile;
  role: string;
  plan: string;
  credits_remaining: number;
  credits_total: number;
  credits_expires_at: string | null;
}

export default function OwnerUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editModal, setEditModal] = useState<EditModalData | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) { router.push('/dashboard'); return; }

    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data as UserProfile[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let result = users.filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch = !search ||
        u.email.toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        String(u.user_number || '').includes(q) ||
        u.id.toLowerCase().includes(q);
      const matchesPlan = planFilter === 'all' || u.plan === planFilter;
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesPlan && matchesRole;
    });

    result.sort((a, b) => {
      let cmp = 0;
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal || '').localeCompare(String(bVal || ''));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [users, search, planFilter, roleFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  function toggleSelectAll() {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map(u => u.id)));
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  async function bulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.size} users? This cannot be undone.`)) return;
    const count = selectedIds.size;
    for (const id of Array.from(selectedIds)) {
      try {
        await fetch(`/api/admin/users?userId=${id}`, { method: 'DELETE' });
      } catch {}
    }
    setUsers(prev => prev.filter(u => !selectedIds.has(u.id)));
    setSelectedIds(new Set());
    toast.success(`Deleted ${count} users`);
  }

  async function bulkChangePlan(plan: string) {
    const count = selectedIds.size;
    for (const id of Array.from(selectedIds)) {
      try {
        await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: id, plan }),
        });
      } catch {}
    }
    setUsers(prev => prev.map(u => selectedIds.has(u.id) ? { ...u, plan: plan as UserProfile['plan'] } : u));
    setSelectedIds(new Set());
    toast.success(`Changed ${count} users to ${plan}`);
  }

  async function toggleAdmin(userId: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole as 'user' | 'admin' } : u)));
      toast.success(`User ${newRole === 'admin' ? 'promoted to' : 'demoted from'} admin`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update role');
    }
  }

  async function deleteUser(userId: string) {
    setDeleting(userId);
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success('User deleted successfully');
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete user');
    }
    setDeleting(null);
  }

  async function saveEdit() {
    if (!editModal) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editModal.user.id, role: editModal.role,
          plan: editModal.plan, credits_remaining: editModal.credits_remaining, credits_total: editModal.credits_total,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setUsers((prev) => prev.map((u) =>
        u.id === editModal.user.id
          ? { ...u, role: editModal.role as 'user' | 'admin', plan: editModal.plan as UserProfile['plan'], credits_remaining: editModal.credits_remaining, credits_total: editModal.credits_total }
          : u
      ));
      setEditModal(null);
      toast.success('User updated successfully');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update user');
    }
    setSaving(false);
  }

  function exportCSV() {
    const headers = ['Name', 'Email', 'Plan', 'Role', 'Credits Left', 'Total Credits', 'Joined'];
    const rows = filtered.map(u => [
      u.full_name || '', u.email, u.plan, u.role, u.credits_remaining, u.credits_total, u.created_at
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex items-center gap-3 text-white/40">
          <RefreshCw className="h-5 w-5 animate-spin" /> Loading users...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {filtered.length} of {users.length} total users
            {selectedIds.size > 0 && <span className="ml-2 text-violet-400">· {selectedIds.size} selected</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/5 transition-colors">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={loadUsers} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/5 transition-colors">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            placeholder="Search by name, email, or ID..."
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-white/30 shrink-0" />
          {['all', ...PLANS].map((p) => (
            <button key={p} onClick={() => { setPlanFilter(p); setCurrentPage(1); }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                planFilter === p ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-white/40 border border-white/10 hover:bg-white/5'
              }`}>
              {p === 'all' ? 'All Plans' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button onClick={() => { setRoleFilter(roleFilter === 'admin' ? 'all' : 'admin'); setCurrentPage(1); }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              roleFilter === 'admin' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'text-white/40 border border-white/10 hover:bg-white/5'
            }`}>
            {roleFilter === 'admin' ? 'Admins Only' : 'All Roles'}
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
          <span className="text-sm font-medium text-violet-300">{selectedIds.size} selected</span>
          <div className="w-px h-5 bg-white/10" />
          <span className="text-xs text-white/40">Change plan to:</span>
          {PLANS.map(p => (
            <button key={p} onClick={() => bulkChangePlan(p)}
              className="rounded-full px-3 py-1 text-xs font-medium border border-white/10 text-white/60 hover:bg-white/5 transition-colors">
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={bulkDelete}
            className="rounded-lg px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors">
            <Trash2 className="inline h-3 w-3 mr-1" />Delete Selected
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-4 w-10">
                  <button onClick={toggleSelectAll} className="flex items-center justify-center">
                    {selectedIds.size === paginated.length && paginated.length > 0
                      ? <CheckSquare className="h-4 w-4 text-violet-400" />
                      : <Square className="h-4 w-4 text-white/30" />}
                  </button>
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  <button onClick={() => toggleSort('full_name')} className="flex items-center gap-1 hover:text-white/70 transition-colors">
                    User <SortIcon field="full_name" />
                  </button>
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  User ID
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  <button onClick={() => toggleSort('plan')} className="flex items-center gap-1 hover:text-white/70 transition-colors">
                    Plan <SortIcon field="plan" />
                  </button>
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  <button onClick={() => toggleSort('role')} className="flex items-center gap-1 hover:text-white/70 transition-colors">
                    Role <SortIcon field="role" />
                  </button>
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  <button onClick={() => toggleSort('credits_remaining')} className="flex items-center gap-1 hover:text-white/70 transition-colors">
                    Credits <SortIcon field="credits_remaining" />
                  </button>
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  <button onClick={() => toggleSort('created_at')} className="flex items-center gap-1 hover:text-white/70 transition-colors">
                    Joined <SortIcon field="created_at" />
                  </button>
                </th>
                <th className="px-4 py-4 text-right text-xs font-semibold text-white/40 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-sm text-white/30">No users found</td>
                </tr>
              ) : (
                paginated.map((user) => (
                  <tr key={user.id} className={`hover:bg-white/5 transition-colors ${selectedIds.has(user.id) ? 'bg-violet-500/5' : ''}`}>
                    <td className="px-4 py-4">
                      <button onClick={() => toggleSelect(user.id)} className="flex items-center justify-center">
                        {selectedIds.has(user.id)
                          ? <CheckSquare className="h-4 w-4 text-violet-400" />
                          : <Square className="h-4 w-4 text-white/30" />}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-xs font-bold text-violet-400">
                          {(user.full_name || user.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{user.full_name || '—'}</p>
                          <p className="text-xs text-white/40 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-white/30 font-mono">#{user.user_number || '—'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.plan === 'free' ? 'bg-white/5 text-white/50' :
                        user.plan === 'starter' ? 'bg-blue-500/20 text-blue-300' :
                        user.plan === 'pro' ? 'bg-purple-500/20 text-purple-300' :
                        'bg-amber-500/20 text-amber-300'
                      }`}>
                        {user.plan === 'pro' || user.plan === 'enterprise' ? <Crown className="h-3 w-3" /> : null}
                        {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.role === 'admin' ? 'bg-red-500/20 text-red-300' : 'bg-white/5 text-white/50'
                      }`}>{user.role}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[80px]">
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500" style={{ width: `${Math.min((user.credits_remaining / Math.max(user.credits_total, 1)) * 100, 100)}%` }} />
                          </div>
                        </div>
                        <span className="text-xs text-white/40 whitespace-nowrap">{user.credits_remaining}/{user.credits_total}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-white/40">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setEditModal({ user, role: user.role, plan: user.plan, credits_remaining: user.credits_remaining, credits_total: user.credits_total, credits_expires_at: user.credits_expires_at })}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium border border-white/10 text-white/60 hover:bg-white/5 transition-colors">Edit</button>
                        <button onClick={() => toggleAdmin(user.id, user.role)}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            user.role === 'admin' ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'border border-white/10 text-white/60 hover:bg-white/5'
                          }`}>
                          {user.role === 'admin' ? 'Demote' : 'Promote'}
                        </button>
                        <button onClick={() => { if (window.confirm(`Delete ${user.email}?`)) deleteUser(user.id); }}
                          disabled={deleting === user.id}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                          {deleting === user.id ? '...' : <Trash2 className="h-3 w-3" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-white/40">
            <span>Rows per page:</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-violet-500/50">
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/40">
              Page {currentPage} of {totalPages || 1}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-30 transition-colors">First</button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-30 transition-colors">Prev</button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-30 transition-colors">Next</button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-30 transition-colors">Last</button>
            </div>
          </div>
        </div>
      </div>

      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 p-6 mx-4" style={{ background: 'rgba(15,15,40,0.98)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Edit User</h3>
              <button onClick={() => setEditModal(null)} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
                <X className="h-5 w-5 text-white/60" />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-white/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-sm font-bold text-violet-400">
                {(editModal.user.full_name || editModal.user.email || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{editModal.user.full_name || '—'}</p>
                <p className="text-xs text-white/40">{editModal.user.email}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">Plan</label>
                <select value={editModal.plan} onChange={(e) => setEditModal({ ...editModal, plan: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50">
                  {PLANS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">Role</label>
                <select value={editModal.role} onChange={(e) => setEditModal({ ...editModal, role: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">Credits Remaining</label>
                  <input type="number" min={0} value={editModal.credits_remaining}
                    onChange={(e) => setEditModal({ ...editModal, credits_remaining: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">Total Credits</label>
                  <input type="number" min={0} value={editModal.credits_total}
                    onChange={(e) => setEditModal({ ...editModal, credits_total: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditModal(null)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-white/60 hover:bg-white/5 transition-colors">Cancel</button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white py-2.5 text-sm font-medium hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50">
                {saving ? 'Saving...' : <><Save className="inline h-4 w-4 mr-1.5" />Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
