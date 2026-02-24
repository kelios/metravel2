type RecoveryThrottleOptions = {
  timestampKey: string;
  cooldownMs: number;
  countKey?: string;
  maxRetries?: number;
  nowMs?: number;
};

export type RecoveryAttemptDecision = {
  allowed: boolean;
  reason: 'allowed' | 'cooldown' | 'max_retries';
};

function parseCount(value: string | null): number {
  const parsed = Number.parseInt(value || '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function shouldAllowRecoveryAttempt(options: RecoveryThrottleOptions): boolean {
  return evaluateRecoveryAttempt(options).allowed;
}

export function evaluateRecoveryAttempt(
  options: RecoveryThrottleOptions
): RecoveryAttemptDecision {
  const {
    timestampKey,
    cooldownMs,
    countKey,
    maxRetries,
    nowMs,
  } = options;

  try {
    const now = nowMs ?? Date.now();
    let count = countKey ? parseCount(sessionStorage.getItem(countKey)) : 0;

    const previousRaw = sessionStorage.getItem(timestampKey);
    const previous = previousRaw ? Number(previousRaw) : 0;
    const elapsed = previous && Number.isFinite(previous) ? now - previous : Infinity;

    if (countKey && typeof maxRetries === 'number' && count >= maxRetries) {
      if (elapsed >= cooldownMs) {
        count = 0;
        sessionStorage.setItem(countKey, '0');
      } else {
        return { allowed: false, reason: 'max_retries' };
      }
    }

    if (elapsed < cooldownMs) {
      return { allowed: false, reason: 'cooldown' };
    }

    sessionStorage.setItem(timestampKey, String(now));
    if (countKey) {
      sessionStorage.setItem(countKey, String(count + 1));
    }
  } catch {
    // sessionStorage may be unavailable; allow one best-effort attempt.
  }

  return { allowed: true, reason: 'allowed' };
}
