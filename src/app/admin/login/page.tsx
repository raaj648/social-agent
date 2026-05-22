'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Crown, Mail, Lock, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setError(signInError.message); return; }
      if (!data.user) { setError('No user returned'); return; }

      const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin');
      if (rpcError) { setError(`Verification error: ${rpcError.message}`); return; }

      if (!isAdmin) {
        await supabase.auth.signOut();
        setError('Access denied. This login is for administrators only.');
        return;
      }

      window.location.href = '/admin';
    } catch (e: any) {
      setError('Authentication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a1a] p-4"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.08) 0%, transparent 60%), radial-gradient(ellipse at 50% 100%, rgba(236,72,153,0.04) 0%, transparent 60%)',
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 p-8 shadow-2xl transition-all"
        style={{
          background: 'rgba(15,15,40,0.6)',
          backdropFilter: 'blur(24px)',
        }}
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 shadow-lg shadow-purple-500/25">
            <Crown className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Owner Panel</h1>
          <p className="mt-1 text-sm text-white/40">Administrator authentication</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-10 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition-all hover:from-violet-500 hover:to-purple-500 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {loading ? 'Authenticating...' : 'Sign in to Owner Panel'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/30">
          Authorized administrators only. Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  );
}
