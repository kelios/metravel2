/**
 * NearTravelsSection.redesign.tsx
 *
 * ✅ Редизайн секции похожих маршрутов поблизости с темной темой
 *
 * Особенности:
 * - Темная тема через useThemedColors
 * - Компактный дизайн (-15-20%)
 * - Ленивая загрузка
 * - Скелетоны при загрузке
 * - WCAG AA доступность
 * - Поддержка Web/Native
 */

import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';

/* -------------------- Types -------------------- */

interface NearTravelsSectionProps {
  /** Компонент со списком маршрутов */
  children: React.ReactNode;
  /** Индикатор загрузки */
  isLoading?: boolean;
  /** Есть ли данные для отображения */
  hasData?: boolean;
  /** Радиус поиска в км */
  radiusKm?: number;
  /** Заголовок секции */
  title?: string;
  /** Подзаголовок секции */
  subtitle?: string;
}

/* -------------------- Component -------------------- */

export const NearTravelsSection: React.FC<NearTravelsSectionProps> = memo(({
  children,
  isLoading = false,
  hasData = true,
  radiusKm = 60,
  title = 'Рядом можно посмотреть',
  subtitle,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Подзаголовок по умолчанию
  const defaultSubtitle = `Маршруты в радиусе ~${radiusKm} км`;
  const displaySubtitle = subtitle || defaultSubtitle;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface }
      ]}
      testID="near-travels-section-redesign"
      accessible
      accessibilityLabel="Похожие маршруты поблизости"
      {...(Platform.OS === 'web' ? { role: 'region' } as any : {})}
    >
      {/* Заголовок */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: `${colors.primary}15` }]}>
          <Feather name="compass" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerContent}>
          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            accessibilityRole="header"
            {...(Platform.OS === 'web' ? { 'aria-level': 2 } as any : {})}
          >
            {title}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {displaySubtitle}
          </Text>
        </View>
      </View>

      {/* Контент */}
      {hasData ? (
        <View
          style={styles.contentWrapper}
          testID="near-travels-content"
        >
          {isLoading ? (
            /* Состояние загрузки */
            <View
              style={styles.loadingState}
              testID="near-travels-loading"
            >
              <View style={styles.skeletonList}>
                {[1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.skeletonItem,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: colors.borderLight,
                      }
                    ]}
                  >
                    <View
                      style={[
                        styles.skeletonImage,
                        { backgroundColor: colors.surfaceElevated }
                      ]}
                    />
                    <View style={styles.skeletonText}>
                      <View
                        style={[
                          styles.skeletonLine,
                          styles.skeletonLineTitle,
                          { backgroundColor: colors.surfaceElevated }
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonLine,
                          styles.skeletonLineSubtitle,
                          { backgroundColor: colors.surfaceElevated }
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            /* Загруженный контент */
            children
          )}
        </View>
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
          testID="near-travels-empty"
        >
          <Feather name="map-pin" size={48} color={colors.textMuted} style={styles.emptyIcon} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Поблизости нет других маршрутов
          </Text>
        </View>
      )}
    </View>
  );
});

NearTravelsSection.displayName = 'NearTravelsSection';

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

  // ✅ Контент
  contentWrapper: {
    // Контейнер для контента
  },

  // ✅ Состояние загрузки
  loadingState: {
    // Контейнер для скелетонов
  },
  skeletonList: {
    gap: DESIGN_TOKENS.spacing.md,
  },
  skeletonItem: {
    flexDirection: 'row',
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    gap: DESIGN_TOKENS.spacing.md,
  },
  skeletonImage: {
    width: 80,
    height: 80,
    borderRadius: DESIGN_TOKENS.radii.sm,
  },
  skeletonText: {
    flex: 1,
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  skeletonLineTitle: {
    width: '80%',
    height: 16,
  },
  skeletonLineSubtitle: {
    width: '60%',
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

export default memo(NearTravelsSection);
