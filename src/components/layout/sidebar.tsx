'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  BookOpen,
  BarChart3,
  Facebook,
  LogOut,
  Bot,
  Shield,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  User,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/conversations', label: 'Conversations', icon: MessageSquare },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/dashboard/pages', label: 'Connected Pages', icon: Facebook },
  { href: '/dashboard/playground', label: 'Playground', icon: Bot },
  { href: '/dashboard/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

function SidebarContent({ collapsed, onNavClick }: { collapsed: boolean; onNavClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.rpc('is_admin').then(
        ({ data }) => setIsAdmin(!!data)
      );
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      <div className={cn(
        'flex h-16 items-center border-b gap-3 shrink-0',
        collapsed ? 'justify-center px-0' : 'px-6'
      )}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
          <Bot className="h-5 w-5 text-white" />
        </div>
        {!collapsed && <span className="text-lg font-bold truncate">SocialReply AI</span>}
      </div>

      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 dark:from-blue-950/50 dark:to-purple-950/50 dark:text-blue-400'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-blue-600 dark:text-blue-400')} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={cn('border-t p-3 space-y-1 shrink-0', collapsed && 'flex flex-col items-center')}>
        {isAdmin && (
          <Link href="/admin" className="w-full" onClick={onNavClick}>
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? 'Admin Panel' : undefined}
            >
              <Shield className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Admin Panel</span>}
            </Button>
          </Link>
        )}
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-3 text-muted-foreground',
            collapsed && 'justify-center px-2'
          )}
          onClick={handleSignOut}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="relative flex">
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-40 flex h-9 w-9 items-center justify-center rounded-lg border bg-background shadow-sm lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Mobile drawer + Desktop sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-card transition-all duration-300 lg:static lg:z-auto lg:block',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        collapsed ? 'lg:w-16' : 'lg:w-64',
        'w-64'
      )}>
        {/* Mobile close button */}
        <button
          onClick={closeMobile}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>

        <SidebarContent collapsed={collapsed} onNavClick={closeMobile} />
      </aside>

      {/* Desktop collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex absolute -right-3 top-14 h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </div>
  );
}
