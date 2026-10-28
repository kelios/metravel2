import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SupportedLocale } from '@/i18n/config';
import type { ApiQuestMeta } from '@/api/quests';
import type { QuestDiscovery } from '@/utils/questDiscovery';
import { projectQuestDiscoveryRow } from '@/utils/questDiscovery';
import { QuestDiscoveryContext } from '@/components/quests/runtime/QuestDiscoveryContext';
import { queryKeys } from '@/api/queryKeys';
import { questPrivateSnapshot } from '../fixtures/questPublicProjection';

let mockLocale: SupportedLocale = 'ru';
const mockFetchList = jest.fn();
const mockFetchPreview = jest.fn();
const mockCredentials = jest.fn();
jest.mock('@/hooks/useQuestContentLocale', () => ({ useQuestContentLocale: () => mockLocale }));
jest.mock('@/api/questsCatalogInvalidation', () => ({ waitForQuestsCatalogCredentials: (...args: unknown[]) => mockCredentials(...args) }));
jest.mock('@/api/quests', () => ({ fetchQuestsList: (...args: unknown[]) => mockFetchList(...args),
  fetchQuestsPreview: (...args: unknown[]) => mockFetchPreview(...args) }));
import { useQuestsList, useQuestsPreview } from '@/hooks/useQuestsApi';

const seed = projectQuestDiscoveryRow(questPrivateSnapshot().catalog[0])!;
const discovery = (view: QuestDiscovery['view']): QuestDiscovery => ({ schema_version: 2, state: 'available', locale: 'ru', view,
  publication_id: 'a'.repeat(64), corpus_revision: 'b'.repeat(64), source_revision: 'c'.repeat(64), content_revision: 'd'.repeat(64),
  quests: [seed], cities: [], countries: [] });
let client: QueryClient;
const wrapper = (data: QuestDiscovery) => ({ children }: { children: ReactNode }) => createElement(QueryClientProvider,
  { client }, createElement(QuestDiscoveryContext.Provider, { value: data }, children));

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mockLocale = 'ru';
  mockFetchList.mockReset(); mockFetchPreview.mockReset(); mockCredentials.mockReset().mockResolvedValue(undefined);
});
afterEach(() => client.clear());

it('shows guest-safe SSR data immediately and waits for normal credentials before replacing personal state', async () => {
  let release: () => void = () => {};
  mockCredentials.mockReturnValue(new Promise<void>((resolve) => { release = resolve; }));
  const authenticated: ApiQuestMeta = { ...seed, title: 'Authenticated current value', is_completed_by_me: true,
    personal_status_unavailable: false };
  mockFetchList.mockResolvedValue([authenticated]);
  const { result } = await renderHook(() => useQuestsList(), { wrapper: wrapper(discovery('catalog')) });
  expect(result.current.loading).toBe(false);
  expect(result.current.quests[0].personalStatusUnavailable).toBe(true);
  expect(result.current.quests[0].isCompletedByMe).toBe(false);
  await waitFor(() => expect(mockCredentials).toHaveBeenCalledTimes(1));
  expect(mockFetchList).not.toHaveBeenCalled();
  await act(async () => release());
  await waitFor(() => expect(result.current.quests[0].isCompletedByMe).toBe(true));
  expect(result.current.quests[0].personalStatusUnavailable).toBe(false);
});

it('does not overwrite an existing authenticated browser cache with a public document snapshot', async () => {
  client.setQueryData(queryKeys.questsCatalog('ru'), [{ ...seed, title: 'Existing current cache',
    is_completed_by_me: true, personal_status_unavailable: false }]);
  const { result } = await renderHook(() => useQuestsList(), { wrapper: wrapper(discovery('catalog')) });
  expect(result.current.quests[0].title).toBe('Existing current cache');
  expect(result.current.quests[0].isCompletedByMe).toBe(true);
  expect(mockFetchList).not.toHaveBeenCalled();
});

it('does not mistake a homepage preview for the complete catalogue', async () => {
  const { result } = await renderHook(() => ({ list: useQuestsList({ enabled: false }), preview: useQuestsPreview(6, { enabled: false }) }),
    { wrapper: wrapper(discovery('home')) });
  expect(result.current.list.quests).toEqual([]);
  expect(result.current.preview.quests.map((quest) => quest.id)).toEqual([seed.quest_id]);
  expect(client.getQueryData(queryKeys.questsCatalog('ru'))).toBeUndefined();
});

it('never feeds a RU seed into a later selected content locale', async () => {
  mockLocale = 'pl';
  const { result } = await renderHook(() => useQuestsList({ enabled: false }), { wrapper: wrapper(discovery('catalog')) });
  expect(result.current.quests).toEqual([]);
});
