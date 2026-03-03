// AND-27: Floating Action Button (Material Design 3)
// FAB «Создать маршрут» для авторизованных пользователей на native
// На web не рендерится — десктоп использует хедер-кнопку

import React, { memo } from 'react';
import { Pressable, StyleSheet, Platform, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { hapticImpact } from '@/utils/haptics';

interface FloatingActionButtonProps {
  /** Иконка (Feather icon name) */
  icon?: keyof typeof Feather.glyphMap;
  /** Размер иконки */
  iconSize?: number;
  /** Callback при нажатии */
  onPress: () => void;
  /** Accessibility label */
  label: string;
  /** testID */
  testID?: string;
  /** Смещение от нижнего края (для учёта dock footer) */
  bottomOffset?: number;
}

/**
 * AND-27: Material Design 3 FAB
 *
 * Круглая кнопка 56x56dp с иконкой, плавающая в правом нижнем углу.
 * Не рендерится на web (там используется кнопка в хедере).
 */
const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  icon = 'plus',
  iconSize = 24,
  onPress,
  label,
  testID,
  bottomOffset = 80,
}) => {
  const colors = useThemedColors();

  // На web FAB не нужен — десктоп/мобильный web используют хедер-кнопки
  if (Platform.OS === 'web') return null;

  const handlePress = () => {
    hapticImpact('medium');
    onPress();
  };

  return (
    <View
      style={[
        styles.container,
        { bottom: bottomOffset },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.primary,
            shadowColor: colors.text,
          },
          pressed && styles.fabPressed,
        ]}
        onPress={handlePress}
        android_ripple={{ color: 'rgba(255,255,255,0.24)', borderless: true, radius: 28 }}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
      >
        <Feather name={icon} size={iconSize} color={colors.textOnPrimary} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: DESIGN_TOKENS.spacing.md,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 16, // M3 rounded square FAB
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  fabPressed: {
    elevation: 2,
    opacity: 0.92,
  },
});

export default memo(FloatingActionButton);

