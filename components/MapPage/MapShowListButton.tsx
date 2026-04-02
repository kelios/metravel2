/**
 * MapShowListButton — плавающая pill-кнопка «Показать N мест списком» поверх карты
 */
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface MapShowListButtonProps {
  count: number;
  onPress: () => void;
  visible?: boolean;
  bottomOffset?: number;
}

const MOBILE_WEB_BOTTOM_CHROME_GAP = 28;

export const MapShowListButton: React.FC<MapShowListButtonProps> = React.memo(({
  count,
  onPress,
  visible = true,
  bottomOffset = 0,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors, bottomOffset), [colors, bottomOffset]);

  if (!visible || count <= 0) return null;

  const shortLabel = count === 1
    ? '1 место'
    : count < 5
    ? `${count} места`
    : `${count} мест`;
  const ariaLabel = `Показать ${shortLabel} списком`;

  return (
    <CardActionPressable
      accessibilityLabel={ariaLabel}
      onPress={onPress}
      title={ariaLabel}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <View style={styles.iconBubble}>
        <Feather name="list" size={13} color={colors.textOnPrimary} />
      </View>
      <Text style={styles.text}>Открыть список</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{count > 999 ? '999+' : count}</Text>
      </View>
    </CardActionPressable>
  );
});

const getStyles = (colors: ThemedColors, bottomOffset: number = 0) =>
  StyleSheet.create({
    button: {
      position: 'absolute',
      bottom:
        Platform.OS === 'web'
          ? (`calc(${60 + bottomOffset}px + env(safe-area-inset-bottom) + ${MOBILE_WEB_BOTTOM_CHROME_GAP}px)` as any)
          : 60 + bottomOffset,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.primary,
      borderWidth: 0,
      zIndex: 6,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: `0 4px 20px ${colors.primary}55, 0 1px 4px rgba(0,0,0,0.08)`,
            cursor: 'pointer',
            transition: 'opacity 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease',
          } as any)
        : {
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 14,
            elevation: 8,
          }),
    },
    buttonPressed: {
      opacity: 0.82,
      ...(Platform.OS === 'web' ? ({ transform: 'translateY(1px)' } as any) : null),
    },
    iconBubble: {
      width: 22,
      height: 22,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    text: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textOnPrimary,
      letterSpacing: 0.1,
    },
    badge: {
      minWidth: 26,
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.24)',
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
  });
