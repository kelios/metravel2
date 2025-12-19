// StickySearchBar.tsx
// ✅ НОВЫЙ КОМПОНЕНТ: Sticky поисковая строка с быстрыми действиями

import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Text,
  Platform,
  Dimensions,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';

interface StickySearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onFiltersPress?: () => void;
  hasActiveFilters: boolean;
  availableWidth?: number;
  primaryAction?: {
    label: string
    onPress: () => void
    accessibilityLabel?: string
  }
  resultsCount?: number;
  sortOptions?: Array<{ value: string; label: string }>;
  onSortChange?: (sort: string) => void;
  currentSort?: string;
  placeholder?: string;
  onToggleRecommendations?: () => void;
  isRecommendationsVisible?: boolean;
  onClearAll?: () => void;
  activeFiltersCount?: number;
}

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

function StickySearchBar({
  search,
  onSearchChange,
  onFiltersPress,
  hasActiveFilters,
  availableWidth,
  primaryAction,
  resultsCount,
  sortOptions = [],
  onSortChange,
  currentSort,
  placeholder = 'Найти путешествия...',
  onToggleRecommendations,
  isRecommendationsVisible,
  onClearAll,
  activeFiltersCount,
}: StickySearchBarProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const webWidth = Platform.OS === 'web' ? Dimensions.get('window').width : 0;

  // UX УЛУЧШЕНИЕ: Показываем счетчик только если есть результаты
  const showResultsCount = resultsCount !== undefined && resultsCount > 0 && !isMobile;
  const shouldReserveDesktopResultsSlot = Platform.OS === 'web' && !isMobile;
  const shouldReserveDesktopClearAllSlot = Platform.OS === 'web' && !isMobile && !!onClearAll;
  const showClearAll = !!onClearAll && (hasActiveFilters || search.length > 0) && !isMobile;

  // Keyboard shortcut для фокуса (Ctrl+K / Cmd+K)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Mobile web specific styles
  const isMobileWeb = Platform.OS === 'web' && webWidth > 0 && webWidth <= 1024;

  return (
    <View
      style={[
        styles.container,
        isMobile && Platform.OS === 'web' ? styles.containerMobileWeb : null,
        isFocused && styles.containerFocused,
      ]}
    >
      <View
        style={[styles.inner]}
      >
        <View style={[styles.contentRow, isMobile && styles.contentRowMobile]}>
          <View
            style={[
              styles.searchBox,
              isMobile && styles.searchBoxMobile,
              !isMobile && Platform.OS === 'web' ? ({ maxWidth: 760, minWidth: 420 } as any) : null,
            ]}
          >
          <Feather
            name="search"
            size={18}
            color={isFocused ? palette.primary : palette.textMuted}
          />
          <TextInput
            ref={inputRef}
            value={search}
            onChangeText={onSearchChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            placeholderTextColor={palette.textSubtle}
            style={styles.input}
            returnKeyType="search"
            accessibilityLabel="Поиск путешествий"
            {...Platform.select({
              web: {
                // @ts-ignore
                'aria-label': 'Поиск путешествий. Нажмите Ctrl+K для быстрого доступа',
              },
            })}
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => onSearchChange('')}
              style={styles.clearButton}
              accessibilityLabel="Очистить поиск"
            >
              <Feather name="x" size={16} color={palette.textMuted} />
            </Pressable>
          )}
          {!isMobile && Platform.OS === 'web' && (
            <View style={styles.shortcutHint}>
              <Text style={styles.shortcutText}>Ctrl+K</Text>
            </View>
          )}
          </View>

          {/* Действия */}
          <View style={[styles.actions, !isMobile && styles.actionsDesktop, isMobile && styles.actionsMobile]}>
          {(showResultsCount || shouldReserveDesktopResultsSlot) && (
            <View
              style={[
                styles.resultsInline,
                !showResultsCount ? ({ opacity: 0 } as any) : null,
                Platform.OS === 'web' && ({ pointerEvents: showResultsCount ? 'auto' : 'none' } as any),
              ]}
              {...(Platform.OS !== 'web'
                ? ({ pointerEvents: showResultsCount ? 'auto' : 'none' } as any)
                : {})}
              testID="results-count-wrapper"
            >
              <Text style={styles.resultsText} testID="results-count-text">
                Найдено: {resultsCount ?? 0}{' '}
                {resultsCount === 1
                  ? 'путешествие'
                  : (resultsCount ?? 0) < 5
                    ? 'путешествия'
                    : 'путешествий'}
              </Text>
            </View>
          )}

          {/* Рекомендации */}
          {onToggleRecommendations && (
            <Pressable
              testID="toggle-recommendations-button"
              onPress={onToggleRecommendations}
              style={[
                styles.actionButton,
                isMobile && Platform.OS === 'web' ? styles.actionButtonMobileWeb : null,
                isRecommendationsVisible && styles.actionButtonActive,
              ]}
              accessibilityLabel={isRecommendationsVisible ? "Скрыть рекомендации" : "Показать рекомендации"}
              accessibilityState={{ selected: !!isRecommendationsVisible }}
            >
              <MaterialIcons
                name="lightbulb-outline"
                size={20}
                color={isRecommendationsVisible ? palette.primary : palette.textMuted}
              />
            </Pressable>
          )}

          {/* Кнопка фильтров: показываем только на мобильных, на вебе фильтры всегда в левой панели */}
          {onFiltersPress && isMobile && (
            <Pressable
              testID="filters-button"
              onPress={onFiltersPress}
              style={[
                styles.actionButton,
                isMobile && Platform.OS === 'web' ? styles.actionButtonMobileWeb : null,
                hasActiveFilters && styles.actionButtonActive,
              ]}
              accessibilityLabel="Открыть фильтры"
              accessibilityHint={hasActiveFilters ? `Активно фильтров: ${activeFiltersCount ?? 0}` : undefined}
            >
              <Feather
                name="filter"
                size={16}
                color={hasActiveFilters ? palette.primary : palette.textMuted}
              />
              {hasActiveFilters && (
                <View style={styles.badge} testID="filters-badge">
                  <View style={styles.badgeDot} />
                </View>
              )}
            </Pressable>
          )}

          {/* Сбросить все (если есть активные фильтры или поиск) */}
          {(showClearAll || shouldReserveDesktopClearAllSlot) && (
            <Pressable
              testID="clear-all-button"
              onPress={showClearAll ? onClearAll : undefined}
              disabled={!showClearAll}
              style={[
                styles.clearAllButton,
                !showClearAll ? ({ opacity: 0 } as any) : null,
                Platform.OS === 'web' && ({ pointerEvents: showClearAll ? 'auto' : 'none' } as any),
              ]}
              {...(Platform.OS !== 'web'
                ? ({ pointerEvents: showClearAll ? 'auto' : 'none' } as any)
                : {})}
              accessibilityLabel="Сбросить все фильтры и поиск"
            >
              <Feather name="x-circle" size={14} color={palette.textMuted} />
              {!isMobile && <Text style={styles.clearAllText}>Сбросить</Text>}
            </Pressable>
          )}
        </View>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    paddingHorizontal: Platform.select({ default: spacing.sm, web: spacing.md }),
    paddingVertical: Platform.select({ default: spacing.sm, web: spacing.sm }),
    gap: Platform.select({ default: spacing.xs, web: spacing.xs }),
    minHeight: Platform.select({ default: 52, web: 60 }),
    ...Platform.select({
      web: {
        boxShadow: 'none',
      },
    }),
  },
  containerMobileWeb: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 0,
  },
  inner: {
    width: '100%',
    ...Platform.select({
      web: {
        maxWidth: 1120,
        marginLeft: 'auto',
        marginRight: 'auto',
      } as any,
    }),
  },
  containerFocused: {
    borderColor: palette.primary,
    ...Platform.select({
      web: {
        boxShadow: 'none',
      },
    }),
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ default: spacing.xs, web: spacing.sm }),
  },
  contentRowMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  searchBox: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.background,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: Platform.select({ default: spacing.sm, web: spacing.md }),
    paddingVertical: Platform.select({ default: spacing.xs, web: spacing.sm }),
    gap: spacing.xs,
    height: Platform.select({ default: 40, web: 44 }), // Чуть ниже на мобильных
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      } as any,
    }),
  },
  searchBoxMobile: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  input: {
    flex: 1,
    fontSize: Platform.select({ default: 14, web: 15 }),
    color: palette.text,
    padding: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        boxShadow: 'none',
        borderColor: 'transparent',
      },
    }),
  },
  clearButton: {
    padding: spacing.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  shortcutHint: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    backgroundColor: palette.surfaceMuted,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.border,
  },
  shortcutText: {
    fontSize: 11,
    color: palette.textMuted,
    fontFamily: Platform.select({
      web: 'monospace',
      default: 'monospace',
    }),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ default: spacing.xs, web: spacing.sm }),
  },
  actionsDesktop: {
    flexShrink: 0,
    flexWrap: 'nowrap',
  },
  resultsInline: {
    paddingHorizontal: 10,
    height: Platform.select({ default: 36, web: 44 }),
    minWidth: Platform.select({ default: 0, web: 150 }),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.border,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: Platform.select({ default: 40, web: 44 }),
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: palette.surface,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.primary,
  },
  primaryActionRowMobile: {
    paddingTop: spacing.xs,
    alignItems: 'flex-start',
  },
  actionsMobile: {
    flexShrink: 0,
    justifyContent: 'flex-start',
  },
  actionButton: {
    width: Platform.select({ default: 36, web: 44 }),
    height: Platform.select({ default: 36, web: 44 }),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: palette.surface,
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
          borderColor: palette.primary,
        },
      },
    }),
  },
  actionButtonMobileWeb: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
  actionButtonActive: {
    backgroundColor: palette.primarySoft,
    borderColor: palette.primary,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primary,
  },
  badgeDot: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: palette.primary,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    height: Platform.select({ default: 40, web: 44 }),
    borderRadius: radii.pill,
    backgroundColor: palette.surfaceMuted,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  clearAllText: {
    fontSize: 13,
    color: palette.textMuted,
    fontWeight: '500',
  },
  resultsText: {
    fontSize: 11,
    color: palette.textMuted,
    fontWeight: '500',
  },
});

// ✅ ОПТИМИЗАЦИЯ: Мемоизация компонента
export default memo(StickySearchBar);

