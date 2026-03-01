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

export const MapShowListButton: React.FC<MapShowListButtonProps> = React.memo(({
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
      <Feather name="list" size={14} color={colors.primary} />
      <Text style={styles.text}>{label}</Text>
    </CardActionPressable>
  );
});

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    button: {
      position: 'absolute',
      bottom: 52,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      zIndex: 6,
      ...(Platform.OS === 'web'
        ? ({
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            cursor: 'pointer',
          } as any)
        : colors.shadows.medium),
    },
    buttonPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.97 }],
    },
    text: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
  });
