import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { deletePushTokenApi, registerPushTokenApi } from '@/api/auth';
import {
  addPushTokenRotationListener,
  getPushNotificationToken,
  inspectNotificationPermission,
  isNotificationPermissionAllowed,
  requestNotificationPermission,
  type NotificationPermissionState,
} from '@/services/notifications';

const REGISTERED_TOKEN_KEY = 'pushRegistration.registeredToken';
const PENDING_TOKEN_KEY = 'pushRegistration.pendingToken';

export type PushRegistrationStatus =
  | NotificationPermissionState
  | 'syncing'
  | 'offline';

export interface PushRegistrationResult {
  status: PushRegistrationStatus;
  permission: NotificationPermissionState;
  token: string | null;
  backendSynced: boolean;
}

type Listener = (result: PushRegistrationResult) => void;

const initialResult: PushRegistrationResult = {
  status: 'notDetermined',
  permission: 'notDetermined',
  token: null,
  backendSynced: false,
};

let currentResult = initialResult;
let registrationInFlight: Promise<PushRegistrationResult> | null = null;
let registrationSessionActive = false;
const listeners = new Set<Listener>();
const activeRotationSyncs = new Set<Promise<void>>();

function publish(result: PushRegistrationResult): PushRegistrationResult {
  currentResult = result;
  listeners.forEach((listener) => listener(result));
  return result;
}

async function isDefinitelyOffline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === false || state.isInternetReachable === false;
  } catch {
    return false;
  }
}

async function readStoredToken(key: string): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

async function rememberPendingToken(token: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_TOKEN_KEY, token).catch(() => undefined);
}

async function rememberRegisteredToken(token: string): Promise<void> {
  await Promise.allSettled([
    AsyncStorage.setItem(REGISTERED_TOKEN_KEY, token),
    AsyncStorage.removeItem(PENDING_TOKEN_KEY),
  ]);
}

async function performRegistration(options: {
  requestPermission: boolean;
  tokenOverride?: string;
}): Promise<PushRegistrationResult> {
  publish({ ...currentResult, status: 'syncing' });

  const permission = options.requestPermission
    ? await requestNotificationPermission()
    : await inspectNotificationPermission();

  if (!isNotificationPermissionAllowed(permission)) {
    return publish({
      status: permission,
      permission,
      token: null,
      backendSynced: false,
    });
  }

  const pendingToken = await readStoredToken(PENDING_TOKEN_KEY);
  const token = options.tokenOverride ?? pendingToken ?? await getPushNotificationToken();
  if (!token) {
    return publish({
      status: 'unavailable',
      permission,
      token: null,
      backendSynced: false,
    });
  }

  if (await isDefinitelyOffline()) {
    await rememberPendingToken(token);
    return publish({ status: 'offline', permission, token, backendSynced: false });
  }

  const backendSynced = await registerPushTokenApi(token);
  if (!backendSynced) {
    await rememberPendingToken(token);
    const status = await isDefinitelyOffline() ? 'offline' : 'unavailable';
    return publish({ status, permission, token, backendSynced: false });
  }

  await rememberRegisteredToken(token);
  return publish({ status: permission, permission, token, backendSynced: true });
}

function runRegistration(options: {
  requestPermission: boolean;
  tokenOverride?: string;
}): Promise<PushRegistrationResult> {
  if (!registrationSessionActive) return Promise.resolve(initialResult);
  if (registrationInFlight) return registrationInFlight;
  registrationInFlight = performRegistration(options).finally(() => {
    registrationInFlight = null;
  });
  return registrationInFlight;
}

/** Enable sync only after the auth store has finished restoring a live session. */
export function activatePushRegistrationSession(): void {
  registrationSessionActive = true;
}

/** Authenticated-session sync. It inspects permission and never opens a prompt. */
export function syncPushRegistration(): Promise<PushRegistrationResult> {
  return runRegistration({ requestPermission: false });
}

/** User-action entry point. This is the only remote-push path that may prompt. */
export async function requestAndRegisterPushNotifications(): Promise<PushRegistrationResult> {
  if (!registrationSessionActive) return initialResult;
  const joined = registrationInFlight ? await registrationInFlight : null;
  if (joined && joined.permission !== 'notDetermined') return joined;
  return runRegistration({ requestPermission: true });
}

/** Retry hook for AppState/network reconnection; it remains prompt-free. */
export function retryPendingPushRegistration(): Promise<PushRegistrationResult> {
  return runRegistration({ requestPermission: false });
}

/** Keep the Expo token registered when APNs/FCM rotates its native token. */
export function startPushTokenRotationSync(
  isAuthenticated: () => boolean,
  onResult?: (result: PushRegistrationResult) => void,
): () => void {
  let disposed = false;
  let rotationSyncInFlight: Promise<void> | null = null;
  let pendingRotatedToken: string | null = null;
  const removeListener = addPushTokenRotationListener(async (token) => {
    if (disposed || !registrationSessionActive || !isAuthenticated()) return;

    // Native token events may arrive faster than the backend POST completes.
    // Keep the newest token queued instead of joining (and losing it behind)
    // an unrelated in-flight registration.
    pendingRotatedToken = token;
    if (!rotationSyncInFlight) {
      const rotationSync = (async () => {
        while (pendingRotatedToken) {
          const nextToken = pendingRotatedToken;
          pendingRotatedToken = null;
          if (registrationInFlight) await registrationInFlight.catch(() => undefined);
          if (disposed || !registrationSessionActive || !isAuthenticated()) {
            pendingRotatedToken = null;
            return;
          }
          const result = await runRegistration({
            requestPermission: false,
            tokenOverride: nextToken,
          });
          if (!disposed && registrationSessionActive && isAuthenticated()) {
            onResult?.(result);
          }
        }
      })();
      activeRotationSyncs.add(rotationSync);
      rotationSyncInFlight = rotationSync.finally(() => {
        rotationSyncInFlight = null;
        activeRotationSyncs.delete(rotationSync);
      });
    }
    await rotationSyncInFlight;
  });

  return () => {
    disposed = true;
    pendingRotatedToken = null;
    removeListener();
  };
}

/**
 * Best-effort remote removal while the auth credential is still available.
 * Local token ownership is always cleared. A non-2xx DELETE is never reported
 * as success; logout still continues.
 */
export async function unregisterPushBeforeLogout(): Promise<boolean> {
  // Suspend first: a rotation event delivered while logout is awaiting the
  // current POST must not register a token after DELETE/local cleanup.
  registrationSessionActive = false;

  // A registration that started just before logout may still be POSTing and
  // persisting its token. Join it first so DELETE cannot miss that late token.
  if (registrationInFlight) {
    await registrationInFlight.catch(() => undefined);
  }
  if (activeRotationSyncs.size > 0) {
    await Promise.allSettled([...activeRotationSyncs]);
  }

  const tokens = new Set(
    (await Promise.all([
      readStoredToken(REGISTERED_TOKEN_KEY),
      readStoredToken(PENDING_TOKEN_KEY),
    ])).filter((token): token is string => Boolean(token)),
  );

  let removed = true;
  for (const token of tokens) {
    removed = (await deletePushTokenApi(token)) && removed;
  }

  await Promise.allSettled([
    AsyncStorage.removeItem(REGISTERED_TOKEN_KEY),
    AsyncStorage.removeItem(PENDING_TOKEN_KEY),
  ]);
  publish(initialResult);
  return removed;
}

export function getPushRegistrationResult(): PushRegistrationResult {
  return currentResult;
}

export function subscribePushRegistration(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function __resetPushRegistrationForTests(): void {
  currentResult = initialResult;
  registrationInFlight = null;
  registrationSessionActive = false;
  activeRotationSyncs.clear();
  listeners.clear();
}
