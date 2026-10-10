import { fetchQuestServing } from '@/api/questServing';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

jest.mock('@/utils/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }));
const identity = { cityId: 1, questSlug: 'krakow-dragon', locale: 'pl' as const };
const projection = {
  schema_version: 1, release_id: 'release-1', city_id: 1, quest_slug: 'krakow-dragon', locale: 'pl',
  state: 'available', canonical_path: '/pl/quests/1/krakow-dragon', ru_source_path: '/quests/1/krakow-dragon',
  versions: [{ locale: 'ru', path: '/quests/1/krakow-dragon' }, { locale: 'pl', path: '/pl/quests/1/krakow-dragon' }],
};
const mockedFetch = jest.mocked(fetchWithTimeout);
beforeEach(() => jest.clearAllMocks());

it('uses exact language and anonymous no-store transport', async () => {
  mockedFetch.mockResolvedValue({ status: 200, json: async () => projection } as Response);
  const signal = new AbortController().signal;
  await expect(fetchQuestServing(identity, signal)).resolves.toEqual(projection);
  expect(mockedFetch).toHaveBeenCalledWith(expect.stringContaining('/quests/serving/1/krakow-dragon/?lang=pl'),
    { credentials: 'omit', cache: 'no-store', signal, headers: { Accept: 'application/json' } }, expect.any(Number));
});
it.each([[404, 'unavailable'], [503, 'temporary_failure']])('returns HTTP %s as its explicit live state', async (status, state) => {
  const body = { ...projection, state, canonical_path: null, versions: [] };
  mockedFetch.mockResolvedValue({ status, json: async () => body } as Response);
  await expect(fetchQuestServing(identity)).resolves.toEqual(body);
});
it('rejects wrong status/state, unsafe identity and corrupt projection', async () => {
  mockedFetch.mockResolvedValue({ status: 404, json: async () => projection } as Response);
  await expect(fetchQuestServing(identity)).rejects.toThrow('Invalid quest serving response');
  mockedFetch.mockResolvedValue({ status: 200, json: async () => ({ ...projection, locale: 'ru' }) } as Response);
  await expect(fetchQuestServing(identity)).rejects.toThrow('Invalid quest serving response');
  mockedFetch.mockClear();
  await expect(fetchQuestServing({ ...identity, questSlug: '../other' })).rejects.toThrow('Invalid quest serving identity');
  expect(mockedFetch).not.toHaveBeenCalled();
});
