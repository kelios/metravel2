export const RECOVERY_COOLDOWNS = {
  emergencyMs: 60 * 1000,
  staleMs: 30 * 1000,
  exhaustedAutoRetryMs: 30 * 1000,
  react130Ms: 30 * 1000,
  controllerChangeMs: 60 * 1000,
} as const;

export const RECOVERY_RETRY_LIMITS = {
  stale: 2,
  errorBoundary: 3,
  exhaustedAutoRetry: 3,
  react130: 1,
} as const;

export const RECOVERY_TIMEOUTS = {
  staleAutoRetryDelayMs: 2500,
  staleCleanupSafetyMs: 3000,
  bundleMismatchFetchTimeoutMs: 4000,
} as const;
