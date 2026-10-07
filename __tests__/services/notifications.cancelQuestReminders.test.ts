// PUSH-2: локальные квестовые напоминания не привязаны к аккаунту, поэтому
// на выходе / смене владельца сессии их нужно снять явно — иначе названия
// квестов прошлого пользователя всплывают у следующего на общем устройстве.

import { Platform } from 'react-native';

const mockGetAllScheduledNotificationsAsync = jest.fn();
const mockCancelScheduledNotificationAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { easConfig: { projectId: 'test-project' } },
}));

jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: mockGetAllScheduledNotificationsAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}), { virtual: true });

import { cancelScheduledQuestReminders, isQuestReminderIdentifier } from '@/services/notifications';

describe('cancelScheduledQuestReminders (PUSH-2)', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  });

  it('recognises both quest reminder families and nothing else', () => {
    expect(isQuestReminderIdentifier('quest-reminder-42')).toBe(true);
    expect(isQuestReminderIdentifier('quest-return-user%401-42')).toBe(true);
    expect(isQuestReminderIdentifier('daily-digest')).toBe(false);
  });

  it('cancels only quest reminders and keeps other schedules', async () => {
    mockGetAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'quest-reminder-7' },
      { identifier: 'quest-return-u1-7' },
      { identifier: 'something-else' },
    ]);

    await cancelScheduledQuestReminders();

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('quest-reminder-7');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('quest-return-u1-7');
    expect(mockCancelScheduledNotificationAsync).not.toHaveBeenCalledWith('something-else');
  });

  it('is best-effort: a failing module never throws', async () => {
    mockGetAllScheduledNotificationsAsync.mockRejectedValue(new Error('boom'));

    await expect(cancelScheduledQuestReminders()).resolves.toBeUndefined();
  });

  it('is a no-op on web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    await cancelScheduledQuestReminders();

    expect(mockGetAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });
});
