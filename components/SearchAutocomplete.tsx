// components/SearchAutocomplete.tsx
// ✅ УЛУЧШЕНИЕ: Компонент автодополнения для поиска

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface Suggestion {
  text: string;
  type: 'city' | 'travel' | 'category' | 'country';
  icon?: string;
}

interface SearchAutocompleteProps {
  query: string;
  onSelect: (text: string) => void;
  onClose?: () => void;
  maxSuggestions?: number;
}

const palette = DESIGN_TOKENS.colors;

// Популярные запросы (можно заменить на API вызов)
const POPULAR_QUERIES = [
  'Минск',
  'Беларусь',
  'Природа',
  'Города',
  'Польша',
  'Вильнюс',
];

// Генерация предложений на основе запроса
function generateSuggestions(query: string): Suggestion[] {
  if (!query || query.length < 2) {
    return POPULAR_QUERIES.slice(0, 5).map(text => ({
      text,
      type: 'city' as const,
      icon: 'map-pin',
    }));
  }

  const lowerQuery = query.toLowerCase();
  const suggestions: Suggestion[] = [];

  // Города Беларуси
  const cities = ['Минск', 'Брест', 'Гродно', 'Витебск', 'Гомель', 'Могилев'];
  cities.forEach(city => {
    if (city.toLowerCase().includes(lowerQuery)) {
      suggestions.push({ text: city, type: 'city', icon: 'map-pin' });
    }
  });

  // Страны
  const countries = ['Беларусь', 'Польша', 'Литва', 'Латвия', 'Украина'];
  countries.forEach(country => {
    if (country.toLowerCase().includes(lowerQuery) && !suggestions.find(s => s.text === country)) {
      suggestions.push({ text: country, type: 'country', icon: 'globe' });
    }
  });

  // Категории
  const categories = ['Природа', 'Города', 'Архитектура', 'История', 'Культура'];
  categories.forEach(category => {
    if (category.toLowerCase().includes(lowerQuery) && !suggestions.find(s => s.text === category)) {
      suggestions.push({ text: category, type: 'category', icon: 'tag' });
    }
  });

  return suggestions.slice(0, 7);
}

export default function SearchAutocomplete({
  query,
  onSelect,
  onClose,
  maxSuggestions = 7,
}: SearchAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const selectedIndexRef = useRef(-1);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const newSuggestions = generateSuggestions(query);
    setSuggestions(newSuggestions.slice(0, maxSuggestions));
    setSelectedIndex(-1);
    selectedIndexRef.current = -1;
  }, [query, maxSuggestions]);

  const handleSelect = useCallback((text: string) => {
    onSelect(text);
    onClose?.();
  }, [onSelect, onClose]);

  const handleKeyPress = useCallback((e: any) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next =
        selectedIndexRef.current < suggestions.length - 1
          ? selectedIndexRef.current + 1
          : selectedIndexRef.current;
      selectedIndexRef.current = next;
      setSelectedIndex(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = selectedIndexRef.current > 0 ? selectedIndexRef.current - 1 : -1;
      selectedIndexRef.current = next;
      setSelectedIndex(next);
    } else if (e.key === 'Enter' && selectedIndexRef.current >= 0) {
      e.preventDefault();
      const selected = suggestions[selectedIndexRef.current];
      if (selected) {
        handleSelect(selected.text);
      }
    } else if (e.key === 'Escape') {
      onClose?.();
    }
  }, [suggestions, handleSelect, onClose]);

  // Прокрутка к выбранному элементу
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      listRef.current.scrollToIndex({ index: selectedIndex, animated: true });
    }
  }, [selectedIndex]);

  if (suggestions.length === 0) {
    return null;
  }

  const renderItem = ({ item, index }: { item: Suggestion; index: number }) => {
    const isSelected = index === selectedIndex;
    const iconName = item.icon || 
      (item.type === 'city' ? 'map-pin' :
       item.type === 'country' ? 'globe' :
       item.type === 'category' ? 'tag' : 'search');

    return (
      <Pressable
        style={[
          styles.suggestionItem,
          isSelected && styles.suggestionItemSelected,
        ]}
        onPress={() => handleSelect(item.text)}
        {...(Platform.OS === 'web' ? ({ onKeyDown: handleKeyPress } as any) : null)}
        {...Platform.select({
          web: {
            cursor: 'pointer',
            // @ts-ignore
            ':hover': {
              backgroundColor: palette.primarySoft,
            },
          },
        })}
      >
        <Feather 
          name={iconName as any} 
          size={16} 
          color={isSelected ? palette.primary : palette.textMuted} 
        />
        <Text 
          style={[
            styles.suggestionText,
            isSelected && styles.suggestionTextSelected,
          ]}
        >
          {item.text}
        </Text>
        {item.type !== 'city' && (
          <Text style={styles.suggestionType}>
            {item.type === 'country' ? 'Страна' :
             item.type === 'category' ? 'Категория' : 'Путешествие'}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.listContainer}>
        <FlatList
          ref={listRef}
          data={suggestions}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.text}-${index}`}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          nestedScrollEnabled
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    // ✅ Максимальный приоритет поверх карточек и других блоков
    zIndex: 99999,
    marginTop: 4,
    ...Platform.select({
      web: {
        position: 'absolute',
        zIndex: 99999,
      },
      default: {
        // На мобильных используем elevation для Android и shadow для iOS
        elevation: 5,
      },
    }),
    backgroundColor: palette.surface,
    borderRadius: 12,
  },
  listContainer: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    maxHeight: 300,
    // ✅ ИСПРАВЛЕНИЕ: Добавляем тень и правильное позиционирование для всех платформ
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.medium,
      },
      ios: {
        ...DESIGN_TOKENS.shadowsNative.medium,
      },
      android: {
        elevation: 8,
      },
      default: {
        ...DESIGN_TOKENS.shadowsNative.medium,
      },
    }),
  },
  list: {
    flexGrow: 0,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    minHeight: 44, // Минимальный размер для touch-целей
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  suggestionItemSelected: {
    backgroundColor: palette.primarySoft,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: palette.text,
    fontWeight: '500',
  },
  suggestionTextSelected: {
    color: palette.primary,
    fontWeight: '600',
  },
  suggestionType: {
    fontSize: 12,
    color: palette.textMuted,
    fontStyle: 'italic',
  },
});
