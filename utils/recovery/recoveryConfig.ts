export const RECOVERY_COOLDOWNS = {
  emergencyMs: 30 * 1000,
  staleMs: 20 * 1000,
  exhaustedAutoRetryMs: 20 * 1000,
  react130Ms: 20 * 1000,
  controllerChangeMs: 45 * 1000,
} as const;

export const RECOVERY_RETRY_LIMITS = {
  stale: 4,
  errorBoundary: 5,
  exhaustedAutoRetry: 5,
  react130: 2,
} as const;

export const RECOVERY_TIMEOUTS = {
  staleAutoRetryDelayMs: 2500,
  staleCleanupSafetyMs: 3000,
  bundleMismatchFetchTimeoutMs: 4000,
} as const;
