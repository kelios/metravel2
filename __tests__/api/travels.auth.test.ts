import {
  confirmAccount,
  googleAuthApi,
  loginApi,
  registration,
  resetPasswordLinkApi,
  setNewPasswordApi,
  sendPasswordApi,
  validateWebCookieSessionApi,
} from '@/api/auth';
import { Platform } from 'react-native';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { validatePassword } from '@/utils/aiValidation';
import { sanitizeInput } from '@/utils/security';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { devError } from '@/utils/logger';
import { setSecureItem } from '@/utils/secureStorage';
import { setStorageBatch } from '@/utils/storageBatch';

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Platform: { OS: 'ios' },
}));

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
}));

jest.mock('@/utils/aiValidation', () => ({
  validatePassword: jest.fn(() => ({ valid: true })),
}));

jest.mock('@/utils/security', () => ({
  sanitizeInput: jest.fn((v: string) => v.trim()),
}));

jest.mock('@/utils/safeJsonParse', () => ({
  safeJsonParse: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  devError: jest.fn(),
}));

jest.mock('@/utils/secureStorage', () => ({
  setSecureItem: jest.fn(),
}));

jest.mock('@/utils/storageBatch', () => ({
  setStorageBatch: jest.fn(),
}));

const mockedFetchWithTimeout = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;
const mockedSafeJsonParse = safeJsonParse as jest.MockedFunction<typeof safeJsonParse>;
const mockedValidatePassword = validatePassword as jest.MockedFunction<typeof validatePassword>;
const mockedSanitizeInput = sanitizeInput as jest.MockedFunction<typeof sanitizeInput>;

describe('src/api/auth.ts auth/password API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  });

  describe('validateWebCookieSessionApi', () => {
    it('probes a private endpoint with cookie credentials on web', async () => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 } as any);

      await expect(validateWebCookieSessionApi()).resolves.toBe(true);

      expect(mockedFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining('/user/me/verifications/'),
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
        expect.any(Number),
      );
    });

    it.each([401, 403])('fails closed for HTTP %s', async (status) => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status } as any);

      await expect(validateWebCookieSessionApi()).resolves.toBe(false);
    });

    it('keeps transient probe failures visible', async () => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 503 } as any);

      await expect(validateWebCookieSessionApi()).rejects.toThrow('Web session probe failed: 503');
    });
  });

  describe('loginApi', () => {
    it('возвращает null и показывает Alert при пустом пароле', async () => {
      const result = await loginApi('test@example.com', '   ');

      expect(result).toBeNull();
      expect(fetchWithTimeout).not.toHaveBeenCalled();
    });

    it('успешный логин возвращает данные пользователя', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ token: 't', name: 'User', email: 'e', id: 1, is_superuser: false } as any);

      const result = await loginApi('test@example.com', 'password');

      expect(result).toMatchObject({ token: 't', name: 'User' });
    });

    it('при ошибке логина логирует devError и показывает Alert', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('network'));

      const result = await loginApi('test@example.com', 'password');

      expect(result).toBeNull();
      expect(devError).toHaveBeenCalled();
    });
  });

  describe('confirmAccount', () => {
    it('persists non-secret identity metadata for web cookie-session reload', async () => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        userToken: 'opaque-token',
        userName: 'Pending User',
        userId: 42,
      } as any);

      await expect(confirmAccount('activation-hash')).resolves.toMatchObject({ userId: 42 });

      expect(mockedFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining('/user/confirm-registration/'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ hash: 'activation-hash' }),
        }),
        expect.any(Number),
      );
      expect(setStorageBatch).toHaveBeenCalledWith([
        ['userName', 'Pending User'],
        ['userId', '42'],
      ]);
      expect(setSecureItem).not.toHaveBeenCalled();
    });

    it('preserves native token storage and also persists the confirmation user id', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        userToken: 'native-token',
        refreshToken: 'native-refresh',
        userName: 'Native User',
        userId: '73',
      } as any);

      await confirmAccount('activation-hash');

      expect(setSecureItem).toHaveBeenNthCalledWith(1, 'userToken', 'native-token');
      expect(setSecureItem).toHaveBeenNthCalledWith(2, 'refreshToken', 'native-refresh');
      expect(setStorageBatch).toHaveBeenCalledWith([
        ['userName', 'Native User'],
        ['userId', '73'],
      ]);
    });

    it('rejects a token response without the required non-secret user id', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        userToken: 'opaque-token',
        userName: 'Incomplete User',
      } as any);

      await expect(confirmAccount('activation-hash')).rejects.toThrow();

      expect(setSecureItem).not.toHaveBeenCalled();
      expect(setStorageBatch).not.toHaveBeenCalled();
    });
  });

  describe('googleAuthApi', () => {
    it('отправляет trimmed id_token и возвращает данные пользователя', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        token: 'google-token',
        refresh: 'refresh-token',
        name: 'Google User',
        email: 'google@example.com',
        id: 7,
        is_superuser: false,
      } as any);

      const result = await googleAuthApi('  google-id-token  ');

      expect(result).toMatchObject({ token: 'google-token', id: 7 });
      expect(fetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining('/user/google-login/'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ id_token: 'google-id-token' }),
        }),
        expect.any(Number),
      );
    });

    it('показывает сообщение backend при ошибке Google авторизации', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 400 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ detail: 'Google token expired' } as any);

      const result = await googleAuthApi('expired-token');

      expect(result).toBeNull();
      expect(devError).toHaveBeenCalled();
    });

    it('использует понятный fallback для пустого 401 от Google endpoint', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 401 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({} as any);

      const result = await googleAuthApi('invalid-token');

      expect(result).toBeNull();
      expect(devError).toHaveBeenCalledWith(
        'Google auth error:',
        expect.objectContaining({
          message: 'Google не подтвердил аккаунт. Попробуйте выбрать аккаунт ещё раз.',
        }),
      );
    });
  });

  describe('registration', () => {
    it('валидация пароля вызывается и при невалидном пароле возвращает сообщение об ошибке', async () => {
      mockedValidatePassword.mockReturnValueOnce({ valid: false, error: 'bad' } as any);

      const result = await registration({ email: 'e', password: 'p' } as any);

      expect(result).toEqual({ ok: false, message: 'bad' });
    });

    it('успешная регистрация сохраняет токен и имя', async () => {
      mockedValidatePassword.mockReturnValueOnce({ valid: true } as any);
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ token: 't', name: 'User' } as any);

      const result = await registration({ email: 'e', password: 'p' } as any);

      expect(result).toEqual({
        ok: true,
        message: 'Пользователь успешно зарегистрирован. Проверьте почту для активации.',
      });
      expect(setSecureItem).toHaveBeenCalledWith('userToken', 't');
    });
  });

  describe('resetPasswordLinkApi', () => {
    it('sanitizeInput вызывается и при пустом email кидает ошибку', async () => {
      mockedSanitizeInput.mockReturnValueOnce('');

      await expect(resetPasswordLinkApi('   ')).rejects.toThrow('Email не может быть пустым');
    });

    it('возвращает сообщение из json при успехе', async () => {
      mockedSanitizeInput.mockReturnValueOnce('user@example.com');
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ message: 'OK' } as any);

      const msg = await resetPasswordLinkApi('user@example.com');
      expect(msg).toBe('OK');
    });
  });

  describe('setNewPasswordApi', () => {
    it('при невалидном пароле показывает Alert и возвращает false', async () => {
      mockedValidatePassword.mockReturnValueOnce({ valid: false, error: 'weak' } as any);

      const result = await setNewPasswordApi('token', 'p');

      expect(result).toBe(false);
      expect(fetchWithTimeout).not.toHaveBeenCalled();
    });

    it('успешная смена пароля показывает Alert успеха', async () => {
      mockedValidatePassword.mockReturnValueOnce({ valid: true } as any);
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ success: true } as any);

      const result = await setNewPasswordApi('token', 'StrongPassword1!');

      expect(result).toBe(true);
    });
  });

  describe('sendPasswordApi', () => {
    it('успешный вызов возвращает true и показывает Alert успеха', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ success: true } as any);

      const result = await sendPasswordApi('user@example.com');

      expect(result).toBe(true);
    });

    it('при ошибке логирует и возвращает false', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('network'));

      const result = await sendPasswordApi('user@example.com');

      expect(result).toBe(false);
    });
  });
});
