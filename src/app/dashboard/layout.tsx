'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';

const breadcrumbMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/conversations': 'Conversations',
  '/dashboard/orders': 'Orders',
  '/dashboard/pages': 'Connected Pages',
  '/dashboard/playground': 'Playground',
  '/dashboard/knowledge-base': 'Knowledge Base',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/profile': 'Profile',
  '/dashboard/settings': 'Settings',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const isConversationDetail = /^\/dashboard\/conversations\/[^\/]+$/.test(pathname);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {!isConversationDetail && (
          <header className="flex h-14 shrink-0 items-center border-b bg-background/80 backdrop-blur-sm px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/dashboard" className="hover:text-foreground transition-colors">
                <Home className="h-4 w-4" />
              </Link>
              {segments.map((seg, i) => {
                const href = '/' + segments.slice(0, i + 1).join('/');
                const label = breadcrumbMap[href] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
                const isLast = i === segments.length - 1;
                return (
                  <span key={href} className="flex items-center gap-1.5">
                    <ChevronRight className="h-3.5 w-3.5" />
                    {isLast ? (
                      <span className="font-medium text-foreground">{label}</span>
                    ) : (
                      <Link href={href} className="hover:text-foreground transition-colors">{label}</Link>
                    )}
                  </span>
                );
              })}
            </nav>
          </header>
        )}
        <main className="flex-1 overflow-auto bg-gradient-to-br from-background via-background to-muted/50">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
