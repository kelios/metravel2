import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
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
  /**
   * Компактная шапка для экранов с тяжёлым контентом под ней (календарь):
   * на телефоне держит заголовок и кнопку «В профиль» в одной строке,
   * скрывает подзаголовок и поджимает вертикальные паддинги — чтобы под
   * фиксированной шапкой сразу был виден контент (правило «шапка ≤20%»).
   */
  dense?: boolean;
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
  dense = false,
}: Props) {
  const colors = useThemedColors();
  const { isPhone } = useResponsive();
  const stackOnPhone = isPhone && !dense;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          paddingHorizontal: 16,
          paddingTop: dense ? 6 : 8,
          paddingBottom: dense ? 4 : 6,
        },
        headerRow: {
          flexDirection: stackOnPhone ? 'column' : 'row',
          alignItems: stackOnPhone ? 'stretch' : 'flex-end',
          justifyContent: 'space-between',
          gap: 8,
        },
        headerTitleBlock: {
          flexGrow: 1,
          flexShrink: stackOnPhone ? 0 : 1,
          flexBasis: stackOnPhone ? 'auto' : 0,
        },
        headerActions: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        },
        title: {
          fontSize: 18,
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
    [colors, dense, stackOnPhone]
  );

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.title}>{title}</Text>
          {!dense && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        <View style={styles.headerActions}>
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
    </View>
  );
}
