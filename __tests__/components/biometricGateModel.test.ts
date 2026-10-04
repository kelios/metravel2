// #2142: the lock screen is a refusal screen, never the waiting screen.
import {
  isBiometricGateLaunchSettled,
  resolveBiometricGateView,
} from '@/components/layout/biometricGateModel';

describe('resolveBiometricGateView', () => {
  it('holds the launch cover while the gate is still deciding', () => {
    expect(resolveBiometricGateView({ phase: 'idle', decided: false, shouldGate: false })).toBe('pending');
    expect(resolveBiometricGateView({ phase: 'idle', decided: false, shouldGate: true })).toBe('pending');
  });

  it('shows the launch cover, not the lock screen, while the prompt is open', () => {
    expect(resolveBiometricGateView({ phase: 'idle', decided: true, shouldGate: true })).toBe('prompting');
    expect(resolveBiometricGateView({ phase: 'prompting', decided: true, shouldGate: true })).toBe('prompting');
  });

  it('shows the lock screen only after a failed or cancelled prompt', () => {
    expect(resolveBiometricGateView({ phase: 'failed', decided: true, shouldGate: true })).toBe('locked');
  });

  it('opens when unlocked, not armed, or logged out from the lock screen', () => {
    expect(resolveBiometricGateView({ phase: 'unlocked', decided: true, shouldGate: true })).toBe('open');
    expect(resolveBiometricGateView({ phase: 'idle', decided: true, shouldGate: false })).toBe('open');
    expect(resolveBiometricGateView({ phase: 'failed', decided: true, shouldGate: false })).toBe('open');
  });

  it('settles the launch condition only once the outcome is on screen', () => {
    expect(isBiometricGateLaunchSettled('pending')).toBe(false);
    expect(isBiometricGateLaunchSettled('prompting')).toBe(false);
    expect(isBiometricGateLaunchSettled('locked')).toBe(true);
    expect(isBiometricGateLaunchSettled('open')).toBe(true);
  });
});
