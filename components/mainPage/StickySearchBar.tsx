// StickySearchBar.tsx
// ✅ НОВЫЙ КОМПОНЕНТ: Sticky поисковая строка с быстрыми действиями

import { useState, useRef, useEffect, useCallback, memo, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  View,
  TextInput,
  Pressable,
  Text,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { getTravelLabel } from '@/utils/pluralize';
import Chip from '@/components/ui/Chip';
import { useSearchHistoryStore } from '@/stores/searchHistoryStore';
import {
  getStickySearchShortcutLabel,
  getStickySearchUiState,
  getStickySearchViewportState,
  type QuickFilterChip,
} from '@/components/mainPage/stickySearchBarModel';
import { translate as i18nT } from '@/i18n'
import { useStickySearchBarStyles as useStyles } from './StickySearchBar.styles';


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
  primaryAction?: {
    accessibilityHint?: string;
    iconName: ComponentProps<typeof Feather>['name'];
    label: string;
    onPress: () => void;
    testID: string;
  };
}

function StickySearchBar({
  search,
  onSearchChange,
  onFiltersPress,
  hasActiveFilters,
  isSearchPending = false,
  flush = false,
  resultsCount,
  placeholder = i18nT('home:components.mainPage.StickySearchBar.nayti_puteshestviya_91417b58'),
  onToggleRecommendations,
  isRecommendationsVisible,
  onClearAll,
  activeFiltersCount,
  quickFilters,
  onQuickFilterPress,
  primaryAction,
}: StickySearchBarProps) {
  const colors = useThemedColors();
  const { isPhone, isLargePhone, width } = useResponsive();
  const { isMac, isMobile } = getStickySearchViewportState({
    isLargePhone,
    isPhone,
    width,
  });
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const suppressNextHistoryPressRef = useRef(false);

  const history = useSearchHistoryStore((s) => s.history);
  const loadHistory = useSearchHistoryStore((s) => s.load);
  const addQuery = useSearchHistoryStore((s) => s.addQuery);
  const removeQuery = useSearchHistoryStore((s) => s.removeQuery);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const commitToHistory = useCallback(() => {
    const trimmed = search.trim();
    if (trimmed) void addQuery(trimmed);
  }, [addQuery, search]);

  const applyHistoryQuery = useCallback(
    (query: string) => {
      onSearchChange(query);
      void addQuery(query);
      inputRef.current?.blur();
      setIsFocused(false);
    },
    [addQuery, onSearchChange],
  );

  const runHistoryActionOnPress = useCallback((action: () => void) => {
    if (Platform.OS === 'web' && suppressNextHistoryPressRef.current) return;
    action();
  }, []);

  const runHistoryActionOnMouseDown = useCallback((event: unknown, action: () => void) => {
    if (Platform.OS !== 'web') return;

    const webEvent = event as { preventDefault?: () => void };
    webEvent.preventDefault?.();
    suppressNextHistoryPressRef.current = true;
    action();

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        suppressNextHistoryPressRef.current = false;
      });
      return;
    }

    setTimeout(() => {
      suppressNextHistoryPressRef.current = false;
    }, 0);
  }, []);

  const showHistory = isFocused && search.trim().length === 0 && history.length > 0;

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
  // The results count is surfaced in the catalog toolbar's sort row on mobile (#336), so the
  // sticky search bar only keeps the transient pending state here to hold the pinned header
  // height within budget.
  const showMobileSummary = isMobile && showPendingState;

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
      accessibilityRole="button"
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
            onBlur={() => {
              commitToHistory();
              setIsFocused(false);
            }}
            onSubmitEditing={commitToHistory}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, isMobile && styles.inputMobile]}
            returnKeyType="search"
            accessibilityLabel={i18nT('home:components.mainPage.StickySearchBar.poisk_puteshestviy_e43cf138')}
            {...Platform.select({
              web: {
                // @ts-ignore -- aria-label is a web-only ARIA attribute not in RN TextInput types
                'aria-label': isMobile
                  ? i18nT('home:components.mainPage.StickySearchBar.poisk_puteshestviy_e43cf138')
                  : i18nT('home:components.mainPage.StickySearchBar.poisk_puteshestviy_nazhmite_value1_dlya_byst_da8afc47', { value1: shortcutLabel }),
              },
            })}
          />
          {search.length > 0 && (
            <Pressable
              onPress={clearSearch}
              accessibilityRole="button"
              accessibilityLabel={i18nT('home:components.mainPage.StickySearchBar.ochistit_poisk_b1c2bdab')}
              {...Platform.select({
                web: {
                  title: i18nT('home:components.mainPage.StickySearchBar.ochistit_poisk_b1c2bdab'),
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
              <ActivityIndicator size="small" color={colors.primaryDark} accessibilityLabel={i18nT('home:components.mainPage.StickySearchBar.ischem_marshruty_fe4e25a6')} />
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
            {primaryAction ? (
              renderActionButton({
                accessibilityHint: primaryAction.accessibilityHint,
                accessibilityLabel: primaryAction.label,
                iconColor: colors.primary,
                iconName: primaryAction.iconName,
                iconSize: actionIconSize,
                onPress: primaryAction.onPress,
                testID: primaryAction.testID,
              })
            ) : null}

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
                    <ActivityIndicator size="small" color={colors.primaryDark} accessibilityLabel={i18nT('home:components.mainPage.StickySearchBar.ischem_marshruty_fe4e25a6')} />
                    <Text style={styles.pendingStatusText}>{i18nT('home:components.mainPage.StickySearchBar.ischem_ff4b9bf4')}</Text>
                  </View>
              ) : (
                <>
                  <Text style={styles.resultsLabel}>{i18nT('home:components.mainPage.StickySearchBar.rezultaty_54e0674a')}</Text>
                  <Text style={styles.resultsText} testID="results-count-text">
                    {resultsCount !== undefined
                      ? `${resultsCount} ${getTravelLabel(resultsCount)}`
                      : '—'}
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Рекомендации */}
          {onToggleRecommendations && (
            renderActionButton({
              accessibilityLabel: isRecommendationsVisible ? i18nT('home:components.mainPage.StickySearchBar.skryt_idei_puteshestviy_7fd2b644') : i18nT('home:components.mainPage.StickySearchBar.pokazat_idei_puteshestviy_16cd9af1'),
              accessibilityHint: i18nT('home:components.mainPage.StickySearchBar.personalnye_rekomendatsii_marshrutov_d0292367'),
              active: !!isRecommendationsVisible,
              iconColor: isRecommendationsVisible ? colors.primary : colors.textMuted,
              iconName: 'compass',
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
              accessibilityHint: hasActiveFilters ? i18nT('home:components.mainPage.StickySearchBar.aktivno_filtrov_value1_d76351a7', { value1: activeFiltersCount ?? 0 }) : undefined,
              accessibilityLabel: i18nT('home:components.mainPage.StickySearchBar.otkryt_filtry_8dcfd76a'),
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
              accessibilityRole="button"
              {...Platform.select({
                web: {
                  title: i18nT('home:components.mainPage.StickySearchBar.sbrosit_usloviya_c412986e'),
                } as any,
              })}
              style={[
                styles.clearAllButton,
                !showClearAll ? ({ opacity: 0 } as any) : null,
                ({ pointerEvents: showClearAll ? 'auto' : 'none' } as any),
                globalFocusStyles.focusable,
              ]}
              accessibilityLabel={i18nT('home:components.mainPage.StickySearchBar.sbrosit_vse_filtry_i_poisk_96874bf6')}
            >
              <View style={styles.inlineIconSlot}>
                <Feather name="x-circle" size={14} color={colors.textMuted} />
              </View>
              {!isMobile && <Text style={styles.clearAllText}>{i18nT('home:components.mainPage.StickySearchBar.sbrosit_48d8ad20')}</Text>}
            </Pressable>
          )}
        </View>
      </View>
      {showMobileSummary ? (
        <View style={styles.mobileSummaryRow}>
          {showPendingState ? (
            <Text style={styles.mobileSummaryText}>{i18nT('home:components.mainPage.StickySearchBar.ischem_ff4b9bf4')}</Text>
          ) : null}
        </View>
      ) : null}
      {showHistory ? (
        <View
          style={styles.historyPanel}
          testID="search-history-panel"
          accessibilityRole={Platform.OS === 'web' ? undefined : ('menu' as any)}
          accessibilityLabel={i18nT('home:components.mainPage.StickySearchBar.nedavnie_zaprosy_82a34095')}
        >
          <View style={styles.historyHeader}>
            <Text style={styles.historyHeaderText}>{i18nT('home:components.mainPage.StickySearchBar.nedavnie_zaprosy_82a34095')}</Text>
            <Pressable
              testID="search-history-clear-all"
              onPress={() => runHistoryActionOnPress(() => void clearHistory())}
              accessibilityRole="button"
              accessibilityLabel={i18nT('home:components.mainPage.StickySearchBar.ochistit_istoriyu_poiska_cd08f48a')}
              {...Platform.select({
                web: {
                  title: i18nT('home:components.mainPage.StickySearchBar.ochistit_istoriyu_f9889e79'),
                  onMouseDown: (event: unknown) => runHistoryActionOnMouseDown(event, () => void clearHistory()),
                } as any,
              })}
              style={styles.historyClearAll}
            >
              <Feather name="trash-2" size={13} color={colors.textSecondary} />
              <Text style={styles.historyClearAllText}>{i18nT('home:components.mainPage.StickySearchBar.ochistit_fd85ffe7')}</Text>
            </Pressable>
          </View>
          {history.map((query) => (
            <View key={query} style={styles.historyRow}>
              <Pressable
                testID={`search-history-item-${query}`}
                onPress={() => runHistoryActionOnPress(() => applyHistoryQuery(query))}
                accessibilityRole="button"
                accessibilityLabel={i18nT('home:components.mainPage.StickySearchBar.nayti_value1_0d916130', { value1: query })}
                {...Platform.select({
                  web: {
                    title: query,
                    onMouseDown: (event: unknown) => runHistoryActionOnMouseDown(event, () => applyHistoryQuery(query)),
                  } as any,
                })}
                style={styles.historyRowMain}
              >
                <Feather name="clock" size={14} color={colors.textMuted} />
                <Text style={styles.historyRowText} numberOfLines={1}>
                  {query}
                </Text>
              </Pressable>
              <Pressable
                testID={`search-history-remove-${query}`}
                onPress={() => runHistoryActionOnPress(() => void removeQuery(query))}
                accessibilityRole="button"
                accessibilityLabel={i18nT('home:components.mainPage.StickySearchBar.udalit_iz_istorii_value1_f59529ef', { value1: query })}
                {...Platform.select({
                  web: {
                    title: i18nT('home:components.mainPage.StickySearchBar.udalit_da76c0e4'),
                    onMouseDown: (event: unknown) => runHistoryActionOnMouseDown(event, () => void removeQuery(query)),
                  } as any,
                })}
                style={styles.historyRemove}
              >
                <Feather name="x" size={14} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      </View>
      {/* SRCH-06: Quick-filter chips */}
      {quickFilters && quickFilters.length > 0 && (
        <View style={styles.quickFiltersRow} accessibilityRole="toolbar" accessibilityLabel={i18nT('home:components.mainPage.StickySearchBar.bystrye_filtry_8a6ebfa3')}>
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
