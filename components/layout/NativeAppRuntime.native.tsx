import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { Fragment } from 'react';

import { useThemedColors } from '@/hooks/useTheme';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import BiometricGate from '@/components/layout/BiometricGate';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';

export default function NativeAppRuntime() {
  const colors = useThemedColors();
  const currentColorScheme = useColorScheme();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    try {
      const NavigationBar = require('expo-navigation-bar');
      NavigationBar.setBackgroundColorAsync(colors.background);
      NavigationBar.setButtonStyleAsync(
        currentColorScheme === 'dark' ? 'light' : 'dark'
      );
    } catch {
      // expo-navigation-bar not available — ok
    }
  }, [colors.background, currentColorScheme]);

  usePushNotifications({
    autoRequest: false,
  });

  // BiometricGate renders an absolute-fill overlay above app content when armed.
  // OnboardingScreen is a sibling overlay (lower zIndex) shown once on first run;
  // both no-op (return null) when not needed, so the home tab stays interactive.
  return (
    <Fragment>
      <OnboardingScreen />
      <BiometricGate />
    </Fragment>
  );
}
