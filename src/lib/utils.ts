import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getPlatformIcon(platform: string): string {
  return platform === 'messenger' ? 'facebook' : 'instagram';
}

export function isWithinBusinessHours(
  start: string,
  end: string,
  timezone: string = 'UTC'
): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const timeStr = formatter.format(now);
    return timeStr >= start && timeStr <= end;
  } catch {
    return true;
  }
}
