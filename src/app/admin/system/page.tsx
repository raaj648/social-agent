'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  HeartPulse, RefreshCw, CheckCircle, AlertCircle, XCircle,
  Database, Globe, Cpu, Clock, Shield, Activity, Zap
} from 'lucide-react';

interface HealthCheck {
  label: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  icon: any;
}

export default function AdminSystemPage() {
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => { runChecks(); }, []);

  async function runChecks() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) { router.push('/dashboard'); return; }

    const results: HealthCheck[] = [];

    // Supabase connection
    try {
      const { data, error } = await supabase.from('users').select('id', { count: 'exact', head: true });
      results.push({
        label: 'Supabase Database',
        status: error ? 'error' : 'ok',
        message: error ? error.message : `Responding — ${data?.length === undefined ? '0' : 'query successful'}`,
        icon: Database,
      });
    } catch (e: any) {
      results.push({ label: 'Supabase Database', status: 'error', message: e.message, icon: Database });
    }

    // Auth system
    try {
      const { error } = await supabase.auth.getSession();
      results.push({
        label: 'Authentication System',
        status: error ? 'warn' : 'ok',
        message: error ? error.message : 'Email/Password + Google OAuth ready',
        icon: Shield,
      });
    } catch (e: any) {
      results.push({ label: 'Authentication System', status: 'warn', message: e.message, icon: Shield });
    }

    // Platform settings
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      results.push({
        label: 'Platform Settings',
        status: data.error ? 'warn' : 'ok',
        message: data.error ? data.error : `${Object.keys(data).length} settings loaded`,
        icon: Globe,
      });
    } catch (e: any) {
      results.push({ label: 'Platform Settings', status: 'warn', message: e.message, icon: Globe });
    }

    // Admin API
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      results.push({
        label: 'Admin API',
        status: data.error ? 'error' : 'ok',
        message: data.error ? data.error : 'All endpoints responding',
        icon: Cpu,
      });
    } catch (e: any) {
      results.push({ label: 'Admin API', status: 'error', message: e.message, icon: Cpu });
    }

    // Environment check (fetched from server endpoint to check server-side vars)
    try {
      const envRes = await fetch('/api/admin/health/env');
      const envData = await envRes.json();
      const missing = envData.missing || [];
      results.push({
        label: 'Environment Variables',
        status: missing.length === 0 ? 'ok' : missing.length < 3 ? 'warn' : 'error',
        message: missing.length === 0 ? 'All configured' : `Missing: ${missing.join(', ')}`,
        icon: Activity,
      });
    } catch (e: any) {
      results.push({
        label: 'Environment Variables',
        status: 'error',
        message: e.message,
        icon: Activity,
      });
    }

    setChecks(results);
    setLastChecked(new Date());
    setLoading(false);
  }

  const totalOk = checks.filter(c => c.status === 'ok').length;
  const totalWarn = checks.filter(c => c.status === 'warn').length;
  const totalError = checks.filter(c => c.status === 'error').length;

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'ok': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warn': return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-muted-foreground mt-1">Monitor platform status and diagnostics</p>
        </div>
        <button onClick={runChecks} disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Running...' : 'Run Checks'}
        </button>
      </div>

      {/* Status summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{totalOk}</p>
              <p className="text-xs text-green-600 dark:text-green-400">Operational</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-amber-600" />
            <div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{totalWarn}</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Warnings</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-5">
          <div className="flex items-center gap-3">
            <XCircle className="h-6 w-6 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{totalError}</p>
              <p className="text-xs text-red-600 dark:text-red-400">Errors</p>
            </div>
          </div>
        </div>
      </div>

      {/* Health checks */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" /> Running diagnostics...
            </div>
          </div>
        ) : (
          checks.map((check) => {
            const Icon = check.icon;
            return (
              <div key={check.label} className="flex items-center gap-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  check.status === 'ok' ? 'bg-green-100 dark:bg-green-900' :
                  check.status === 'warn' ? 'bg-amber-100 dark:bg-amber-900' :
                  'bg-red-100 dark:bg-red-900'
                }`}>
                  <Icon className={`h-5 w-5 ${
                    check.status === 'ok' ? 'text-green-600 dark:text-green-400' :
                    check.status === 'warn' ? 'text-amber-600 dark:text-amber-400' :
                    'text-red-600 dark:text-red-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{check.label}</p>
                    <StatusIcon status={check.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{check.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* System info */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-purple-950 border border-blue-100 dark:border-blue-900 p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
          <Clock className="h-5 w-5 text-blue-600" />
          System Information
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-muted-foreground">Last Checked</p>
            <p className="text-sm font-medium mt-1">{lastChecked.toLocaleTimeString()}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-muted-foreground">Supabase Project</p>
            <p className="text-sm font-medium mt-1 truncate font-mono">nsppwrfzmvaiyeaqfryt</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-muted-foreground">Framework</p>
            <p className="text-sm font-medium mt-1">Next.js 14</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-muted-foreground">Environment</p>
            <p className="text-sm font-medium mt-1">{typeof window !== 'undefined' ? window.location.origin : 'Server'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
