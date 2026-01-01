// components/NetworkStatus.tsx
// ✅ FIX-005: Компонент для отображения статуса сети
// ✅ МИГРАЦИЯ: Полная миграция на DESIGN_TOKENS и useThemedColors
// ✅ УЛУЧШЕНИЕ: Анимированные уведомления о состоянии сети

import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface NetworkStatusProps {
  showWhenOnline?: boolean; // Показывать ли индикатор когда сеть есть
  position?: 'top' | 'bottom';
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({
  showWhenOnline = false,
  position = 'top',
}) => {
  const colors = useThemedColors();
  const { isConnected } = useNetworkStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const translateY = useSharedValue(isConnected ? -100 : 0);

  useEffect(() => {
    if (!isConnected) {
      setWasOffline(true);
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      if (wasOffline) {
        // Показываем сообщение о восстановлении соединения
        translateY.value = withTiming(0, { duration: 300 });
        const timer = setTimeout(() => {
          translateY.value = withTiming(-100, { duration: 300 });
          setTimeout(() => setWasOffline(false), 300);
        }, 2000);
        return () => clearTimeout(timer);
      } else {
        translateY.value = withTiming(-100, { duration: 300 });
      }
    }
  }, [isConnected, wasOffline, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (isConnected && !wasOffline && !showWhenOnline) {
    return null;
  }

  const message = isConnected
    ? 'Соединение восстановлено'
    : 'Нет подключения к интернету';

  const backgroundColor = isConnected ? colors.success : colors.danger;

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'top' ? styles.top : styles.bottom,
        animatedStyle,
        { backgroundColor },
      ]}
    >
      <Text style={[styles.text, { color: colors.textInverse }]}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    zIndex: 9999,
    ...Platform.select({
      web: {
        position: 'fixed' as any,
      },
    }),
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
