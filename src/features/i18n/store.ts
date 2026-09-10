/**
 * Language access for components.
 *
 * The chosen language lives in the persisted session store; this module is the
 * read side. `useT()` subscribes to it, so flipping the toggle in the settings
 * sheet re-renders every screen at once — which is what the design's
 * "ES · EN" chip does from three different places.
 */
import { useCallback } from 'react';

import { useSessionStore } from '@/features/session/store';

import { STRINGS, fill, type Lang, type StringKey, type Strings } from './strings';

/** The active language table. */
export function useT(): Strings {
  return STRINGS[useSessionStore((s) => s.lang)];
}

export function useLang(): Lang {
  return useSessionStore((s) => s.lang);
}

export function useToggleLang(): () => void {
  return useSessionStore((s) => s.toggleLang);
}

/** `t` plus placeholder substitution: `tf('onlineMany', { N: 4 })`. */
export function useTf(): (key: StringKey, values: Record<string, string | number>) => string {
  const t = useT();
  return useCallback((key, values) => fill(t[key], values), [t]);
}

/** Non-hook access, for code outside React (toasts fired from a store action). */
export function currentStrings(): Strings {
  return STRINGS[useSessionStore.getState().lang];
}

/** Relative "2 h ago" label for the recent-boards list. */
export function relativeTime(t: Strings, at: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 2) return t.justNow;
  if (minutes < 60) return fill(t.minutesAgo, { N: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return fill(t.hoursAgo, { N: hours });
  const days = Math.round(hours / 24);
  if (days === 1) return t.yesterday;
  return fill(t.daysAgo, { N: days });
}
