// components/SearchAutocomplete.tsx
// ✅ УЛУЧШЕНИЕ: Компонент автодополнения для поиска

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { FlashList } from '@shopify/flash-list';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface Suggestion {
  text: string;
  type: 'city' | 'travel' | 'category' | 'country';
  icon?: FeatherIconName;
}

interface SearchAutocompleteProps {
  query: string;
  onSelect: (text: string) => void;
  onClose?: () => void;
  maxSuggestions?: number;
}


// Популярные запросы (можно заменить на API вызов)
const getPopularQueries = () => [
  i18nT('sharedStatic:searchAutocomplete.popular.minsk'),
  i18nT('sharedStatic:searchAutocomplete.popular.belarus'),
  i18nT('sharedStatic:searchAutocomplete.popular.nature'),
  i18nT('sharedStatic:searchAutocomplete.popular.cities'),
  i18nT('sharedStatic:searchAutocomplete.popular.poland'),
  i18nT('sharedStatic:searchAutocomplete.popular.vilnius'),
];

// Генерация предложений на основе запроса
function generateSuggestions(query: string): Suggestion[] {
  if (!query || query.length < 2) {
    return getPopularQueries().slice(0, 5).map(text => ({
      text,
      type: 'city' as const,
      icon: 'map-pin',
    }));
  }

  const lowerQuery = query.toLowerCase();
  const suggestions: Suggestion[] = [];

  // Города Беларуси
  const cities = [i18nT('shared:components.forms.SearchAutocomplete.minsk_3b3e7183'), i18nT('shared:components.forms.SearchAutocomplete.brest_9ae83be3'), i18nT('shared:components.forms.SearchAutocomplete.grodno_1f6a2b63'), i18nT('shared:components.forms.SearchAutocomplete.vitebsk_3a8dbc6f'), i18nT('shared:components.forms.SearchAutocomplete.gomel_5ab8c0a6'), i18nT('shared:components.forms.SearchAutocomplete.mogilev_a858c382')];
  cities.forEach(city => {
    if (city.toLowerCase().includes(lowerQuery)) {
      suggestions.push({ text: city, type: 'city', icon: 'map-pin' });
    }
  });

  // Страны
  const countries = [i18nT('shared:components.forms.SearchAutocomplete.belarus_d0b12928'), i18nT('shared:components.forms.SearchAutocomplete.polsha_0b8f9bad'), i18nT('shared:components.forms.SearchAutocomplete.litva_4dfc837a'), i18nT('shared:components.forms.SearchAutocomplete.latviya_7704e4b0'), i18nT('shared:components.forms.SearchAutocomplete.ukraina_8eb3b97a')];
  countries.forEach(country => {
    if (country.toLowerCase().includes(lowerQuery) && !suggestions.find(s => s.text === country)) {
      suggestions.push({ text: country, type: 'country', icon: 'globe' });
    }
  });

  // Категории
  const categories = [i18nT('shared:components.forms.SearchAutocomplete.priroda_bf4aec83'), i18nT('shared:components.forms.SearchAutocomplete.goroda_4dc12ded'), i18nT('shared:components.forms.SearchAutocomplete.arhitektura_12a25a06'), i18nT('shared:components.forms.SearchAutocomplete.istoriya_e90964eb'), i18nT('shared:components.forms.SearchAutocomplete.kultura_bbc7c106')];
  categories.forEach(category => {
    if (category.toLowerCase().includes(lowerQuery) && !suggestions.find(s => s.text === category)) {
      suggestions.push({ text: category, type: 'category', icon: 'tag' });
    }
  });

  return suggestions.slice(0, 7);
}

function SearchAutocomplete({
  query,
  onSelect,
  onClose,
  maxSuggestions = 7,
}: SearchAutocompleteProps) {
  const colors = useThemedColors();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const selectedIndexRef = useRef(-1);
  const listRef = useRef<any>(null);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      zIndex: 99999,
      marginTop: 4,
      ...Platform.select({
        web: {
          position: 'absolute',
          zIndex: 99999,
        },
        default: {
          elevation: 5,
        },
      }),
      backgroundColor: colors.surface,
      borderRadius: 12,
    },
    listContainer: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      maxHeight: 300,
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
      minHeight: 44,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    suggestionItemSelected: {
      backgroundColor: colors.primarySoft,
    },
    suggestionItemHovered: {
      backgroundColor: colors.primarySoft,
    },
    suggestionText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    suggestionTextSelected: {
      color: colors.primaryText,
      fontWeight: '600',
    },
    suggestionType: {
      fontSize: 12,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
  }), [colors]);

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
    if (selectedIndex >= 0 && selectedIndex < suggestions.length && listRef.current) {
      listRef.current.scrollToIndex({ index: selectedIndex, animated: true });
    }
  }, [selectedIndex, suggestions.length]);

  if (suggestions.length === 0) {
    return null;
  }

  const renderItem = ({ item, index }: { item: Suggestion; index: number }) => {
    const isSelected = index === selectedIndex;
    const isHovered = index === hoveredIndex;
    const iconName: FeatherIconName = item.icon || 
      (item.type === 'city' ? 'map-pin' :
       item.type === 'country' ? 'globe' :
       item.type === 'category' ? 'tag' : 'search');

    return (
      <Pressable
        style={[
          styles.suggestionItem,
          isSelected && styles.suggestionItemSelected,
          !isSelected && isHovered && styles.suggestionItemHovered,
        ]}
        onPress={() => handleSelect(item.text)}
        onHoverIn={Platform.OS === 'web' ? () => setHoveredIndex(index) : undefined}
        onHoverOut={Platform.OS === 'web' ? () => setHoveredIndex(-1) : undefined}
        {...(Platform.OS === 'web' ? ({ onKeyDown: handleKeyPress } as any) : null)}
        {...Platform.select({
          web: {
            cursor: 'pointer',
          },
        })}
      >
        <Feather 
          name={iconName} 
          size={16} 
          color={isSelected ? colors.primary : colors.textMuted}
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
            {item.type === 'country' ? i18nT('shared:components.forms.SearchAutocomplete.strana_0be287a9') :
             item.type === 'category' ? i18nT('shared:components.forms.SearchAutocomplete.kategoriya_e4d230ab') : i18nT('shared:components.forms.SearchAutocomplete.puteshestvie_5f88e8fc')}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.listContainer}>
        <FlashList
          ref={listRef}
          data={suggestions}
          renderItem={renderItem}
          keyExtractor={(item: Suggestion) => `${item.type}-${item.text}`}
          {...({ estimatedItemSize: 44 } as any)}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          nestedScrollEnabled
          drawDistance={600}
          overrideItemLayout={(layout: any) => {
            layout.size = 44;
          }}
        />
      </View>
    </View>
  );
}

export default React.memo(SearchAutocomplete);
