import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { resetAuthStoreForTests } from '@/stores/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginApi, logoutApi, resetPasswordLinkApi, setNewPasswordApi } from '@/api/auth';
import { Alert, Platform } from 'react-native';
import { getSecureItem, readSecureItem, setSecureItem, removeSecureItems } from '@/utils/secureStorage';
import { translate as i18nT } from '@/i18n';
import { getStorageBatch, setStorageBatch, removeStorageBatch } from '@/utils/storageBatch';
import { fetchUserProfile } from '@/api/user';

jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/api/auth', () => ({
  loginApi: jest.fn(),
  logoutApi: jest.fn(),
  resetPasswordLinkApi: jest.fn(),
  setNewPasswordApi: jest.fn(),
}));

jest.mock('@/utils/secureStorage', () => {
  const getSecureItem = jest.fn();
  return {
    getSecureItem,
    setSecureItem: jest.fn(),
    removeSecureItems: jest.fn(),
    readSecureItem: jest.fn(async (...args: unknown[]) => {
      try {
        return { value: await getSecureItem(...args), unavailable: false };
      } catch {
        return { value: null, unavailable: true };
      }
    }),
  };
});

jest.mock('@/utils/storageBatch', () => ({
  getStorageBatch: jest.fn(),
  setStorageBatch: jest.fn(),
  removeStorageBatch: jest.fn(),
}));

jest.mock('@/api/user', () => ({
  fetchUserProfile: jest.fn(),
  normalizeAvatar: (raw: unknown) => {
    const str = String(raw ?? '').trim();
    if (!str) return null;
    const lower = str.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return null;
    return str;
  },
}));

const TestComponent: React.FC<{ onContext?: (ctx: any) => void }> = ({ onContext }) => {
  const ctx = useAuth();
  React.useEffect(() => {
    onContext?.(ctx);
  }, [ctx, onContext]);
  return null;
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthStoreForTests();
    (AsyncStorage as any).__reset?.();
    (readSecureItem as jest.Mock).mockImplementation(async (...args: unknown[]) => {
      try {
        return { value: await (getSecureItem as jest.Mock)(...args), unavailable: false };
      } catch {
        return { value: null, unavailable: true };
      }
    });
  });

  const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  it('throws error when useAuth is used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow('useAuth must be used within an AuthProvider');
    consoleSpy.mockRestore();
  });

  it('initially unauthenticated when no token', async () => {
    (getSecureItem as jest.Mock).mockResolvedValueOnce(null);
    (getStorageBatch as jest.Mock).mockResolvedValueOnce({
      userId: null,
      userName: null,
      isSuperuser: null,
    });

    let contextValue: any;

    render(
      <AuthProvider>
        <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue.isAuthenticated).toBe(false);
      expect(contextValue.userId).toBeNull();
      expect(contextValue.username).toBe('');
      expect(contextValue.isSuperuser).toBe(false);
    });
  });

  it('on web waits for idle no longer than the 1000 ms «Timeout policy» cap before the auth check (#2020)', () => {
    const originalOS = Platform.OS;
    const requestIdleCallback = jest.fn((_callback: () => void, _options?: { timeout: number }) => 1);
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    Object.defineProperty(window, 'requestIdleCallback', { value: requestIdleCallback, writable: true, configurable: true });
    Object.defineProperty(window, 'cancelIdleCallback', { value: jest.fn(), writable: true, configurable: true });

    try {
      const { unmount } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // The header's sign-in state waits for this check.
      expect(requestIdleCallback).toHaveBeenCalledTimes(1);
      expect(requestIdleCallback.mock.calls[0][1]?.timeout).toBeLessThanOrEqual(1000);
      unmount();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
      delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
      delete (window as { cancelIdleCallback?: unknown }).cancelIdleCallback;
    }
  });

  it('sets authenticated state when token and storage data exist', async () => {
    (getSecureItem as jest.Mock).mockResolvedValueOnce('token-123');
    (getStorageBatch as jest.Mock).mockResolvedValueOnce({
      userId: '42',
      userName: 'John',
      isSuperuser: 'true',
    });

    // Avatar missing from storage → background fetch will be triggered
    (fetchUserProfile as jest.Mock).mockResolvedValueOnce({
      id: 1,
      first_name: 'John',
      last_name: '',
      avatar: 'https://example.com/avatar.webp',
      user: 42,
    });

    let contextValue: any;

    render(
      <AuthProvider>
        <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue.isAuthenticated).toBe(true);
      expect(contextValue.userId).toBe('42');
      expect(contextValue.username).toBe('John');
      expect(contextValue.isSuperuser).toBe(true);
    });

    // Avatar missing from storage → fetchUserProfile called in background
    await waitFor(() => {
      expect(fetchUserProfile).toHaveBeenCalledWith('42');
    });
  });

  it('resets auth state on checkAuthentication error', async () => {
    (getSecureItem as jest.Mock).mockResolvedValueOnce('token-123');
    (getStorageBatch as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    let contextValue: any;

    render(
      <AuthProvider>
        <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue.isAuthenticated).toBe(false);
      expect(contextValue.userId).toBeNull();
      expect(contextValue.username).toBe('');
      expect(contextValue.isSuperuser).toBe(false);
    });
  });

  it('does not collapse a Keychain outage into a silent guest session', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    (readSecureItem as jest.Mock).mockResolvedValueOnce({ value: null, unavailable: true });
    (getStorageBatch as jest.Mock).mockResolvedValueOnce({
      userId: '7',
      userName: 'Julia',
      isSuperuser: 'false',
      userAvatar: 'https://img/avatar.jpg',
    });

    let contextValue: any;

    render(
      <AuthProvider>
        <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue.isAuthenticated).toBe(true);
      expect(contextValue.userId).toBe('7');
      expect(contextValue.username).toBe('Julia');
    });
    expect(alertSpy).toHaveBeenCalledWith(
      i18nT('errorsStatic:api.auth.signInErrorTitle'),
      i18nT('errorsStatic:api.client.sessionExpired'),
    );
    alertSpy.mockRestore();
  });

  it('login success updates state and storage', async () => {
    (loginApi as jest.Mock).mockResolvedValueOnce({
      ok: true,
      user: {
        token: 'token-123',
        id: 7,
        name: 'User Name',
        email: 'user@example.com',
        is_superuser: true,
      },
    });

    // First call: background avatar fetch from checkAuthentication (no avatar in storage)
    (fetchUserProfile as jest.Mock).mockResolvedValueOnce({
      id: 78,
      first_name: 'User Name',
      last_name: '',
      avatar: null,
      user: 7,
    });

    // Second call: login fetches profile
    (fetchUserProfile as jest.Mock).mockResolvedValueOnce({
      id: 78,
      first_name: 'Юлия',
      last_name: '',
      youtube: '',
      instagram: '',
      twitter: '',
      vk: '',
      avatar: 'https://example.com/avatar.webp?X-Amz-Expires=3600',
      user: 7,
    });

    (getSecureItem as jest.Mock).mockResolvedValueOnce('token-123');
    (getStorageBatch as jest.Mock).mockResolvedValueOnce({
      userId: '7',
      userName: 'User Name',
      isSuperuser: 'true',
    });

    let contextValue: any;

    render(
      <AuthProvider>
        <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue).toBeDefined();
    });

    await act(async () => {
      const result = await contextValue.login('user@example.com', 'password');
      expect(result).toEqual({ ok: true });
    });

    expect(setSecureItem).toHaveBeenCalledWith('userToken', 'token-123');

    expect(fetchUserProfile).toHaveBeenCalledWith('7');
    expect(setStorageBatch).toHaveBeenLastCalledWith([
      ['userId', '7'],
      ['userName', 'Юлия'],
      ['isSuperuser', 'true'],
      ['userAvatar', 'https://example.com/avatar.webp?X-Amz-Expires=3600'],
    ]);

    expect(contextValue.isAuthenticated).toBe(true);
    expect(contextValue.userId).toBe('7');
    expect(contextValue.username).toBe('Юлия');
    expect(contextValue.isSuperuser).toBe(true);
    expect(contextValue.userAvatar).toBe('https://example.com/avatar.webp?X-Amz-Expires=3600');
  });

  it('fetches profile on provider mount to keep avatar fresh', async () => {
    (getSecureItem as jest.Mock).mockResolvedValueOnce('token-123');
    (getStorageBatch as jest.Mock).mockResolvedValueOnce({
      userId: '7',
      userName: 'Юлия',
      isSuperuser: 'false',
      userAvatar: 'https://example.com/avatar.webp?X-Amz-Expires=3600',
    });
    (fetchUserProfile as jest.Mock).mockResolvedValueOnce({
      avatar: 'https://example.com/avatar.webp?X-Amz-Expires=3600',
    });

    let contextValue: any;

    render(
      <AuthProvider>
        <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue.isAuthenticated).toBe(true);
      expect(contextValue.username).toBe('Юлия');
    });

    expect(fetchUserProfile).toHaveBeenCalledWith('7');
  });

  it('login failure keeps unauthenticated', async () => {
    // #1944: слой api отдаёт причину отказа, а не `null`.
    (loginApi as jest.Mock).mockResolvedValueOnce({
      ok: false,
      reason: 'rejected',
      message: 'Неверный email или пароль',
    });
    (getSecureItem as jest.Mock).mockResolvedValueOnce(null);
    (getStorageBatch as jest.Mock).mockResolvedValueOnce({});

    let contextValue: any;

    render(
      <AuthProvider>
        <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue).toBeDefined();
    });

    await act(async () => {
      const result = await contextValue.login('user@example.com', 'password');
      expect(result).toMatchObject({ ok: false, reason: 'rejected' });
    });

    expect(setSecureItem).not.toHaveBeenCalled();
    expect(setStorageBatch).not.toHaveBeenCalled();
    expect(contextValue.isAuthenticated).toBe(false);
  });

  it('logout clears storage and state even if api fails', async () => {
    (getSecureItem as jest.Mock).mockResolvedValueOnce('token-123');
    (getStorageBatch as jest.Mock).mockResolvedValueOnce({
      userId: '7',
      userName: 'User Name',
      isSuperuser: 'true',
    });

    (logoutApi as jest.Mock).mockRejectedValueOnce(new Error('network error'));

    let contextValue: any;

    render(
      <AuthProvider>
        <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue).toBeDefined();
    });

    await act(async () => {
      await contextValue.logout();
    });

    expect(removeSecureItems).toHaveBeenCalledWith(['userToken', 'refreshToken']);
    expect(removeStorageBatch).toHaveBeenCalledWith(['userName', 'isSuperuser', 'userId', 'userAvatar']);
    expect(contextValue.isAuthenticated).toBe(false);
    expect(contextValue.userId).toBeNull();
    expect(contextValue.username).toBe('');
    expect(contextValue.isSuperuser).toBe(false);
  });

  it('does not restore stale authenticated state if logout happens during initial auth check', async () => {
    const tokenDeferred = createDeferred<string | null>();
    const storageDeferred = createDeferred<any>();

    (getSecureItem as jest.Mock).mockReturnValueOnce(tokenDeferred.promise);
    (getStorageBatch as jest.Mock).mockReturnValueOnce(storageDeferred.promise);
    (logoutApi as jest.Mock).mockResolvedValueOnce(undefined);

    let contextValue: any;

    render(
      <AuthProvider>
        <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue).toBeDefined();
    });

    await act(async () => {
      await contextValue.logout();
    });

    await act(async () => {
      tokenDeferred.resolve('token-123');
      storageDeferred.resolve({
        userId: '7',
        userName: 'User Name',
        isSuperuser: 'true',
        userAvatar: null,
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(contextValue.isAuthenticated).toBe(false);
      expect(contextValue.userId).toBeNull();
      expect(contextValue.username).toBe('');
      expect(contextValue.isSuperuser).toBe(false);
    });
  });

  it('sendPassword returns success message from api', async () => {
    (getSecureItem as jest.Mock).mockResolvedValueOnce(null);
    (getStorageBatch as jest.Mock).mockResolvedValueOnce({});
    (resetPasswordLinkApi as jest.Mock).mockResolvedValueOnce('OK');

    let contextValue: any;

    render(
      <AuthProvider>
        <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue).toBeDefined();
    });

    const msg = await contextValue.sendPassword('user@example.com');
    expect(msg).toBe('OK');
  });

  it('sendPassword returns fallback message on error', async () => {
    (getSecureItem as jest.Mock).mockResolvedValueOnce(null);
    (getStorageBatch as jest.Mock).mockResolvedValueOnce({});
    (resetPasswordLinkApi as jest.Mock).mockRejectedValueOnce(new Error('fail'));

    let contextValue: any;

    render(
      <AuthProvider>
        <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue).toBeDefined();
    });

    const msg = await contextValue.sendPassword('user@example.com');
    expect(msg).toBe('Произошла ошибка. Попробуйте ещё раз.');
  });

  it('setNewPassword proxies to api', async () => {
    (getSecureItem as jest.Mock).mockResolvedValueOnce(null);
    (getStorageBatch as jest.Mock).mockResolvedValueOnce({});
    (setNewPasswordApi as jest.Mock).mockResolvedValueOnce(true);

    let contextValue: any;

    render(
      <AuthProvider>
        <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue).toBeDefined();
    });

    const result = await contextValue.setNewPassword('token', 'newpass');
    expect(result).toBe(true);
    expect(setNewPasswordApi).toHaveBeenCalledWith('token', 'newpass');
  });
});
