// constants/launchSplash.ts
// Geometry and colors of the native launch splash, mirrored for the JS launch
// cover (#2142). The source of truth is the `expo-splash-screen` plugin entry
// in app.json (logo `assets/images/splash.png`, required by LaunchCover so the
// web bundle never references it);
// `__tests__/config/launch-splash-contract.test.ts` fails when this mirror or
// the committed iOS splash assets drift from it.

/** Logo width in points/dp — the plugin's `imageWidth` (default 100). */
export const LAUNCH_SPLASH_IMAGE_WIDTH = 100;

export const LAUNCH_SPLASH_BACKGROUND = {
  light: '#ffffff',
  dark: '#1a1a2e',
} as const;

/**
 * Liveness cap of the launch: the native splash is released and an undecided
 * biometric gate opens after this long even if a launch condition hangs
 * (font load, Keychain read, LocalAuthentication probe). It never gates a
 * normal start — those finish on real events well before it.
 */
export const LAUNCH_FAILSAFE_MS = 3000;
