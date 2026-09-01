import {
  activatePushRegistrationSession,
  getPushRegistrationResult,
  requestAndRegisterPushNotifications,
  retryPendingPushRegistration,
  syncPushRegistration,
  unregisterPushBeforeLogout,
} from '@/services/pushRegistration.web';

describe('web push registration adapter', () => {
  const unavailable = {
    status: 'unavailable',
    permission: 'unavailable',
    token: null,
    backendSynced: false,
  };

  it('stays a deterministic no-op for every lifecycle entry point', async () => {
    expect(activatePushRegistrationSession()).toBeUndefined();
    expect(getPushRegistrationResult()).toEqual(unavailable);
    await expect(syncPushRegistration()).resolves.toEqual(unavailable);
    await expect(requestAndRegisterPushNotifications()).resolves.toEqual(unavailable);
    await expect(retryPendingPushRegistration()).resolves.toEqual(unavailable);
    await expect(unregisterPushBeforeLogout()).resolves.toBe(false);
  });
});
