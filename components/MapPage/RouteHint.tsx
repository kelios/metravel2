import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import IconButton from '@/components/ui/IconButton';

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
      <IconButton
        icon={<Feather name="x" size={16} color={colors.textMuted} />}
        label="Закрыть подсказку"
        size="sm"
        onPress={onDismiss}
        style={styles.closeButton}
      />
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
    width: 28,
    height: 28,
    borderRadius: 14,
    padding: 0,
    marginLeft: 8,
    marginHorizontal: 0,
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as any) : null),
  },
});
