// #2142: the native splash is not hidden on fonts alone — it waits for the
// biometric gate's decision, with the shared failsafe as the liveness cap.
import { act, renderHook } from '@testing-library/react-native';

const mockHideAsync = jest.fn(() => Promise.resolve(true));
jest.mock('expo-router', () => ({
  SplashScreen: { hideAsync: () => mockHideAsync() },
}));

import { useLaunchSplash } from '@/hooks/useLaunchSplash';
import { LAUNCH_FAILSAFE_MS } from '@/constants/launchSplash';
import {
  resetLaunchReadinessForTests,
  useLaunchReadinessStore,
} from '@/stores/launchReadinessStore';

describe('useLaunchSplash', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetLaunchReadinessForTests();
    mockHideAsync.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the splash after fonts load until the biometric gate decides', async () => {
    await renderHook(() => useLaunchSplash(true));
    expect(useLaunchReadinessStore.getState().ready.fonts).toBe(true);
    expect(mockHideAsync).not.toHaveBeenCalled();

    await act(() => {
      useLaunchReadinessStore.getState().markLaunchConditionReady('biometricGate');
    });
    expect(mockHideAsync).not.toHaveBeenCalled();
    await act(() => {
      useLaunchReadinessStore.getState().markLaunchConditionReady('theme');
    });
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps the splash while the gate decided but fonts are still loading', async () => {
    const { rerender } = await renderHook(({ fonts }) => useLaunchSplash(fonts), {
      initialProps: { fonts: false },
    });
    await act(() => {
      useLaunchReadinessStore.getState().markLaunchConditionReady('biometricGate');
      useLaunchReadinessStore.getState().markLaunchConditionReady('theme');
    });
    expect(mockHideAsync).not.toHaveBeenCalled();
    await rerender({ fonts: true });
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it('releases the splash at the failsafe when a condition hangs', async () => {
    const { result } = await renderHook(() => useLaunchSplash(false));
    expect(result.current).toBe(false);
    await act(() => {
      jest.advanceTimersByTime(LAUNCH_FAILSAFE_MS - 1);
    });
    expect(mockHideAsync).not.toHaveBeenCalled();
    await act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });
});
