/**
 * Компонент QuickFacts - быстрые факты о путешествии
 * Показывает ключевую информацию: дата, длительность, страна, категории
 * ✅ РЕДИЗАЙН: Поддержка темной темы + компактный дизайн
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { Travel } from '@/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';
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
  const { width } = useWindowDimensions();
  const isMobile = width < METRICS.breakpoints.tablet;
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

  const factItems: React.ReactNode[] = [];
  const iconSize = Platform.select({ default: 14, web: 15 });
  const iconColor = colors.textMuted;

  if (whenLine) {
    factItems.push(
      <SafeView key="when" style={styles.factItem}>
        <Feather name="calendar" size={iconSize} color={iconColor} />
        <Text style={styles.factText}>{whenLine}</Text>
      </SafeView>
    );
  }
  if (daysText) {
    factItems.push(
      <SafeView key="days" style={styles.factItem}>
        <Feather name="clock" size={iconSize} color={iconColor} />
        <Text style={styles.factText}>{daysText}</Text>
      </SafeView>
    );
  }
  if (countryName) {
    factItems.push(
      <SafeView key="country" style={styles.factItem}>
        <Feather name="map-pin" size={iconSize} color={iconColor} />
        <Text style={styles.factText}>{countryName}</Text>
      </SafeView>
    );
  }

  return (
    <SafeView 
      style={[
        styles.container,
        isMobile && styles.containerMobile,
      ]}
      accessibilityLabel="Ключевая информация о путешествии"
    >
      <SafeView style={styles.factsRow}>
        {factItems.map((item, i) => (
          <React.Fragment key={i}>
            {item}
          </React.Fragment>
        ))}
      </SafeView>

      {categories.length > 0 && (
        <SafeView style={styles.categoriesContainer}>
          <SafeView style={styles.categoriesHeader}>
            <Feather name="tag" size={iconSize} color={iconColor} />
            <Text style={styles.categoriesLabel}>Категории</Text>
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
                  style={styles.categoryTag}
                  disabled={!onCategoryPress}
                  accessibilityRole={categoryRole}
                  accessibilityLabel={categoryLabel}
                  {...(webA11yProps as any)}
                >
                <Text style={styles.categoryText}>{cat}</Text>
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
    gap: Platform.select({
      default: 10,
      web: 12,
    }),
    paddingVertical: Platform.select({
      default: 12,
      web: 14,
    }),
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  containerMobile: {
    paddingVertical: 10,
    paddingHorizontal: 0,
    gap: 8,
  },
  factsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Platform.select({
      default: 6,
      web: 8,
    }),
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Platform.select({
      default: 8,
      web: 10,
    }),
    paddingHorizontal: Platform.select({
      default: 12,
      web: 14,
    }),
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: Platform.select({
      default: 38,
      web: 40,
    }),
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        } as any)
      : {}),
  },
  factText: {
    fontSize: Platform.select({
      default: 14,
      web: 14,
    }),
    fontWeight: '500',
    color: colors.text,
    letterSpacing: -0.1,
  },
  categoriesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DESIGN_TOKENS.spacing.xs,
    width: '100%',
  },
  categoriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: Platform.select({
      default: 30,
      web: 32,
    }),
    paddingHorizontal: 2,
  },
  categoriesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.1,
  },
  categoriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
    flex: 1,
  },
  categoryTag: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: Platform.select({
      default: 12,
      web: 14,
    }),
    paddingVertical: Platform.select({
      default: 6,
      web: 7,
    }),
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
    minHeight: Platform.select({
      default: 30,
      web: 32,
    }),
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease' as any,
        ':hover': {
          transform: 'translateY(-1px)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          borderColor: colors.primary,
        } as any,
      },
    }),
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryText,
    letterSpacing: 0.1,
  },
});

export default React.memo(QuickFacts);
