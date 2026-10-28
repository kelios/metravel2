import { Platform } from 'react-native';

/**
 * Повторный вход в создание с экрана `/travel/new`.
 *
 * Первое сохранение дописывает `id` через `router.setParams`. Повторный
 * `router.push` того же экрана этот `id` не снимает, и форма остаётся на
 * сохранённой записи (#2829). `setParams` со значением `undefined` параметр
 * прячет: так же снимается секретная ссылка.
 */
const TRAVEL_CREATE_PATH = '/travel/new';

const CREATE_QUERY_KEYS = ['mode', 'source_travel_id', 'country', 'place'] as const;

type AppRouter = {
  push: (path: string) => void;
  setParams?: (params: Record<string, string | undefined>) => void;
};

export function normalizeAppPathname(pathname: string | null | undefined): string {
  if (!pathname) return '';
  const path = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return path || '/';
}

export function travelCreateResetParams(href: string): Record<string, string | undefined> | null {
  const [path, query = ''] = href.split('?');
  if (normalizeAppPathname(path) !== TRAVEL_CREATE_PATH) return null;
  const search = new URLSearchParams(query);
  const params: Record<string, string | undefined> = { id: undefined };
  for (const key of CREATE_QUERY_KEYS) {
    params[key] = search.get(key) ?? undefined;
  }
  return params;
}

function currentWebPathname(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
  return window.location.pathname;
}

export function pushInAppRoute(
  router: AppRouter,
  href: string,
  pathname?: string,
): void {
  router.push(href);
  const reset = travelCreateResetParams(href);
  if (!reset || !router.setParams) return;
  const current = normalizeAppPathname(pathname ?? currentWebPathname());
  if (current !== TRAVEL_CREATE_PATH) return;
  router.setParams(reset);
}
