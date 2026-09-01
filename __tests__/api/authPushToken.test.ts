import { Platform } from 'react-native';

const mockFetchWithTimeout = jest.fn();
const mockGetSecureItem = jest.fn();
const mockDevWarn = jest.fn();

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));

jest.mock('@/utils/secureStorage', () => ({
  getSecureItem: (...args: unknown[]) => mockGetSecureItem(...args),
}));

jest.mock('@/utils/authPlatform', () => ({
  ACCESS_TOKEN_STORAGE_KEY: 'userToken',
  getApiRequestCredentials: () => ({}),
  hasUsableAuthCredential: (value: unknown) => typeof value === 'string' && value.length > 0,
  shouldUseStoredAuthToken: () => true,
}));

jest.mock('@/utils/csrf', () => ({ getCsrfHeader: () => ({}) }));
jest.mock('@/utils/logger', () => ({
  devError: jest.fn(),
  devWarn: (...args: unknown[]) => mockDevWarn(...args),
}));

import { deletePushTokenApi, registerPushTokenApi } from '@/api/auth';

describe('push-token API adapter', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockGetSecureItem.mockResolvedValue('session-secret');
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  });

  it.each([
    ['POST', registerPushTokenApi],
    ['DELETE', deletePushTokenApi],
  ])('sends %s with the authenticated iOS payload', async (method, operation) => {
    await expect(operation('ExponentPushToken[device]')).resolves.toBe(true);

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      expect.stringMatching(/\/user\/push-token\/$/),
      expect.objectContaining({
        method,
        headers: expect.objectContaining({
          Authorization: 'Token session-secret',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          push_token: 'ExponentPushToken[device]',
          platform: 'ios',
        }),
      }),
      expect.any(Number),
    );
  });

  it.each([
    ['register', registerPushTokenApi],
    ['unregister', deletePushTokenApi],
  ])('fails closed without logging the token when %s is unavailable', async (_label, operation) => {
    mockFetchWithTimeout.mockRejectedValue(new Error('offline'));

    await expect(operation('ExponentPushToken[sensitive]')).resolves.toBe(false);

    expect(mockDevWarn).toHaveBeenCalledWith(expect.stringMatching(/Push token .* unavailable/));
    expect(mockDevWarn.mock.calls.flat().join(' ')).not.toContain('ExponentPushToken');
  });
});
