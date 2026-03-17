// StickySearchBar.tsx
// ✅ НОВЫЙ КОМПОНЕНТ: Sticky поисковая строка с быстрыми действиями

import { useState, useRef, useEffect, memo, useMemo } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Text,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { getTravelLabel } from '@/services/pdf-export/utils/pluralize';

interface QuickFilterChip {
  id: string;
  label: string;
  active?: boolean;
}

interface StickySearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onFiltersPress?: () => void;
  hasActiveFilters: boolean;
  flush?: boolean;
  resultsCount?: number;
  placeholder?: string;
  onToggleRecommendations?: () => void;
  isRecommendationsVisible?: boolean;
  onClearAll?: () => void;
  activeFiltersCount?: number;
  // SRCH-06: Quick-filter chips
  quickFilters?: QuickFilterChip[];
  onQuickFilterPress?: (id: string) => void;
}

const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

const useStyles = (colors: ReturnType<typeof useThemedColors>) => useMemo(() => StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.lg,
    paddingHorizontal: Platform.select({ default: spacing.sm, web: spacing.md }),
    paddingVertical: Platform.select({ default: spacing.sm, web: spacing.sm }),
    gap: Platform.select({ default: spacing.xs, web: spacing.xs }),
    minHeight: Platform.select({ default: 52, web: 60 }),
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.card,
      },
    }),
  },
  containerMobile: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    minHeight: 44,
    borderRadius: radii.md,
  },
  containerFlush: {
    paddingHorizontal: 0,
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
  innerFlush: {
    ...Platform.select({
      web: {
        maxWidth: '100%',
        marginLeft: 0,
        marginRight: 0,
      } as any,
    }),
  },
  containerFocused: {
    borderColor: colors.borderStrong,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ default: spacing.xs, web: spacing.sm }),
    ...Platform.select({
      web: {
        justifyContent: 'space-between',
      } as any,
    }),
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
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    paddingHorizontal: Platform.select({ default: spacing.sm, web: spacing.md }),
    paddingVertical: Platform.select({ default: spacing.xs, web: spacing.sm }),
    gap: spacing.xs,
    height: Platform.select({ default: 46, web: 56 }),
    ...Platform.select({
      web: {
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: colors.boxShadows.light,
      } as any,
    }),
  },
  searchBoxMobile: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
    height: 40,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    gap: 6,
  },
  input: {
    flex: 1,
    fontSize: Platform.select({ default: 15, web: 16 }),
    fontWeight: '400',
    color: colors.text,
    padding: 0,
    lineHeight: Platform.select({ default: 22, web: 24 }),
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        boxShadow: 'none',
        borderColor: 'transparent',
      },
    }),
  },
  inputMobile: {
    fontSize: 16,
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
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: Platform.select({
      web: 'monospace',
      default: 'monospace',
    }),
  },
  // SRCH-06: Quick-filter chips
  quickFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    ...Platform.select({
      web: { overflowX: 'auto', paddingBottom: 2 } as any,
    }),
  },
  quickChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    ...Platform.select({
      web: { cursor: 'pointer', transition: 'all 0.18s ease' } as any,
    }),
  },
  quickChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryAlpha30,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    lineHeight: 16,
  },
  quickChipTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ default: spacing.xs, web: spacing.sm }),
  },
  actionsDesktop: {
    flexShrink: 0,
    flexWrap: 'nowrap',
    padding: 4,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.light,
      } as any,
    }),
  },
  resultsInline: {
    paddingHorizontal: spacing.sm,
    height: Platform.select({ default: 40, web: 52 }),
    minWidth: Platform.select({ default: 0, web: 216 }),
    ...(Platform.OS === 'web' ? ({ width: 216 } as any) : null),
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  actionsMobile: {
    flexShrink: 0,
    justifyContent: 'flex-start',
  },
  actionButton: {
    width: Platform.select({ default: 46, web: 52 }),
    height: Platform.select({ default: 46, web: 52 }),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    position: 'relative',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  actionButtonHovered: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
  },
  actionButtonMobile: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  actionButtonMobileWeb: {
    width: 46,
    height: 46,
    borderRadius: 12,
  },
  actionButtonActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryAlpha40,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeDot: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  badgeCount: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textOnPrimary,
    lineHeight: 12,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    height: Platform.select({ default: 46, web: 52 }),
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  clearAllText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  resultsText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
    ...(Platform.OS === 'web'
      ? ({
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        } as any)
      : null),
  },
  resultsLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  searchBoxFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
    ...Platform.select({
      web: {
        boxShadow: `0 0 0 3px ${colors.primaryAlpha20 || 'rgba(59, 130, 246, 0.1)'}`,
      } as any,
    }),
  },
  clearButtonIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  inlineIconSlot: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionIconSlot: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  shortcutHintDesktop: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  recommendationAccent: {
    position: 'absolute',
    bottom: 6,
    width: 16,
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
}), [colors]);

function StickySearchBar({
  search,
  onSearchChange,
  onFiltersPress,
  hasActiveFilters,
  flush = false,
  resultsCount,
  placeholder = 'Найти путешествия...',
  onToggleRecommendations,
  isRecommendationsVisible,
  onClearAll,
  activeFiltersCount,
  quickFilters,
  onQuickFilterPress,
}: StickySearchBarProps) {
  const colors = useThemedColors();
  const { isPhone, isLargePhone, width } = useResponsive();
  const isJestEnv = typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined;
  const effectiveWidth =
    Platform.OS === 'web' && !isJestEnv && typeof window !== 'undefined'
      ? window.innerWidth
      : width;
  const isMobile =
    Platform.OS === 'web'
      ? effectiveWidth < METRICS.breakpoints.tablet
      : isPhone || isLargePhone;
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const searchIconSize = isMobile ? 16 : 18;
  const actionIconSize = isMobile ? 18 : 20;
  const filterIconSize = isMobile ? 14 : 16;
  const isMac = Platform.OS === 'web' && typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K';

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

  // Mobile web specific styles (оставлено для будущего использования)
  // const isMobileWeb = Platform.OS === 'web' && webWidth > 0 && webWidth <= 1024;

  const styles = useStyles(colors);

  return (
    <View
      style={[
        styles.container,
        flush && Platform.OS === 'web' ? styles.containerFlush : null,
        isMobile && Platform.OS === 'web' ? styles.containerMobileWeb : null,
        isMobile ? styles.containerMobile : null,
        isFocused && styles.containerFocused,
      ]}
    >
      <View
        style={[styles.inner, flush && Platform.OS === 'web' ? styles.innerFlush : null]}
      >
        <View style={[styles.contentRow, isMobile && styles.contentRowMobile]}>
          <View
            style={[
              styles.searchBox,
              isFocused && styles.searchBoxFocused,
              isMobile && styles.searchBoxMobile,
            ]}
          >
          <View style={styles.inlineIconSlot}>
            <Feather
              name="search"
              size={searchIconSize}
              color={isFocused ? colors.primary : colors.textMuted}
            />
          </View>
          <TextInput
            ref={inputRef}
            value={search}
            onChangeText={onSearchChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, isMobile && styles.inputMobile]}
            returnKeyType="search"
            accessibilityLabel="Поиск путешествий"
            {...Platform.select({
              web: {
                // @ts-ignore -- aria-label is a web-only ARIA attribute not in RN TextInput types
                'aria-label': `Поиск путешествий. Нажмите ${shortcutLabel} для быстрого доступа`,
              },
            })}
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => onSearchChange('')}
              accessibilityLabel="Очистить поиск"
              style={[styles.clearButton, { pointerEvents: 'box-only' }, globalFocusStyles.focusable]}
            >
              <View style={styles.clearButtonIconWrap}>
                <Feather name="x" size={14} color={colors.textMuted} style={{ pointerEvents: 'none' }} />
              </View>
            </Pressable>
          )}
          {!isMobile && Platform.OS === 'web' && (
            <View style={[styles.shortcutHint, styles.shortcutHintDesktop]}>
              <Text style={styles.shortcutText}>{shortcutLabel}</Text>
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
                ({ pointerEvents: showResultsCount ? 'auto' : 'none' } as any),
              ]}
              testID="results-count-wrapper"
            >
              <Text style={styles.resultsLabel}>Результаты</Text>
              <Text style={styles.resultsText} testID="results-count-text">
                {resultsCount ?? 0} {getTravelLabel(resultsCount ?? 0)}
              </Text>
            </View>
          )}

          {/* Рекомендации */}
          {onToggleRecommendations && (
            <Pressable
              testID="toggle-recommendations-button"
              onPress={onToggleRecommendations}
              style={({ hovered }: any) => [
                styles.actionButton,
                isMobile && Platform.OS === 'web' ? styles.actionButtonMobileWeb : null,
                isMobile ? styles.actionButtonMobile : null,
                isRecommendationsVisible && styles.actionButtonActive,
                !isRecommendationsVisible && hovered && Platform.OS === 'web' && styles.actionButtonHovered,
                globalFocusStyles.focusable,
              ]}
              accessibilityLabel={isRecommendationsVisible ? "Скрыть рекомендации" : "Показать рекомендации"}
              accessibilityState={{ selected: !!isRecommendationsVisible }}
            >
              <View style={styles.actionIconSlot}>
                <Feather
                  name="zap"
                  size={actionIconSize}
                  color={isRecommendationsVisible ? colors.primary : colors.textMuted}
                />
              </View>
              {isRecommendationsVisible && <View style={styles.recommendationAccent} />}
            </Pressable>
          )}

          {/* Кнопка фильтров: показываем только на мобильных, на вебе фильтры всегда в левой панели */}
          {onFiltersPress && isMobile && (
            <Pressable
              testID="filters-button"
              onPress={onFiltersPress}
              style={({ hovered }: any) => [
                styles.actionButton,
                isMobile && Platform.OS === 'web' ? styles.actionButtonMobileWeb : null,
                isMobile ? styles.actionButtonMobile : null,
                hasActiveFilters && styles.actionButtonActive,
                !hasActiveFilters && hovered && Platform.OS === 'web' && styles.actionButtonHovered,
                globalFocusStyles.focusable,
              ]}
              accessibilityLabel="Открыть фильтры"
              accessibilityHint={hasActiveFilters ? `Активно фильтров: ${activeFiltersCount ?? 0}` : undefined}
            >
              <View style={styles.actionIconSlot}>
                <Feather
                  name="filter"
                  size={filterIconSize}
                  color={hasActiveFilters ? colors.primary : colors.textMuted}
                />
              </View>
              {hasActiveFilters && activeFiltersCount != null && activeFiltersCount > 0 && (
                <View style={styles.badge} testID="filters-badge">
                  <Text style={styles.badgeCount}>{activeFiltersCount > 99 ? '99+' : activeFiltersCount}</Text>
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
                ({ pointerEvents: showClearAll ? 'auto' : 'none' } as any),
                globalFocusStyles.focusable,
              ]}
              accessibilityLabel="Сбросить все фильтры и поиск"
            >
              <View style={styles.inlineIconSlot}>
                <Feather name="x-circle" size={14} color={colors.textMuted} />
              </View>
              {!isMobile && <Text style={styles.clearAllText}>Сбросить</Text>}
            </Pressable>
          )}
        </View>
      </View>
      </View>
      {/* SRCH-06: Quick-filter chips */}
      {quickFilters && quickFilters.length > 0 && (
        <View style={styles.quickFiltersRow} accessibilityRole="toolbar" accessibilityLabel="Быстрые фильтры">
          {quickFilters.map((chip) => (
            <Pressable
              key={chip.id}
              onPress={() => onQuickFilterPress?.(chip.id)}
              style={[styles.quickChip, chip.active && styles.quickChipActive, globalFocusStyles.focusable]}
              accessibilityRole="button"
              accessibilityLabel={chip.label}
              accessibilityState={{ selected: !!chip.active }}
            >
              {chip.active && (
                <View style={styles.inlineIconSlot}>
                  <Feather name="check" size={11} color={colors.primaryText} />
                </View>
              )}
              <Text style={[styles.quickChipText, chip.active && styles.quickChipTextActive]}>
                {chip.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}


// ✅ ОПТИМИЗАЦИЯ: Мемоизация компонента
export default memo(StickySearchBar);
