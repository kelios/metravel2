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
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { getTravelLabel } from '@/services/pdf-export/utils/pluralize';

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
}

const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

const useStyles = (colors: ReturnType<typeof useThemedColors>) => useMemo(() => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderColor: colors.primary,
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
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Platform.select({ default: spacing.sm, web: spacing.md }),
    paddingVertical: Platform.select({ default: spacing.xs, web: spacing.sm }),
    gap: spacing.xs,
    height: Platform.select({ default: 46, web: 52 }),
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
    height: 40,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    gap: 6,
  },
  input: {
    flex: 1,
    fontSize: Platform.select({ default: 14, web: 15 }),
    color: colors.text,
    padding: 0,
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
    height: Platform.select({ default: 40, web: 52 }),
    minWidth: Platform.select({ default: 0, web: 160 }),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  actionButtonHovered: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
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
    borderColor: colors.primary,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  badgeDot: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    height: Platform.select({ default: 46, web: 52 }),
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  clearAllText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  resultsText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
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
}: StickySearchBarProps) {
  const colors = useThemedColors();
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
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
              isMobile && styles.searchBoxMobile,
            ]}
          >
          <Feather
            name="search"
            size={searchIconSize}
            color={isFocused ? colors.primary : colors.textMuted}
          />
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
                // @ts-ignore
                'aria-label': `Поиск путешествий. Нажмите ${shortcutLabel} для быстрого доступа`,
              },
            })}
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => onSearchChange('')}
              accessibilityLabel="Очистить поиск"
              style={[styles.clearButton, { pointerEvents: 'box-only' }]}
            >
              <Feather name="x" size={16} color={colors.textMuted} style={{ pointerEvents: 'none' }} />
            </Pressable>
          )}
          {!isMobile && Platform.OS === 'web' && (
            <View style={styles.shortcutHint}>
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
              <Text style={styles.resultsText} testID="results-count-text">
                Найдено: {resultsCount ?? 0}{' '}
                {getTravelLabel(resultsCount ?? 0)}
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
              ]}
              accessibilityLabel={isRecommendationsVisible ? "Скрыть рекомендации" : "Показать рекомендации"}
              accessibilityState={{ selected: !!isRecommendationsVisible }}
            >
              <Feather
                name="zap"
                size={actionIconSize}
                color={isRecommendationsVisible ? colors.primary : colors.textMuted}
              />
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
              ]}
              accessibilityLabel="Открыть фильтры"
              accessibilityHint={hasActiveFilters ? `Активно фильтров: ${activeFiltersCount ?? 0}` : undefined}
            >
              <Feather
                name="filter"
                size={filterIconSize}
                color={hasActiveFilters ? colors.primary : colors.textMuted}
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
                ({ pointerEvents: showClearAll ? 'auto' : 'none' } as any),
              ]}
              accessibilityLabel="Сбросить все фильтры и поиск"
            >
              <Feather name="x-circle" size={14} color={colors.textMuted} />
              {!isMobile && <Text style={styles.clearAllText}>Сбросить</Text>}
            </Pressable>
          )}
        </View>
      </View>
      </View>
    </View>
  );
}


// ✅ ОПТИМИЗАЦИЯ: Мемоизация компонента
export default memo(StickySearchBar);
