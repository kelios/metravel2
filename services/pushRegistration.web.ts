import type { NotificationPermissionState } from '@/services/notifications.web';

export type PushRegistrationStatus = NotificationPermissionState | 'syncing' | 'offline';

export interface PushRegistrationResult {
  status: PushRegistrationStatus;
  permission: NotificationPermissionState;
  token: string | null;
  backendSynced: boolean;
}

const unavailable: PushRegistrationResult = {
  status: 'unavailable',
  permission: 'unavailable',
  token: null,
  backendSynced: false,
};

export function activatePushRegistrationSession(): void {}

export async function syncPushRegistration(): Promise<PushRegistrationResult> {
  return unavailable;
}

export async function requestAndRegisterPushNotifications(): Promise<PushRegistrationResult> {
  return unavailable;
}

export async function retryPendingPushRegistration(): Promise<PushRegistrationResult> {
  return unavailable;
}

export function startPushTokenRotationSync(): () => void {
  return () => {};
}

export async function unregisterPushBeforeLogout(): Promise<boolean> {
  return false;
}

export function getPushRegistrationResult(): PushRegistrationResult {
  return unavailable;
}

export function subscribePushRegistration(): () => void {
  return () => {};
}

export function __resetPushRegistrationForTests(): void {}
