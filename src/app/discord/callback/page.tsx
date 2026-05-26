'use client';
import { useEffect } from 'react';

export default function DiscordCallback() {
  useEffect(() => {
    window.close();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-sm text-muted-foreground">Authorization successful. You can close this window.</p>
    </div>
  );
}
