// components/layout/biometricGateModel.ts
// What the cold-start biometric gate shows for a given state (#2142).
//
// The lock screen («MeTravel заблокирован» + «Разблокировать») is a refusal
// screen: it appears only after Face ID / fingerprint failed or was cancelled.
// While the gate is still deciding or the system prompt is open, the gate
// holds the launch cover — the same picture as the native splash — so a
// successful start reads as one launch screen: splash → system prompt → home.

export type BiometricGatePhase = 'idle' | 'prompting' | 'unlocked' | 'failed';

/**
 * - `pending`   — not yet known whether the gate is armed (auth restore or the
 *                 biometric device probe still running): launch cover.
 * - `prompting` — armed, the system prompt is open or about to open: launch cover.
 * - `locked`    — the prompt failed or was cancelled: lock screen.
 * - `open`      — not armed, or unlocked: nothing rendered.
 */
export type BiometricGateView = 'pending' | 'prompting' | 'locked' | 'open';

export interface BiometricGateViewInput {
  phase: BiometricGatePhase;
  /** Auth restored and the device probe settled (or the launch failsafe expired). */
  decided: boolean;
  /** Biometrics opted in, available, enrolled, and the user is logged in. */
  shouldGate: boolean;
}

export function resolveBiometricGateView({
  phase,
  decided,
  shouldGate,
}: BiometricGateViewInput): BiometricGateView {
  if (phase === 'unlocked') return 'open';
  if (!decided) return 'pending';
  // Logged out from the lock screen, or never armed.
  if (!shouldGate) return 'open';
  if (phase === 'failed') return 'locked';
  return 'prompting';
}

/**
 * The gate releases its launch condition once the launch outcome is on screen:
 * the app itself (`open`) or the refusal screen (`locked`). While the system
 * prompt is open the native splash keeps standing behind it.
 */
export function isBiometricGateLaunchSettled(view: BiometricGateView): boolean {
  return view === 'open' || view === 'locked';
}
