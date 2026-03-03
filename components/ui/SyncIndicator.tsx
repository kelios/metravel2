// components/ui/SyncIndicator.tsx
// AND-10: Индикатор синхронизации данных при восстановлении сети.
// Показывается на 3 секунды при переходе offline → online.

import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Platform, ActivityIndicator, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

/**
 * AND-10: Компонент «Синхронизация данных...»
 *
 * Появляется при восстановлении связи после offline-периода.
 * Показывает spinner + текст на 3 секунды, затем скрывается.
 * На web не рендерится (web NetworkStatus уже показывает «Соединение восстановлено»).
 */
export function SyncIndicator() {
  // На web NetworkStatus.web.tsx уже обрабатывает восстановление — не дублируем
  if (Platform.OS === 'web') return null;

  return <SyncIndicatorNative />;
}

function SyncIndicatorNative() {
  const colors = useThemedColors();
  const { isConnected } = useNetworkStatus();
  const [visible, setVisible] = useState(false);
  const wasOfflineRef = useRef(false);
  const translateY = useSharedValue(-60);

  useEffect((): (() => void) | void => {
    if (!isConnected) {
      wasOfflineRef.current = true;
      return;
    }

    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setVisible(true);
      translateY.value = withTiming(0, { duration: 300 });

      const timer = setTimeout(() => {
        translateY.value = withTiming(-60, { duration: 300 });
        setTimeout(() => setVisible(false), 350);
      }, 3000);

      return () => { clearTimeout(timer); };
    }
  }, [isConnected, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        { backgroundColor: colors.info },
      ]}
      accessibilityRole="alert"
      accessibilityLabel="Синхронизация данных"
    >
      <View style={styles.content}>
        <ActivityIndicator size="small" color={colors.textInverse} />
        <Text style={[styles.text, { color: colors.textInverse }]}>
          Синхронизация данных...
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    zIndex: 9998, // Чуть ниже NetworkStatus (9999)
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

