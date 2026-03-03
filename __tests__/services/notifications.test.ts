// __tests__/services/notifications.test.ts
// AND-05: Tests for push notification service


// Must mock before importing the module
const mockSetNotificationChannelAsync = jest.fn().mockResolvedValue(null);
const mockGetPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockRequestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockGetExpoPushTokenAsync = jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test-token]' });
const mockSetNotificationHandler = jest.fn();
const mockAddNotificationReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
const mockAddNotificationResponseReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
const mockSetBadgeCountAsync = jest.fn().mockResolvedValue(true);

jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  getExpoPushTokenAsync: mockGetExpoPushTokenAsync,
  setNotificationHandler: mockSetNotificationHandler,
  addNotificationReceivedListener: mockAddNotificationReceivedListener,
  addNotificationResponseReceivedListener: mockAddNotificationResponseReceivedListener,
  setBadgeCountAsync: mockSetBadgeCountAsync,
}), { virtual: true });

describe('notifications service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

