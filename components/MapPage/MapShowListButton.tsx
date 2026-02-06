/**
 * MapShowListButton — плавающая pill-кнопка «Показать N мест списком» поверх карты
 */
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface MapShowListButtonProps {
  count: number;
  onPress: () => void;
  visible?: boolean;
}

export const MapShowListButton: React.FC<MapShowListButtonProps> = ({
  count,
  onPress,
  visible = true,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  if (!visible || count <= 0) return null;

  const label = count === 1
    ? 'Показать 1 место'
    : count < 5
    ? `Показать ${count} места`
    : `Показать ${count} мест`;

  return (
    <CardActionPressable
      accessibilityLabel={label}
      onPress={onPress}
      title={label}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Feather name="list" size={16} color={colors.textOnDark} />
      <Text style={styles.text}>{label}</Text>
    </CardActionPressable>
  );
};

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    button: {
      position: 'absolute',
      bottom: 48,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 24,
      backgroundColor: colors.text,
      zIndex: 6,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: colors.boxShadows.heavy,
            cursor: 'pointer',
          } as any)
        : colors.shadows.heavy),
    },
    buttonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.97 }],
    },
    text: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textOnDark,
    },
  });
