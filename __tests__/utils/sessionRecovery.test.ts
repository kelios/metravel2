import {
  clearRecoverySessionState,
  isRecoveryLoopUrl,
  RECOVERY_SESSION_KEYS,
  withCacheBust,
} from '@/utils/recovery/sessionRecovery';

describe('sessionRecovery', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('clears core recovery keys by default', () => {
    sessionStorage.setItem(RECOVERY_SESSION_KEYS.errorBoundaryReloadTs, '1');
    sessionStorage.setItem(RECOVERY_SESSION_KEYS.errorBoundaryReloadCount, '1');
    sessionStorage.setItem(RECOVERY_SESSION_KEYS.chunkReloadTs, '1');
    sessionStorage.setItem(RECOVERY_SESSION_KEYS.chunkReloadCount, '1');
    sessionStorage.setItem(RECOVERY_SESSION_KEYS.swStaleReloadTs, '1');
    sessionStorage.setItem(RECOVERY_SESSION_KEYS.swStaleReloadCount, '1');
    sessionStorage.setItem(RECOVERY_SESSION_KEYS.emergencyRecoveryTs, '1');

    clearRecoverySessionState();

    expect(sessionStorage.getItem(RECOVERY_SESSION_KEYS.errorBoundaryReloadTs)).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_SESSION_KEYS.errorBoundaryReloadCount)).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_SESSION_KEYS.chunkReloadTs)).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_SESSION_KEYS.chunkReloadCount)).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_SESSION_KEYS.swStaleReloadTs)).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_SESSION_KEYS.swStaleReloadCount)).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_SESSION_KEYS.emergencyRecoveryTs)).toBe('1');
  });

  it('clears optional keys when flags are enabled', () => {
    sessionStorage.setItem(RECOVERY_SESSION_KEYS.exhaustedAutoRetryTs, '1');
    sessionStorage.setItem(RECOVERY_SESSION_KEYS.exhaustedAutoRetryCount, '1');
    sessionStorage.setItem(RECOVERY_SESSION_KEYS.react130RecoveryTs, '1');
    sessionStorage.setItem(RECOVERY_SESSION_KEYS.react130RecoveryCount, '1');
    sessionStorage.setItem(RECOVERY_SESSION_KEYS.controllerChangeReloadTs, '1');
    sessionStorage.setItem(RECOVERY_SESSION_KEYS.emergencyRecoveryTs, '1');

    clearRecoverySessionState({
      clearEmergencyKey: true,
      clearExhaustedAutoRetryKeys: true,
      clearReact130RecoveryKeys: true,
      clearControllerChangeReloadKey: true,
    });

    expect(sessionStorage.getItem(RECOVERY_SESSION_KEYS.exhaustedAutoRetryTs)).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_SESSION_KEYS.exhaustedAutoRetryCount)).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_SESSION_KEYS.react130RecoveryTs)).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_SESSION_KEYS.react130RecoveryCount)).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_SESSION_KEYS.controllerChangeReloadTs)).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_SESSION_KEYS.emergencyRecoveryTs)).toBeNull();
  });

  it('detects recovery loop URLs by _cb query param', () => {
    expect(isRecoveryLoopUrl('https://metravel.by/map?_cb=123')).toBe(true);
    expect(isRecoveryLoopUrl('https://metravel.by/map')).toBe(false);
    expect(isRecoveryLoopUrl('not-a-url')).toBe(false);
  });

  it('adds cache-busting query param', () => {
    const url = withCacheBust('https://metravel.by/map?foo=bar', '999');
    expect(url).toBe('https://metravel.by/map?foo=bar&_cb=999');
  });
});
