/**
 * DescriptionSection.redesign.tsx
 *
 * ✅ Редизайн секции описания путешествия с темной темой
 *
 * Особенности:
 * - Темная тема через useThemedColors
 * - Компактный дизайн (-15-25%)
 * - Улучшенная типографика
 * - Адаптивные отступы
 * - WCAG AA доступность
 * - Поддержка Web/Native
 */

import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import TravelDescription from '@/components/travel/TravelDescription';
import { Icon } from '../TravelDetailsIcons';

/* -------------------- Types -------------------- */

interface DecisionTip {
  text: string;
  level: number;
}

interface DescriptionSectionProps {
  /** Название путешествия */
  title: string;
  /** HTML-контент описания */
  htmlContent: string;
  /** Количество дней */
  numberDays?: number;
  /** Название страны */
  countryName?: string;
  /** Название месяца (лучший сезон) */
  monthName?: string;
  /** Список полезных советов */
  decisionTips?: DecisionTip[];
  /** Обработчик для кнопки "Назад к началу" */
  onBackToTop?: () => void;
  /** Скрыть кнопку "Назад к началу" (для мобильных) */
  hideBackToTop?: boolean;
}

/* -------------------- Component -------------------- */

export const DescriptionSection: React.FC<DescriptionSectionProps> = memo(({
  title,
  htmlContent,
  numberDays,
  countryName,
  monthName,
  decisionTips = [],
  onBackToTop,
  hideBackToTop = false,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Форматирование количества дней
  const daysText = numberDays
    ? `${numberDays} ${
        numberDays === 1 ? 'день' : numberDays < 5 ? 'дня' : 'дней'
      }`
    : null;

  const metaInfo = [
    daysText,
    countryName,
    monthName ? `лучший сезон: ${monthName.toLowerCase()}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface }
      ]}
      testID="description-section-redesign"
      accessible
      accessibilityLabel="Описание маршрута"
      {...(Platform.OS === 'web' ? { role: 'region' } as any : {})}
    >
      {/* Интро */}
      <View style={styles.introWrapper}>
        <Text
          style={[styles.introTitle, { color: colors.text }]}
          accessibilityRole="header"
          {...(Platform.OS === 'web' ? { 'aria-level': 2 } as any : {})}
        >
          Описание маршрута
        </Text>
        {metaInfo && (
          <Text style={[styles.introMeta, { color: colors.textMuted }]}>
            {metaInfo}
          </Text>
        )}
      </View>

      {/* Полезные советы */}
      {decisionTips.length > 0 && (
        <View
          style={[
            styles.tipsBox,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderLight,
            }
          ]}
          accessible
          accessibilityLabel="Полезные советы перед поездкой"
          {...(Platform.OS === 'web' ? { role: 'complementary' } as any : {})}
        >
          <View style={styles.tipsHeader}>
            <Icon name="lightbulb" size={20} color={colors.primary} accessibilityElementsHidden />
            <Text style={[styles.tipsTitle, { color: colors.text }]}>
              Полезные советы перед поездкой
            </Text>
          </View>

          <View style={styles.tipsList}>
            {decisionTips.map((tip, idx) =>
              tip.level === 0 ? (
                <View key={`tip-${idx}`} style={styles.tipRow}>
                  <Icon name="check-circle" size={16} color={colors.primary} accessibilityElementsHidden />
                  <Text style={[styles.tipText, { color: colors.text }]}>
                    {tip.text}
                  </Text>
                </View>
              ) : (
                <View key={`tip-${idx}`} style={styles.tipSubRow}>
                  <Icon name="circle" size={6} color={colors.textMuted} accessibilityElementsHidden />
                  <Text style={[styles.tipSubText, { color: colors.text }]}>
                    {tip.text}
                  </Text>
                </View>
              )
            )}
          </View>
        </View>
      )}

      {/* Описание */}
      <View style={styles.descriptionWrapper}>
        <TravelDescription
          title={title}
          htmlContent={htmlContent}
          noBox
        />
      </View>

      {/* Кнопка "Назад к началу" */}
      {!hideBackToTop && Platform.OS === 'web' && onBackToTop && (
        <Pressable
          onPress={onBackToTop}
          style={({ pressed }) => [
            styles.backToTopButton,
            {
              backgroundColor: pressed
                ? colors.backgroundSecondary
                : colors.surface,
              borderColor: colors.borderLight,
            }
          ]}
          accessibilityRole="button"
          accessibilityLabel="Назад к началу страницы"
          accessibilityHint="Прокрутить страницу вверх"
        >
          <Icon name="arrow-upward" size={18} color={colors.primary} accessibilityElementsHidden />
          <Text style={[styles.backToTopText, { color: colors.textMuted }]}>
            Назад к началу
          </Text>
        </Pressable>
      )}
    </View>
  );
});

DescriptionSection.displayName = 'DescriptionSection';

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

  // ✅ Интро
  introWrapper: {
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  introTitle: {
    fontSize: Platform.select({
      web: 22,
      default: 20,
    }),
    fontWeight: '600',
    lineHeight: Platform.select({
      web: 28,
      default: 26,
    }),
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  introMeta: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },

  // ✅ Советы
  tipsBox: {
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    padding: DESIGN_TOKENS.spacing.lg,
    marginBottom: DESIGN_TOKENS.spacing.xl,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  tipsHeaderIcon: {
    marginRight: DESIGN_TOKENS.spacing.sm,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  tipsList: {
    gap: DESIGN_TOKENS.spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  tipIcon: {
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  tipSubRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingLeft: DESIGN_TOKENS.spacing.lg,
  },
  tipSubIcon: {
    marginTop: 8,
  },
  tipSubText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },

  // ✅ Описание
  descriptionWrapper: {
    // Убираем лишние отступы, т.к. они есть в TravelDescription
  },

  // ✅ Кнопка "Назад к началу"
  backToTopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    marginTop: DESIGN_TOKENS.spacing.xl,
    alignSelf: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      } as any,
    }),
  },
  backToTopIcon: {
    marginRight: DESIGN_TOKENS.spacing.xs,
  },
  backToTopText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});

export default DescriptionSection;
