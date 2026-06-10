import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, ScrollView, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLocationSearchQuery, type LocationSearchResult } from '@/api/geoQueries';

const isWeb = Platform.OS === 'web' || typeof document !== 'undefined';

type SearchResult = LocationSearchResult;

interface LocationSearchInputProps {
    onLocationSelect: (result: SearchResult) => void;
    placeholder?: string;
    autoFocus?: boolean;
}

/**
 * ✅ ФАЗА 2: Компонент поиска мест на карте через Nominatim API
 * Позволяет пользователям искать места по названию вместо ручного клика
 */
const LocationSearchInput: React.FC<LocationSearchInputProps> = ({
    onLocationSelect,
    placeholder = 'Поиск места на карте...',
    autoFocus = false,
}) => {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [query, setQuery] = useState('');
    const [showResults, setShowResults] = useState(false);
    const debouncedQuery = useDebouncedValue(query, 500);

    const {
        data: results = [],
        isFetching: isLoading,
        isError,
    } = useLocationSearchQuery({ query: debouncedQuery });

    const error = isError ? 'Ошибка поиска. Попробуйте еще раз.' : null;

    // Показываем выпадашку, как только пришёл задебаунсенный результат.
    useEffect(() => {
        if (debouncedQuery.trim().length >= 3) {
            setShowResults(true);
        } else {
            setShowResults(false);
        }
    }, [debouncedQuery]);

    const handleResultSelect = useCallback((result: SearchResult) => {
        onLocationSelect(result);
        setQuery('');
        setShowResults(false);
    }, [onLocationSelect]);

    const handleClear = useCallback(() => {
        setQuery('');
        setShowResults(false);
    }, []);

    // Форматирование адреса для отображения
    const formatAddress = useCallback((result: SearchResult) => {
        const parts: string[] = [];

        if (result.address) {
            const { city, town, village, state, country } = result.address;
            const locality = city || town || village;
            if (locality) parts.push(locality);
            if (state && state !== locality) parts.push(state);
            if (country) parts.push(country);
        }

        return parts.length > 0 ? parts.join(', ') : result.display_name;
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.inputWrapper}>
                <Feather name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
                <TextInput
                    style={styles.input}
                    value={query}
                    onChangeText={setQuery}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    autoFocus={autoFocus}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {isLoading && (
                    <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
                )}
                {query.length > 0 && !isLoading && (
                    <Pressable
                        testID="location-clear-button"
                        onPress={handleClear}
                        style={styles.clearButton}
                        accessibilityRole="button"
                        accessibilityLabel="Очистить поле поиска"
                    >
                        <Feather name="x" size={18} color={colors.textMuted} />
                    </Pressable>
                )}
            </View>

            {query.trim().length > 0 && query.trim().length < 3 && !isLoading && !error && (
                <Text style={styles.minCharsHint}>Введите минимум 3 символа для поиска</Text>
            )}

            {!!error && (
                <View style={styles.errorContainer}>
                    <Feather name="alert-circle" size={16} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {showResults && results.length > 0 && (
                <ScrollView
                    testID="location-results"
                    {...(isWeb ? ({ 'data-testid': 'location-results' } as any) : null)}
                    style={styles.resultsContainer}
                    nestedScrollEnabled
                >
                    {results.map((result) => (
                        <Pressable
                            key={result.place_id}
                            testID={`location-result-${result.place_id}`}
                            accessibilityRole="button"
                            accessibilityLabel={result.display_name}
                            {...(isWeb
                                ? ({ 'data-testid': `location-result-${result.place_id}` } as any)
                                : null)}
                            style={({ pressed }) => [
                                styles.resultItem,
                                pressed && styles.resultItemPressed,
                            ]}
                            onPress={() => handleResultSelect(result)}
                        >
                            <Feather name="map-pin" size={16} color={colors.primary} style={styles.resultIcon} />
                            <View style={styles.resultTextContainer}>
                                <Text style={styles.resultTitle} numberOfLines={1}>
                                    {result.display_name.split(',')[0]}
                                </Text>
                                <Text style={styles.resultAddress} numberOfLines={1}>
                                    {formatAddress(result)}
                                </Text>
                            </View>
                            <Feather name="chevron-right" size={16} color={colors.textMuted} />
                        </Pressable>
                    ))}
                </ScrollView>
            )}

            {showResults && results.length === 0 && !isLoading && query.length >= 3 && (
                <View style={styles.emptyContainer}>
                    <Feather name="search" size={24} color={colors.textMuted} />
                    <Text style={styles.emptyText}>Ничего не найдено</Text>
                    <Text style={styles.emptyHint}>Попробуйте изменить запрос</Text>
                </View>
            )}
        </View>
    );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: DESIGN_TOKENS.spacing.md,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        minHeight: 44,
    },
    searchIcon: {
        marginRight: DESIGN_TOKENS.spacing.xs,
    },
    input: {
        flex: 1,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.text,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
    },
    spinner: {
        marginLeft: DESIGN_TOKENS.spacing.xs,
    },
    clearButton: {
        padding: DESIGN_TOKENS.spacing.xs,
        marginLeft: DESIGN_TOKENS.spacing.xs,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
        marginTop: DESIGN_TOKENS.spacing.xs,
        padding: DESIGN_TOKENS.spacing.sm,
        backgroundColor: colors.dangerSoft ?? colors.surface,
        borderRadius: DESIGN_TOKENS.radii.sm,
    },
    minCharsHint: {
        marginTop: DESIGN_TOKENS.spacing.xs,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
    },
    errorText: {
        flex: 1,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.danger,
    },
    resultsContainer: {
        marginTop: DESIGN_TOKENS.spacing.xs,
        maxHeight: 300,
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...(Platform.OS === 'web'
            ? ({ boxShadow: colors.boxShadows?.medium ?? '0 2px 6px rgba(0,0,0,0.08)' } as any)
            : {}),
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: DESIGN_TOKENS.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
    },
    resultItemPressed: {
        backgroundColor: colors.primarySoft,
    },
    resultIcon: {
        marginRight: DESIGN_TOKENS.spacing.sm,
    },
    resultTextContainer: {
        flex: 1,
        minWidth: 0,
    },
    resultTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    resultAddress: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: DESIGN_TOKENS.spacing.lg,
        marginTop: DESIGN_TOKENS.spacing.xs,
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    emptyText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.textMuted,
        marginTop: DESIGN_TOKENS.spacing.sm,
    },
    emptyHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginTop: DESIGN_TOKENS.spacing.xxs,
    },
});

export default React.memo(LocationSearchInput);
