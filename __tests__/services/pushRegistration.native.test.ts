const storage = new Map<string, string>();
const mockGetItem = jest.fn(async (key: string) => storage.get(key) ?? null);
const mockSetItem = jest.fn(async (key: string, value: string) => {
  storage.set(key, value);
});
const mockRemoveItem = jest.fn(async (key: string) => {
  storage.delete(key);
});
const mockNetInfoFetch = jest.fn();
const mockRegisterPushTokenApi = jest.fn();
const mockDeletePushTokenApi = jest.fn();
const mockInspectPermission = jest.fn();
const mockRequestPermission = jest.fn();
const mockGetPushToken = jest.fn();
let mockRotationHandler: ((token: string) => void | Promise<void>) | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: Parameters<typeof mockGetItem>) => mockGetItem(...args),
    setItem: (...args: Parameters<typeof mockSetItem>) => mockSetItem(...args),
    removeItem: (...args: Parameters<typeof mockRemoveItem>) => mockRemoveItem(...args),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: (...args: unknown[]) => mockNetInfoFetch(...args),
  },
}));

jest.mock('@/api/auth', () => ({
  registerPushTokenApi: (...args: unknown[]) => mockRegisterPushTokenApi(...args),
  deletePushTokenApi: (...args: unknown[]) => mockDeletePushTokenApi(...args),
}));

jest.mock('@/services/notifications', () => ({
  __esModule: true,
  addPushTokenRotationListener: jest.fn((handler) => {
    mockRotationHandler = handler;
    return jest.fn();
  }),
  getPushNotificationToken: (...args: unknown[]) => mockGetPushToken(...args),
  inspectNotificationPermission: (...args: unknown[]) => mockInspectPermission(...args),
  isNotificationPermissionAllowed: (state: string) =>
    state === 'enabled' || state === 'provisional',
  requestNotificationPermission: (...args: unknown[]) => mockRequestPermission(...args),
}));

import {
  __resetPushRegistrationForTests,
  activatePushRegistrationSession,
  getPushRegistrationResult,
  requestAndRegisterPushNotifications,
  retryPendingPushRegistration,
  startPushTokenRotationSync,
  syncPushRegistration,
  unregisterPushBeforeLogout,
} from '@/services/pushRegistration.native';

describe('native push registration lifecycle', () => {
  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    mockRotationHandler = null;
    mockNetInfoFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    mockInspectPermission.mockResolvedValue('enabled');
    mockRequestPermission.mockResolvedValue('enabled');
    mockGetPushToken.mockResolvedValue('ExponentPushToken[current]');
    mockRegisterPushTokenApi.mockResolvedValue(true);
    mockDeletePushTokenApi.mockResolvedValue(true);
    __resetPushRegistrationForTests();
    activatePushRegistrationSession();
  });

  it('registers after passive permission inspection without opening the prompt', async () => {
    await expect(syncPushRegistration()).resolves.toEqual({
      status: 'enabled',
      permission: 'enabled',
      token: 'ExponentPushToken[current]',
      backendSynced: true,
    });

    expect(mockInspectPermission).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockRegisterPushTokenApi).toHaveBeenCalledWith('ExponentPushToken[current]');
    expect(storage.get('pushRegistration.registeredToken')).toBe('ExponentPushToken[current]');
  });

  it('requests permission only through the explicit user-action entry point', async () => {
    mockRequestPermission.mockResolvedValue('provisional');

    await expect(requestAndRegisterPushNotifications()).resolves.toMatchObject({
      status: 'provisional',
      backendSynced: true,
    });

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockInspectPermission).not.toHaveBeenCalled();
  });

  it('persists an offline token and retries it after connectivity returns', async () => {
    mockNetInfoFetch
      .mockResolvedValueOnce({ isConnected: false, isInternetReachable: false })
      .mockResolvedValue({ isConnected: true, isInternetReachable: true });

    await expect(syncPushRegistration()).resolves.toMatchObject({
      status: 'offline',
      token: 'ExponentPushToken[current]',
      backendSynced: false,
    });
    expect(mockRegisterPushTokenApi).not.toHaveBeenCalled();
    expect(storage.get('pushRegistration.pendingToken')).toBe('ExponentPushToken[current]');

    await expect(retryPendingPushRegistration()).resolves.toMatchObject({
      status: 'enabled',
      backendSynced: true,
    });
    expect(mockGetPushToken).toHaveBeenCalledTimes(1);
    expect(mockRegisterPushTokenApi).toHaveBeenCalledWith('ExponentPushToken[current]');
    expect(storage.has('pushRegistration.pendingToken')).toBe(false);
  });

  it('reports an online backend failure as unavailable without fake success', async () => {
    mockRegisterPushTokenApi.mockResolvedValue(false);

    await expect(syncPushRegistration()).resolves.toEqual({
      status: 'unavailable',
      permission: 'enabled',
      token: 'ExponentPushToken[current]',
      backendSynced: false,
    });
    expect(storage.get('pushRegistration.pendingToken')).toBe('ExponentPushToken[current]');
  });

  it('does not lose a rotated token while an earlier registration is in flight', async () => {
    let resolveFirstRegistration!: (value: boolean) => void;
    const firstRegistration = new Promise<boolean>((resolve) => {
      resolveFirstRegistration = resolve;
    });
    mockRegisterPushTokenApi
      .mockReturnValueOnce(firstRegistration)
      .mockResolvedValueOnce(true);

    const initialSync = syncPushRegistration();
    const stopRotationSync = startPushTokenRotationSync(() => true);
    const rotationHandler = mockRotationHandler;
    if (!rotationHandler) throw new Error('rotation listener was not registered');
    const rotatedSync = rotationHandler('ExponentPushToken[rotated]');

    resolveFirstRegistration(true);
    await initialSync;
    await rotatedSync;
    stopRotationSync();

    expect(mockRegisterPushTokenApi.mock.calls).toEqual([
      ['ExponentPushToken[current]'],
      ['ExponentPushToken[rotated]'],
    ]);
    expect(getPushRegistrationResult()).toMatchObject({
      token: 'ExponentPushToken[rotated]',
      backendSynced: true,
    });
  });

  it('serializes consecutive rotations and keeps the newest token', async () => {
    let resolveFirstRegistration!: (value: boolean) => void;
    const firstRegistration = new Promise<boolean>((resolve) => {
      resolveFirstRegistration = resolve;
    });
    mockRegisterPushTokenApi
      .mockReturnValueOnce(firstRegistration)
      .mockResolvedValue(true);

    const initialSync = syncPushRegistration();
    const stopRotationSync = startPushTokenRotationSync(() => true);
    const rotationHandler = mockRotationHandler;
    if (!rotationHandler) throw new Error('rotation listener was not registered');
    const firstRotation = rotationHandler('ExponentPushToken[rotated-1]');
    const latestRotation = rotationHandler('ExponentPushToken[rotated-2]');

    resolveFirstRegistration(true);
    await Promise.all([initialSync, firstRotation, latestRotation]);
    stopRotationSync();

    expect(mockRegisterPushTokenApi.mock.calls).toEqual([
      ['ExponentPushToken[current]'],
      ['ExponentPushToken[rotated-1]'],
      ['ExponentPushToken[rotated-2]'],
    ]);
    expect(getPushRegistrationResult()).toMatchObject({
      token: 'ExponentPushToken[rotated-2]',
      backendSynced: true,
    });
  });

  it('ignores token rotation outside an authenticated session', async () => {
    const stopRotationSync = startPushTokenRotationSync(() => false);
    const rotationHandler = mockRotationHandler;
    if (!rotationHandler) throw new Error('rotation listener was not registered');
    await rotationHandler('ExponentPushToken[rotated]');
    stopRotationSync();
    expect(mockRegisterPushTokenApi).not.toHaveBeenCalled();
  });

  it('removes every locally owned token before clearing registration state', async () => {
    storage.set('pushRegistration.registeredToken', 'ExponentPushToken[registered]');
    storage.set('pushRegistration.pendingToken', 'ExponentPushToken[pending]');

    await expect(unregisterPushBeforeLogout()).resolves.toBe(true);

    expect(mockDeletePushTokenApi.mock.calls).toEqual([
      ['ExponentPushToken[registered]'],
      ['ExponentPushToken[pending]'],
    ]);
    expect(storage.size).toBe(0);
    expect(getPushRegistrationResult()).toEqual({
      status: 'notDetermined',
      permission: 'notDetermined',
      token: null,
      backendSynced: false,
    });
  });

  it('waits for an in-flight registration before deleting its token on logout', async () => {
    let resolveRegistration!: (value: boolean) => void;
    const inFlightRegistration = new Promise<boolean>((resolve) => {
      resolveRegistration = resolve;
    });
    mockRegisterPushTokenApi.mockReturnValueOnce(inFlightRegistration);

    const registration = syncPushRegistration();
    await Promise.resolve();
    const unregister = unregisterPushBeforeLogout();

    expect(mockDeletePushTokenApi).not.toHaveBeenCalled();
    resolveRegistration(true);

    await registration;
    await expect(unregister).resolves.toBe(true);
    expect(mockDeletePushTokenApi).toHaveBeenCalledWith('ExponentPushToken[current]');
    expect(storage.size).toBe(0);
  });

  it('cancels a queued rotation on logout and stays suspended until the next auth session', async () => {
    let resolveRegistration!: (value: boolean) => void;
    const inFlightRegistration = new Promise<boolean>((resolve) => {
      resolveRegistration = resolve;
    });
    mockRegisterPushTokenApi.mockReturnValueOnce(inFlightRegistration);

    const registration = syncPushRegistration();
    const stopRotationSync = startPushTokenRotationSync(() => true);
    const rotationHandler = mockRotationHandler;
    if (!rotationHandler) throw new Error('rotation listener was not registered');
    const rotatedSync = rotationHandler('ExponentPushToken[late-rotation]');
    const unregister = unregisterPushBeforeLogout();

    resolveRegistration(true);
    await Promise.all([registration, rotatedSync]);
    await expect(unregister).resolves.toBe(true);
    stopRotationSync();

    expect(mockRegisterPushTokenApi).toHaveBeenCalledTimes(1);
    expect(mockDeletePushTokenApi).toHaveBeenCalledWith('ExponentPushToken[current]');

    await expect(syncPushRegistration()).resolves.toEqual({
      status: 'notDetermined',
      permission: 'notDetermined',
      token: null,
      backendSynced: false,
    });
    expect(mockRegisterPushTokenApi).toHaveBeenCalledTimes(1);

    activatePushRegistrationSession();
    await syncPushRegistration();
    expect(mockRegisterPushTokenApi).toHaveBeenCalledTimes(2);
  });

  it('never reports a failed backend removal as successful', async () => {
    storage.set('pushRegistration.registeredToken', 'ExponentPushToken[registered]');
    mockDeletePushTokenApi.mockResolvedValue(false);

    await expect(unregisterPushBeforeLogout()).resolves.toBe(false);
    expect(storage.size).toBe(0);
  });
});
