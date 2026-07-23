import { Fragment } from 'react';

import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useIncomingAppLinks } from '@/hooks/useIncomingAppLinks.native';
import BiometricGate from '@/components/layout/BiometricGate';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';

export default function NativeAppRuntime() {
  useIncomingAppLinks();
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
