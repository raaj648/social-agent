import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-muted/60', className)} />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-6 py-3.5">
      <Skeleton className="h-9 w-9 rounded-full" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-3 w-20" />
    </div>
  );
}
