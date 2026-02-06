import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { queryKeys } from '@/queryKeys';
import type { LatLng } from '@/types/coordinates';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import MapIcon from './MapIcon';
import IconButton from '@/components/ui/IconButton';

interface AddressSearchProps {
  placeholder?: string;
  onAddressSelect: (address: string, coords: LatLng) => void;
  value?: string;
  label?: string;
  enableCoordinateInput?: boolean;
  onClear?: () => void;
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
  onClear,
}) => {
  const [query, setQuery] = useState(value);
  const [showResults, setShowResults] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 500);
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { data: results = [], isFetching: loading } = useQuery<SearchResult[]>({
    queryKey: queryKeys.addressSearch(debouncedQuery),
    enabled: searchEnabled && debouncedQuery.length >= 3,
    retry: false,
    staleTime: 10_000,
    gcTime: 60_000,
    queryFn: async ({ signal } = {} as any) => {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
          `format=json&q=${encodeURIComponent(debouncedQuery)}&` +
          `limit=5&addressdetails=1&countrycodes=by`,
        {
          signal,
          headers: {
            'User-Agent': 'MeTravel/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка поиска адреса');
      }

      return response.json();
    },
  });

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      setSearchEnabled(true);
      if (text.length < 3) {
        setShowResults(false);
      }
    },
    []
  );

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      const coords: LatLng = {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      };
      setQuery(result.display_name);
      setSearchEnabled(false);
      setShowResults(false);
      onAddressSelect(result.display_name, coords);
    },
    [onAddressSelect]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setSearchEnabled(false);
    setShowResults(false);
    onClear?.();
  }, [onClear]);

  const trySubmitCoords = useCallback(() => {
    if (!enableCoordinateInput) return false;
    const parts = query.replace(/;/g, ',').split(',').map(p => p.trim());
    if (parts.length !== 2) return false;
    const [a, b] = parts.map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;

    const candidateLatLng: LatLng = { lat: a, lng: b };
    const candidateLngLat: LatLng = { lat: b, lng: a };
    const validLatLng = CoordinateConverter.isValid(candidateLatLng);
    const validLngLat = CoordinateConverter.isValid(candidateLngLat);

    if (!validLatLng && !validLngLat) return false;

    // If only one candidate is valid, it's unambiguous.
    let coords: LatLng;
    if (validLatLng && !validLngLat) {
      coords = candidateLatLng;
    } else if (!validLatLng && validLngLat) {
      coords = candidateLngLat;
    } else {
      // Ambiguous case: both within -90..90. App search is constrained to Belarus (countrycodes=by),
      // so prefer the interpretation that falls into a Belarus-like bounding box.
      const inBelarusBox = (c: LatLng) =>
        c.lat >= 50 && c.lat <= 57.5 && c.lng >= 22 && c.lng <= 33.5;

      const aInBox = inBelarusBox(candidateLatLng);
      const bInBox = inBelarusBox(candidateLngLat);

      if (aInBox && !bInBox) coords = candidateLatLng;
      else if (!aInBox && bInBox) coords = candidateLngLat;
      else {
        // Fallback heuristic: for Belarus lat is typically larger than lng in magnitude.
        coords = Math.abs(candidateLatLng.lat) >= Math.abs(candidateLatLng.lng)
          ? candidateLatLng
          : candidateLngLat;
      }
    }

    setShowResults(false);
    onAddressSelect(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`, coords);
    return true;
  }, [enableCoordinateInput, onAddressSelect, query]);

  useEffect(() => {
    // Синхронизируем внешнее значение (например, после swap/очистки)
    setQuery(value || '');
    setSearchEnabled(false);
    setShowResults(false);
  }, [value]);

  useEffect(() => {
    if (searchEnabled && query.length >= 3 && results.length > 0) {
      setShowResults(true);
    }
  }, [query.length, results.length, searchEnabled]);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.inputContainer}>
        <MapIcon name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />

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
          <IconButton
            icon={<MapIcon name="close" size={20} color={colors.textMuted} />}
            label="Очистить поиск"
            size="sm"
            onPress={handleClear}
            style={styles.clearButton}
          />
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
                <MapIcon name="place" size={18} color={colors.primary} />
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
    padding: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as any) : null),
    marginHorizontal: 0,
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
