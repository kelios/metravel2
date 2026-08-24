import { act } from '@testing-library/react';
import { Platform } from 'react-native';

jest.mock('@/api/appleAuth', () => ({
  appleAuthApi: jest.fn(),
}));

jest.mock('@/api/auth', () => ({
  loginApi: jest.fn(),
  facebookAuthApi: jest.fn(),
  startFacebookEmailCompletionApi: jest.fn(),
  confirmFacebookEmailCompletionApi: jest.fn(),
  logoutApi: jest.fn(),
  resetPasswordLinkApi: jest.fn(),
  setNewPasswordApi: jest.fn(),
  validateWebCookieSessionApi: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/utils/secureStorage', () => ({
  setSecureItem: jest.fn().mockResolvedValue(undefined),
  getSecureItem: jest.fn().mockResolvedValue(null),
  removeSecureItems: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/utils/storageBatch', () => ({
  getStorageBatch: jest.fn().mockResolvedValue({}),
  setStorageBatch: jest.fn().mockResolvedValue(undefined),
  removeStorageBatch: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/api/user', () => ({
  fetchUserProfile: jest.fn().mockResolvedValue(null),
  normalizeAvatar: (raw: unknown) => {
    const str = String(raw ?? '').trim();
    if (!str) return null;
    const lower = str.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return null;
    return str;
  },
}));

const { appleAuthApi } = require('@/api/appleAuth') as { appleAuthApi: jest.Mock };

const {
  loginApi,
  facebookAuthApi,
  startFacebookEmailCompletionApi,
  confirmFacebookEmailCompletionApi,
  logoutApi,
  resetPasswordLinkApi,
  setNewPasswordApi,
  validateWebCookieSessionApi,
} =
  require('@/api/auth') as {
    loginApi: jest.Mock;
    facebookAuthApi: jest.Mock;
    startFacebookEmailCompletionApi: jest.Mock;
    confirmFacebookEmailCompletionApi: jest.Mock;
    logoutApi: jest.Mock;
    resetPasswordLinkApi: jest.Mock;
    setNewPasswordApi: jest.Mock;
    validateWebCookieSessionApi: jest.Mock;
  };

const { getSecureItem, setSecureItem, removeSecureItems } = require('@/utils/secureStorage') as {
  getSecureItem: jest.Mock;
  setSecureItem: jest.Mock;
  removeSecureItems: jest.Mock;
};
const { getStorageBatch, removeStorageBatch, setStorageBatch } = require('@/utils/storageBatch') as {
  getStorageBatch: jest.Mock;
  removeStorageBatch: jest.Mock;
  setStorageBatch: jest.Mock;
};
const { fetchUserProfile } = require('@/api/user') as { fetchUserProfile: jest.Mock };

import { useAuthStore } from '@/stores/authStore';

const flushPromises = () => new Promise((r) => setTimeout(r, 0));
const originalPlatformOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  validateWebCookieSessionApi.mockResolvedValue(true);
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  // Reset store to initial state
  useAuthStore.setState({
    isAuthenticated: false,
    username: '',
    isSuperuser: false,
    userId: null,
    userAvatar: null,
    authReady: false,
    profileRefreshToken: 0,
  });
});

afterAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
});

describe('authStore', () => {
  describe('initial state', () => {
    it('should have correct defaults', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.username).toBe('');
      expect(state.isSuperuser).toBe(false);
      expect(state.userId).toBeNull();
      expect(state.userAvatar).toBeNull();
      expect(state.authReady).toBe(false);
    });
  });

  describe('setters', () => {
    // Сырые сеттеры identity (setIsAuthenticated/setUsername/setIsSuperuser/setUserId)
    // убраны из стора — они позволяли завести «залогинен без userId» и повторить #1462.
    // Осталась только смена аватара (инвариант личности не трогает). (#1470)
    it('setUserAvatar updates state', () => {
      act(() => useAuthStore.getState().setUserAvatar('https://img/a.jpg'));
      expect(useAuthStore.getState().userAvatar).toBe('https://img/a.jpg');
    });

    it('triggerProfileRefresh increments token', () => {
      const before = useAuthStore.getState().profileRefreshToken;
      act(() => useAuthStore.getState().triggerProfileRefresh());
      expect(useAuthStore.getState().profileRefreshToken).toBe(before + 1);
    });
  });

  describe('invalidateAuthState', () => {
    it('resets auth fields and sets authReady', () => {
      useAuthStore.setState({ isAuthenticated: true, userId: '1', username: 'Bob' });
      act(() => useAuthStore.getState().invalidateAuthState());
      const s = useAuthStore.getState();
      expect(s.isAuthenticated).toBe(false);
      expect(s.userId).toBeNull();
      expect(s.username).toBe('');
      expect(s.authReady).toBe(true);
    });
  });

  // #1462: подтверждение почты входит в сессию мимо login/checkAuthentication.
  describe('applyConfirmedAccountSession', () => {
    it('заполняет userId и имя, а не только флаг авторизации', () => {
      act(() => useAuthStore.getState().applyConfirmedAccountSession({ userId: 77, userName: 'Ирина' }));
      const s = useAuthStore.getState();
      expect(s.isAuthenticated).toBe(true);
      expect(s.userId).toBe('77');
      expect(s.username).toBe('Ирина');
      expect(s.authReady).toBe(true);
    });

    it('не наследует личность предыдущего аккаунта на общем устройстве', () => {
      useAuthStore.setState({
        isAuthenticated: true,
        userId: '1',
        username: 'Bob',
        isSuperuser: true,
        userAvatar: 'https://img/bob.jpg',
        isPremium: true,
      });

      act(() => useAuthStore.getState().applyConfirmedAccountSession({ userId: '77' }));

      const s = useAuthStore.getState();
      expect(s.userId).toBe('77');
      expect(s.username).toBe('');
      expect(s.isSuperuser).toBe(false);
      expect(s.userAvatar).toBeNull();
      expect(s.isPremium).toBe(false);
    });

    it('проверка авторизации, стартовавшая до подтверждения, не разлогинивает', async () => {
      // checkAuthentication читает storage ещё без нового userId и завершается
      // ПОСЛЕ подтверждения: без смены эпохи её ответ затёр бы свежую сессию.
      getSecureItem.mockResolvedValue(null);
      let releaseCheck: (() => void) | undefined;
      getStorageBatch.mockImplementation(
        () => new Promise((resolve) => {
          releaseCheck = () => resolve({});
        }),
      );

      let checking: Promise<void> | undefined;
      await act(async () => {
        checking = useAuthStore.getState().checkAuthentication();
        await flushPromises();
      });

      act(() => useAuthStore.getState().applyConfirmedAccountSession({ userId: '77', userName: 'Ирина' }));

      await act(async () => {
        releaseCheck?.();
        await checking;
        await flushPromises();
      });

      const s = useAuthStore.getState();
      expect(s.isAuthenticated).toBe(true);
      expect(s.userId).toBe('77');
    });
  });

  describe('checkAuthentication', () => {
    it('sets authenticated when token exists', async () => {
      getSecureItem.mockResolvedValue('tok123');
      getStorageBatch.mockResolvedValue({
        userId: '7',
        userName: 'Julia',
        isSuperuser: 'false',
        userAvatar: 'https://img/avatar.jpg',
      });
      fetchUserProfile.mockResolvedValue({ avatar: 'https://img/avatar.jpg' });

      await act(async () => {
        await useAuthStore.getState().checkAuthentication();
        await flushPromises();
      });

      const s = useAuthStore.getState();
      expect(s.isAuthenticated).toBe(true);
      expect(s.userId).toBe('7');
      expect(s.username).toBe('Julia');
      expect(s.isSuperuser).toBe(false);
      expect(s.userAvatar).toBe('https://img/avatar.jpg');
      expect(s.authReady).toBe(true);
    });

    it('sets unauthenticated when no token', async () => {
      getSecureItem.mockResolvedValue(null);

      await act(() => useAuthStore.getState().checkAuthentication());

      const s = useAuthStore.getState();
      expect(s.isAuthenticated).toBe(false);
      expect(s.authReady).toBe(true);
    });

    it('validates a web HttpOnly-cookie session without reading a JS token', async () => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
      getStorageBatch.mockResolvedValue({
        userId: '7',
        userName: 'Julia',
        isSuperuser: 'false',
        userAvatar: null,
      });
      fetchUserProfile.mockResolvedValue({
        first_name: 'Julia',
        avatar: null,
        is_premium: true,
      });

      await act(async () => {
        await useAuthStore.getState().checkAuthentication();
      });

      expect(getSecureItem).not.toHaveBeenCalled();
      expect(validateWebCookieSessionApi).toHaveBeenCalledTimes(1);
      expect(fetchUserProfile).toHaveBeenCalledWith('7');
      expect(useAuthStore.getState()).toEqual(
        expect.objectContaining({
          isAuthenticated: true,
          userId: '7',
          isPremium: true,
        }),
      );
    });

    it('fails closed when stale web metadata has no active cookie session', async () => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
      getStorageBatch.mockResolvedValue({
        userId: '7',
        userName: 'Julia',
        isSuperuser: 'false',
        userAvatar: null,
      });
      validateWebCookieSessionApi.mockResolvedValue(false);

      await act(async () => {
        await useAuthStore.getState().checkAuthentication();
      });

      expect(fetchUserProfile).not.toHaveBeenCalled();
      expect(removeStorageBatch).toHaveBeenCalledWith([
        'userName',
        'isSuperuser',
        'userId',
        'userAvatar',
      ]);
      expect(useAuthStore.getState()).toEqual(
        expect.objectContaining({
          isAuthenticated: false,
          userId: null,
        }),
      );
    });

    it('normalizes avatar "null" string to null', async () => {
      getSecureItem.mockResolvedValue('tok');
      getStorageBatch.mockResolvedValue({
        userId: '1',
        userName: 'X',
        isSuperuser: 'false',
        userAvatar: 'null',
      });
      fetchUserProfile.mockResolvedValue(null);

      await act(async () => {
        await useAuthStore.getState().checkAuthentication();
        await flushPromises();
      });
      expect(useAuthStore.getState().userAvatar).toBeNull();
    });

    it('handles storage errors gracefully', async () => {
      getSecureItem.mockRejectedValue(new Error('storage fail'));

      await act(() => useAuthStore.getState().checkAuthentication());

      const s = useAuthStore.getState();
      expect(s.isAuthenticated).toBe(false);
      expect(s.authReady).toBe(true);
    });
  });

  describe('login', () => {
    it('returns true and sets state on success', async () => {
      loginApi.mockResolvedValue({
        token: 'abc',
        id: 5,
        name: 'Julia',
        email: 'j@test.com',
        is_superuser: false,
      });
      fetchUserProfile.mockResolvedValue({ first_name: 'Юлия', avatar: 'https://img/a.jpg' });

      const result = await act(() => useAuthStore.getState().login('j@test.com', 'pass'));

      expect(result).toBe(true);
      const s = useAuthStore.getState();
      expect(s.isAuthenticated).toBe(true);
      expect(s.userId).toBe('5');
      expect(s.username).toBe('Юлия');
      expect(s.userAvatar).toBe('https://img/a.jpg');
    });

    it('sanitizes profile URL values before persisting the display name', async () => {
      loginApi.mockResolvedValue({
        token: 'abc',
        id: 5,
        name: 'https://metravel.by/profile',
        email: 'j@test.com',
        is_superuser: false,
      });
      fetchUserProfile.mockResolvedValue({
        first_name: 'https://metravel.by/Julia',
        last_name: 'https://metravel.by/Sauran',
        avatar: null,
      });

      const result = await act(() => useAuthStore.getState().login('j@test.com', 'pass'));

      expect(result).toBe(true);
      expect(useAuthStore.getState().username).toBe('Julia Sauran');
      expect(setStorageBatch).toHaveBeenCalledWith([
        ['userId', '5'],
        ['userName', 'Julia Sauran'],
        ['isSuperuser', 'false'],
      ]);
    });

    it('does not persist access or refresh tokens on web login', async () => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
      loginApi.mockResolvedValue({
        token: 'must-not-be-stored',
        refresh: 'must-not-be-stored-either',
        id: 5,
        name: 'Julia',
        email: 'j@test.com',
        is_superuser: false,
      });
      fetchUserProfile.mockResolvedValue({ first_name: 'Julia', avatar: null });

      await expect(useAuthStore.getState().login('j@test.com', 'pass')).resolves.toBe(true);

      expect(setSecureItem).not.toHaveBeenCalled();
    });

    it('returns false when loginApi returns null', async () => {
      loginApi.mockResolvedValue(null);

      const result = await act(() => useAuthStore.getState().login('x@x.com', 'wrong'));
      expect(result).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('returns false on error', async () => {
      loginApi.mockRejectedValue(new Error('network'));

      const result = await act(() => useAuthStore.getState().login('x@x.com', 'p'));
      expect(result).toBe(false);
    });

    it('falls back to email when profile has no first_name', async () => {
      loginApi.mockResolvedValue({
        token: 'abc',
        id: 1,
        name: '',
        email: 'test@test.com',
        is_superuser: false,
      });
      fetchUserProfile.mockResolvedValue({ first_name: '', avatar: null });

      await act(() => useAuthStore.getState().login('test@test.com', 'p'));
      expect(useAuthStore.getState().username).toBe('test@test.com');
    });

    it('подтверждение почты во время in-flight логина не стирает свежую сессию (#1469)', async () => {
      // Подтверждение почты в той же вкладке уже записало свои креды под теми же
      // storage-ключами и сдвинуло epoch, пока логин ждал профиль. Проигравший гонку
      // логин не должен их откатить, иначе после reload пользователь окажется гостем.
      loginApi.mockResolvedValue({
        token: 'login-token',
        id: 5,
        name: 'Логин',
        email: 'login@example.com',
        is_superuser: false,
      });
      fetchUserProfile.mockImplementationOnce(async () => {
        useAuthStore.getState().applyConfirmedAccountSession({ userId: '77', userName: 'Ирина' });
        return null;
      });

      await expect(useAuthStore.getState().login('login@example.com', 'pass')).resolves.toBe(false);

      // Стереть креды подтверждённой сессии мог бы только откат — а он единственный
      // путь к удалению этих ключей. Он пропущен: ни secure-токены, ни identity-ключи
      // storage не удалялись, поэтому записанная подтверждением сессия на диске цела.
      // (Парный тест ниже доказывает, что при реальном logout эти же удаления срабатывают.)
      expect(removeSecureItems).not.toHaveBeenCalled();
      expect(removeStorageBatch).not.toHaveBeenCalled();
      const s = useAuthStore.getState();
      expect(s.isAuthenticated).toBe(true);
      expect(s.userId).toBe('77');
      expect(s.username).toBe('Ирина');
    });

    it('logout во время in-flight логина по-прежнему полностью откатывает креды', async () => {
      // Регресс #1462/#1469: при реальной разлогинке epoch тоже меняется, и откат
      // обязан очистить и secure-токены, и storage-ключи наполовину записанной сессии.
      loginApi.mockResolvedValue({
        token: 'login-token',
        id: 5,
        name: 'Логин',
        email: 'login@example.com',
        is_superuser: false,
      });
      fetchUserProfile.mockImplementationOnce(async () => {
        useAuthStore.getState().invalidateAuthState();
        return null;
      });

      await expect(useAuthStore.getState().login('login@example.com', 'pass')).resolves.toBe(false);

      expect(removeSecureItems).toHaveBeenCalledWith(['userToken', 'refreshToken']);
      expect(removeStorageBatch).toHaveBeenCalledWith(['userName', 'isSuperuser', 'userId', 'userAvatar']);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('loginWithApple', () => {
    const appleCredential = {
      identityToken: 'apple-identity-token',
      authorizationCode: 'one-time-code',
      givenName: 'Apple',
      familyName: 'User',
    };

    it('кладёт сессию в Keychain и поднимает состояние', async () => {
      appleAuthApi.mockResolvedValue({
        status: 'authenticated',
        user: {
          token: 'apple-session-token',
          refresh: 'apple-refresh',
          id: 77,
          name: 'Apple User',
          email: 'apple@example.com',
          is_superuser: false,
        },
      });
      fetchUserProfile.mockResolvedValue({ first_name: 'Apple', last_name: 'User', avatar: null });

      await expect(useAuthStore.getState().loginWithApple(appleCredential)).resolves.toMatchObject({
        status: 'authenticated',
      });

      expect(appleAuthApi).toHaveBeenCalledWith(appleCredential);
      expect(setSecureItem).toHaveBeenCalledWith('userToken', 'apple-session-token');
      expect(setSecureItem).toHaveBeenCalledWith('refreshToken', 'apple-refresh');
      expect(useAuthStore.getState()).toEqual(expect.objectContaining({
        isAuthenticated: true,
        userId: '77',
        username: 'Apple User',
      }));
    });

    it('на ошибке сервера не оставляет частичную сессию', async () => {
      appleAuthApi.mockResolvedValue({
        status: 'error',
        errorCode: 'apple_account_disabled',
        message: 'disabled',
      });

      await expect(useAuthStore.getState().loginWithApple(appleCredential)).resolves.toMatchObject({
        status: 'error',
        errorCode: 'apple_account_disabled',
      });

      expect(setSecureItem).not.toHaveBeenCalled();
      expect(setStorageBatch).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('logout во время входа откатывает записанные креды', async () => {
      appleAuthApi.mockResolvedValue({
        status: 'authenticated',
        user: {
          token: 'apple-session-token',
          id: 77,
          name: 'Apple User',
          email: 'apple@example.com',
          is_superuser: false,
        },
      });
      // Профиль резолвится уже после того, как параллельный logout сдвинул epoch.
      fetchUserProfile.mockImplementationOnce(async () => {
        useAuthStore.getState().invalidateAuthState();
        return null;
      });

      await expect(useAuthStore.getState().loginWithApple(appleCredential)).resolves.toMatchObject({
        status: 'error',
      });

      expect(removeSecureItems).toHaveBeenCalledWith(['userToken', 'refreshToken']);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('подтверждение почты во время соц-входа не стирает свежую сессию (#1469)', async () => {
      // Тот же гард на общем пути applySocialSession (Google/Facebook/Apple):
      // проигравший гонку соц-вход не откатывает креды подтверждённой сессии.
      appleAuthApi.mockResolvedValue({
        status: 'authenticated',
        user: {
          token: 'apple-session-token',
          id: 77,
          name: 'Apple User',
          email: 'apple@example.com',
          is_superuser: false,
        },
      });
      fetchUserProfile.mockImplementationOnce(async () => {
        useAuthStore.getState().applyConfirmedAccountSession({ userId: '99', userName: 'Ирина' });
        return null;
      });

      await expect(useAuthStore.getState().loginWithApple(appleCredential)).resolves.toMatchObject({
        status: 'error',
      });

      expect(removeSecureItems).not.toHaveBeenCalled();
      expect(removeStorageBatch).not.toHaveBeenCalled();
      const s = useAuthStore.getState();
      expect(s.isAuthenticated).toBe(true);
      expect(s.userId).toBe('99');
    });

    it('исключение внутри адаптера не роняет вход', async () => {
      appleAuthApi.mockRejectedValue(new Error('boom'));

      await expect(useAuthStore.getState().loginWithApple(appleCredential)).resolves.toMatchObject({
        status: 'error',
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('loginWithFacebook', () => {
    it('uses the server session payload and never persists a Facebook credential on web', async () => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
      facebookAuthApi.mockResolvedValue({
        status: 'authenticated',
        user: {
          token: 'server-cookie-mirror',
          id: 91,
          name: 'Facebook User',
          email: 'facebook@example.com',
          is_superuser: false,
        },
      });
      fetchUserProfile.mockResolvedValue({ first_name: 'Facebook', last_name: 'User', avatar: null });

      await expect(useAuthStore.getState().loginWithFacebook('short-lived-facebook-token')).resolves.toMatchObject({
        status: 'authenticated',
      });

      expect(facebookAuthApi).toHaveBeenCalledWith('short-lived-facebook-token');
      expect(setSecureItem).not.toHaveBeenCalled();
      expect(useAuthStore.getState()).toEqual(expect.objectContaining({
        isAuthenticated: true,
        userId: '91',
        username: 'Facebook User',
      }));
    });

    it('keeps completion state unauthenticated and does not persist it', async () => {
      facebookAuthApi.mockResolvedValue({
        status: 'email_completion_required',
        completionHandle: 'opaque-handle',
        reasonCode: 'facebook_primary_email_unavailable',
        expiresIn: 900,
      });

      await expect(useAuthStore.getState().loginWithFacebook('valid-no-email')).resolves.toMatchObject({
        status: 'email_completion_required',
        completionHandle: 'opaque-handle',
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(setStorageBatch).not.toHaveBeenCalled();
    });

    it('starts completion and finalizes the confirmed session through the shared path', async () => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
      startFacebookEmailCompletionApi.mockResolvedValue({ status: 'verification_sent' });
      confirmFacebookEmailCompletionApi.mockResolvedValue({
        status: 'authenticated',
        user: {
          token: 'server-cookie-mirror',
          id: 92,
          name: 'Completed Facebook User',
          email: 'completed@example.com',
          is_superuser: false,
        },
      });
      // resolveAuthDisplayName предпочитает имя профиля серверному user.name —
      // мок профиля должен складываться в ожидаемый username
      fetchUserProfile.mockResolvedValue({ first_name: 'Completed', last_name: 'Facebook User', avatar: null });

      await expect(
        useAuthStore.getState().startFacebookEmailCompletion('opaque-handle', 'completed@example.com'),
      ).resolves.toEqual({ status: 'verification_sent' });
      await expect(
        useAuthStore.getState().confirmFacebookEmailCompletion('opaque-handle', '123456'),
      ).resolves.toMatchObject({ status: 'authenticated' });

      expect(useAuthStore.getState()).toEqual(expect.objectContaining({
        isAuthenticated: true,
        userId: '92',
        username: 'Completed Facebook User',
      }));
      expect(setSecureItem).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears auth state', async () => {
      useAuthStore.setState({ isAuthenticated: true, userId: '1', username: 'X' });

      logoutApi.mockResolvedValue(undefined);

      await act(() => useAuthStore.getState().logout());

      const s = useAuthStore.getState();
      expect(s.isAuthenticated).toBe(false);
      expect(s.userId).toBeNull();
    });

    it('still clears state even if logoutApi fails', async () => {
      useAuthStore.setState({ isAuthenticated: true, userId: '1' });
      logoutApi.mockRejectedValue(new Error('server down'));

      await act(() => useAuthStore.getState().logout());
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('sendPassword', () => {
    it('returns server message on success', async () => {
      resetPasswordLinkApi.mockResolvedValue('Ссылка отправлена');

      const result = await useAuthStore.getState().sendPassword('a@b.com');
      expect(result).toBe('Ссылка отправлена');
    });

    it('returns fallback message when response is not a string', async () => {
      resetPasswordLinkApi.mockResolvedValue({ ok: true });

      const result = await useAuthStore.getState().sendPassword('a@b.com');
      expect(result).toBe('Что-то пошло не так. Попробуйте снова.');
    });

    it('returns error message on failure', async () => {
      resetPasswordLinkApi.mockRejectedValue(new Error('fail'));

      const result = await useAuthStore.getState().sendPassword('a@b.com');
      expect(result).toBe('Произошла ошибка. Попробуйте ещё раз.');
    });
  });

  describe('setNewPassword', () => {
    it('delegates to setNewPasswordApi', async () => {
      setNewPasswordApi.mockResolvedValue(true);

      const result = await useAuthStore.getState().setNewPassword('tok', 'newpass');
      expect(result).toBe(true);
      expect(setNewPasswordApi).toHaveBeenCalledWith('tok', 'newpass');
    });
  });
});
