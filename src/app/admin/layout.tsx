'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  Brain,
  Cpu,
  Webhook,
  ScrollText,
  LifeBuoy,
  HeartPulse,
  Megaphone,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ArrowLeft,
  Bell,
  Search,
  Crown,
} from 'lucide-react';
import { Toaster } from 'sonner';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/ai-usage', label: 'AI Usage', icon: Brain },
  { href: '/admin/providers', label: 'AI Config', icon: Cpu },
  { href: '/admin/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/admin/audit', label: 'Audit Trail', icon: ScrollText },
  { href: '/admin/system', label: 'System Health', icon: HeartPulse },
  { href: '/admin/support', label: 'Support', icon: LifeBuoy },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

const pageTitles: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/users': 'Users',
  '/admin/ai-usage': 'AI Usage',
  '/admin/providers': 'AI Configuration',
  '/admin/webhooks': 'Webhooks',
  '/admin/audit': 'Audit Trail',
  '/admin/system': 'System Health',
  '/admin/support': 'Support Tools',
  '/admin/announcements': 'Announcements',
  '/admin/settings': 'Settings',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/admin/login'); return; }
        const { data: isAdmin } = await supabase.rpc('is_admin');
        if (!isAdmin) {
          router.push('/dashboard');
          return;
        }
        setMounted(true);
      } catch (e) {
        console.error('Admin auth check failed:', e);
        router.push('/admin/login');
      }
    };
    checkAuth();
  }, []);

  const currentTitle = Object.entries(pageTitles).find(([path]) => pathname.startsWith(path))?.[1] || 'Admin Panel';

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a1a]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
          <p className="text-sm text-white/40">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a1a]">
      <aside
        className={`relative flex flex-col border-r border-white/10 transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        } shrink-0`}
        style={{
          background: 'linear-gradient(180deg, rgba(15,15,40,0.95) 0%, rgba(10,10,30,0.98) 100%)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 shadow-lg shadow-purple-500/25">
            <Crown className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold text-white">Admin Panel</p>
              <p className="text-[11px] text-white/40">Platform Administration</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                  isActive
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                } ${collapsed ? 'justify-center px-2' : ''}`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-violet-400' : ''}`} />
                {!collapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
                {!collapsed && isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3 space-y-1">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/40 transition-all duration-200 hover:bg-white/5 hover:text-white/70 ${
              collapsed ? 'justify-center px-2' : ''
            }`}
            title={collapsed ? 'Back to App' : undefined}
          >
            <ArrowLeft className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Back to App</span>}
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/login');
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/40 transition-all duration-200 hover:bg-white/5 hover:text-red-400 ${
              collapsed ? 'justify-center px-2' : ''
            }`}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#0a0a1a] text-white/40 transition-colors hover:text-white"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header
          className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-6"
          style={{
            background: 'rgba(10,10,30,0.8)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(236,72,153,0.2) 100%)',
              }}
            >
              <Crown className="h-4 w-4 text-violet-400" />
            </div>
            <h1 className="text-lg font-semibold text-white">{currentTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex h-9 w-9 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white">
              <Search className="h-4 w-4" />
            </button>
            <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2.5 top-2 h-2 w-2 rounded-full bg-violet-500 ring-2 ring-[#0a0a1a]" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[11px] font-bold text-white shadow-lg shadow-violet-500/20">
              A
            </div>
          </div>
        </header>

        <Toaster richColors closeButton position="top-right" theme="dark" />
        <main className="flex-1 overflow-auto">
          <div
            className="min-h-full p-6 lg:p-8"
            style={{
              background: 'radial-gradient(ellipse at 0% 0%, rgba(139,92,246,0.06) 0%, transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(236,72,153,0.04) 0%, transparent 60%)',
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
