/**
 * Компонент QuickFacts - быстрые факты о путешествии
 * Показывает ключевую информацию: дата, длительность, страна, категории
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Pressable, Platform } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import type { Travel } from '@/src/types/types';

interface QuickFactsProps {
  travel: Travel;
  onCategoryPress?: (category: string) => void;
}

export default function QuickFacts({ travel, onCategoryPress }: QuickFactsProps) {
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;

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
          const parts = String(addr.categoryName).split(',').map(s => s.trim()).filter(Boolean);
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
      accessibilityRole="group"
      accessibilityLabel="Ключевая информация о путешествии"
    >
      {/* Дата */}
      {whenLine && (
        <View style={styles.factItem}>
          <MaterialIcons name="calendar-today" size={Platform.select({ default: 16, web: 18 })} color="#6b7280" /> {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
          <Text style={styles.factText}>{whenLine}</Text>
        </View>
      )}

      {/* Длительность */}
      {daysText && (
        <View style={styles.factItem}>
          <MaterialIcons name="schedule" size={Platform.select({ default: 16, web: 18 })} color="#6b7280" /> {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
          <Text style={styles.factText}>{daysText}</Text>
        </View>
      )}

      {/* Страна */}
      {countryName && (
        <View style={styles.factItem}>
          <Feather name="map-pin" size={Platform.select({ default: 16, web: 18 })} color="#6b7280" /> {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
          <Text style={styles.factText}>{countryName}</Text>
        </View>
      )}

      {/* Категории */}
      {categories.length > 0 && (
        <View style={[styles.factItem, styles.categoriesContainer]}>
          <MaterialIcons name="label" size={Platform.select({ default: 16, web: 18 })} color="#6b7280" /> {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
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
  // ✅ РЕДИЗАЙН: Современная карточка с glassmorphism и улучшенными тенями
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Platform.select({
      default: 16, // Мобильные
      web: 20, // Десктоп
    }),
    paddingVertical: Platform.select({
      default: 20, // Мобильные
      web: 24, // Десктоп
    }),
    paddingHorizontal: Platform.select({
      default: 20, // Мобильные
      web: 28, // Десктоп
    }),
    backgroundColor: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.9)' : '#fff',
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(20px)' as any,
      WebkitBackdropFilter: 'blur(20px)' as any,
    } : {}),
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 1
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02, // ✅ УЛУЧШЕНИЕ: Упрощенная тень
    shadowRadius: 4,
    elevation: 1, // ✅ УЛУЧШЕНИЕ: Уменьшено с 4
  },
  containerMobile: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 16,
    borderRadius: 16,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  factText: {
    fontSize: Platform.select({
      default: 14, // Мобильные
      web: 16, // Десктоп
    }),
    fontWeight: '600',
    color: '#1a202c',
    fontFamily: 'Georgia',
    letterSpacing: -0.2,
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
    gap: 8,
    flex: 1,
  },
  // ✅ РЕДИЗАЙН: Улучшенные теги категорий с hover эффектами
  categoryTag: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)', // ✅ УЛУЧШЕНИЕ: Нейтральный фон
    paddingHorizontal: Platform.select({
      default: 10, // Мобильные
      web: 12, // Десктоп
    }),
    paddingVertical: Platform.select({
      default: 5, // Мобильные
      web: 6, // Десктоп
    }),
    borderRadius: 16,
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 1
    borderColor: 'rgba(0, 0, 0, 0.06)',
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' as any,
        ':hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
          borderColor: '#1f2937',
          transform: 'translateY(-2px) scale(1.05)' as any,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' as any,
        } as any,
      },
    }),
  },
  categoryText: {
    fontSize: Platform.select({
      default: 12, // Мобильные
      web: 13, // Десктоп
    }),
    fontWeight: '700',
    color: '#6b7280', // ✅ УЛУЧШЕНИЕ: Нейтральный серый
    fontFamily: 'Georgia',
    letterSpacing: -0.1,
  },
});

