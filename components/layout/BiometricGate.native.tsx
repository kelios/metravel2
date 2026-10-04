// components/layout/BiometricGate.native.tsx
// Cold-start biometric unlock gate (native only).
// Armed ONLY when the user opted in to biometrics AND is logged in.
// Web has a no-op sibling (BiometricGate.web.tsx) so the lock never blocks web.
//
// Launch contract (#2142): the gate is one of the launch conditions of
// stores/launchReadinessStore — the native splash stays up until the gate has
// decided. While deciding or prompting it shows LaunchCover (the splash's JS
// twin); the lock screen appears only after a failed/cancelled prompt.

import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import LaunchCover from '@/components/layout/LaunchCover';
import {
  isBiometricGateLaunchSettled,
  resolveBiometricGateView,
  type BiometricGatePhase,
} from '@/components/layout/biometricGateModel';
import { useThemedColors } from '@/hooks/useTheme';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useAuth } from '@/context/AuthContext';
import { useLaunchReadinessStore } from '@/stores/launchReadinessStore';
import { translate as i18nT } from '@/i18n'

export default function BiometricGate() {
  const colors = useThemedColors();
  const { isAuthenticated, authReady, logout } = useAuth();
  const {
    isAvailable,
    isEnrolled,
    isEnabled,
    isChecking,
    authenticate,
  } = useBiometricAuth();
  const failsafeExpired = useLaunchReadinessStore((s) => s.failsafeExpired);
  const markLaunchConditionReady = useLaunchReadinessStore((s) => s.markLaunchConditionReady);

  // The gate is "armed" only when: biometrics opted in, hardware present,
  // enrolled, and the user is logged in. Anything else → never lock.
  const shouldGate = isEnabled && isAvailable && isEnrolled && isAuthenticated;
  // Whether the gate is armed is known only once the session is restored and
  // the device probe settled. The launch failsafe only lifts the cover over a
  // slow probe (fail-open, as before the contract); it does not consume the
  // decision, so a probe that settles later still prompts.
  const probeSettled = authReady && !isChecking;
  const decided = probeSettled || failsafeExpired;

  const [phase, setPhase] = useState<BiometricGatePhase>('idle');
  // The gate decides once per cold start: a later sign-in does not prompt.
  const consumedRef = useRef(false);

  const runAuth = useCallback(async () => {
    setPhase('prompting');
    const ok = await authenticate(i18nT('navigation:components.layout.BiometricGate.razblokiruyte_metravel_e8f80743'));
    setPhase(ok ? 'unlocked' : 'failed');
  }, [authenticate]);

  useEffect(() => {
    if (!decided) return;
    if (!shouldGate) {
      // Not armed (biometrics off, no hardware, logged out) → never block.
      if (probeSettled) consumedRef.current = true;
      setPhase('unlocked');
      return;
    }
    if (!consumedRef.current) {
      consumedRef.current = true;
      void runAuth();
    }
  }, [decided, probeSettled, shouldGate, runAuth]);

  const view = resolveBiometricGateView({ phase, decided, shouldGate });

  useEffect(() => {
    if (isBiometricGateLaunchSettled(view)) markLaunchConditionReady('biometricGate');
  }, [view, markLaunchConditionReady]);

  if (view === 'open') return null;
  if (view === 'pending' || view === 'prompting') return <LaunchCover />;

  const styles = createStyles(colors);

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.card}>
        <Feather name="lock" size={48} color={colors.primaryDark} />
        <Text style={styles.title}>{i18nT('navigation:components.layout.BiometricGate.metravel_zablokirovan_8dcb0074')}</Text>
        <Text style={styles.subtitle}>
          {i18nT('navigation:components.layout.BiometricGate.podtverdite_vhod_s_pomoschyu_biometrii_chtob_3fa03608')}</Text>

        <Button
          label={i18nT('navigation:components.layout.BiometricGate.razblokirovat_f1634eec')}
          onPress={() => void runAuth()}
          variant="primary"
          icon={<Feather name="unlock" size={18} color={colors.textOnPrimary} />}
          style={styles.primaryButton}
        />

        <Button
          label={i18nT('navigation:components.layout.BiometricGate.vyyti_iz_akkaunta_22641000')}
          onPress={() => void logout()}
          variant="ghost"
          style={styles.secondaryButton}
        />
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 9999,
      elevation: 9999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      backgroundColor: colors.background,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      alignItems: 'center',
      gap: 12,
      padding: 28,
      borderRadius: 20,
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
    },
    primaryButton: {
      marginTop: 12,
    },
    secondaryButton: {
      marginTop: 4,
    },
  });
