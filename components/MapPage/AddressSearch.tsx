import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  Platform,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { LatLng } from '@/types/coordinates';

interface AddressSearchProps {
  placeholder?: string;
  onAddressSelect: (address: string, coords: LatLng) => void;
  value?: string;
  label?: string;
  enableCoordinateInput?: boolean;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: string;
}

const AddressSearch: React.FC<AddressSearchProps> = ({
  placeholder = 'Введите адрес...',
  onAddressSelect,
  value = '',
  label,
  enableCoordinateInput = false,
}) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const searchAddress = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 3) {
      setResults([]);
      return;
    }

    // Отменяем предыдущий запрос
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);

    try {
      // Используем Nominatim для геокодинга
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
          `format=json&q=${encodeURIComponent(searchQuery)}&` +
          `limit=5&addressdetails=1&countrycodes=by`,
        {
          signal: abortControllerRef.current.signal,
          headers: {
            'User-Agent': 'MeTravel/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка поиска адреса');
      }

      const data = await response.json();
      setResults(data);
      setShowResults(true);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Ошибка поиска адреса:', error);
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);

      // Debounce поиска
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        searchAddress(text);
      }, 500);
    },
    [searchAddress]
  );

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      const coords: LatLng = {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      };
      setQuery(result.display_name);
      setShowResults(false);
      setResults([]);
      onAddressSelect(result.display_name, coords);
    },
    [onAddressSelect]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  }, []);

  const trySubmitCoords = useCallback(() => {
    if (!enableCoordinateInput) return false;
    const parts = query.split(',').map(p => p.trim());
    if (parts.length !== 2) return false;
    const [a, b] = parts.map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    // допускаем ввод как "lat, lng" или "lng, lat" — считаем второй координатой широту
    // выберем формат lat,lng (a — широта, b — долгота) по интуитивности пользователя
    const lat = a;
    const lng = b;
    const coords: LatLng = { lat, lng };
    setResults([]);
    setShowResults(false);
    onAddressSelect(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, coords);
    return true;
  }, [enableCoordinateInput, onAddressSelect, query]);

  useEffect(() => {
    // Синхронизируем внешнее значение (например, после swap/очистки)
    setQuery(value || '');
  }, [value]);

  // ✅ ИСПРАВЛЕНИЕ: Cleanup для debounce и AbortController
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      // Отменяем текущий запрос при размонтировании
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ✅ НОВОЕ: Cleanup при изменении query для предотвращения race conditions
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.inputContainer}>
        <Icon name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />

        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleQueryChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          onFocus={() => {
            if (results.length > 0) {
              setShowResults(true);
            }
          }}
          onSubmitEditing={trySubmitCoords}
        />

        {loading && (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        )}

        {query.length > 0 && !loading && (
          <Pressable onPress={handleClear} hitSlop={8} style={styles.clearButton}>
            <Icon name="close" size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {showResults && results.length > 0 && (
        <View style={styles.resultsContainer}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.resultItem,
                  pressed && styles.resultItemPressed,
                ]}
                onPress={() => handleSelectResult(item)}
              >
                <Icon name="place" size={18} color={colors.primary} />
                <Text style={styles.resultText} numberOfLines={2}>
                  {item.display_name}
                </Text>
              </Pressable>
            )}
            style={styles.resultsList}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}
    </View>
  );
};

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    zIndex: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  loader: {
    marginLeft: 8,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  resultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 200,
    ...colors.shadows.medium,
    zIndex: 1000,
  },
  resultsList: {
    maxHeight: 200,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resultItemPressed: {
    backgroundColor: colors.mutedBackground,
  },
  resultText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
});

export default AddressSearch;
