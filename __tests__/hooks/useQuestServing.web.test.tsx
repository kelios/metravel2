/** @jest-environment jsdom */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fetchQuestServing } from '@/api/questServing';
import { useQuestServing, readQuestServingBootstrap, resetQuestServingReleaseLatchForTests } from '@/hooks/useQuestServing.web';

jest.mock('@/api/questServing', () => ({ fetchQuestServing: jest.fn() }));
let mockOffline = false;
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: !mockOffline, isInternetReachable: !mockOffline }) }));
const options = { cityId: 1, questSlug: 'krakow-dragon', locale: 'pl' as const, enabled: true };
const bootstrap = {
  schema_version: 1, release_id: 'release-1', city_id: 1, quest_slug: 'krakow-dragon', locale: 'pl', state: 'available',
  canonical_path: '/pl/quests/1/krakow-dragon', ru_source_path: '/quests/1/krakow-dragon',
  versions: [{ locale: 'ru', path: '/quests/1/krakow-dragon' }, { locale: 'pl', path: '/pl/quests/1/krakow-dragon' }],
};
function mountHook(hookOptions: Parameters<typeof useQuestServing>[0] = options) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { ...renderHook(() => useQuestServing(hookOptions), { wrapper }), client };
}
beforeEach(() => {
  jest.clearAllMocks(); mockOffline = false; resetQuestServingReleaseLatchForTests();
  document.body.innerHTML = '<script id="quest-serving-v1" type="application/json"></script>';
  document.getElementById('quest-serving-v1')!.textContent = JSON.stringify(bootstrap);
});
afterEach(() => { document.body.innerHTML = ''; });

it('accepts only bootstrap E with the exact requested identity and locale', () => {
  expect(readQuestServingBootstrap(options)).toEqual(bootstrap);
  expect(readQuestServingBootstrap({ ...options, cityId: 19 })).toBeNull();
  expect(readQuestServingBootstrap({ ...options, locale: 'en' })).toBeNull();
});
it('replaces bootstrap membership permanently when fresh publication is withdrawn', async () => {
  let resolve!: (value: unknown) => void;
  jest.mocked(fetchQuestServing).mockReturnValue(new Promise((done) => { resolve = done; }) as ReturnType<typeof fetchQuestServing>);
  const { result, client, unmount } = mountHook();
  expect(result.current.projection?.state).toBe('available');
  resolve({ ...bootstrap, state: 'unavailable', canonical_path: null, versions: [] });
  await waitFor(() => expect(result.current.projection?.state).toBe('unavailable'));
  expect(result.current.projection?.versions).toEqual([]);
  unmount(); client.clear();
});
it('turns a failed revalidation into noindex/retry data without stale versions', async () => {
  jest.mocked(fetchQuestServing).mockRejectedValue(new Error('network'));
  const { result, client, unmount } = mountHook();
  await waitFor(() => expect(result.current.projection?.state).toBe('temporary_failure'));
  expect(result.current.projection?.versions).toEqual([]);
  unmount(); client.clear();
});
it('does not restore the document bootstrap after a withdrawn route remounts', async () => {
  jest.mocked(fetchQuestServing).mockResolvedValueOnce({
    ...bootstrap, state: 'unavailable', canonical_path: null, versions: [],
  } as Awaited<ReturnType<typeof fetchQuestServing>>);
  const first = mountHook();
  await waitFor(() => expect(first.result.current.projection?.state).toBe('unavailable'));
  first.unmount(); first.client.clear();
  jest.mocked(fetchQuestServing).mockReturnValueOnce(new Promise(() => {}));
  const second = mountHook();
  expect(second.result.current.projection).toBeNull();
  expect(second.result.current.pending).toBe(true);
  second.unmount(); second.client.clear();
});
it('does not use offline bootstrap/cache as publication evidence', () => {
  mockOffline = true;
  const { result, client, unmount } = mountHook();
  expect(result.current).toMatchObject({ offline: true, pending: false, projection: null });
  expect(fetchQuestServing).not.toHaveBeenCalled();
  unmount(); client.clear();
});
const noRelease = {
  schema_version: 1, release_id: null, city_id: 1, quest_slug: 'krakow-dragon', locale: 'ru', state: 'temporary_failure',
  canonical_path: null, ru_source_path: null, versions: [],
};
it('revalidation-only callers query on SPA entry without a bootstrap while a release may be active (#2364)', async () => {
  document.body.innerHTML = '';
  jest.mocked(fetchQuestServing).mockResolvedValue({ ...bootstrap, locale: 'ru' } as Awaited<ReturnType<typeof fetchQuestServing>>);
  const { client, unmount } = mountHook({ ...options, locale: 'ru', requireBootstrap: true });
  await waitFor(() => expect(fetchQuestServing).toHaveBeenCalledTimes(1));
  unmount(); client.clear();
});
it('revalidation-only callers pause after a 503 without package identity, except for their own bootstrap (#2364)', async () => {
  document.body.innerHTML = '';
  jest.mocked(fetchQuestServing).mockResolvedValue(noRelease as Awaited<ReturnType<typeof fetchQuestServing>>);
  const ruOptions = { ...options, locale: 'ru' as const, requireBootstrap: true };
  const first = mountHook(ruOptions);
  await waitFor(() => expect(fetchQuestServing).toHaveBeenCalledTimes(1));
  first.unmount(); first.client.clear();
  const second = mountHook(ruOptions);
  expect(second.result.current).toMatchObject({ projection: null, pending: false });
  expect(fetchQuestServing).toHaveBeenCalledTimes(1);
  second.unmount(); second.client.clear();
  // A prefixed page is never gated by the latch.
  const prefixed = mountHook({ ...options, cityId: 2 });
  await waitFor(() => expect(fetchQuestServing).toHaveBeenCalledTimes(2));
  prefixed.unmount(); prefixed.client.clear();
  // A document carrying the quest's own bootstrap still revalidates.
  document.body.innerHTML = '<script id="quest-serving-v1" type="application/json"></script>';
  document.getElementById('quest-serving-v1')!.textContent = JSON.stringify(bootstrap);
  const own = mountHook({ ...options, requireBootstrap: true });
  await waitFor(() => expect(fetchQuestServing).toHaveBeenCalledTimes(3));
  own.unmount(); own.client.clear();
  // The pause expires: a later SPA entry probes again.
  document.body.innerHTML = '';
  const now = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 5 * 60_000 + 1);
  const later = mountHook(ruOptions);
  await waitFor(() => expect(fetchQuestServing).toHaveBeenCalledTimes(4));
  later.unmount(); later.client.clear(); clock.mockRestore();
});
