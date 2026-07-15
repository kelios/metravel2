import { act } from '@testing-library/react';
import { Platform } from 'react-native';

jest.mock('@/api/auth', () => ({
  loginApi: jest.fn(),
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

const {
  loginApi,
  logoutApi,
  resetPasswordLinkApi,
  setNewPasswordApi,
  validateWebCookieSessionApi,
} =
  require('@/api/auth') as {
    loginApi: jest.Mock;
    logoutApi: jest.Mock;
    resetPasswordLinkApi: jest.Mock;
    setNewPasswordApi: jest.Mock;
    validateWebCookieSessionApi: jest.Mock;
  };

const { getSecureItem, setSecureItem } = require('@/utils/secureStorage') as {
  getSecureItem: jest.Mock;
  setSecureItem: jest.Mock;
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
    it('setIsAuthenticated updates state', () => {
      act(() => useAuthStore.getState().setIsAuthenticated(true));
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('setUsername updates state', () => {
      act(() => useAuthStore.getState().setUsername('Alice'));
      expect(useAuthStore.getState().username).toBe('Alice');
    });

    it('setIsSuperuser updates state', () => {
      act(() => useAuthStore.getState().setIsSuperuser(true));
      expect(useAuthStore.getState().isSuperuser).toBe(true);
    });

    it('setUserId updates state', () => {
      act(() => useAuthStore.getState().setUserId('42'));
      expect(useAuthStore.getState().userId).toBe('42');
    });

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
