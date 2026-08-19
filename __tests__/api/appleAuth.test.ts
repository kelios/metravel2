import { appleAuthApi } from '@/api/appleAuth';
import { Platform } from 'react-native';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { devError } from '@/utils/logger';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
}));

jest.mock('@/utils/safeJsonParse', () => ({
  safeJsonParse: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  devError: jest.fn(),
}));

const mockedFetchWithTimeout = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;
const mockedSafeJsonParse = safeJsonParse as jest.MockedFunction<typeof safeJsonParse>;

describe('api/appleAuth.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  });

  describe('appleAuthApi', () => {
    it('отправляет контракт #1412 и возвращает сессию', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        token: 'apple-session-token',
        refresh: 'apple-refresh',
        name: 'Apple User',
        email: 'apple@example.com',
        id: 51,
        is_superuser: false,
      } as any);

      await expect(
        appleAuthApi({
          identityToken: '  apple-identity-token  ',
          authorizationCode: 'one-time-code',
          givenName: 'Apple',
          familyName: 'User',
        }),
      ).resolves.toMatchObject({
        status: 'authenticated',
        user: { token: 'apple-session-token', id: 51 },
      });

      expect(mockedFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining('/user/apple-login/'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            identity_token: 'apple-identity-token',
            authorization_code: 'one-time-code',
            given_name: 'Apple',
            family_name: 'User',
          }),
        }),
        expect.any(Number),
      );
    });

    it('на повторном входе не шлёт пустые name-поля', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        token: 'apple-session-token',
        name: '',
        email: '',
        id: 51,
        is_superuser: false,
      } as any);

      await expect(
        appleAuthApi({
          identityToken: 'apple-identity-token',
          authorizationCode: null,
          givenName: null,
          familyName: null,
        }),
      ).resolves.toMatchObject({ status: 'authenticated' });

      expect(mockedFetchWithTimeout).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: JSON.stringify({ identity_token: 'apple-identity-token' }),
        }),
        expect.any(Number),
      );
    });

    it('без identity token не ходит в сеть', async () => {
      await expect(appleAuthApi({ identityToken: '   ' })).resolves.toMatchObject({
        status: 'error',
        errorCode: 'identity_token_required',
      });

      expect(mockedFetchWithTimeout).not.toHaveBeenCalled();
    });

    it('не повторяет запрос: authorization_code одноразовый', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('network timeout'));

      await expect(
        appleAuthApi({ identityToken: 'apple-identity-token', authorizationCode: 'one-time-code' }),
      ).resolves.toMatchObject({ status: 'error' });

      expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(1);
      expect(devError).toHaveBeenCalled();
    });

    it('пробрасывает стабильный код apple_account_disabled', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 403 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ error_code: 'apple_account_disabled' } as any);

      await expect(appleAuthApi({ identityToken: 'apple-identity-token' })).resolves.toMatchObject({
        status: 'error',
        errorCode: 'apple_account_disabled',
      });
    });

    it('конфликт аккаунтов не выдаёт сессию', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 409 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ error_code: 'apple_account_conflict' } as any);

      const result = await appleAuthApi({ identityToken: 'apple-identity-token' });

      expect(result.status).toBe('error');
      expect(result).not.toHaveProperty('user');
    });

    it('успешный ответ без токена сессией не считается', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ id: 51, name: 'Apple User' } as any);

      await expect(appleAuthApi({ identityToken: 'apple-identity-token' })).resolves.toMatchObject({
        status: 'error',
      });
    });
  });

});
