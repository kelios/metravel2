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
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface StickySearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onFiltersPress: () => void;
  hasActiveFilters: boolean;
  resultsCount?: number;
  sortOptions?: Array<{ value: string; label: string }>;
  onSortChange?: (sort: string) => void;
  currentSort?: string;
  placeholder?: string;
}

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

function StickySearchBar({
  search,
  onSearchChange,
  onFiltersPress,
  hasActiveFilters,
  resultsCount,
  sortOptions = [],
  onSortChange,
  currentSort,
  placeholder = 'Найти путешествия...',
}: StickySearchBarProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  
  // ✅ UX УЛУЧШЕНИЕ: Показываем счетчик только если есть результаты
  const showResultsCount = resultsCount !== undefined && resultsCount > 0 && !isMobile;

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

  return (
    <View style={[styles.container, isFocused && styles.containerFocused]}>
      <View style={styles.searchBox}>
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

      {/* Действия - только на десктопе, на мобильных вынесены отдельно */}
      {!isMobile && (
        <View style={styles.actions}>
          {/* Кнопка фильтров */}
          <Pressable
            onPress={onFiltersPress}
            style={[
              styles.actionButton,
              hasActiveFilters && styles.actionButtonActive,
            ]}
            accessibilityLabel="Открыть фильтры"
          >
            <Feather
              name="filter"
              size={16}
              color={hasActiveFilters ? palette.primary : palette.textMuted}
            />
            {hasActiveFilters && (
              <View style={styles.badge}>
                <View style={styles.badgeDot} />
              </View>
            )}
          </Pressable>

          {/* Сортировка */}
          {sortOptions.length > 0 && onSortChange && (
              <Pressable
              style={styles.actionButton}
              onPress={() => {
                // Сортировка будет реализована в будущих версиях
                // См. issue #XXX для отслеживания прогресса
              }}
              accessibilityLabel="Сортировка"
            >
              <Feather name="arrow-up-down" size={16} color={palette.textMuted} />
            </Pressable>
          )}

          {/* Счетчик результатов */}
          {showResultsCount && (
            <View style={styles.resultsCount}>
              <Text style={styles.resultsText}>
                {resultsCount} {resultsCount === 1 ? 'результат' : resultsCount < 5 ? 'результата' : 'результатов'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
      },
    }),
  },
  containerFocused: {
    borderBottomColor: palette.primary,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(74, 140, 140, 0.12)',
      },
    }),
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      },
    }),
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: palette.text,
    padding: 0,
    ...Platform.select({
      web: {
        outline: 'none',
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
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radii.sm,
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
  resultsCount: {
    marginLeft: 'auto',
  },
  resultsText: {
    fontSize: 13,
    color: palette.textMuted,
    fontWeight: '500',
  },
});

// ✅ ОПТИМИЗАЦИЯ: Мемоизация компонента
export default memo(StickySearchBar);

