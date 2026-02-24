import {
  evaluateRecoveryAttempt,
  shouldAllowRecoveryAttempt,
} from '@/utils/recovery/recoveryThrottle';

describe('recoveryThrottle', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('allows first attempt and stores timestamp/counter', () => {
    const allowed = shouldAllowRecoveryAttempt({
      timestampKey: 'k:ts',
      countKey: 'k:count',
      cooldownMs: 30_000,
      maxRetries: 3,
      nowMs: 1_000,
    });

    expect(allowed).toBe(true);
    expect(sessionStorage.getItem('k:ts')).toBe('1000');
    expect(sessionStorage.getItem('k:count')).toBe('1');
  });

  it('returns cooldown when attempt is too soon', () => {
    sessionStorage.setItem('k:ts', '1000');
    sessionStorage.setItem('k:count', '1');

    const decision = evaluateRecoveryAttempt({
      timestampKey: 'k:ts',
      countKey: 'k:count',
      cooldownMs: 30_000,
      maxRetries: 3,
      nowMs: 20_000,
    });

    expect(decision).toEqual({ allowed: false, reason: 'cooldown' });
    expect(sessionStorage.getItem('k:count')).toBe('1');
  });

  it('returns max_retries when retries exhausted and cooldown not elapsed', () => {
    sessionStorage.setItem('k:ts', '1000');
    sessionStorage.setItem('k:count', '3');

    const decision = evaluateRecoveryAttempt({
      timestampKey: 'k:ts',
      countKey: 'k:count',
      cooldownMs: 30_000,
      maxRetries: 3,
      nowMs: 20_000,
    });

    expect(decision).toEqual({ allowed: false, reason: 'max_retries' });
  });

  it('resets retry counter after cooldown when max retries was reached', () => {
    sessionStorage.setItem('k:ts', '1000');
    sessionStorage.setItem('k:count', '3');

    const decision = evaluateRecoveryAttempt({
      timestampKey: 'k:ts',
      countKey: 'k:count',
      cooldownMs: 30_000,
      maxRetries: 3,
      nowMs: 40_000,
    });

    expect(decision).toEqual({ allowed: true, reason: 'allowed' });
    expect(sessionStorage.getItem('k:count')).toBe('1');
    expect(sessionStorage.getItem('k:ts')).toBe('40000');
  });

  it('supports timestamp-only mode without counter key', () => {
    const first = shouldAllowRecoveryAttempt({
      timestampKey: 'k:ts-only',
      cooldownMs: 30_000,
      nowMs: 1_000,
    });
    const second = shouldAllowRecoveryAttempt({
      timestampKey: 'k:ts-only',
      cooldownMs: 30_000,
      nowMs: 10_000,
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
