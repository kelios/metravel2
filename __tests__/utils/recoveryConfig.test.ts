import {
  RECOVERY_COOLDOWNS,
  RECOVERY_RETRY_LIMITS,
  RECOVERY_TIMEOUTS,
} from '@/utils/recovery/recoveryConfig'

describe('recoveryConfig', () => {
  it('keeps expected stable cooldown defaults', () => {
    expect(RECOVERY_COOLDOWNS.staleMs).toBe(20_000)
    expect(RECOVERY_COOLDOWNS.emergencyMs).toBe(30_000)
    expect(RECOVERY_COOLDOWNS.controllerChangeMs).toBe(45_000)
    expect(RECOVERY_COOLDOWNS.react130Ms).toBe(20_000)
  })

  it('keeps expected retry limits', () => {
    expect(RECOVERY_RETRY_LIMITS.stale).toBe(4)
    expect(RECOVERY_RETRY_LIMITS.errorBoundary).toBe(5)
    expect(RECOVERY_RETRY_LIMITS.exhaustedAutoRetry).toBe(5)
    expect(RECOVERY_RETRY_LIMITS.react130).toBe(2)
  })

  it('keeps safety timeout not greater than stale cooldown', () => {
    expect(RECOVERY_TIMEOUTS.staleCleanupSafetyMs).toBeLessThan(RECOVERY_COOLDOWNS.staleMs)
    expect(RECOVERY_TIMEOUTS.staleAutoRetryDelayMs).toBeLessThan(RECOVERY_COOLDOWNS.staleMs)
    expect(RECOVERY_TIMEOUTS.bundleMismatchFetchTimeoutMs).toBeGreaterThan(0)
  })
})
