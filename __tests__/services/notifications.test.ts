// __tests__/services/notifications.test.ts
// AND-05: Tests for push notification service

import { Platform } from 'react-native';

// Must mock before importing the module
const mockSetNotificationChannelAsync = jest.fn().mockResolvedValue(null);
const mockGetPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockRequestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockGetExpoPushTokenAsync = jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test-token]' });
const mockSetNotificationHandler = jest.fn();
const mockAddNotificationReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
const mockAddNotificationResponseReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
const mockAddPushTokenListener = jest.fn(() => ({ remove: jest.fn() }));
const mockGetLastNotificationResponseAsync = jest.fn().mockResolvedValue(null);
const mockClearLastNotificationResponseAsync = jest.fn().mockResolvedValue(undefined);
const mockSetBadgeCountAsync = jest.fn().mockResolvedValue(true);
const mockScheduleNotificationAsync = jest.fn().mockResolvedValue('scheduled');
const mockCancelScheduledNotificationAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { easConfig: { projectId: 'test-project' } },
}));

jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  getExpoPushTokenAsync: mockGetExpoPushTokenAsync,
  setNotificationHandler: mockSetNotificationHandler,
  addNotificationReceivedListener: mockAddNotificationReceivedListener,
  addNotificationResponseReceivedListener: mockAddNotificationResponseReceivedListener,
  addPushTokenListener: mockAddPushTokenListener,
  getLastNotificationResponseAsync: mockGetLastNotificationResponseAsync,
  clearLastNotificationResponseAsync: mockClearLastNotificationResponseAsync,
  setBadgeCountAsync: mockSetBadgeCountAsync,
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}), { virtual: true });

describe('notifications service', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockGetPermissionsAsync.mockResolvedValue({
      granted: true,
      status: 'granted',
      ios: { status: 2 },
    });
    mockRequestPermissionsAsync.mockResolvedValue({
      granted: true,
      status: 'granted',
      ios: { status: 2 },
    });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test-token]' });
    mockGetLastNotificationResponseAsync.mockResolvedValue(null);
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  });

  it('inspects permission passively and requests it only from the explicit entry point', async () => {
    const {
      inspectNotificationPermission,
      requestNotificationPermission,
    } = require('@/services/notifications') as typeof import('@/services/notifications');
    mockGetPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'undetermined',
      ios: { status: 0 },
    });
    mockRequestPermissionsAsync.mockResolvedValue({
      granted: true,
      status: 'granted',
      ios: { status: 3 },
    });

    await expect(inspectNotificationPermission()).resolves.toBe('notDetermined');
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();

    await expect(requestNotificationPermission()).resolves.toBe('provisional');
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it.each([
    [0, 'notDetermined'],
    [1, 'denied'],
    [2, 'enabled'],
    [3, 'provisional'],
    [4, 'provisional'],
  ])('normalizes iOS authorization status %s as %s', (status, expected) => {
    const { normalizeNotificationPermission } =
      require('@/services/notifications') as typeof import('@/services/notifications');

    expect(normalizeNotificationPermission({
      granted: status >= 2,
      status: status >= 2 ? 'granted' : status === 1 ? 'denied' : 'undetermined',
      ios: { status },
    } as never)).toBe(expected);
  });

  it('keeps local reminders passive when permission is not already allowed', async () => {
    const { ensureLocalNotificationPermission } =
      require('@/services/notifications') as typeof import('@/services/notifications');
    mockGetPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'denied',
      ios: { status: 1 },
    });

    await expect(ensureLocalNotificationPermission({
      getPermissionsAsync: mockGetPermissionsAsync,
    } as never)).resolves.toBe(false);
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('preserves local quest scheduling when permission is already allowed', async () => {
    const { scheduleQuestReminder } =
      require('@/services/notifications') as typeof import('@/services/notifications');

    await scheduleQuestReminder('dragon', 'Dragon quest', 2, 5, 'krakow/dragon');

    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('quest-reminder-dragon');
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      identifier: 'quest-reminder-dragon',
      content: expect.objectContaining({ data: { url: '/quests/krakow/dragon' } }),
      trigger: expect.objectContaining({
        type: 'timeInterval',
        repeats: false,
      }),
    }));
  });

  it('normalizes cold-start responses and clears the consumed native response', async () => {
    const {
      clearLastNotificationResponse,
      getInitialNotificationResponse,
    } = require('@/services/notifications') as typeof import('@/services/notifications');
    mockGetLastNotificationResponseAsync.mockResolvedValue({
      notification: {
        request: {
          identifier: 'notification-1',
          content: { data: { screen: 'quest', city: 'krakow', questId: 'dragon' } },
        },
      },
    });

    await expect(getInitialNotificationResponse()).resolves.toEqual({
      id: 'notification-1',
      data: { screen: 'quest', city: 'krakow', questId: 'dragon' },
    });
    await clearLastNotificationResponse();
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it('converts a native token rotation to the Expo token without exposing it to logs', async () => {
    const { addPushTokenRotationListener } =
      require('@/services/notifications') as typeof import('@/services/notifications');
    const handler = jest.fn();
    addPushTokenRotationListener(handler);
    const rotationHandler = mockAddPushTokenListener.mock.calls[0][0];

    await rotationHandler({ type: 'ios', data: 'native-secret-token' });

    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'test-project',
      devicePushToken: { type: 'ios', data: 'native-secret-token' },
    }));
    expect(handler).toHaveBeenCalledWith('ExponentPushToken[test-token]');
  });

  describe('extractDeepLinkFromNotification', () => {
    it('should extract url from data', () => {
      const { extractDeepLinkFromNotification } = require('@/services/notifications');
      expect(extractDeepLinkFromNotification({ url: '/travels/test-slug' })).toBe('/travels/test-slug');
    });

    it('should extract screen from data', () => {
      const { extractDeepLinkFromNotification } = require('@/services/notifications');
      expect(extractDeepLinkFromNotification({ screen: '/map' })).toBe('/map');
    });

    it('should return null if no deep link data', () => {
      const { extractDeepLinkFromNotification } = require('@/services/notifications');
      expect(extractDeepLinkFromNotification({ other: 'value' })).toBeNull();
    });

    it('should prefer url over screen', () => {
      const { extractDeepLinkFromNotification } = require('@/services/notifications');
      expect(extractDeepLinkFromNotification({ url: '/travels/a', screen: '/map' })).toBe('/travels/a');
    });
  });

  describe('NOTIFICATION_CHANNELS', () => {
    it('should have 3 channels defined', () => {
      const { NOTIFICATION_CHANNELS } = require('@/services/notifications');
      expect(NOTIFICATION_CHANNELS).toHaveLength(3);
      expect(NOTIFICATION_CHANNELS.map((c: any) => c.id)).toEqual(['messages', 'updates', 'recommendations']);
    });
  });

  describe('extractDeepLinkFromNotification edge cases', () => {
    it('should return null for empty string url', () => {
      const { extractDeepLinkFromNotification } = require('@/services/notifications');
      expect(extractDeepLinkFromNotification({ url: '' })).toBeNull();
    });

    it('should return null for empty string screen', () => {
      const { extractDeepLinkFromNotification } = require('@/services/notifications');
      expect(extractDeepLinkFromNotification({ screen: '' })).toBeNull();
    });
  });
});
