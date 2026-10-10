/** @jest-environment jsdom */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fetchQuestServing } from '@/api/questServing';
import { useQuestServing, readQuestServingBootstrap } from '@/hooks/useQuestServing.web';

jest.mock('@/api/questServing', () => ({ fetchQuestServing: jest.fn() }));
let mockOffline = false;
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: !mockOffline, isInternetReachable: !mockOffline }) }));
const options = { cityId: 1, questSlug: 'krakow-dragon', locale: 'pl' as const, enabled: true };
const bootstrap = {
  schema_version: 1, release_id: 'release-1', city_id: 1, quest_slug: 'krakow-dragon', locale: 'pl', state: 'available',
  canonical_path: '/pl/quests/1/krakow-dragon', ru_source_path: '/quests/1/krakow-dragon',
  versions: [{ locale: 'ru', path: '/quests/1/krakow-dragon' }, { locale: 'pl', path: '/pl/quests/1/krakow-dragon' }],
};
function mountHook() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { ...renderHook(() => useQuestServing(options), { wrapper }), client };
}
beforeEach(() => {
  jest.clearAllMocks(); mockOffline = false;
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
