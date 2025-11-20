// components/FiltersModalMobile.tsx
// ✅ РЕДИЗАЙН: Улучшенное модальное окно фильтров для мобильной версии

import React, { useRef } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Platform, ScrollView, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import FiltersComponent from '@/components/listTravel/FiltersComponent';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type { TravelFilters } from '@/src/types/types';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

interface FiltersModalMobileProps {
  visible: boolean;
  onClose: () => void;
  filters: TravelFilters | null;
  filterValue: any;
  onSelectedItemsChange: (field: string, items: any[]) => void;
  handleApplyFilters: () => void;
  resetFilters: () => void;
  isSuperuser?: boolean;
}

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

export default function FiltersModalMobile({
  visible,
  onClose,
  filters,
  filterValue,
  onSelectedItemsChange,
  handleApplyFilters,
  resetFilters,
  isSuperuser = false,
}: FiltersModalMobileProps) {
  const insets = useSafeAreaInsets();
  const modalRef = useRef<HTMLElement>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ✅ УЛУЧШЕНИЕ: Focus trap для модального окна
  useFocusTrap(modalRef, {
    enabled: visible && Platform.OS === 'web',
  });

  // ✅ УЛУЧШЕНИЕ: Анимация появления
  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // ✅ УЛУЧШЕНИЕ: Закрытие по Escape
  React.useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [visible, onClose]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const opacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const activeFiltersCount = Object.values(filterValue || {}).reduce((count, value) => {
    if (Array.isArray(value)) return count + value.length;
    if (value && value !== '') return count + 1;
    return count;
  }, 0);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <Pressable
        style={styles.overlay}
        onPress={onClose}
        accessibilityLabel="Закрыть фильтры"
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              paddingBottom: insets.bottom,
              transform: [{ translateY }],
              opacity,
            },
          ]}
          {...Platform.select({
            web: {
              // @ts-ignore
              ref: modalRef,
              role: 'dialog',
              'aria-modal': true,
              'aria-label': 'Фильтры путешествий',
            },
          })}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Заголовок */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Feather name="filter" size={20} color={palette.primary} />
                <Text style={styles.headerTitle}>Фильтры</Text>
                {activeFiltersCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{activeFiltersCount}</Text>
                  </View>
                )}
              </View>

              <View style={styles.headerActions}>
                {activeFiltersCount > 0 && (
                  <Pressable
                    onPress={resetFilters}
                    style={[styles.clearButton, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                    accessibilityRole="button"
                    accessibilityLabel="Сбросить все фильтры"
                    hitSlop={8}
                  >
                    <Feather name="x-circle" size={18} color={palette.primary} />
                    <Text style={styles.clearButtonText}>Сбросить</Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={onClose}
                  style={[styles.closeButton, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                  accessibilityRole="button"
                  accessibilityLabel="Закрыть"
                  hitSlop={8}
                >
                  <Feather name="x" size={24} color={palette.text} />
                </Pressable>
              </View>
            </View>

            {/* Содержимое */}
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {filters && (
                <FiltersComponent
                  filters={filters}
                  filterValue={filterValue}
                  onSelectedItemsChange={onSelectedItemsChange}
                  handleApplyFilters={handleApplyFilters}
                  resetFilters={resetFilters}
                  isSuperuser={isSuperuser}
                  closeMenu={onClose}
                  isCompact={false}
                  disableApplyOnMobileClose={false}
                />
              )}
            </ScrollView>

            {/* Индикатор для swipe */}
            <View style={styles.swipeIndicator} />
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: '90%',
    ...Platform.select({
      web: {
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    minHeight: 56,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.text,
  },
  badge: {
    backgroundColor: palette.primary,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: palette.primarySoft,
    minHeight: 36,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: palette.primary,
  },
  closeButton: {
    width: 40,
    height: 40,
    minWidth: 40, // ✅ ИСПРАВЛЕНИЕ: Минимальная ширина для touch-целей
    minHeight: 40, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        // @ts-ignore
        ':hover': {
          backgroundColor: palette.primarySoft,
        },
      },
    }),
    backgroundColor: palette.surfaceMuted,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        // @ts-ignore
        ':hover': {
          backgroundColor: palette.primarySoft,
        },
      },
    }),
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  swipeIndicator: {
    width: 40,
    height: 4,
    backgroundColor: palette.border,
    borderRadius: radii.sm,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
});

