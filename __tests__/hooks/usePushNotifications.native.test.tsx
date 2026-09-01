import { act, renderHook } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockNavigationState: { key?: string } | undefined = { key: 'root' };
let mockAuthState = { authReady: true, isAuthenticated: true };
let mockResponseListener:
  | ((response: { id: string; data: Record<string, unknown> }) => void)
  | null = null;
let mockReceivedListener:
  | ((payload: { title?: string; body?: string; data?: Record<string, unknown> }) => void)
  | null = null;
const mockGetInitialNotificationResponse = jest.fn();
const mockClearLastNotificationResponse = jest.fn();
const mockRequestAndRegister = jest.fn();
const mockSyncPushRegistration = jest.fn();
const mockRetryPending = jest.fn();
const mockActivatePushRegistrationSession = jest.fn();
let mockRotationAuthReady: (() => boolean) | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRootNavigationState: () => mockNavigationState,
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

jest.mock('@/stores/authStore', () => {
  const useAuthStore = Object.assign(
    (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
    { getState: () => mockAuthState },
  );
  return { useAuthStore };
});

jest.mock('@/services/notifications', () => ({
  addNotificationReceivedListener: jest.fn((listener) => {
    mockReceivedListener = listener;
    return jest.fn();
  }),
  addNotificationResponseListener: jest.fn((listener) => {
    mockResponseListener = listener;
    return jest.fn();
  }),
  clearBadge: jest.fn().mockResolvedValue(undefined),
  clearLastNotificationResponse: (...args: unknown[]) => mockClearLastNotificationResponse(...args),
  getInitialNotificationResponse: (...args: unknown[]) => mockGetInitialNotificationResponse(...args),
  setForegroundNotificationHandler: jest.fn(),
  setupNotificationChannels: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/pushRegistration.native', () => ({
  activatePushRegistrationSession: (...args: unknown[]) =>
    mockActivatePushRegistrationSession(...args),
  getPushRegistrationResult: jest.fn(() => ({
    status: 'notDetermined',
    permission: 'notDetermined',
    token: null,
    backendSynced: false,
  })),
  requestAndRegisterPushNotifications: (...args: unknown[]) => mockRequestAndRegister(...args),
  retryPendingPushRegistration: (...args: unknown[]) => mockRetryPending(...args),
  startPushTokenRotationSync: jest.fn((isReady) => {
    mockRotationAuthReady = isReady;
    return jest.fn();
  }),
  subscribePushRegistration: jest.fn(() => jest.fn()),
  syncPushRegistration: (...args: unknown[]) => mockSyncPushRegistration(...args),
}));

import { usePushNotifications } from '@/hooks/usePushNotifications.native';

const unsyncedResult = {
  status: 'notDetermined' as const,
  permission: 'notDetermined' as const,
  token: null,
  backendSynced: false,
};

describe('usePushNotifications native lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigationState = { key: 'root' };
    mockAuthState = { authReady: true, isAuthenticated: true };
    mockResponseListener = null;
    mockReceivedListener = null;
    mockRotationAuthReady = null;
    mockGetInitialNotificationResponse.mockResolvedValue(null);
    mockRequestAndRegister.mockResolvedValue(unsyncedResult);
    mockSyncPushRegistration.mockResolvedValue(unsyncedResult);
    mockRetryPending.mockResolvedValue(unsyncedResult);
  });

  it('performs only passive registration on authenticated mount', async () => {
    renderHook(() => usePushNotifications());
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSyncPushRegistration).toHaveBeenCalledTimes(1);
    expect(mockActivatePushRegistrationSession).toHaveBeenCalledTimes(1);
    expect(mockRequestAndRegister).not.toHaveBeenCalled();
  });

  it('keeps passive sync and rotation blocked until auth hydration is ready', async () => {
    mockAuthState = { authReady: false, isAuthenticated: true };
    renderHook(() => usePushNotifications());
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockActivatePushRegistrationSession).not.toHaveBeenCalled();
    expect(mockSyncPushRegistration).not.toHaveBeenCalled();
    expect(mockRotationAuthReady?.()).toBe(false);
  });

  it('routes a cold-start quest once after navigation is ready and dedupes replay', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    mockNavigationState = undefined;
    mockGetInitialNotificationResponse.mockResolvedValue({
      id: 'response-1',
      data: { screen: 'quest', city: 'krakow', questId: 'dragon' },
    });
    const { rerender } = renderHook(() => usePushNotifications());

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockPush).not.toHaveBeenCalled();

    mockNavigationState = { key: 'root' };
    rerender({});
    expect(mockPush).toHaveBeenCalledWith('/quests/krakow/dragon');

    act(() => {
      mockResponseListener?.({
        id: 'response-1',
        data: { screen: 'quest', city: 'krakow', questId: 'dragon' },
      });
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockClearLastNotificationResponse).toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it('allows a later local reminder that reuses its stable identifier', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    renderHook(() => usePushNotifications());

    act(() => {
      mockResponseListener?.({ id: 'quest-reminder-dragon', data: { url: '/quests/krakow/dragon' } });
    });
    nowSpy.mockReturnValue(2_001);
    act(() => {
      mockResponseListener?.({ id: 'quest-reminder-dragon', data: { url: '/quests/krakow/dragon' } });
    });

    expect(mockPush).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it('does not navigate on foreground receipt before the user taps', () => {
    const onNotificationReceived = jest.fn();
    renderHook(() => usePushNotifications({ onNotificationReceived }));

    act(() => {
      mockReceivedListener?.({
        title: 'New trip message',
        data: { screen: 'trip', tripId: 31 },
      });
    });

    expect(onNotificationReceived).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('exposes the explicit permission action without using it automatically', async () => {
    mockRequestAndRegister.mockResolvedValue({
      status: 'enabled',
      permission: 'enabled',
      token: 'ExponentPushToken[user-action]',
      backendSynced: true,
    });
    const { result } = renderHook(() => usePushNotifications());

    await expect(result.current.requestPermission()).resolves.toBe(
      'ExponentPushToken[user-action]',
    );
    expect(mockRequestAndRegister).toHaveBeenCalledTimes(1);
  });
});
