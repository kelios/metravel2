export const RECOVERY_SESSION_KEYS = {
  errorBoundaryReloadTs: 'metravel:eb:reload_ts',
  errorBoundaryReloadCount: 'metravel:eb:reload_count',
  chunkReloadTs: '__metravel_chunk_reload',
  chunkReloadCount: '__metravel_chunk_reload_count',
  swStaleReloadTs: '__metravel_sw_stale_reload',
  swStaleReloadCount: '__metravel_sw_stale_reload_count',
  emergencyRecoveryTs: '__metravel_emergency_recovery_ts',
  exhaustedAutoRetryTs: '__metravel_exhausted_autoretry_ts',
  exhaustedAutoRetryCount: '__metravel_exhausted_autoretry_count',
  react130RecoveryTs: '__metravel_react130_recovery_ts',
  react130RecoveryCount: '__metravel_react130_recovery_count',
  controllerChangeReloadTs: '__metravel_sw_controllerchange_reload_ts',
  recoveryExhausted: '__metravel_recovery_exhausted',
} as const;

export type ClearRecoverySessionStateOptions = {
  clearEmergencyKey?: boolean;
  clearExhaustedAutoRetryKeys?: boolean;
  clearReact130RecoveryKeys?: boolean;
  clearControllerChangeReloadKey?: boolean;
};

export function clearRecoverySessionState(
  options: ClearRecoverySessionStateOptions = {}
): void {
  const {
    clearEmergencyKey = false,
    clearExhaustedAutoRetryKeys = false,
    clearReact130RecoveryKeys = false,
    clearControllerChangeReloadKey = false,
  } = options;

  try {
    sessionStorage.removeItem(RECOVERY_SESSION_KEYS.errorBoundaryReloadTs);
    sessionStorage.removeItem(RECOVERY_SESSION_KEYS.errorBoundaryReloadCount);
    sessionStorage.removeItem(RECOVERY_SESSION_KEYS.chunkReloadTs);
    sessionStorage.removeItem(RECOVERY_SESSION_KEYS.chunkReloadCount);
    sessionStorage.removeItem(RECOVERY_SESSION_KEYS.swStaleReloadTs);
    sessionStorage.removeItem(RECOVERY_SESSION_KEYS.swStaleReloadCount);
    // Always clear the exhausted flag when clearing recovery state
    sessionStorage.removeItem(RECOVERY_SESSION_KEYS.recoveryExhausted);

    if (clearExhaustedAutoRetryKeys) {
      sessionStorage.removeItem(RECOVERY_SESSION_KEYS.exhaustedAutoRetryTs);
      sessionStorage.removeItem(RECOVERY_SESSION_KEYS.exhaustedAutoRetryCount);
    }

    if (clearReact130RecoveryKeys) {
      sessionStorage.removeItem(RECOVERY_SESSION_KEYS.react130RecoveryTs);
      sessionStorage.removeItem(RECOVERY_SESSION_KEYS.react130RecoveryCount);
    }

    if (clearControllerChangeReloadKey) {
      sessionStorage.removeItem(RECOVERY_SESSION_KEYS.controllerChangeReloadTs);
    }

    if (clearEmergencyKey) {
      sessionStorage.removeItem(RECOVERY_SESSION_KEYS.emergencyRecoveryTs);
    }
  } catch {
    // sessionStorage may be unavailable (private mode / browser restrictions)
  }
}

export function isRecoveryLoopUrl(url: string): boolean {
  try {
    return new URL(url).searchParams.has('_cb');
  } catch {
    return false;
  }
}

/** Check if inline script has exhausted recovery attempts */
export function isRecoveryExhausted(): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_SESSION_KEYS.recoveryExhausted) === '1';
  } catch {
    return false;
  }
}

export function withCacheBust(url: string, value = String(Date.now())): string {
  const parsed = new URL(url);
  parsed.searchParams.set('_cb', value);
  return parsed.toString();
}
