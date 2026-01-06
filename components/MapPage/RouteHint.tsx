import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface RouteHintProps {
  onDismiss: () => void;
  routePointsCount: number;
}

export default function RouteHint({ onDismiss, routePointsCount }: RouteHintProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  if (routePointsCount >= 2) return null; // Скрываем, если маршрут уже построен

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <View style={styles.content}>
        <Feather name="info" size={18} color={colors.info} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Как построить маршрут</Text>
          <Text style={styles.description}>
            Сначала поставьте старт на карте, затем выберите финиш
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onDismiss}
        style={styles.closeButton}
        accessibilityRole="button"
        accessibilityLabel="Закрыть подсказку"
      >
        <Feather name="x" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
    marginBottom: 12,
  },
  containerMobile: {
    padding: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});
