import { Platform } from 'react-native';
import { fetchTravels, fetchTravelFacets } from '@/api/travelListQueries';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { getSecureItem } from '@/utils/secureStorage';
import { readPublicStalePayload, savePublicStalePayload } from '@/utils/publicStaleCache';

jest.mock('@/utils/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }));
jest.mock('@/utils/safeJsonParse', () => ({ safeJsonParse: jest.fn() }));
jest.mock('@/utils/secureStorage', () => ({ getSecureItem: jest.fn() }));
jest.mock('@/utils/publicStaleCache', () => ({
  isRecoverablePublicStaleError: () => true,
  readPublicStalePayload: jest.fn(),
  savePublicStalePayload: jest.fn(),
}));

const request = jest.mocked(fetchWithTimeout);
const parse = jest.mocked(safeJsonParse);
const token = jest.mocked(getSecureItem);
const params = { publish: 0, includeDrafts: true, countries: [3] };
const originalOS = Platform.OS;

describe('admin unpublished travel list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    request.mockResolvedValue({ ok: true } as Response);
    token.mockResolvedValue('test-token');
    parse.mockResolvedValue({
      results: [
        { id: 1, publish: false, moderation: false, publication_status: 'draft' },
        { id: 2, publish: false, moderation: false, publication_status: 'pending_review' },
        { id: 3, publish: false, moderation: true, publication_status: 'approved' },
      ],
      count: 23,
    });
  });

  afterEach(() => { Platform.OS = originalOS; });

  it('preserves all unpublished statuses and server pagination with authenticated requests', async () => {
    const result = await fetchTravels(1, 10, 'castle', params);
    expect(result.data.map(item => item.id)).toEqual([1, 2, 3]);
    expect(result.total).toBe(23);
    const [url, init] = request.mock.calls[0];
    const query = new URL(String(url), 'https://example.test').searchParams;
    expect(JSON.parse(query.get('where') || '{}')).toEqual({ publish: 0, countries: [3] });
    expect(query.get('page')).toBe('2');
    expect(query.get('perPage')).toBe('10');
    expect(query.get('query')).toBe('castle');
    expect(init?.headers).toEqual({ Authorization: 'Token test-token' });
    expect(savePublicStalePayload).not.toHaveBeenCalled();
  });

  it('sends web session cookies for both the list and matching facets', async () => {
    Platform.OS = 'web';
    await fetchTravels(0, 10, '', params);
    parse.mockResolvedValue({ total: 23, facets: {} });
    await fetchTravelFacets('', params);
    for (const [url, init] of request.mock.calls) {
      expect(init?.credentials).toBe('include');
      expect(JSON.parse(new URL(String(url), 'https://example.test').searchParams.get('where') || '{}'))
        .toEqual({ publish: 0, countries: [3] });
    }
    expect(token).not.toHaveBeenCalled();
  });

  it('does not retain private payloads without a usable native credential', async () => {
    token.mockResolvedValue(null);
    expect((await fetchTravels(0, 10, '', params)).data).toEqual([]);
  });

  it('propagates denied access and never falls back to public stale cache', async () => {
    request.mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' } as Response);
    await expect(fetchTravels(0, 10, '', params)).rejects.toMatchObject({ status: 403 });
    expect(readPublicStalePayload).not.toHaveBeenCalled();
    expect(savePublicStalePayload).not.toHaveBeenCalled();
  });
});
