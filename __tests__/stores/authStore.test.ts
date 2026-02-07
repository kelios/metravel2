import { act } from '@testing-library/react';

jest.mock('@/api/auth', () => ({
  loginApi: jest.fn(),
  logoutApi: jest.fn(),
  resetPasswordLinkApi: jest.fn(),
  setNewPasswordApi: jest.fn(),
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
}));

const { loginApi, logoutApi, resetPasswordLinkApi, setNewPasswordApi } =
  require('@/api/auth') as {
    loginApi: jest.Mock;
    logoutApi: jest.Mock;
    resetPasswordLinkApi: jest.Mock;
    setNewPasswordApi: jest.Mock;
  };

const { getSecureItem } = require('@/utils/secureStorage') as {
  getSecureItem: jest.Mock;
};
const { getStorageBatch } = require('@/utils/storageBatch') as {
  getStorageBatch: jest.Mock;
};
const { fetchUserProfile } = require('@/api/user') as { fetchUserProfile: jest.Mock };

import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  jest.clearAllMocks();
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

      await act(() => useAuthStore.getState().checkAuthentication());

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

    it('normalizes avatar "null" string to null', async () => {
      getSecureItem.mockResolvedValue('tok');
      getStorageBatch.mockResolvedValue({
        userId: '1',
        userName: 'X',
        isSuperuser: 'false',
        userAvatar: 'null',
      });

      await act(() => useAuthStore.getState().checkAuthentication());
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
