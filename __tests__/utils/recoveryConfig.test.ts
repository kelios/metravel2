import {
  RECOVERY_COOLDOWNS,
  RECOVERY_RETRY_LIMITS,
  RECOVERY_TIMEOUTS,
} from '@/utils/recovery/recoveryConfig'

describe('recoveryConfig', () => {
  it('keeps expected stable cooldown defaults', () => {
    expect(RECOVERY_COOLDOWNS.staleMs).toBe(30_000)
    expect(RECOVERY_COOLDOWNS.emergencyMs).toBe(60_000)
    expect(RECOVERY_COOLDOWNS.controllerChangeMs).toBe(60_000)
    expect(RECOVERY_COOLDOWNS.react130Ms).toBe(30_000)
  })

  it('keeps expected retry limits', () => {
    expect(RECOVERY_RETRY_LIMITS.stale).toBe(2)
    expect(RECOVERY_RETRY_LIMITS.errorBoundary).toBe(3)
    expect(RECOVERY_RETRY_LIMITS.exhaustedAutoRetry).toBe(3)
    expect(RECOVERY_RETRY_LIMITS.react130).toBe(1)
  })

  it('keeps safety timeout not greater than stale cooldown', () => {
    expect(RECOVERY_TIMEOUTS.staleCleanupSafetyMs).toBeLessThan(RECOVERY_COOLDOWNS.staleMs)
    expect(RECOVERY_TIMEOUTS.staleAutoRetryDelayMs).toBeLessThan(RECOVERY_COOLDOWNS.staleMs)
    expect(RECOVERY_TIMEOUTS.bundleMismatchFetchTimeoutMs).toBeGreaterThan(0)
  })
})
