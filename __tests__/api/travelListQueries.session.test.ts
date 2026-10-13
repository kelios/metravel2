import { Platform } from 'react-native';
import { fetchTravelFacets, fetchTravels, fetchRandomTravels } from '@/api/travelListQueries';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { getSecureItem } from '@/utils/secureStorage';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { takeTravelListPreload } from '@/utils/travelListPreload';
import { readPublicStalePayload, savePublicStalePayload } from '@/utils/publicStaleCache';

let mockAuthenticated = false;
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ isAuthenticated: mockAuthenticated }) } }));
jest.mock('@/utils/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }));
jest.mock('@/utils/secureStorage', () => ({ getSecureItem: jest.fn() }));
jest.mock('@/utils/safeJsonParse', () => ({ safeJsonParse: jest.fn() }));
jest.mock('@/utils/travelListPreload', () => ({ takeTravelListPreload: jest.fn() }));
jest.mock('@/utils/publicStaleCache', () => ({
  savePublicStalePayload: jest.fn(), readPublicStalePayload: jest.fn(),
  isRecoverablePublicStaleError: () => true,
}));

const fetchMock = jest.mocked(fetchWithTimeout);
const parseMock = jest.mocked(safeJsonParse);
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthenticated = false;
  Platform.OS = 'ios';
  jest.mocked(getSecureItem).mockResolvedValue('stored-token');
  fetchMock.mockResolvedValue({ ok: true, status: 200 } as Response);
  parseMock.mockResolvedValue({ data: [{ id: 2, userIds: '2', publish: true, moderation: true }], total: 1 });
});
afterEach(() => { Platform.OS = originalOS; });

it('sends the signed native session and uses the server-filtered total', async () => {
  mockAuthenticated = true;
  const response = await fetchTravels(0, 10, '', { sort: 'newest' });
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'omit', headers: { Authorization: 'Token stored-token' } });
  expect(response.data).toHaveLength(1);
  expect(response.total).toBe(1);
  expect(takeTravelListPreload).not.toHaveBeenCalled();
  expect(savePublicStalePayload).not.toHaveBeenCalled();
});

it('uses cookie auth on web and keeps personalized responses out of public stale storage', async () => {
  Platform.OS = 'web';
  mockAuthenticated = true;
  await fetchTravels(0, 10, '', {});
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
  expect(fetchMock.mock.calls[0][1]?.headers).toBeUndefined();
  expect(getSecureItem).not.toHaveBeenCalled();
  expect(savePublicStalePayload).not.toHaveBeenCalled();
});

it('keeps guests anonymous even with a leftover token, preserving preload and public stale cache', async () => {
  await fetchTravels(0, 10, '', {});
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
  expect(fetchMock.mock.calls[0][1]?.headers).toBeUndefined();
  expect(getSecureItem).not.toHaveBeenCalled();
  expect(takeTravelListPreload).toHaveBeenCalledTimes(1);
  expect(savePublicStalePayload).toHaveBeenCalledTimes(1);
});

it('makes public random and facet requests participate in the same native session', async () => {
  mockAuthenticated = true;
  await fetchRandomTravels(0, 10, '', {});
  parseMock.mockResolvedValue({ total: 1, facets: { countries: [] } });
  await fetchTravelFacets('', {});
  expect(fetchMock).toHaveBeenCalledTimes(2);
  for (const [, init] of fetchMock.mock.calls) {
    expect(init).toMatchObject({ credentials: 'omit', headers: { Authorization: 'Token stored-token' } });
  }
});

it('keeps guest web random and facets requests anonymous', async () => {
  Platform.OS = 'web';
  await fetchRandomTravels(0, 10, '', {});
  parseMock.mockResolvedValue({ total: 1, facets: {} });
  await fetchTravelFacets('', {});
  for (const [, init] of fetchMock.mock.calls) expect(init).toMatchObject({ credentials: 'omit' });
  expect(getSecureItem).not.toHaveBeenCalled();
});

it('retries an expired public token anonymously without storing the personalized result', async () => {
  mockAuthenticated = true;
  fetchMock.mockResolvedValueOnce({ ok: false, status: 401 } as Response);
  await fetchTravels(0, 10, '', {});
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][1]).toMatchObject({ credentials: 'omit' });
  expect(fetchMock.mock.calls[1][1]?.headers).toBeUndefined();
  expect(savePublicStalePayload).not.toHaveBeenCalled();
});

it('can still read a guest public stale snapshot offline without persisting a signed response', async () => {
  mockAuthenticated = true;
  fetchMock.mockRejectedValueOnce(new Error('Network request failed'));
  jest.mocked(readPublicStalePayload).mockResolvedValueOnce({ data: [], total: 0 });
  const result = await fetchTravels(0, 10, '', {}, { signal: new AbortController().signal });
  expect(result).toEqual({ data: [], total: 0 });
  expect(savePublicStalePayload).not.toHaveBeenCalled();
});
