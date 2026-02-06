import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginApi, logoutApi, resetPasswordLinkApi, setNewPasswordApi } from '@/api/auth';
import { getSecureItem, setSecureItem, removeSecureItems } from '@/utils/secureStorage';
import { getStorageBatch, setStorageBatch, removeStorageBatch } from '@/utils/storageBatch';
import { fetchUserProfile } from '@/api/user';

jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/api/auth', () => ({
  loginApi: jest.fn(),
  logoutApi: jest.fn(),
  resetPasswordLinkApi: jest.fn(),
  setNewPasswordApi: jest.fn(),
}));

jest.mock('@/utils/secureStorage', () => ({
  getSecureItem: jest.fn(),
  setSecureItem: jest.fn(),
  removeSecureItems: jest.fn(),
}));

jest.mock('@/utils/storageBatch', () => ({
  getStorageBatch: jest.fn(),
  setStorageBatch: jest.fn(),
  removeStorageBatch: jest.fn(),
}));

jest.mock('@/api/user', () => ({
  fetchUserProfile: jest.fn(),
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
    (AsyncStorage as any).__reset?.();
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

  it('sets authenticated state when token and storage data exist', async () => {
    (getSecureItem as jest.Mock).mockResolvedValueOnce('token-123');
    (getStorageBatch as jest.Mock).mockResolvedValueOnce({
      userId: '42',
      userName: 'John',
      isSuperuser: 'true',
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

    expect(fetchUserProfile).not.toHaveBeenCalled();
  });

  it('resets auth state on checkAuthentication error', async () => {
    (getSecureItem as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    (getStorageBatch as jest.Mock).mockResolvedValueOnce({});

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

  it('login success updates state and storage', async () => {
    (loginApi as jest.Mock).mockResolvedValueOnce({
      token: 'token-123',
      id: 7,
      name: 'User Name',
      email: 'user@example.com',
      is_superuser: true,
    });

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
      expect(result).toBe(true);
    });

    expect(setSecureItem).toHaveBeenCalledWith('userToken', 'token-123');

    expect(fetchUserProfile).toHaveBeenCalledWith('7');
    expect(setStorageBatch).toHaveBeenCalledWith([
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

  it('does not request profile on provider mount (only on login)', async () => {
    (getSecureItem as jest.Mock).mockResolvedValueOnce('token-123');
    (getStorageBatch as jest.Mock).mockResolvedValueOnce({
      userId: '7',
      userName: 'Юлия',
      isSuperuser: 'false',
      userAvatar: 'https://example.com/avatar.webp?X-Amz-Expires=3600',
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

    expect(fetchUserProfile).not.toHaveBeenCalled();
  });

  it('login failure keeps unauthenticated', async () => {
    (loginApi as jest.Mock).mockResolvedValueOnce(null);
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
      expect(result).toBe(false);
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
