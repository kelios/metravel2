import { useLayoutEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'expo-router';
import type { SupportedLocale } from '@/i18n/config';
import { parseQuestLocaleRoute, type QuestServingProjection } from '@/utils/questLocaleRouting';
import type { QuestVersionNavigation } from './questServingTypes';

let current: (QuestVersionNavigation & { pathname: string }) | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => current;
const serverSnapshot = () => null;
const notify = () => { for (const listener of listeners) listener(); };

/** Header and route have different ancestors; ownership is scoped to the active path. */
export function useQuestVersionNavigation(): QuestVersionNavigation | null {
  const pathname = usePathname();
  const published = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (published?.pathname === pathname) return published;
  const route = parseQuestLocaleRoute(pathname);
  return route ? { bound: true, projection: null, locale: route.locale } : null;
}

export function usePublishQuestVersionNavigation(
  projection: QuestServingProjection | null, enabled: boolean, locale: SupportedLocale,
): void {
  const pathname = usePathname();
  useLayoutEffect(() => {
    if (!enabled) return;
    const owned = { pathname, projection, locale, bound: Boolean(parseQuestLocaleRoute(pathname)) };
    current = owned;
    notify();
    return () => {
      if (current === owned) { current = null; notify(); }
    };
  }, [pathname, projection, enabled, locale]);
}
