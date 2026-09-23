import {
  confirmAccount,
  confirmFacebookEmailCompletionApi,
  facebookAuthApi,
  googleAuthApi,
  loginApi,
  registration,
  resetPasswordLinkApi,
  setNewPasswordApi,
  startFacebookEmailCompletionApi,
  validateWebCookieSessionApi,
} from '@/api/auth';
import { Alert, Platform } from 'react-native';
import { i18n } from '@/i18n';
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
    // #1946: причина по-прежнему доходит, но текстом ПРИЛОЖЕНИЯ (локализуемый
    // ключ), а не сырой русской строкой бэкенда.
    it('401 с detail «не активирован» — локализованный текст приложения про активацию', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 401 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        detail: 'Аккаунт не активирован. Воспользуйтесь ссылкой активации в письме',
      } as any);

      const result = await loginApi('test@example.com', 'password');

      expect(result).toEqual({
        ok: false,
        reason: 'rejected',
        message: 'Аккаунт не активирован. Воспользуйтесь ссылкой активации в письме.',
      });
      expect(alertSpy).not.toHaveBeenCalled();
    });

    // #1946: прод отдаёт обычный отказ по паролю в поле `error`, а не `detail`,
    // и ветка `detail ||` делала локализованный ключ недостижимым — EN/BE/UK/PL
    // получали русский текст сервера.
    it('401 с error «Данные входа не корректные» — локализованный ключ, а не строка бэкенда', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 401 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        error: 'Данные входа не корректные',
      } as any);

      const result = await loginApi('test@example.com', 'password');

      expect(result).toEqual({ ok: false, reason: 'rejected', message: 'Неверный email или пароль' });
      expect(alertSpy).not.toHaveBeenCalled();
    });

    // 400 от сериализатора DRF несёт технические тексты полей — их в форму
    // входа тоже не выводим.
    it('400 с произвольным message от бэкенда — локализованный текст про учётные данные', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 400 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        message: 'Enter a valid email address.',
      } as any);

      const result = await loginApi('test@example.com', 'password');

      expect(result).toEqual({ ok: false, reason: 'rejected', message: 'Неверный email или пароль' });
    });

    // #2042: бэкенд #1993 отдаёт причину отказа машиночитаемым `code`, а
    // активацию раскрывает только после проверки пароля. Текст выбирает `code`;
    // строка `error` рядом с ним — лишь fallback для старого бэкенда без `code`.
    describe('code причины отказа (#2042)', () => {
      const rejectWith = (body: Record<string, unknown>) => {
        mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 401 } as any);
        mockedSafeJsonParse.mockResolvedValueOnce(body as any);
      };

      it('неактивный аккаунт с неверным паролем (invalid_credentials) — общий отказ', async () => {
        rejectWith({ code: 'invalid_credentials', error: 'Неверная почта или пароль' });

        const result = await loginApi('inactive@example.com', 'wrong-password');

        expect(result).toEqual({ ok: false, reason: 'rejected', message: 'Неверный email или пароль' });
      });

      it('неизвестный email (invalid_credentials) — тот же общий отказ', async () => {
        rejectWith({ code: 'invalid_credentials', error: 'Неверная почта или пароль' });

        const result = await loginApi('nobody@example.com', 'password');

        expect(result).toEqual({ ok: false, reason: 'rejected', message: 'Неверный email или пароль' });
      });

      it('неактивный аккаунт с верным паролем (account_not_activated) — подсказка активации', async () => {
        rejectWith({
          code: 'account_not_activated',
          error: 'Аккаунт не активирован. Воспользуйтесь ссылкой активации в письме',
        });

        const result = await loginApi('inactive@example.com', 'correct-password');

        expect(result).toEqual({
          ok: false,
          reason: 'rejected',
          message: 'Аккаунт не активирован. Воспользуйтесь ссылкой активации в письме.',
        });
      });

      it('code invalid_credentials сильнее противоречащего текста «не активирован»', async () => {
        rejectWith({
          code: 'invalid_credentials',
          error: 'Аккаунт не активирован. Воспользуйтесь ссылкой активации в письме',
        });

        const result = await loginApi('test@example.com', 'password');

        expect(result).toEqual({ ok: false, reason: 'rejected', message: 'Неверный email или пароль' });
      });

      it('code account_not_activated сильнее противоречащего текста обычного отказа', async () => {
        rejectWith({ code: 'account_not_activated', error: 'Неверная почта или пароль' });

        const result = await loginApi('test@example.com', 'password');

        expect(result).toEqual({
          ok: false,
          reason: 'rejected',
          message: 'Аккаунт не активирован. Воспользуйтесь ссылкой активации в письме.',
        });
      });

      it('незнакомый code — общий отказ, а не подсказка активации по тексту', async () => {
        rejectWith({ code: 'account_locked', detail: 'Аккаунт не активирован' });

        const result = await loginApi('test@example.com', 'password');

        expect(result).toEqual({ ok: false, reason: 'rejected', message: 'Неверный email или пароль' });
      });
    });

    // #1946: регрессия #1945 наблюдалась ТОЛЬКО вне русской локали, и на RU её
    // не видно: тексты приложения и сервера там почти совпадают (различие —
    // точка в конце), поэтому утечка сырого ответа русскую проверку проходит.
    // Английская локаль делает разницу «ключ приложения против строки бэкенда»
    // однозначной.
    describe('на английской локали', () => {
      beforeEach(async () => {
        await i18n.changeLanguage('en');
      });

      afterEach(async () => {
        await i18n.changeLanguage('ru');
      });

      it('401 «не активирован» — английский текст приложения, а не русская строка сервера', async () => {
        mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 401 } as any);
        mockedSafeJsonParse.mockResolvedValueOnce({
          error: 'Аккаунт не активирован. Воспользуйтесь ссылкой активации в письме',
        } as any);

        const result = await loginApi('test@example.com', 'password');

        expect(result).toEqual({
          ok: false,
          reason: 'rejected',
          message: 'Your account is not activated yet. Use the activation link from the email we sent you.',
        });
        expect((result as { message: string }).message).not.toMatch(/[А-Яа-я]/);
      });

      it('401 account_not_activated — английская подсказка активации по code', async () => {
        mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 401 } as any);
        mockedSafeJsonParse.mockResolvedValueOnce({
          code: 'account_not_activated',
          error: 'Аккаунт не активирован. Воспользуйтесь ссылкой активации в письме',
        } as any);

        const result = await loginApi('test@example.com', 'password');

        expect(result).toEqual({
          ok: false,
          reason: 'rejected',
          message: 'Your account is not activated yet. Use the activation link from the email we sent you.',
        });
      });

      it('401 invalid_credentials — английский общий отказ, а не русская строка сервера', async () => {
        mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 401 } as any);
        mockedSafeJsonParse.mockResolvedValueOnce({
          code: 'invalid_credentials',
          error: 'Неверная почта или пароль',
        } as any);

        const result = await loginApi('test@example.com', 'password');

        expect(result).toEqual({ ok: false, reason: 'rejected', message: 'Invalid email or password' });
      });

      it('401 обычного отказа — английский текст приложения, а не русская строка сервера', async () => {
        mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 401 } as any);
        mockedSafeJsonParse.mockResolvedValueOnce({
          error: 'Данные входа не корректные',
        } as any);

        const result = await loginApi('test@example.com', 'password');

        expect(result).toEqual({
          ok: false,
          reason: 'rejected',
          message: 'Invalid email or password',
        });
        expect((result as { message: string }).message).not.toMatch(/[А-Яа-я]/);
      });
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

    // #1946: причина отказа по-прежнему `rejected` (#1944), но текст берётся из
    // i18n. Раньше выигрывал `payload.detail`, а `google_login` отдаёт только
    // англоязычную технику («Google token is invalid», «id_token is required»),
    // и русскоязычный пользователь видел её как сообщение об ошибке входа.
    it('4xx от Google endpoint — отказ по сути запроса с текстом приложения (#1946)', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 400 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ detail: 'Google token is invalid' } as any);

      const result = await googleAuthApi('expired-token');

      expect(result).toEqual({
        ok: false,
        reason: 'rejected',
        message: 'Не удалось войти через Google.',
      });
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('401 с технической строкой бэкенда — локализованный текст про аккаунт', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 401 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ error: 'Google email is not verified' } as any);

      const result = await googleAuthApi('unverified-token');

      expect(result).toEqual({
        ok: false,
        reason: 'rejected',
        message: 'Google не подтвердил аккаунт. Попробуйте выбрать аккаунт ещё раз.',
      });
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

      await expect(facebookAuthApi({
        kind: 'access_token',
        accessToken: '  short-lived-user-token  ',
      })).resolves.toEqual({
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

    it('sends the Limited Login OIDC token with the nonce of the attempt', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        token: 'server-session-token',
        name: 'Facebook User',
        email: 'facebook@example.com',
        id: 19,
        is_superuser: false,
      } as any);

      await expect(facebookAuthApi({
        kind: 'authentication_token',
        authenticationToken: '  limited-login-oidc-token  ',
        nonce: '  attempt-nonce  ',
      })).resolves.toEqual({
        status: 'authenticated',
        user: expect.objectContaining({ id: 19 }),
      });
      expect(mockedFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining('/user/facebook-login/'),
        expect.objectContaining({
          method: 'POST',
          // Ровно одна форма credential: access token в это тело не попадает.
          body: JSON.stringify({
            authentication_token: 'limited-login-oidc-token',
            nonce: 'attempt-nonce',
          }),
        }),
        expect.any(Number),
      );
    });

    it('maps a stable backend conflict code to a localized error', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 409 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ error_code: 'facebook_account_conflict' } as any);

      await expect(facebookAuthApi({ kind: 'access_token', accessToken: 'facebook-token' })).resolves.toEqual({
        status: 'error',
        errorCode: 'facebook_account_conflict',
        // #1944: сервер ответил — это отказ по сути запроса, а не обрыв связи.
        reason: 'rejected',
        message: 'Этот Facebook-аккаунт уже связан с другим пользователем.',
      });
    });

    it('does not call the backend without a Facebook credential', async () => {
      await expect(facebookAuthApi({ kind: 'access_token', accessToken: '   ' })).resolves.toMatchObject({
        status: 'error',
        errorCode: 'access_token_required',
      });
      // Limited Login без nonce — тот же отказ: сервер сверяет nonce с claim
      // токена, и запрос без него заведомо невалиден.
      await expect(facebookAuthApi({
        kind: 'authentication_token',
        authenticationToken: 'oidc-token',
        nonce: '   ',
      })).resolves.toMatchObject({
        status: 'error',
        errorCode: 'access_token_required',
      });
      await expect(facebookAuthApi({
        kind: 'authentication_token',
        authenticationToken: '  ',
        nonce: 'nonce-1',
      })).resolves.toMatchObject({
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

      await expect(facebookAuthApi({
        kind: 'access_token',
        accessToken: 'sensitive-facebook-token',
      })).resolves.toEqual({
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

  // #2042: бэкенд #1993 отвечает на любой корректный email одинаково — 200
  // `{code: "password_reset_requested", message: …}`, есть аккаунт или нет.
  // Успех и ошибку решает статус, а текст всегда свой, локализованный: сырая
  // строка сервера в форму не попадает (#1946).
  describe('resetPasswordLinkApi', () => {
    const NEUTRAL_RU =
      'Если аккаунт с такой почтой существует, мы отправили на неё письмо со ссылкой для сброса пароля.';
    const SERVER_ACK = {
      code: 'password_reset_requested',
      message: 'Если аккаунт с такой почтой существует, письмо отправлено.',
    };

    // Тело отдаём и через фабрику `safeJsonParse`: если реализация снова начнёт
    // читать и показывать `message`/`email[0]` сервера, тест это увидит.
    const respond = (status: number, body: unknown = {}) => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status } as any);
      mockedSafeJsonParse.mockImplementation(async () => body as any);
    };

    afterEach(() => {
      mockedSafeJsonParse.mockReset();
    });

    it('пустой email — отказ rejected без запроса к серверу', async () => {
      mockedSanitizeInput.mockReturnValueOnce('');

      await expect(resetPasswordLinkApi('   ')).resolves.toEqual({
        ok: false,
        reason: 'rejected',
        message: 'Email не может быть пустым',
      });
      expect(fetchWithTimeout).not.toHaveBeenCalled();
    });

    it('известный и неизвестный email — одинаковый нейтральный локализованный успех', async () => {
      respond(200, SERVER_ACK);
      const known = await resetPasswordLinkApi('known@example.com');
      respond(200, SERVER_ACK);
      const unknown = await resetPasswordLinkApi('unknown@example.com');

      expect(known).toEqual({ ok: true, message: NEUTRAL_RU });
      expect(unknown).toEqual(known);
      expect(known.message).not.toBe(SERVER_ACK.message);
    });

    it('успех старого бэкенда без code — та же нейтральная строка, а не его message', async () => {
      respond(200, { message: 'Ссылка для сброса пароля отправлена на почту' });

      await expect(resetPasswordLinkApi('user@example.com')).resolves.toEqual({ ok: true, message: NEUTRAL_RU });
    });

    it('400 некорректного email — локализованная ошибка, а не строка сервера', async () => {
      respond(400, { email: ['Введите правильный адрес электронной почты.'] });

      await expect(resetPasswordLinkApi('bad@')).resolves.toEqual({
        ok: false,
        reason: 'rejected',
        message: 'Введите корректный email',
      });
    });

    it('429 — reason server и текст про слишком частые попытки', async () => {
      respond(429, { detail: 'Request was throttled. Expected available in 42 seconds.' });

      await expect(resetPasswordLinkApi('user@example.com')).resolves.toEqual({
        ok: false,
        reason: 'server',
        message: 'Слишком много попыток. Попробуйте позже.',
      });
    });

    it('5xx — reason server и локализованный текст неудачной отправки', async () => {
      respond(502);

      await expect(resetPasswordLinkApi('user@example.com')).resolves.toEqual({
        ok: false,
        reason: 'server',
        message: 'Не удалось отправить инструкции по восстановлению пароля',
      });
    });

    it('обрыв связи — reason network с дружелюбным текстом', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('Network request failed'));

      const result = await resetPasswordLinkApi('user@example.com');

      expect(result).toMatchObject({ ok: false, reason: 'network' });
      expect(result.message).toMatch(/интернет/i);
    });

    describe('на английской локали', () => {
      beforeEach(async () => {
        await i18n.changeLanguage('en');
      });

      afterEach(async () => {
        await i18n.changeLanguage('ru');
      });

      it('успех — английская нейтральная строка без русского текста сервера', async () => {
        respond(200, SERVER_ACK);

        const result = await resetPasswordLinkApi('user@example.com');

        expect(result).toEqual({
          ok: true,
          message: "If an account with this email exists, we've sent a password reset link to that address.",
        });
        expect(result.message).not.toMatch(/[А-Яа-я]/);
      });

      it('400 — английская ошибка некорректного email', async () => {
        respond(400, { email: ['Введите правильный адрес электронной почты.'] });

        const result = await resetPasswordLinkApi('bad@');

        expect(result).toEqual({ ok: false, reason: 'rejected', message: 'Enter a correct email' });
      });
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

});
