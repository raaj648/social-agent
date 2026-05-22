'use client';

import { useEffect } from 'react';

type ShortcutMap = Record<string, () => void>;

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const key = [
        e.ctrlKey || e.metaKey ? 'Ctrl' : '',
        e.shiftKey ? 'Shift' : '',
        e.key === ' ' ? 'Space' : e.key,
      ].filter(Boolean).join('+');

      const action = shortcuts[key];
      if (action) {
        e.preventDefault();
        action();
      }

      if (e.key === 'Escape') {
        const escape = shortcuts['Escape'];
        if (escape) {
          e.preventDefault();
          escape();
        }
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const enter = shortcuts['Enter'];
        if (enter) {
          enter();
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
