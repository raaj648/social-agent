'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Package, Loader2, RefreshCw, Phone, MapPin, User, Calendar,
  ChevronDown, MessageSquare, Archive, MoreHorizontal
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { usePageTitle } from '@/lib/use-page-title';
import type { Order } from '@/types';

const STATUS_COLUMNS = [
  { key: 'pending', label: 'Pending', color: 'bg-amber-500', border: 'border-t-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { key: 'confirmed', label: 'Confirmed', color: 'bg-blue-500', border: 'border-t-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { key: 'processing', label: 'Processing', color: 'bg-purple-500', border: 'border-t-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  { key: 'shipped', label: 'Shipped', color: 'bg-indigo-500', border: 'border-t-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
  { key: 'delivered', label: 'Delivered', color: 'bg-green-500', border: 'border-t-green-500', bg: 'bg-green-50 dark:bg-green-950/30' },
  { key: 'cancelled', label: 'Cancelled', color: 'bg-red-500', border: 'border-t-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
];

export default function OrdersPage() {
  usePageTitle('Orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setOrders(data || []);
    setLoading(false);
  }

  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  const updateStatus = useCallback(async (orderId: string, newStatus: string) => {
    const snapshot = [...ordersRef.current];
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o));
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) {
      setOrders(snapshot);
    }
  }, [supabase]);

  const handleDragStart = (orderId: string) => setDragging(orderId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (status: string) => {
    if (dragging) {
      await updateStatus(dragging, status);
      setDragging(null);
    }
  };

  const getOrdersByStatus = (status: string) =>
    orders.filter(o => o.status === status)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const statusCounts = STATUS_COLUMNS.map(col => ({
    ...col,
    count: orders.filter(o => o.status === col.key).length,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Order CRM</h1>
          <p className="text-muted-foreground">Drag & drop orders to update status</p>
        </div>
        <button
          onClick={loadOrders}
          className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-2">
        {statusCounts.map(col => (
          <div key={col.key} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${col.bg} border`}>
            <span className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
            <span className="font-medium capitalize">{col.label}</span>
            <span className="text-muted-foreground ml-1">{col.count}</span>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {STATUS_COLUMNS.map(column => {
          const columnOrders = getOrdersByStatus(column.key);
          return (
            <div
              key={column.key}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.key)}
              className={`rounded-2xl border ${column.border} ${column.bg} min-h-[300px]`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${column.color}`} />
                  <span className="text-sm font-semibold">{column.label}</span>
                </div>
                <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">
                  {columnOrders.length}
                </span>
              </div>

              <div className="p-2 space-y-2">
                {columnOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Package className="h-6 w-6 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">No orders</p>
                  </div>
                ) : (
                  columnOrders.map(order => (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={() => handleDragStart(order.id)}
                      onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                      className="bg-white dark:bg-gray-900 rounded-xl border p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all animate-fade-in-up"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {order.customer_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {order.product_details?.slice(0, 60) || 'No products'}
                          </p>
                        </div>
                        <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          order.source === 'direct_chat' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' :
                          order.source === 'website' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                          'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        }`}>
                          {order.source === 'direct_chat' ? 'AI' : order.source === 'website' ? 'Web' : 'Form'}
                        </div>
                      </div>

                      {order.phone && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {order.phone}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(order.created_at)}
                      </div>

                      {expandedOrder === order.id && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          {order.delivery_address && (
                            <div className="flex items-start gap-1.5 text-xs">
                              <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                              <span>{order.delivery_address}</span>
                            </div>
                          )}
                          <div className="flex items-start gap-1.5 text-xs">
                            <Package className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                            <span className="whitespace-pre-wrap">{order.product_details}</span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {STATUS_COLUMNS.filter(s => s.key !== order.status).map(s => (
                              <button
                                key={s.key}
                                onClick={(e) => { e.stopPropagation(); updateStatus(order.id, s.key); }}
                                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${s.bg} hover:opacity-80 transition-opacity`}
                              >
                                Move to {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
