// components/layout/BiometricGate.native.tsx
// Cold-start biometric unlock gate (native only).
// Shown ONLY when the user opted in to biometrics AND is logged in.
// Web has a no-op sibling (BiometricGate.web.tsx) so the lock never blocks web.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useThemedColors } from '@/hooks/useTheme';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useAuth } from '@/context/AuthContext';

type GatePhase = 'idle' | 'prompting' | 'unlocked' | 'failed';

export default function BiometricGate() {
  const colors = useThemedColors();
  const { isAuthenticated, logout } = useAuth();
  const {
    isAvailable,
    isEnrolled,
    isEnabled,
    isChecking,
    authenticate,
  } = useBiometricAuth();

  // The gate is "armed" only when: biometrics opted in, hardware present,
  // enrolled, and the user is logged in. Anything else → never lock.
  const shouldGate = isEnabled && isAvailable && isEnrolled && isAuthenticated;

  const [phase, setPhase] = useState<GatePhase>('idle');
  const triggeredRef = useRef(false);

  const runAuth = useCallback(async () => {
    if (triggeredRef.current && phase === 'prompting') return;
    triggeredRef.current = true;
    setPhase('prompting');
    const ok = await authenticate('Разблокируйте MeTravel');
    setPhase(ok ? 'unlocked' : 'failed');
  }, [authenticate, phase]);

  // Auto-prompt once, after the hardware/enrollment check settles and the gate is armed.
  useEffect(() => {
    if (isChecking) return;
    if (!shouldGate) {
      // Not armed (biometrics off, no hardware, logged out) → never block.
      setPhase('unlocked');
      return;
    }
    if (!triggeredRef.current) {
      void runAuth();
    }
  }, [isChecking, shouldGate, runAuth]);

  // While the device check is in flight on an armed session, hold a neutral
  // cover so app content is not briefly visible before the prompt.
  if (!shouldGate || phase === 'unlocked') return null;

  const styles = createStyles(colors);
  const isPrompting = phase === 'prompting' || isChecking;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.card}>
        <Feather name="lock" size={48} color={colors.primary} />
        <Text style={styles.title}>MeTravel заблокирован</Text>
        <Text style={styles.subtitle}>
          Подтвердите вход с помощью биометрии, чтобы продолжить.
        </Text>

        {isPrompting ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : (
          <Pressable style={styles.primaryButton} onPress={() => void runAuth()}>
            <Feather name="unlock" size={18} color={colors.textOnPrimary} />
            <Text style={styles.primaryButtonText}>Разблокировать</Text>
          </Pressable>
        )}

        {phase === 'failed' ? (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              void logout();
            }}
          >
            <Text style={styles.secondaryButtonText}>Выйти из аккаунта</Text>
          </Pressable>
        ) : null}
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
    spinner: {
      marginTop: 12,
    },
    primaryButton: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    primaryButtonText: {
      color: colors.textOnPrimary,
      fontWeight: '800',
      fontSize: 16,
    },
    secondaryButton: {
      marginTop: 4,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    secondaryButtonText: {
      color: colors.textMuted,
      fontWeight: '600',
      fontSize: 14,
    },
  });
