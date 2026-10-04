// stores/launchReadinessStore.ts
// One launch-readiness contract for native cold start (#2142).
//
// The native splash stays up until every launch condition is ready: the icon
// font and the biometric gate's decision (not armed / unlocked / failed).
// Conditions are declared here up front instead of registered at mount, so a
// condition owner that mounts late can never be missed by the splash owner.
// `failsafeExpired` is the shared liveness cap (LAUNCH_FAILSAFE_MS): it lets
// the start finish when a condition hangs.

import { create } from 'zustand';

export type LaunchCondition = 'fonts' | 'biometricGate';

const LAUNCH_CONDITIONS: readonly LaunchCondition[] = ['fonts', 'biometricGate'];

interface LaunchReadinessState {
  ready: Record<LaunchCondition, boolean>;
  failsafeExpired: boolean;
  markLaunchConditionReady: (condition: LaunchCondition) => void;
  expireLaunchFailsafe: () => void;
}

const initialReady = (): Record<LaunchCondition, boolean> => ({
  fonts: false,
  biometricGate: false,
});

export const useLaunchReadinessStore = create<LaunchReadinessState>((set) => ({
  ready: initialReady(),
  failsafeExpired: false,
  markLaunchConditionReady: (condition) =>
    set((state) =>
      state.ready[condition] ? state : { ready: { ...state.ready, [condition]: true } },
    ),
  expireLaunchFailsafe: () =>
    set((state) => (state.failsafeExpired ? state : { failsafeExpired: true })),
}));

export const selectLaunchReady = (state: LaunchReadinessState): boolean =>
  state.failsafeExpired || LAUNCH_CONDITIONS.every((condition) => state.ready[condition]);

/** Test-only: restore the cold-start state. */
export function resetLaunchReadinessForTests(): void {
  useLaunchReadinessStore.setState({ ready: initialReady(), failsafeExpired: false });
}
