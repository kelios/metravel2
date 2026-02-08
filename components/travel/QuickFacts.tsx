/**
 * Компонент QuickFacts - быстрые факты о путешествии
 * Показывает ключевую информацию: дата, длительность, страна, категории
 * ✅ РЕДИЗАЙН: Поддержка темной темы + компактный дизайн
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { Travel } from '@/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';

const isWeb = Platform.OS === 'web' || typeof document !== 'undefined';

const getWebA11yProps = (label?: string, role?: string) => {
  if (!isWeb) {
    return {};
  }
  const webProps: { role?: string; 'aria-label'?: string } = {};
  if (role) {
    webProps.role = role;
  }
  if (label) {
    webProps['aria-label'] = label;
  }
  return webProps;
};

const SafeView = ({
  children,
  accessibilityLabel,
  accessibilityRole,
  ...props
}: React.ComponentProps<typeof View>) => {
  const webA11yProps = getWebA11yProps(accessibilityLabel, accessibilityRole);
  return (
    <View
      {...props}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      {...(webA11yProps as any)}
    >
      {React.Children.map(children, (child) => (typeof child === 'string' ? <Text>{child}</Text> : child))}
    </View>
  );
};

interface QuickFactsProps {
  travel: Travel;
  onCategoryPress?: (category: string) => void;
}

function QuickFacts({ travel, onCategoryPress }: QuickFactsProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Извлекаем данные о путешествии
  const monthName = (travel as any).monthName || '';
  const year = travel && (travel as any).year != null ? String((travel as any).year) : '';
  const numberDays = travel && (travel as any).number_days != null 
    ? Number((travel as any).number_days) 
    : null;
  const countryName = (travel as any).countryName || '';
  
  // Извлекаем категории из travelAddress
  const categories = useMemo(() => {
    if (travel.travelAddress && Array.isArray(travel.travelAddress)) {
      const cats = new Set<string>();
      travel.travelAddress.forEach((addr: any) => {
        if (addr?.categoryName) {
          // ✅ ИСПРАВЛЕНИЕ: Обрабатываем случай, когда categoryName может быть объектом с {id, name}
          let categoryNameStr: string;
          if (typeof addr.categoryName === 'string') {
            categoryNameStr = addr.categoryName;
          } else if (addr.categoryName && typeof addr.categoryName === 'object' && 'name' in addr.categoryName) {
            categoryNameStr = String(addr.categoryName.name || '');
          } else {
            categoryNameStr = String(addr.categoryName || '');
          }
          
          const parts = categoryNameStr.split(',').map(s => s.trim()).filter(Boolean);
          parts.forEach(cat => cats.add(cat));
        }
      });
      return Array.from(cats).slice(0, 5); // Максимум 5 категорий
    }
    return [];
  }, [travel.travelAddress]);

  // Форматируем дату
  const whenLine = [monthName, year].filter(Boolean).join(' ');
  
  // Форматируем длительность
  const daysText = numberDays != null && Number.isFinite(numberDays)
    ? `${numberDays} ${numberDays === 1 ? 'день' : numberDays < 5 ? 'дня' : 'дней'}`
    : null;

  // Если нет данных, не показываем компонент
  if (!whenLine && !daysText && !countryName && categories.length === 0) {
    return null;
  }

  return (
    <SafeView 
      style={[
        styles.container,
        isMobile && styles.containerMobile,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
        }
      ]}
      accessibilityLabel="Ключевая информация о путешествии"
    >
      {/* Дата */}
      {whenLine && (
        <SafeView style={styles.factItem}>
          <Feather
            name="calendar"
            size={Platform.select({ default: 16, web: 18 })}
            color={colors.textMuted} // ✅ РЕДИЗАЙН: Темная тема
          />
          <Text style={[styles.factText, { color: colors.text }]}>{whenLine}</Text>
        </SafeView>
      )}

      {/* Длительность */}
      {daysText && (
        <SafeView style={styles.factItem}>
          <Feather
            name="clock"
            size={Platform.select({ default: 16, web: 18 })}
            color={colors.textMuted} // ✅ РЕДИЗАЙН: Темная тема
          />
          <Text style={[styles.factText, { color: colors.text }]}>{daysText}</Text>
        </SafeView>
      )}

      {/* Страна */}
      {!!countryName && (
        <SafeView style={styles.factItem}>
          <Feather
            name="map-pin"
            size={Platform.select({ default: 16, web: 18 })}
            color={colors.textMuted} // ✅ РЕДИЗАЙН: Темная тема
          />
          <Text style={[styles.factText, { color: colors.text }]}>{countryName}</Text>
        </SafeView>
      )}

      {/* Категории */}
      {categories.length > 0 && (
        <SafeView style={[styles.factItem, styles.categoriesContainer]}>
          <Feather
            name="tag"
            size={Platform.select({ default: 16, web: 18 })}
            color={colors.textMuted} // ✅ РЕДИЗАЙН: Темная тема
          />
          <SafeView style={styles.categoriesWrap}>
            {categories.map((cat, index) => {
              const categoryRole = onCategoryPress ? 'button' : 'text';
              const categoryLabel = `Категория: ${cat}`;
              const webA11yProps = getWebA11yProps(categoryLabel, categoryRole);

              return (
                <Pressable
                  key={index}
                  onPress={() => onCategoryPress?.(cat)}
                  style={[
                    styles.categoryTag,
                    {
                      backgroundColor: colors.primarySoft,
                      borderColor: colors.borderLight,
                    }
                  ]}
                  disabled={!onCategoryPress}
                  accessibilityRole={categoryRole}
                  accessibilityLabel={categoryLabel}
                  {...(webA11yProps as any)}
                >
                <Text style={[styles.categoryText, { color: colors.primary }]}>{cat}</Text>
                </Pressable>
              );
            })}
          </SafeView>
        </SafeView>
      )}
    </SafeView>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  // ✅ РЕДИЗАЙН: Компактная карточка с темной темой
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Platform.select({
      default: 18, // было lg 24px (-25%)
      web: 24, // было xl 32px (-25%)
    }),
    paddingVertical: Platform.select({
      default: 18, // было xl 32px (-44%)
      web: 24, // было xxl 48px (-50%)
    }),
    paddingHorizontal: Platform.select({
      default: 18, // было xl 32px (-44%)
      web: 24, // было xxl 48px (-50%)
    }),
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.card,
      } as any,
      default: colors.shadows.medium,
    }),
  },
  containerMobile: {
    paddingVertical: 18, // было lg 24px (-25%)
    paddingHorizontal: 18, // было lg 24px (-25%)
    gap: 14, // было md 16px (-12.5%)
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 4,
  },
  factText: {
    fontSize: Platform.select({
      default: 15,
      web: 17,
    }),
    fontWeight: '500',
    color: colors.text,
    letterSpacing: -0.1,
  },
  categoriesContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minWidth: '100%',
    marginTop: 4,
  },
  categoriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
    flex: 1,
  },
  // ✅ РЕДИЗАЙН: Компактные теги категорий
  categoryTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: Platform.select({
      default: 12, // было 12
      web: 14, // было 16px (-12.5%)
    }),
    paddingVertical: Platform.select({
      default: 6,
      web: 7, // было 8px (-12.5%)
    }),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease' as any,
        ':hover': {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
          boxShadow: colors.boxShadows.hover,
        } as any,
      },
    }),
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 0,
  },
});

export default React.memo(QuickFacts);
