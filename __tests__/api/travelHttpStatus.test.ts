import { fetchTravels, fetchRandomTravels } from '@/api/travelListQueries';
import { fetchMyTravels } from '@/api/travelUserQueries';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { safeJsonParse } from '@/utils/safeJsonParse';
import i18n from '@/i18n/instance';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { resources, type TranslationKey } from '@/i18n/resources';

jest.mock('@/utils/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }));
jest.mock('@/utils/safeJsonParse', () => ({ safeJsonParse: jest.fn() }));
jest.mock('@/utils/secureStorage', () => ({ getSecureItem: jest.fn().mockResolvedValue(null) }));
jest.mock('@/api/client', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ isAuthenticated: false }) } }));
jest.mock('@/utils/publicStaleCache', () => ({
  isRecoverablePublicStaleError: () => true,
  readPublicStalePayload: jest.fn().mockResolvedValue(null),
  savePublicStalePayload: jest.fn(),
}));
jest.mock('@/utils/logger', () => ({ devError: jest.fn(), devWarn: jest.fn() }));

const cases: Array<[string, TranslationKey, () => Promise<unknown>]> = [
  ['my travels', 'errorsStatic:api.myTravels.loadFailed', () => fetchMyTravels({ user_id: 104, throwOnError: true })],
  ['catalog', 'errorsStatic:api.travelList.loadFailed', () => fetchTravels(0, 20, '', {}, { signal: new AbortController().signal })],
  ['random', 'errorsStatic:api.travelList.randomLoadFailed', () => fetchRandomTravels(0, 20, '', {}, { signal: new AbortController().signal })],
];

describe.each(SUPPORTED_LOCALES)('travel HTTP errors in %s', (locale) => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage(locale);
    jest.mocked(fetchWithTimeout).mockResolvedValue({
      ok: false, status: 503, statusText: '', text: async () => '',
    } as Response);
    jest.mocked(safeJsonParse).mockResolvedValue({});
  });

  afterEach(async () => { await i18n.changeLanguage('ru'); });

  it.each(cases)('%s keeps the translated message and numeric status', async (_name, key, request) => {
    const resourceKey = key.replace('errorsStatic:', '') as keyof typeof resources.ru.errorsStatic;
    const expected = resources[locale].errorsStatic[resourceKey].replace('{{details}}', '503');
    await expect(request()).rejects.toMatchObject({ message: expected, status: 503 });
    expect(expected).not.toContain('Unknown error');
    if (['ru', 'be', 'uk'].includes(locale)) expect(expected).not.toMatch(/[a-z]/i);
    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
  });
});
