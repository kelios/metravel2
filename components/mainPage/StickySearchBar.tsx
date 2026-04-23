// StickySearchBar.tsx
// ✅ НОВЫЙ КОМПОНЕНТ: Sticky поисковая строка с быстрыми действиями

import { useState, useRef, useEffect, memo, useMemo, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Text,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { getTravelLabel } from '@/services/pdf-export/utils/pluralize';
import Chip from '@/components/ui/Chip';
import {
  getStickySearchShortcutLabel,
  getStickySearchUiState,
  getStickySearchViewportState,
  type QuickFilterChip,
} from '@/components/mainPage/stickySearchBarModel';

interface StickySearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onFiltersPress?: () => void;
  hasActiveFilters: boolean;
  isSearchPending?: boolean;
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
    paddingHorizontal: Platform.select({ default: spacing.xs, web: spacing.xs }),
    paddingVertical: Platform.select({ default: spacing.xxs, web: spacing.xxs }),
    gap: Platform.select({ default: spacing.xs, web: spacing.xs }),
    minHeight: Platform.select({ default: 46, web: 48 }),
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        backgroundColor: colors.surfaceElevated,
        boxShadow: colors.boxShadows.card,
      } as any,
    }),
  },
  containerMobile: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    minHeight: 42,
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
    borderColor: colors.primary,
    ...Platform.select({
      web: {
        boxShadow: `${colors.boxShadows.card}, 0 0 0 3px ${colors.primaryAlpha30}`,
      } as any,
    }),
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
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    paddingHorizontal: Platform.select({ default: spacing.sm, web: spacing.sm }),
    paddingVertical: Platform.select({ default: spacing.xxs, web: spacing.xxs }),
    gap: spacing.xs,
    height: Platform.select({ default: 38, web: 40 }),
    ...Platform.select({
      web: {
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      } as any,
    }),
  },
  searchBoxMobile: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
    height: 38,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    gap: 6,
  },
  input: {
    flex: 1,
    fontSize: Platform.select({ default: 14, web: 15 }),
    fontWeight: '400',
    color: colors.text,
    padding: 0,
    lineHeight: Platform.select({ default: 20, web: 22 }),
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
    flexShrink: 0,
    minHeight: 36,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ default: spacing.xs, web: spacing.sm }),
  },
  actionsDesktop: {
    flexShrink: 0,
    flexWrap: 'nowrap',
    padding: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
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
  mobileSummaryRow: {
    minHeight: 20,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  mobileSummaryText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  mobileSummaryMuted: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  pendingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 20,
  },
  pendingStatusText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  actionsMobile: {
    flexShrink: 0,
    justifyContent: 'flex-start',
  },
  actionButton: {
    width: Platform.select({ default: 42, web: 46 }),
    height: Platform.select({ default: 42, web: 46 }),
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
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  actionButtonMobileWeb: {
    width: 42,
    height: 42,
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
    borderColor: 'transparent',
    backgroundColor: 'transparent',
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
  isSearchPending = false,
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
  const { isMac, isMobile } = getStickySearchViewportState({
    isJestEnv,
    isLargePhone,
    isPhone,
    width,
  });
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const searchIconSize = isMobile ? 16 : 18;
  const actionIconSize = isMobile ? 18 : 20;
  const filterIconSize = isMobile ? 14 : 16;
  const shortcutLabel = getStickySearchShortcutLabel(isMac);
  const {
    shouldReserveDesktopClearAllSlot,
    shouldReserveDesktopResultsSlot,
    showClearAll,
    showPendingState,
    showResultsCount,
  } = getStickySearchUiState({
    hasActiveFilters,
    isMobile,
    isSearchPending,
    onClearAll,
    resultsCount,
    search,
  });
  const showMobileSummary =
    isMobile &&
    (showPendingState || resultsCount !== undefined || activeFiltersCount !== undefined);

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


  const styles = useStyles(colors);
  const clearSearch = () => onSearchChange('');
  const renderActionButton = ({
    accessibilityHint,
    accessibilityLabel,
    active,
    badgeCount,
    iconColor,
    iconName,
    iconSize,
    onPress,
    selected,
    testID,
    trailingAccent,
  }: {
    accessibilityHint?: string;
    accessibilityLabel: string;
    active?: boolean;
    badgeCount?: number;
    iconColor: string;
    iconName: ComponentProps<typeof Feather>['name'];
    iconSize: number;
    onPress: () => void;
    selected?: boolean;
    testID: string;
    trailingAccent?: ReactNode;
  }) => (
    <Pressable
      testID={testID}
      onPress={onPress}
      {...Platform.select({
        web: {
          title: accessibilityLabel,
        } as any,
      })}
      style={({ hovered }: any) => [
        styles.actionButton,
        isMobile && Platform.OS === 'web' ? styles.actionButtonMobileWeb : null,
        isMobile ? styles.actionButtonMobile : null,
        active && styles.actionButtonActive,
        !active && hovered && Platform.OS === 'web' && styles.actionButtonHovered,
        globalFocusStyles.focusable,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={selected === undefined ? undefined : { selected }}
    >
      <View style={styles.actionIconSlot}>
        <Feather name={iconName} size={iconSize} color={iconColor} />
      </View>
      {badgeCount != null && badgeCount > 0 ? (
        <View style={styles.badge} testID="filters-badge">
          <Text style={styles.badgeCount}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      ) : null}
      {trailingAccent}
    </Pressable>
  );

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
              onPress={clearSearch}
              accessibilityLabel="Очистить поиск"
              {...Platform.select({
                web: {
                  title: 'Очистить поиск',
                } as any,
              })}
              style={[styles.clearButton, { pointerEvents: 'box-only' }, globalFocusStyles.focusable]}
            >
              <View style={styles.clearButtonIconWrap}>
                <Feather name="x" size={14} color={colors.textMuted} style={{ pointerEvents: 'none' }} />
              </View>
            </Pressable>
          )}
          {showPendingState && (
            <View style={styles.inlineIconSlot} testID="search-pending-indicator">
              <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="Ищем маршруты" />
            </View>
          )}
          {!isMobile && Platform.OS === 'web' && (
            <View style={[styles.shortcutHint, styles.shortcutHintDesktop]}>
              <Text style={styles.shortcutText}>{shortcutLabel}</Text>
            </View>
          )}
          </View>

          {/* Действия */}
          <View style={[styles.actions, !isMobile && styles.actionsDesktop, isMobile && styles.actionsMobile]}>
          {(showPendingState || showResultsCount || shouldReserveDesktopResultsSlot) && (
            <View
              style={[
                styles.resultsInline,
                !showPendingState && !showResultsCount ? ({ opacity: 0 } as any) : null,
                ({ pointerEvents: showPendingState || showResultsCount ? 'auto' : 'none' } as any),
              ]}
              testID="results-count-wrapper"
            >
              {showPendingState ? (
                <View style={styles.pendingStatusRow} testID="search-pending-status">
                  <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="Ищем маршруты" />
                  <Text style={styles.pendingStatusText}>Ищем...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.resultsLabel}>Результаты</Text>
                  <Text style={styles.resultsText} testID="results-count-text">
                    {resultsCount ?? 0} {getTravelLabel(resultsCount ?? 0)}
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Рекомендации */}
          {onToggleRecommendations && (
            renderActionButton({
              accessibilityLabel: isRecommendationsVisible ? 'Скрыть рекомендации' : 'Показать рекомендации',
              active: !!isRecommendationsVisible,
              iconColor: isRecommendationsVisible ? colors.primary : colors.textMuted,
              iconName: 'zap',
              iconSize: actionIconSize,
              onPress: onToggleRecommendations,
              selected: !!isRecommendationsVisible,
              testID: 'toggle-recommendations-button',
              trailingAccent: isRecommendationsVisible ? <View style={styles.recommendationAccent} /> : null,
            })
          )}

          {/* Кнопка фильтров: показываем на мобильных и compact-web ширинах, где сайдбар работает оверлеем */}
          {onFiltersPress && isMobile && (
            renderActionButton({
              accessibilityHint: hasActiveFilters ? `Активно фильтров: ${activeFiltersCount ?? 0}` : undefined,
              accessibilityLabel: 'Открыть фильтры',
              active: hasActiveFilters,
              badgeCount: hasActiveFilters ? activeFiltersCount : undefined,
              iconColor: hasActiveFilters ? colors.primary : colors.textMuted,
              iconName: 'filter',
              iconSize: filterIconSize,
              onPress: onFiltersPress,
              testID: 'filters-button',
            })
          )}

          {/* Сбросить все (если есть активные фильтры или поиск) */}
          {(showClearAll || shouldReserveDesktopClearAllSlot) && (
            <Pressable
              testID="clear-all-button"
              onPress={showClearAll ? onClearAll : undefined}
              disabled={!showClearAll}
              {...Platform.select({
                web: {
                  title: 'Сбросить условия',
                } as any,
              })}
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
      {showMobileSummary ? (
        <View style={styles.mobileSummaryRow}>
          {showPendingState ? (
            <Text style={styles.mobileSummaryText}>Ищем...</Text>
          ) : resultsCount !== undefined ? (
            <Text style={styles.mobileSummaryText}>
              {resultsCount} {getTravelLabel(resultsCount)}
            </Text>
          ) : null}
          {activeFiltersCount != null && activeFiltersCount > 0 ? (
            <Text style={[styles.mobileSummaryText, styles.mobileSummaryMuted]}>
              {activeFiltersCount} {activeFiltersCount === 1 ? 'условие' : activeFiltersCount < 5 ? 'условия' : 'условий'}
            </Text>
          ) : null}
        </View>
      ) : null}
      </View>
      {/* SRCH-06: Quick-filter chips */}
      {quickFilters && quickFilters.length > 0 && (
        <View style={styles.quickFiltersRow} accessibilityRole="toolbar" accessibilityLabel="Быстрые фильтры">
          {quickFilters.map((chip) => (
            <Chip
              key={chip.id}
              testID={`quick-filter-${chip.id}`}
              label={chip.label}
              selected={!!chip.active}
              onPress={() => onQuickFilterPress?.(chip.id)}
              icon={chip.active ? <Feather name="check" size={11} color={colors.primaryText} /> : undefined}
              style={styles.quickChip}
            />
          ))}
        </View>
      )}
    </View>
  );
}


// ✅ ОПТИМИЗАЦИЯ: Мемоизация компонента
export default memo(StickySearchBar);
