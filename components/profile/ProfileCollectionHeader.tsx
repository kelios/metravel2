import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';

type Props = {
  title: string;
  subtitle?: string;
  onBackPress: () => void;
  showClearButton?: boolean;
  onClearPress?: () => void;
  clearAccessibilityLabel?: string;
  clearButtonText?: string;
  backAccessibilityLabel?: string;
};

export default function ProfileCollectionHeader({
  title,
  subtitle = 'Профиль',
  onBackPress,
  showClearButton = false,
  onClearPress,
  clearAccessibilityLabel = 'Очистить',
  clearButtonText = 'Очистить',
  backAccessibilityLabel = 'Перейти в профиль',
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 8,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
        },
        headerTitleBlock: {
          flex: 1,
        },
        title: {
          fontSize: 20,
          fontWeight: '700',
          color: colors.text,
        },
        subtitle: {
          marginTop: 4,
          fontSize: 13,
          color: colors.textMuted,
        },
        clearButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: DESIGN_TOKENS.radii.md,
          borderWidth: 1,
          borderColor: colors.danger,
          backgroundColor: colors.surface,
          minHeight: 40,
        },
        clearButtonText: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.danger,
        },
        backToProfileButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: DESIGN_TOKENS.radii.md,
          borderWidth: 1,
          borderColor: colors.borderLight,
          backgroundColor: colors.surface,
          minHeight: 40,
        },
        backToProfileButtonText: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.primary,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <Pressable
          style={[styles.backToProfileButton, globalFocusStyles.focusable]}
          onPress={onBackPress}
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel}
          {...Platform.select({ web: { cursor: 'pointer' } })}
        >
          <Feather name="user" size={16} color={colors.primary} />
          <Text style={styles.backToProfileButtonText}>В профиль</Text>
        </Pressable>

        {showClearButton && typeof onClearPress === 'function' && (
          <Pressable
            style={[styles.clearButton, globalFocusStyles.focusable]}
            onPress={onClearPress}
            accessibilityRole="button"
            accessibilityLabel={clearAccessibilityLabel}
            {...Platform.select({ web: { cursor: 'pointer' } })}
          >
            <Feather name="trash-2" size={16} color={colors.danger} />
            <Text style={styles.clearButtonText}>{clearButtonText}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
