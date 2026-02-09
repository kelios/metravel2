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
          <SafeView style={[styles.factIconWrap, { backgroundColor: colors.primarySoft }]}>
            <Feather
              name="calendar"
              size={Platform.select({ default: 15, web: 16 })}
              color={colors.primary}
            />
          </SafeView>
          <Text style={[styles.factText, { color: colors.text }]}>{whenLine}</Text>
        </SafeView>
      )}

      {/* Длительность */}
      {daysText && (
        <SafeView style={styles.factItem}>
          <SafeView style={[styles.factIconWrap, { backgroundColor: colors.accentSoft }]}>
            <Feather
              name="clock"
              size={Platform.select({ default: 15, web: 16 })}
              color={colors.accent}
            />
          </SafeView>
          <Text style={[styles.factText, { color: colors.text }]}>{daysText}</Text>
        </SafeView>
      )}

      {/* Страна */}
      {!!countryName && (
        <SafeView style={styles.factItem}>
          <SafeView style={[styles.factIconWrap, { backgroundColor: colors.successSoft }]}>
            <Feather
              name="map-pin"
              size={Platform.select({ default: 15, web: 16 })}
              color={colors.successDark}
            />
          </SafeView>
          <Text style={[styles.factText, { color: colors.text }]}>{countryName}</Text>
        </SafeView>
      )}

      {/* Категории */}
      {categories.length > 0 && (
        <SafeView style={[styles.factItem, styles.categoriesContainer]}>
          <SafeView style={[styles.factIconWrap, { backgroundColor: colors.warningSoft }]}>
            <Feather
              name="tag"
              size={Platform.select({ default: 15, web: 16 })}
              color={colors.warningDark}
            />
          </SafeView>
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
                <Text style={[styles.categoryText, { color: colors.primaryText }]}>{cat}</Text>
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
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Platform.select({
      default: 16,
      web: 20,
    }),
    paddingVertical: Platform.select({
      default: 18,
      web: 20,
    }),
    paddingHorizontal: Platform.select({
      default: 16,
      web: 20,
    }),
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.light,
      } as any,
      default: colors.shadows.light,
    }),
  },
  containerMobile: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  factIconWrap: {
    width: Platform.select({ default: 32, web: 34 }),
    height: Platform.select({ default: 32, web: 34 }),
    borderRadius: Platform.select({ default: 8, web: 10 }),
    alignItems: 'center',
    justifyContent: 'center',
  },
  factText: {
    fontSize: Platform.select({
      default: 14,
      web: 15,
    }),
    fontWeight: '600',
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
  categoryTag: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: Platform.select({
      default: 12,
      web: 14,
    }),
    paddingVertical: Platform.select({
      default: 5,
      web: 6,
    }),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease' as any,
      },
    }),
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryText,
    letterSpacing: 0,
  },
});

export default React.memo(QuickFacts);
