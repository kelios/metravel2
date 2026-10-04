// hooks/useLaunchSplash.ts
// Owner of the native launch splash (#2142). The splash is held from module
// load (app/_layout.tsx → preventAutoHideAsync) and hidden exactly once the
// launch is ready per stores/launchReadinessStore: the icon font and the
// biometric gate's decision, or the shared failsafe.
// Returns whether the failsafe expired, so the root can render without fonts.

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SplashScreen } from 'expo-router';

import { LAUNCH_FAILSAFE_MS } from '@/constants/launchSplash';
import { selectLaunchReady, useLaunchReadinessStore } from '@/stores/launchReadinessStore';

const isWeb = Platform.OS === 'web';

export function useLaunchSplash(fontsReady: boolean): boolean {
  const failsafeExpired = useLaunchReadinessStore((s) => s.failsafeExpired);
  const launchReady = useLaunchReadinessStore(selectLaunchReady);

  useEffect(() => {
    if (isWeb) return;
    const t = setTimeout(() => useLaunchReadinessStore.getState().expireLaunchFailsafe(), LAUNCH_FAILSAFE_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (fontsReady) useLaunchReadinessStore.getState().markLaunchConditionReady('fonts');
  }, [fontsReady]);

  useEffect(() => {
    if (isWeb || !launchReady) return;
    SplashScreen.hideAsync().catch((error) => {
      if (__DEV__) {
        console.warn('[useLaunchSplash] hideAsync failed:', error);
      }
    });
  }, [launchReady]);

  return failsafeExpired;
}
