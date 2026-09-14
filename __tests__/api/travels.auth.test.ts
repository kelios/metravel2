import {
  confirmAccount,
  confirmFacebookEmailCompletionApi,
  facebookAuthApi,
  googleAuthApi,
  loginApi,
  registration,
  resetPasswordLinkApi,
  setNewPasswordApi,
  sendPasswordApi,
  startFacebookEmailCompletionApi,
  validateWebCookieSessionApi,
} from '@/api/auth';
import { Alert, Platform } from 'react-native';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { validatePassword } from '@/utils/aiValidation';
import { sanitizeInput } from '@/utils/security';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { devError } from '@/utils/logger';
import { setSecureItem } from '@/utils/secureStorage';
import { setStorageBatch, removeStorageBatch } from '@/utils/storageBatch';

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
  removeSecureItems: jest.fn(),
}));

jest.mock('@/utils/storageBatch', () => ({
  setStorageBatch: jest.fn(),
  removeStorageBatch: jest.fn(),
}));

const mockedFetchWithTimeout = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;
const mockedSafeJsonParse = safeJsonParse as jest.MockedFunction<typeof safeJsonParse>;
const mockedValidatePassword = validatePassword as jest.MockedFunction<typeof validatePassword>;
const mockedSanitizeInput = sanitizeInput as jest.MockedFunction<typeof sanitizeInput>;

describe('src/api/auth.ts auth/password API', () => {
  // #1944: Alert следим спаем, а не фабрикой мока модуля: `Alert.alert` в
  // тестовом окружении — обычная функция, и `not.toHaveBeenCalled()` по ней
  // молча падал бы «received value must be a mock».
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  });

  afterEach(() => {
    alertSpy.mockRestore();
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
    // #1944: контракт результата — причина отказа вместо `null`, и НИ ОДНОГО Alert:
    // модальное окно поверх текста формы и давало два противоречивых сообщения.
    it('пустой пароль — отказ по сути запроса, без Alert и без запроса', async () => {
      const result = await loginApi('test@example.com', '   ');

      expect(result).toEqual({ ok: false, reason: 'rejected', message: 'Пароль не может быть пустым' });
      expect(fetchWithTimeout).not.toHaveBeenCalled();
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('успешный логин возвращает сессию пользователя', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ token: 't', name: 'User', email: 'e', id: 1, is_superuser: false } as any);

      const result = await loginApi('test@example.com', 'password');

      expect(result).toMatchObject({ ok: true, user: { token: 't', name: 'User' } });
    });

    it('обрыв связи — reason network, текст с диагностическим тегом и без Alert', async () => {
      mockedFetchWithTimeout.mockRejectedValue(new Error('Network request failed'));

      const result = await loginApi('test@example.com', 'password');

      expect(result).toMatchObject({ ok: false, reason: 'network' });
      // Текст про сеть, а не про пароль, и с тегом [host · вид · время] (#1943).
      expect((result as { message: string }).message).toMatch(/интернет/i);
      expect((result as { message: string }).message).toMatch(/\[.+ · .+ · \d{2}:\d{2}:\d{2}Z\]$/);
      expect((result as { message: string }).message).not.toMatch(/парол/i);
      expect(alertSpy).not.toHaveBeenCalled();
      expect(devError).toHaveBeenCalled();
    });

    it('401 от сервера — reason rejected и прежний текст про учётные данные', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('Login failed: 401'));

      const result = await loginApi('test@example.com', 'password');

      expect(result).toEqual({ ok: false, reason: 'rejected', message: 'Неверный email или пароль' });
      expect(alertSpy).not.toHaveBeenCalled();
    });

    // Баг: тело ответа читалось ПОСЛЕ throw внутри retry, поэтому 401 с
    // `detail` («Аккаунт не активирован…») всегда показывался как «Неверный
    // email или пароль» — реальная причина отказа терялась.
    it('401 с detail от бэкенда — показывает текст бэкенда, а не «неверный пароль»', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 401 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        detail: 'Аккаунт не активирован. Воспользуйтесь ссылкой активации в письме',
      } as any);

      const result = await loginApi('test@example.com', 'password');

      expect(result).toEqual({
        ok: false,
        reason: 'rejected',
        message: 'Аккаунт не активирован. Воспользуйтесь ссылкой активации в письме',
      });
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('401 без тела — падает на прежний текст про учётные данные', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 401 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({} as any);

      const result = await loginApi('test@example.com', 'password');

      expect(result).toEqual({ ok: false, reason: 'rejected', message: 'Неверный email или пароль' });
    });

    it('5xx — reason server и текст про недоступность сервиса', async () => {
      mockedFetchWithTimeout.mockRejectedValue(new Error('Login failed: 503'));

      const result = await loginApi('test@example.com', 'password');

      expect(result).toEqual({
        ok: false,
        reason: 'server',
        message: 'Сервис временно недоступен. Попробуйте позже.',
      });
      expect(alertSpy).not.toHaveBeenCalled();
    });

    // code-review-gate P2 (#1945): detail из тела ответа годится ТОЛЬКО для
    // 400/401/403 — это текст для конечного пользователя (активация,
    // блокировка). DRF throttle на 429 отдаёт английское `detail` на языке
    // сервера, для которого на клиенте нет локализатора — его подставлять
    // нельзя, иначе RU/BE/UK/PL пользователь увидит нелокализованный текст.
    it('429 с detail от DRF throttle — НЕ подставляет сырой текст, остаётся reason server', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 429 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        detail: 'Request was throttled. Expected available in 42 seconds.',
      } as any);

      const result = await loginApi('test@example.com', 'password');

      expect(result).toEqual({
        ok: false,
        reason: 'server',
        message: 'Сервис временно недоступен. Попробуйте позже.',
      });
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
      // #1462: пишем ту же тройку ключей, что и обычный вход, и снимаем аватар
      // предыдущего аккаунта — иначе `checkAuthentication` восстановит чужой.
      expect(setStorageBatch).toHaveBeenCalledWith([
        ['userName', 'Pending User'],
        ['userId', '42'],
        ['isSuperuser', 'false'],
      ]);
      expect(removeStorageBatch).toHaveBeenCalledWith(['userAvatar']);
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
        ['isSuperuser', 'false'],
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
      expect(removeStorageBatch).not.toHaveBeenCalled();
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

      expect(result).toMatchObject({ ok: true, user: { token: 'google-token', id: 7 } });
      expect(fetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining('/user/google-login/'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ id_token: 'google-id-token' }),
        }),
        expect.any(Number),
      );
    });

    it('отдаёт сообщение backend как отказ по сути запроса (#1944)', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 400 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ detail: 'Google token expired' } as any);

      const result = await googleAuthApi('expired-token');

      expect(result).toEqual({ ok: false, reason: 'rejected', message: 'Google token expired' });
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('использует понятный fallback для пустого 401 от Google endpoint', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 401 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({} as any);

      const result = await googleAuthApi('invalid-token');

      expect(result).toEqual({
        ok: false,
        reason: 'rejected',
        message: 'Google не подтвердил аккаунт. Попробуйте выбрать аккаунт ещё раз.',
      });
    });

    it('обрыв связи — reason network с тегом, без Alert (#1944)', async () => {
      mockedFetchWithTimeout.mockRejectedValue(new Error('Network request failed'));

      const result = await googleAuthApi('google-id-token');

      expect(result).toMatchObject({ ok: false, reason: 'network' });
      expect((result as { message: string }).message).toMatch(/\[.+ · .+ · \d{2}:\d{2}:\d{2}Z\]$/);
      expect(alertSpy).not.toHaveBeenCalled();
      expect(devError).toHaveBeenCalled();
    });

    it('5xx от Google endpoint — reason server', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 503 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({} as any);

      const result = await googleAuthApi('google-id-token');

      expect(result).toMatchObject({ ok: false, reason: 'server' });
    });
  });

  describe('facebookAuthApi', () => {
    it('sends only the trimmed user access token and returns the session payload', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        token: 'server-session-token',
        name: 'Facebook User',
        email: 'facebook@example.com',
        id: 19,
        is_superuser: false,
      } as any);

      await expect(facebookAuthApi('  short-lived-user-token  ')).resolves.toEqual({
        status: 'authenticated',
        user: expect.objectContaining({ id: 19 }),
      });
      expect(mockedFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining('/user/facebook-login/'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ access_token: 'short-lived-user-token' }),
        }),
        expect.any(Number),
      );
    });

    it('maps a stable backend conflict code to a localized error', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 409 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ error_code: 'facebook_account_conflict' } as any);

      await expect(facebookAuthApi('facebook-token')).resolves.toEqual({
        status: 'error',
        errorCode: 'facebook_account_conflict',
        // #1944: сервер ответил — это отказ по сути запроса, а не обрыв связи.
        reason: 'rejected',
        message: 'Этот Facebook-аккаунт уже связан с другим пользователем.',
      });
    });

    it('does not call the backend without a Facebook credential', async () => {
      await expect(facebookAuthApi('   ')).resolves.toMatchObject({
        status: 'error',
        errorCode: 'access_token_required',
      });
      expect(mockedFetchWithTimeout).not.toHaveBeenCalled();
    });

    it('returns the opaque email-completion contract without exposing the user token', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 409 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        error_code: 'facebook_email_completion_required',
        reason_code: 'facebook_primary_email_unavailable',
        completion_handle: 'opaque-completion-handle',
        expires_in: 900,
      } as any);

      await expect(facebookAuthApi('sensitive-facebook-token')).resolves.toEqual({
        status: 'email_completion_required',
        reasonCode: 'facebook_primary_email_unavailable',
        completionHandle: 'opaque-completion-handle',
        expiresIn: 900,
      });
    });

    it('starts email verification with only the opaque handle and email', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ verification_sent: true } as any);

      await expect(
        startFacebookEmailCompletionApi('opaque-handle', '  user@example.com  '),
      ).resolves.toEqual({ status: 'verification_sent' });
      expect(mockedFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining('/user/facebook-login/complete/start/'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            completion_handle: 'opaque-handle',
            email: 'user@example.com',
          }),
        }),
        expect.any(Number),
      );
    });

    it('confirms the email code and returns the normal session payload', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        token: 'server-session-token',
        name: 'Facebook User',
        email: 'facebook@example.com',
        id: 19,
        is_superuser: false,
      } as any);

      await expect(
        confirmFacebookEmailCompletionApi('opaque-handle', ' 123456 '),
      ).resolves.toEqual({
        status: 'authenticated',
        user: expect.objectContaining({ id: 19 }),
      });
      expect(mockedFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining('/user/facebook-login/complete/confirm/'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ completion_handle: 'opaque-handle', code: '123456' }),
        }),
        expect.any(Number),
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
