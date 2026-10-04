import { acceptTerms, fetchTermsAcceptedCurrent } from '@/api/consent';
import { apiClient, ApiError } from '@/api/client';
import { getFacebookLoginBody } from '@/api/auth';
import { withTermsVersion } from '@/api/authShared';

// #2132: согласие с условиями — строгий контракт: ошибка записи не глотается,
// версия уходит серверу только явно, `/user/me/` без поля не требует согласия.

jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn() } };
});

const mockedClient = apiClient as unknown as { get: jest.Mock; post: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('acceptTerms', () => {
  it('пишет согласие с условиями и с правилами сообщества одной версией', async () => {
    mockedClient.post.mockResolvedValue({});

    await acceptTerms('1');

    expect(mockedClient.post).toHaveBeenNthCalledWith(1, '/user/consents/', { consent_type: 'terms', version: '1' });
    expect(mockedClient.post).toHaveBeenNthCalledWith(2, '/user/consents/', {
      consent_type: 'community_rules',
      version: '1',
    });
  });

  it.each([401, 404, 0, 500])('не глотает ошибку %s', async (status) => {
    mockedClient.post.mockRejectedValue(new ApiError(status, 'fail'));

    await expect(acceptTerms('1')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('fetchTermsAcceptedCurrent', () => {
  it.each([
    [{ terms_accepted_current: false }, false],
    [{ terms_accepted_current: true }, true],
    [{ id: 1 }, null],
    [null, null],
  ])('%j → %s', async (dto, expected) => {
    mockedClient.get.mockResolvedValue(dto);

    await expect(fetchTermsAcceptedCurrent()).resolves.toBe(expected);
    expect(mockedClient.get).toHaveBeenCalledWith('/user/me/');
  });
});

describe('terms_version в теле входа', () => {
  it('без версии тело не меняется — согласие не придумывается', () => {
    expect(withTermsVersion({ id_token: 't' })).toEqual({ id_token: 't' });
    expect(getFacebookLoginBody({ kind: 'access_token', accessToken: 'fb' })).toEqual({ access_token: 'fb' });
  });

  it('с версией добавляет terms_version в обе формы Facebook credential', () => {
    expect(getFacebookLoginBody({ kind: 'access_token', accessToken: 'fb' }, '1')).toEqual({
      access_token: 'fb',
      terms_version: '1',
    });
    expect(
      getFacebookLoginBody({ kind: 'authentication_token', authenticationToken: 'oidc', nonce: 'n' }, '1'),
    ).toEqual({ authentication_token: 'oidc', nonce: 'n', terms_version: '1' });
  });
});
