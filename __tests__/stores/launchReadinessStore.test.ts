// #2142: the launch is ready only when every declared condition is ready, or
// the shared failsafe expired.
import {
  resetLaunchReadinessForTests,
  selectLaunchReady,
  useLaunchReadinessStore,
} from '@/stores/launchReadinessStore';

const ready = () => selectLaunchReady(useLaunchReadinessStore.getState());

describe('launchReadinessStore', () => {
  beforeEach(() => resetLaunchReadinessForTests());

  it('waits for saved theme after fonts and the biometric decision', () => {
    useLaunchReadinessStore.getState().markLaunchConditionReady('fonts');
    expect(ready()).toBe(false);
    useLaunchReadinessStore.getState().markLaunchConditionReady('biometricGate');
    expect(ready()).toBe(false);
    useLaunchReadinessStore.getState().markLaunchConditionReady('theme');
    expect(ready()).toBe(true);
  });

  it('does not depend on the order conditions become ready', () => {
    useLaunchReadinessStore.getState().markLaunchConditionReady('biometricGate');
    useLaunchReadinessStore.getState().markLaunchConditionReady('theme');
    expect(ready()).toBe(false);
    useLaunchReadinessStore.getState().markLaunchConditionReady('fonts');
    expect(ready()).toBe(true);
  });

  it('the failsafe ends a hung launch', () => {
    useLaunchReadinessStore.getState().expireLaunchFailsafe();
    expect(ready()).toBe(true);
  });

  it('marking an already ready condition keeps the state identity', () => {
    useLaunchReadinessStore.getState().markLaunchConditionReady('fonts');
    const before = useLaunchReadinessStore.getState();
    useLaunchReadinessStore.getState().markLaunchConditionReady('fonts');
    expect(useLaunchReadinessStore.getState()).toBe(before);
  });
});
