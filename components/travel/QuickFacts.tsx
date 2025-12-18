/**
 * Компонент QuickFacts - быстрые факты о путешествии
 * Показывает ключевую информацию: дата, длительность, страна, категории
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Pressable, Platform } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import type { Travel } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';

interface QuickFactsProps {
  travel: Travel;
  onCategoryPress?: (category: string) => void;
}

export default function QuickFacts({ travel, onCategoryPress }: QuickFactsProps) {
  const { width } = useWindowDimensions();
  const isMobile = width <= METRICS.breakpoints.tablet;

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
    <View 
      style={[styles.container, isMobile && styles.containerMobile]}
      accessibilityLabel="Ключевая информация о путешествии"
    >
      {/* Дата */}
      {whenLine && (
        <View style={styles.factItem}>
          {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
          <MaterialIcons name="calendar-today" size={Platform.select({ default: 16, web: 18 })} color="#6b7280" />
          <Text style={styles.factText}>{whenLine}</Text>
        </View>
      )}

      {/* Длительность */}
      {daysText && (
        <View style={styles.factItem}>
          {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
          <MaterialIcons name="schedule" size={Platform.select({ default: 16, web: 18 })} color="#6b7280" />
          <Text style={styles.factText}>{daysText}</Text>
        </View>
      )}

      {/* Страна */}
      {countryName && (
        <View style={styles.factItem}>
          {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
          <Feather name="map-pin" size={Platform.select({ default: 16, web: 18 })} color="#6b7280" />
          <Text style={styles.factText}>{countryName}</Text>
        </View>
      )}

      {/* Категории */}
      {categories.length > 0 && (
        <View style={[styles.factItem, styles.categoriesContainer]}>
          {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
          <MaterialIcons name="label" size={Platform.select({ default: 16, web: 18 })} color="#6b7280" />
          <View style={styles.categoriesWrap}>
            {categories.map((cat, index) => (
              <Pressable
                key={index}
                onPress={() => onCategoryPress?.(cat)}
                style={styles.categoryTag}
                disabled={!onCategoryPress}
                accessibilityRole={onCategoryPress ? "button" : "text"}
                accessibilityLabel={`Категория: ${cat}`}
              >
                <Text style={styles.categoryText}>{cat}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ✅ РЕДИЗАЙН: Светлая современная карточка с generous spacing
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Platform.select({
      default: DESIGN_TOKENS.spacing.lg,
      web: DESIGN_TOKENS.spacing.xl,
    }),
    paddingVertical: Platform.select({
      default: DESIGN_TOKENS.spacing.xl,
      web: DESIGN_TOKENS.spacing.xxl,
    }),
    paddingHorizontal: Platform.select({
      default: DESIGN_TOKENS.spacing.xl,
      web: DESIGN_TOKENS.spacing.xxl,
    }),
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.card,
      } as any,
      default: DESIGN_TOKENS.shadowsNative.medium,
    }),
  },
  containerMobile: {
    paddingVertical: DESIGN_TOKENS.spacing.lg,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    gap: DESIGN_TOKENS.spacing.md,
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
    color: DESIGN_TOKENS.colors.text,
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
  // ✅ РЕДИЗАЙН: Легкие теги категорий
  categoryTag: {
    backgroundColor: DESIGN_TOKENS.colors.primaryLight,
    paddingHorizontal: Platform.select({
      default: 12,
      web: 16,
    }),
    paddingVertical: Platform.select({
      default: 6,
      web: 8,
    }),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease' as any,
        ':hover': {
          backgroundColor: DESIGN_TOKENS.colors.primary,
          borderColor: DESIGN_TOKENS.colors.primary,
          boxShadow: DESIGN_TOKENS.shadows.hover,
        } as any,
      },
    }),
  },
  categoryText: {
    fontSize: Platform.select({
      default: 13,
      web: 14,
    }),
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.primary,
    letterSpacing: 0,
  },
});

