// #3360: языковой хаб получает участников из discovery своего языка.
import type { ImmutableRequest } from 'expo-server';
import { loadQuestDiscovery } from '@/components/quests/runtime/questDiscoveryLoader';
import { fetchPublicRouteJson } from '@/utils/ssr/fetchPublicRouteJson';
import { readQuestDiscoveryLoaderData } from '@/utils/questDiscoveryWire';
import { questPrivateSnapshot } from '../../fixtures/questPublicProjection';

jest.mock('@/utils/ssr/fetchPublicRouteJson', () => ({
  fetchPublicRouteJson: jest.fn(),
  publicRouteError: (status: number) => Object.assign(new Error(String(status)), { httpStatus: status }),
}));
const fetchMock = fetchPublicRouteJson as jest.Mock;
const request = () => ({ signal: new AbortController().signal } as ImmutableRequest);
const quest = questPrivateSnapshot().catalog[0];
const envelope = (locale: string) => ({ schema_version: 2, state: 'available', locale, view: 'catalog', cities: [], countries: [],
  publication_id: 'a'.repeat(64), corpus_revision: 'b'.repeat(64), source_revision: 'c'.repeat(64), content_revision: 'd'.repeat(64),
  quests: [locale === 'ru' ? quest : { ...quest, title: `${locale} title`, content_locale: locale, served_locales: ['ru', locale] }] });

describe('quest discovery loader', () => {
  const original = process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR;
  beforeEach(() => {
    process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR = 'true';
    fetchMock.mockReset().mockImplementation(async (_request, endpoint: string) =>
      envelope(new URL(endpoint, 'https://example.test').searchParams.get('lang')!));
  });
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR;
    else process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR = original;
  });

  it.each(['be', 'uk', 'pl', 'en'])('asks for the %s hub catalogue and returns its members in that language', async (locale) => {
    const data = readQuestDiscoveryLoaderData(await loadQuestDiscovery(request(), 'catalog', locale as 'en'))!;
    expect(fetchMock.mock.calls[0][1]).toBe(`quests/web/discovery/?lang=${locale}&view=catalog`);
    expect(data.locale).toBe(locale);
    expect(data.quests[0]).toMatchObject({ title: `${locale} title`, content_locale: locale, served_locales: ['ru', locale] });
  });

  it('keeps the Russian catalogue request unchanged', async () => {
    const data = readQuestDiscoveryLoaderData(await loadQuestDiscovery(request(), 'catalog'))!;
    expect(fetchMock.mock.calls[0][1]).toBe('quests/web/discovery/?lang=ru&view=catalog');
    expect(data.locale).toBe('ru');
  });

  it('fails closed with 503 when the response is not the requested hub', async () => {
    fetchMock.mockResolvedValue(envelope('pl'));
    await expect(loadQuestDiscovery(request(), 'catalog', 'en')).rejects.toMatchObject({ httpStatus: 503 });
  });
});
