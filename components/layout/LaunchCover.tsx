// components/layout/LaunchCover.tsx (native; web sibling renders nothing)
// JS twin of the native launch splash (#2142): same background, same logo,
// same size, centered. Shown while the launch is still undecided after the
// native splash is gone (font fallback, biometric prompt past the failsafe),
// so the hand-off from the native splash is invisible.
//
// Colors follow the appearance the native splash itself resolves against
// (the OS appearance as the app sees it), not the in-app theme.

import { Image, StyleSheet, View, useColorScheme } from 'react-native';

import { LAUNCH_SPLASH_BACKGROUND, LAUNCH_SPLASH_IMAGE_WIDTH } from '@/constants/launchSplash';

const LAUNCH_SPLASH_IMAGE = require('@/assets/images/splash.png');

export default function LaunchCover() {
  const scheme = useColorScheme();
  const backgroundColor =
    scheme === 'dark' ? LAUNCH_SPLASH_BACKGROUND.dark : LAUNCH_SPLASH_BACKGROUND.light;

  return (
    <View
      style={[styles.cover, { backgroundColor }]}
      pointerEvents="auto"
      testID="launch-cover"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={LAUNCH_SPLASH_IMAGE} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: LAUNCH_SPLASH_IMAGE_WIDTH,
    height: LAUNCH_SPLASH_IMAGE_WIDTH,
  },
});
