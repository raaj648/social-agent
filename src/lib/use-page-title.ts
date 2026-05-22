'use client';

import { useEffect } from 'react';

const BASE = 'SocialReply AI';

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE}` : BASE;
    return () => { document.title = BASE; };
  }, [title]);
}
