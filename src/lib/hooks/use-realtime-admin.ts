'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

const DEFAULT_INTERVAL = 30;

export interface AdminData {
  stats: {
    totalUsers: number;
    totalConversations: number;
    totalMessages: number;
    aiRepliesToday: number;
    tokensToday: number;
    totalTokens: number;
    costToday: number;
    totalCost: number;
    pointsToday: number;
    totalPointsCharged: number;
    activeSubscriptions: number;
    monthlyRevenue: number;
    facebookPages: number;
    instagramAccounts: number;
    whatsappAccounts: number;
  };
  dailyRegistrations: { date: string; count: number }[];
  planDistribution: Record<string, number>;
  modelBreakdown: Record<string, number>;
  topTenants: any[];
}

export function useRealtimeAdmin() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalSecRef = useRef(DEFAULT_INTERVAL);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/owner/stats');
      if (res.status === 401 || res.status === 403) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setError('Session expired. Please refresh the page.');
        return null;
      }
      const result = await res.json();
      if (result.error) {
        setError(result.error);
        return null;
      }
      setError(null);
      return result as AdminData;
    } catch {
      setError('Failed to connect. Retrying...');
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);

      // Fetch the configured interval
      try {
        const settingsRes = await fetch('/api/admin/settings');
        const settings = await settingsRes.json();
        if (settings.admin_stats_refresh_interval) {
          const v = Number(settings.admin_stats_refresh_interval);
          if (v >= 10 && v <= 600) {
            intervalSecRef.current = v;
          }
        }
      } catch {
        // fall back to default
      }

      // First fetch
      const result = await fetchStats();
      if (!mounted) return;
      if (result) setData(result);
      setLoading(false);

      // Start polling
      intervalRef.current = setInterval(async () => {
        setRefreshing(true);
        const r = await fetchStats();
        if (!mounted) return;
        if (r) setData(r);
        setRefreshing(false);
      }, intervalSecRef.current * 1000);
    };

    init();

    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStats]);

  const refreshNow = useCallback(async () => {
    setRefreshing(true);
    const r = await fetchStats();
    if (r) setData(r);
    setRefreshing(false);
  }, [fetchStats]);

  return { loading, refreshing, data, error, refreshNow };
}
