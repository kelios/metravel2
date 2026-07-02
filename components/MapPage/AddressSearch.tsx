import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { queryKeys } from '@/queryKeys'
import { nominatimSearch } from '@/api/external/nominatim'
import type { LatLng } from '@/types/coordinates'
import { CoordinateConverter } from '@/utils/coordinateConverter'
import MapIcon from './MapIcon'
import IconButton from '@/components/ui/IconButton'

const MIN_QUERY_LENGTH = 3
const SEARCH_DEBOUNCE_MS = 500
const SEARCH_LIMIT = 5
const SEARCH_STALE_TIME_MS = 10_000
const SEARCH_GC_TIME_MS = 60_000
const RESULTS_MAX_HEIGHT = 200

const BELARUS_BBOX = { latMin: 50, latMax: 57.5, lngMin: 22, lngMax: 33.5 }

function isInBelarusBox(c: LatLng) {
  return (
    c.lat >= BELARUS_BBOX.latMin &&
    c.lat <= BELARUS_BBOX.latMax &&
    c.lng >= BELARUS_BBOX.lngMin &&
    c.lng <= BELARUS_BBOX.lngMax
  )
}

/**
 * Parses "lat, lng" (or "lat; lng") input. Returns coords or null.
 * Search is constrained to Belarus on the server, so ambiguous inputs prefer
 * the interpretation falling inside the Belarus bounding box.
 */
function parseCoordinatesInput(query: string): LatLng | null {
  const parts = query
    .replace(/;/g, ',')
    .split(',')
    .map((p) => p.trim())
  if (parts.length !== 2) return null
  const [a, b] = parts.map(Number)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null

  const candidateLatLng: LatLng = { lat: a, lng: b }
  const candidateLngLat: LatLng = { lat: b, lng: a }
  const validLatLng = CoordinateConverter.isValid(candidateLatLng)
  const validLngLat = CoordinateConverter.isValid(candidateLngLat)
  if (!validLatLng && !validLngLat) return null

  if (validLatLng && !validLngLat) return candidateLatLng
  if (!validLatLng && validLngLat) return candidateLngLat

  const aInBox = isInBelarusBox(candidateLatLng)
  const bInBox = isInBelarusBox(candidateLngLat)
  if (aInBox && !bInBox) return candidateLatLng
  if (!aInBox && bInBox) return candidateLngLat

  // Both valid + neither (or both) in box: lat is typically larger magnitude in Belarus.
  return Math.abs(candidateLatLng.lat) >= Math.abs(candidateLatLng.lng)
    ? candidateLatLng
    : candidateLngLat
}

interface AddressSearchProps {
  placeholder?: string
  onAddressSelect: (address: string, coords: LatLng) => void
  value?: string
  label?: string
  enableCoordinateInput?: boolean
  onClear?: () => void
  dense?: boolean
}

interface SearchResult {
  display_name: string
  lat: string
  lon: string
  place_id: string
}

const AddressSearch: React.FC<AddressSearchProps> = ({
  placeholder = 'Введите адрес...',
  onAddressSelect,
  value = '',
  label,
  enableCoordinateInput = false,
  onClear,
  dense = false,
}) => {
  const [query, setQuery] = useState(value)
  const [showResults, setShowResults] = useState(false)
  const [searchEnabled, setSearchEnabled] = useState(false)
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors, dense), [colors, dense])

  const {
    data: results = [],
    isFetching: loading,
    isError,
    refetch,
  } = useQuery<SearchResult[]>({
    queryKey: queryKeys.addressSearch(debouncedQuery),
    enabled: searchEnabled && debouncedQuery.length >= MIN_QUERY_LENGTH,
    retry: false,
    staleTime: SEARCH_STALE_TIME_MS,
    gcTime: SEARCH_GC_TIME_MS,
    queryFn: async ({ signal, queryKey } = {} as any) => {
      const q = (queryKey?.[queryKey.length - 1] ?? '') as string
      const response = await nominatimSearch(
        { q, limit: SEARCH_LIMIT, addressdetails: 1 },
        { signal, headers: { 'User-Agent': 'MeTravel/1.0' } },
      )
      if (!response.ok) throw new Error('Ошибка поиска адреса')
      return response.json()
    },
  })

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text)
    setSearchEnabled(true)
    if (text.length < MIN_QUERY_LENGTH) setShowResults(false)
  }, [])

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      const lat = parseFloat(result.lat)
      const lng = parseFloat(result.lon)
      setQuery(result.display_name)
      setSearchEnabled(false)
      setShowResults(false)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      onAddressSelect(result.display_name, { lat, lng })
    },
    [onAddressSelect],
  )

  const handleClear = useCallback(() => {
    setQuery('')
    setSearchEnabled(false)
    setShowResults(false)
    onClear?.()
  }, [onClear])

  const trySubmitCoords = useCallback(() => {
    if (!enableCoordinateInput) return false
    const coords = parseCoordinatesInput(query)
    if (!coords) return false
    setShowResults(false)
    onAddressSelect(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`, coords)
    return true
  }, [enableCoordinateInput, onAddressSelect, query])

  useEffect(() => {
    setQuery(value || '')
    setSearchEnabled(false)
    setShowResults(false)
  }, [value])

  useEffect(() => {
    if (searchEnabled && debouncedQuery.length >= MIN_QUERY_LENGTH && results.length > 0) {
      setShowResults(true)
    }
  }, [debouncedQuery.length, results.length, searchEnabled])

  const handleFocus = useCallback(() => {
    if (searchEnabled && debouncedQuery.length >= MIN_QUERY_LENGTH && results.length > 0) {
      setShowResults(true)
    }
  }, [searchEnabled, debouncedQuery.length, results.length])

  const showErrorState =
    !loading &&
    isError &&
    searchEnabled &&
    debouncedQuery.length >= MIN_QUERY_LENGTH
  const showEmptyState =
    !loading &&
    !isError &&
    searchEnabled &&
    debouncedQuery.length >= MIN_QUERY_LENGTH &&
    results.length === 0 &&
    !showResults
  const showMinCharsHint =
    !loading && searchEnabled && query.length > 0 && query.length < MIN_QUERY_LENGTH

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.inputContainer}>
        <MapIcon
          name="search"
          size={20}
          color={colors.textMuted}
          style={styles.searchIcon}
        />

        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleQueryChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          onFocus={handleFocus}
          onSubmitEditing={trySubmitCoords}
          accessibilityLabel={placeholder}
          accessibilityRole="search"
          returnKeyType="search"
        />

        {loading && (
          <ActivityIndicator size="small" color={colors.primaryDark} style={styles.loader} />
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
        <View
          style={styles.resultsContainer}
          accessibilityRole={Platform.OS === 'web' ? ('listbox' as any) : 'list'}
          accessibilityLabel="Результаты поиска адреса"
        >
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
                accessibilityRole={Platform.OS === 'web' ? ('option' as any) : 'button'}
                accessibilityLabel={item.display_name}
              >
                <MapIcon name="place" size={18} color={colors.primaryDark} />
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

      {showErrorState && (
        <View style={styles.errorResults}>
          <Text style={styles.errorResultsText}>
            Не удалось выполнить поиск. Проверьте соединение.
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Повторить поиск"
          >
            <MapIcon name="refresh" size={14} color={colors.primaryDark} />
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {showEmptyState && (
        <View style={styles.emptyResults}>
          <Text style={styles.emptyResultsText}>
            Ничего не найдено по запросу «{debouncedQuery}»
          </Text>
        </View>
      )}

      {showMinCharsHint && (
        <Text style={styles.minCharsHint}>
          Введите минимум {MIN_QUERY_LENGTH} символа для поиска
        </Text>
      )}
    </View>
  )
}

const getStyles = (colors: ThemedColors, dense: boolean) =>
  StyleSheet.create({
    container: { width: '100%', position: 'relative', zIndex: 10 },
    label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: dense ? 10 : 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: dense ? 10 : 12,
      height: dense ? 40 : 44,
    },
    searchIcon: { marginRight: dense ? 6 : 8 },
    input: {
      flex: 1,
      fontSize: dense ? 13 : 14,
      color: colors.text,
      paddingVertical: 0,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    loader: { marginLeft: dense ? 6 : 8 },
    clearButton: {
      marginLeft: dense ? 6 : 8,
      padding: 0,
      width: dense ? 28 : 32,
      height: dense ? 28 : 32,
      borderRadius: dense ? 14 : 16,
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
      maxHeight: RESULTS_MAX_HEIGHT,
      ...colors.shadows.medium,
      zIndex: 1000,
    },
    resultsList: { maxHeight: RESULTS_MAX_HEIGHT },
    resultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    resultItemPressed: { backgroundColor: colors.mutedBackground },
    resultText: { flex: 1, fontSize: 13, color: colors.text },
    emptyResults: { marginTop: 6, paddingHorizontal: 4 },
    emptyResultsText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
    errorResults: {
      marginTop: 6,
      paddingHorizontal: 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    errorResultsText: { flex: 1, fontSize: 12, color: colors.danger },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
    },
    retryButtonPressed: { opacity: 0.7 },
    retryText: { fontSize: 12, fontWeight: '600', color: colors.primaryText },
    minCharsHint: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
      paddingHorizontal: 4,
    },
  })

export default React.memo(AddressSearch)
