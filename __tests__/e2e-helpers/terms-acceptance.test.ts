import { acceptTerms } from '@/api/consent';
import { apiClient } from '@/api/client';
import { AUTH_TERMS_CONSENT } from '@/utils/actionConsent';

import { E2E_TERMS_ACCEPTANCE, ensureCurrentTermsAccepted, type TermsApi } from '../../e2e/helpers/auth';

/**
 * #2173: global-setup входит прямым `POST /api/user/login/` и поэтому сам
 * записывает согласие, которое настоящий вход пишет с формы. Иначе аккаунт без
 * текущей версии условий видит лист повторного согласия на каждом экране, а
 * e2e падает таймаутом клика.
 */

jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn() } };
});

const mockedClient = apiClient as unknown as { get: jest.Mock; post: jest.Mock };

const response = (status: number, body: unknown = {}) => ({
  ok: () => status >= 200 && status < 300,
  status: () => status,
  json: async () => body,
});

function fakeApi(meAnswers: unknown[], postStatus = 201) {
  const posts: Array<Record<string, string>> = [];
  const api: TermsApi = {
    get: jest.fn(async (path: string) => {
      if (path !== '/api/user/me/') throw new Error(`unexpected GET ${path}`);
      const next = meAnswers.shift();
      return typeof next === 'number' ? response(next) : response(200, next);
    }),
    post: jest.fn(async (path: string, { data }: { data: Record<string, string> }) => {
      if (path !== '/api/user/consents/') throw new Error(`unexpected POST ${path}`);
      posts.push(data);
      return response(postStatus);
    }),
  };
  return { api, posts };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('E2E_TERMS_ACCEPTANCE', () => {
  it('пишет ровно то же, что «Принять» на листе повторного согласия', async () => {
    mockedClient.post.mockResolvedValue({});

    await acceptTerms(AUTH_TERMS_CONSENT.version);

    const appWrites = mockedClient.post.mock.calls.map(([, body]) => body);
    const e2eWrites = E2E_TERMS_ACCEPTANCE.consentTypes.map((consentType) => ({
      consent_type: consentType,
      version: E2E_TERMS_ACCEPTANCE.version,
    }));
    expect(e2eWrites).toEqual(appWrites);
  });
});

describe('ensureCurrentTermsAccepted', () => {
  it('ничего не пишет, если текущая версия уже принята', async () => {
    const { api, posts } = fakeApi([{ terms_accepted_current: true }]);

    await expect(ensureCurrentTermsAccepted(api, { allowWrite: true })).resolves.toBe('already');
    expect(posts).toEqual([]);
  });

  it('записывает обе записи и сверяется с /user/me/', async () => {
    const { api, posts } = fakeApi([{ terms_accepted_current: false }, { terms_accepted_current: true }]);

    await expect(ensureCurrentTermsAccepted(api, { allowWrite: true })).resolves.toBe('accepted');
    expect(posts).toEqual([
      { consent_type: 'terms', version: '1' },
      { consent_type: 'community_rules', version: '1' },
    ]);
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('на проде (allowWrite: false) не пишет согласие за человека', async () => {
    const { api, posts } = fakeApi([{ terms_accepted_current: false }]);

    await expect(ensureCurrentTermsAccepted(api, { allowWrite: false })).resolves.toBe('refused');
    expect(posts).toEqual([]);
  });

  it('бэкенд без поля terms_accepted_current — листа нет, писать нечего', async () => {
    const { api, posts } = fakeApi([{ id: 104 }]);

    await expect(ensureCurrentTermsAccepted(api, { allowWrite: true })).resolves.toBe('unsupported');
    expect(posts).toEqual([]);
  });

  it('громко падает, если сервер и после записи не видит согласия', async () => {
    const { api } = fakeApi([{ terms_accepted_current: false }, { terms_accepted_current: false }]);

    await expect(ensureCurrentTermsAccepted(api, { allowWrite: true })).rejects.toThrow(/всё ещё не видит согласия/);
  });

  it('громко падает на отказе записи и на мёртвой сессии', async () => {
    await expect(
      ensureCurrentTermsAccepted(fakeApi([{ terms_accepted_current: false }], 403).api, { allowWrite: true }),
    ).rejects.toThrow(/HTTP 403/);
    await expect(ensureCurrentTermsAccepted(fakeApi([401]).api, { allowWrite: true })).rejects.toThrow(/HTTP 401/);
  });
});
