/**
 * #2910: хлебные крошки не должны показывать сырой URL-сегмент («Become
 * Author», «More»). Общий титулизатор `useBreadcrumbModel` превращает
 * неизвестный сегмент в английский заголовок; этот тест обходит все статические
 * роуты `app/` и требует, чтобы ни одна крошка/заголовок не совпадали с таким
 * фолбэком — новый экран без ключа `@/i18n` покраснеет здесь.
 */
import fs from 'fs';
import path from 'path';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { Platform } from 'react-native';

import { STANDALONE_NESTED_ROUTE_LABELS, pageTranslations } from '@/hooks/breadcrumbRouteLabels';
import { useBreadcrumbModel } from '@/hooks/useBreadcrumbModel';
import { i18n } from '@/i18n';

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('@/api/travelDetailsQueries', () => ({ fetchTravel: jest.fn(), fetchTravelBySlug: jest.fn() }));
jest.mock('@/api/quests', () => ({ fetchQuestByQuestId: jest.fn(), fetchQuestsList: jest.fn(async () => []) }));
jest.mock('@/api/plannedTrips', () => ({ fetchPlannedTrip: jest.fn() }));
jest.mock('@/api/publicTrips', () => ({ fetchPublicTrip: jest.fn() }));

const APP_DIR = path.resolve(__dirname, '../../app');

function collectStaticRoutes(dir: string, prefix = ''): string[] {
  const out = new Set<string>();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = entry.name;
    if (name.startsWith('_') || name.startsWith('+') || name.startsWith('[')) continue;
    if (entry.isDirectory()) {
      const isGroup = name.startsWith('(') && name.endsWith(')');
      for (const r of collectStaticRoutes(path.join(dir, name), isGroup ? prefix : `${prefix}/${name}`)) out.add(r);
      continue;
    }
    if (!/\.tsx$/.test(name)) continue;
    const base = name.replace(/\.(web|native)\.tsx$/, '').replace(/\.tsx$/, '');
    if (base === 'index') {
      if (prefix) out.add(prefix);
      continue;
    }
    if (base === 'error') continue;
    out.add(`${prefix}/${base}`);
  }
  return [...out].sort();
}

const titleize = (segment: string) =>
  segment
    .split('-')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');

const STATIC_ROUTES = collectStaticRoutes(APP_DIR);
const LOCALES = ['ru', 'be', 'uk', 'pl', 'en'] as const;

describe('breadcrumb route literals (#2910)', () => {
  const { usePathname } = jest.requireMock('expo-router') as { usePathname: jest.Mock };
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    (Platform.OS as any) = 'ios';
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterAll(async () => {
    await i18n.changeLanguage('ru');
  });

  it('finds the static route list (sanity)', () => {
    expect(STATIC_ROUTES).toEqual(expect.arrayContaining(['/become-author', '/more', '/search', '/trips/my']));
  });

  it.each(LOCALES)('no static route falls back to a titleized URL segment in %s', async (locale) => {
    await i18n.changeLanguage(locale);
    const offenders: string[] = [];
    for (const route of STATIC_ROUTES) {
      usePathname.mockReturnValue(route);
      const { result, unmount } = await renderHook(() => useBreadcrumbModel(), { wrapper });
      await waitFor(() => expect(result.current).toBeTruthy());
      const labels = [result.current.currentTitle, ...result.current.items.map((item) => item.label)];
      // Самостоятельные вложенные страницы подписаны целиком (#2121).
      if (STANDALONE_NESTED_ROUTE_LABELS[route]) {
        await unmount();
        continue;
      }
      const segments = route.split('/').filter(Boolean);
      for (const segment of segments) {
        // Сегмент с подписью в таблице переведён: совпадение с титулизацией —
        // это сам перевод (EN «Community Rules», PL «Offline»), а не сырой slug.
        if (pageTranslations[segment] !== undefined) continue;
        const fallback = titleize(segment);
        if (labels.includes(fallback)) offenders.push(`${route} → «${fallback}»`);
      }
      await unmount();
    }
    expect(offenders).toEqual([]);
  });
});
