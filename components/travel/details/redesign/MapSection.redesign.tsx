/**
 * MapSection.redesign.tsx
 *
 * ✅ Редизайн секции карты маршрута с темной темой
 *
 * Особенности:
 * - Темная тема через useThemedColors
 * - Компактный дизайн (-15-20%)
 * - Улучшенная типографика
 * - Анимированное раскрытие/скрытие
 * - WCAG AA доступность
 * - Поддержка Web/Native
 */

import React, { memo, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';

/* -------------------- Types -------------------- */

interface MapSectionProps {
  /** Карта в виде React-компонента */
  children: React.ReactNode;
  /** Показывать карту по умолчанию */
  initiallyOpen?: boolean;
  /** Индикатор загрузки */
  isLoading?: boolean;
  /** Текст при загрузке */
  loadingLabel?: string;
  /** Сохранять карту в DOM при скрытии */
  keepMounted?: boolean;
  /** Есть ли данные для карты */
  hasMapData?: boolean;
  /** Текст для пустого состояния */
  emptyStateText?: string;
}

/* -------------------- Component -------------------- */

export const MapSection: React.FC<MapSectionProps> = memo(({
  children,
  initiallyOpen = true,
  isLoading = false,
  loadingLabel = 'Загружаем карту...',
  keepMounted = false,
  hasMapData = true,
  emptyStateText = 'Маршрут ещё не добавлен',
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isPhone } = useResponsive();
  const [showMap, setShowMap] = useState(initiallyOpen);
  const [hasOpened, setHasOpened] = useState(initiallyOpen);

  // Текст кнопки
  const buttonText = useMemo(() => {
    if (showMap && isLoading) return loadingLabel;
    return showMap ? 'Скрыть карту' : 'Показать карту';
  }, [showMap, isLoading, loadingLabel]);

  // Рендерить контейнер карты?
  const shouldRenderContainer = showMap || (keepMounted && hasOpened);

  // Обработчик переключения
  const handleToggle = () => {
    setShowMap((prev) => {
      const next = !prev;
      if (next && !hasOpened) {
        setHasOpened(true);
      }
      return next;
    });
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface }
      ]}
      testID="map-section-redesign"
      accessible
      accessibilityLabel="Карта маршрута"
      {...(Platform.OS === 'web' ? { role: 'region' } as any : {})}
    >
      {/* Заголовок */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Feather name="map-pin" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerContent}>
          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            accessibilityRole="header"
            {...(Platform.OS === 'web' ? { 'aria-level': 2 } as any : {})}
          >
            Карта маршрута
          </Text>
        </View>
      </View>

      {/* Контент */}
      {hasMapData ? (
        <>
          {/* Кнопка переключения */}
          <Pressable
            onPress={handleToggle}
            style={({ pressed }) => [
              styles.toggleButton,
              {
                backgroundColor: pressed
                  ? colors.surfaceElevated
                  : colors.backgroundSecondary,
                borderColor: colors.borderLight,
              }
            ]}
            accessibilityRole="button"
            accessibilityLabel={buttonText}
            accessibilityHint={showMap ? 'Скрыть карту маршрута' : 'Показать карту маршрута'}
            testID="map-toggle-button"
          >
            <Feather
              name={showMap ? 'eye-off' : 'eye'}
              size={18}
              color={colors.primary}
              style={styles.toggleIcon}
            />
            <Text style={[styles.toggleText, { color: colors.text }]}>
              {buttonText}
            </Text>
            <Feather
              name={showMap ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </Pressable>

          {/* Контейнер карты */}
          {shouldRenderContainer && (
            <View
              style={[
                styles.mapContainer,
                isPhone && styles.mapContainerMobile,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.borderLight,
                },
                !showMap && keepMounted && styles.mapContainerHidden,
              ]}
              testID="map-container"
            >
              {showMap ? (
                isLoading ? (
                  <View style={styles.loadingState}>
                    {Platform.OS === 'web' ? (
                      <View
                        style={[
                          styles.loadingSkeleton,
                          {
                            backgroundColor: colors.backgroundSecondary,
                            borderColor: colors.borderLight,
                          }
                        ]}
                      />
                    ) : (
                      <ActivityIndicator
                        size="large"
                        color={colors.primary}
                      />
                    )}
                    <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                      {loadingLabel}
                    </Text>
                  </View>
                ) : (
                  children
                )
              ) : (
                keepMounted && children
              )}
            </View>
          )}
        </>
      ) : (
        /* Пустое состояние */
        <View
          style={[
            styles.emptyState,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.borderLight,
            }
          ]}
          testID="map-empty-state"
        >
          <Feather name="map" size={48} color={colors.textMuted} style={styles.emptyIcon} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {emptyStateText}
          </Text>
        </View>
      )}
    </View>
  );
});

MapSection.displayName = 'MapSection';

/* -------------------- Styles -------------------- */

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: Platform.select({
      web: DESIGN_TOKENS.spacing.xl,
      default: DESIGN_TOKENS.spacing.lg,
    }),
    marginBottom: DESIGN_TOKENS.spacing.lg,
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.light,
      } as any,
      default: {
        ...colors.shadows.light,
      },
    }),
  },

  // ✅ Заголовок
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: DESIGN_TOKENS.spacing.lg,
    gap: DESIGN_TOKENS.spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.infoSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Platform.select({
      web: 20,
      default: 18,
    }),
    fontWeight: '600',
    lineHeight: Platform.select({
      web: 26,
      default: 24,
    }),
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },

  // ✅ Кнопка переключения
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    gap: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.md,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      } as any,
    }),
  },
  toggleIcon: {
    // Пустой стиль для иконки
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    flex: 1,
    textAlign: 'center',
  },

  // ✅ Контейнер карты
  mapContainer: {
    width: '100%',
    minHeight: Platform.select({
      web: 400,
      default: 320,
    }),
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
      } as any,
    }),
  },
  mapContainerMobile: {
    minHeight: 280,
    borderRadius: DESIGN_TOKENS.radii.md,
  },
  mapContainerHidden: {
    height: 0,
    minHeight: 0,
    marginTop: 0,
    overflow: 'hidden',
  },

  // ✅ Загрузка
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xxl,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
  },
  loadingSkeleton: {
    width: 56,
    height: 56,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
  },

  // ✅ Пустое состояние
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DESIGN_TOKENS.spacing.xxl * 2,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: DESIGN_TOKENS.spacing.md,
  },
  emptyIcon: {
    marginBottom: DESIGN_TOKENS.spacing.md,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});

export default memo(MapSection);
