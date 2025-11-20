// MobileQuickActions.tsx
// ✅ НОВЫЙ КОМПОНЕНТ: Быстрые действия для мобильной версии

import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface MobileQuickActionsProps {
  onFiltersPress: () => void;
  onSortPress?: () => void;
  hasActiveFilters: boolean;
  resultsCount?: number;
}

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

function MobileQuickActions({
  onFiltersPress,
  onSortPress,
  hasActiveFilters,
  resultsCount,
}: MobileQuickActionsProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  if (!isMobile) return null;

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.actionButton, hasActiveFilters && styles.actionButtonActive]}
        onPress={onFiltersPress}
        accessibilityLabel="Открыть фильтры"
      >
        <Feather
          name="filter"
          size={16}
          color={hasActiveFilters ? palette.primary : palette.textMuted}
        />
        <Text style={[styles.actionText, hasActiveFilters && styles.actionTextActive]}>
          Фильтры
        </Text>
        {hasActiveFilters && (
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
          </View>
        )}
      </Pressable>

      {onSortPress && (
        <Pressable
          style={styles.actionButton}
          onPress={onSortPress}
          accessibilityLabel="Сортировка"
        >
          <Feather name="arrow-up-down" size={16} color={palette.textMuted} />
          <Text style={styles.actionText}>Сортировка</Text>
        </Pressable>
      )}

      {resultsCount !== undefined && resultsCount > 0 && (
        <View style={styles.resultsCount}>
          <Text style={styles.resultsText}>
            {resultsCount}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    position: 'relative',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        // @ts-ignore
        ':hover': {
          backgroundColor: palette.primarySoft,
        },
      },
    }),
  },
  actionButtonActive: {
    backgroundColor: palette.primarySoft,
    borderColor: palette.primary,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
    color: palette.textMuted,
  },
  actionTextActive: {
    color: palette.primary,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.primary,
  },
  badgeDot: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
    backgroundColor: palette.primary,
  },
  resultsCount: {
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: palette.primarySoft,
    borderRadius: radii.sm,
  },
  resultsText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.primary,
  },
});

// ✅ ОПТИМИЗАЦИЯ: Мемоизация компонента
export default memo(MobileQuickActions);

