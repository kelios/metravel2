import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    ScrollView,
    Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLocationSearchQuery, type LocationSearchResult } from '@/api/geoQueries';
import { translate as i18nT } from '@/i18n'


const isWeb = Platform.OS === 'web' || typeof document !== 'undefined';

type SearchResult = LocationSearchResult;

interface LocationSearchInputProps {
    onLocationSelect: (result: SearchResult) => void;
    placeholder?: string;
    autoFocus?: boolean;
    // Native-only: ссылка на родительский ScrollView. На фокусе инпута/появлении
    // результатов подскролливаем его так, чтобы инпут и выпадашка не прятались за
    // софт-клавиатурой (F-13). На web не используется — клавиатуры нет.
    scrollViewRef?: React.RefObject<ScrollView | null>;
    // Native-only: текущее вертикальное смещение того же ScrollView (обновляется
    // родителем через onScroll). Нужно, чтобы из window-координат инпута вычислить
    // абсолютную позицию в контенте для scrollTo.
    scrollOffsetRef?: React.RefObject<number>;
}

/**
 * ✅ ФАЗА 2: Компонент поиска мест на карте через Nominatim API
 * Позволяет пользователям искать места по названию вместо ручного клика
 */
const LocationSearchInput: React.FC<LocationSearchInputProps> = ({
    onLocationSelect,
    placeholder = i18nT('travel:components.travel.LocationSearchInput.poisk_mesta_na_karte_3bddba6d'),
    autoFocus = false,
    scrollViewRef,
    scrollOffsetRef,
}) => {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [query, setQuery] = useState('');
    const [showResults, setShowResults] = useState(false);
    const debouncedQuery = useDebouncedValue(query, 500);

    const containerRef = useRef<View>(null);
    const isFocusedRef = useRef(false);

    // Native-only keyboard avoidance: подскролливаем родительский ScrollView так,
    // чтобы инпут поиска оказался в верхней части видимой области, а выпадашка
    // результатов уместилась над клавиатурой. На web — no-op (нет клавиатуры).
    // Используем measure() (window-координаты), а НЕ measureLayout(nodeHandle):
    // на RN 0.84/Fabric measureLayout с findNodeHandle бросает «must be called with
    // a ref to a native component» и scrollTo не вызывается → инпут остаётся под
    // клавиатурой. measure() архитектурно-независим и не требует чужого узла (F-13).
    const scrollInputIntoView = useCallback(() => {
        if (isWeb || !scrollViewRef?.current) return;
        // Двойной rAF: дать клавиатуре начать анимацию (adjustResize усаживает окно),
        // чтобы measure() вернул уже актуальные координаты.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const container = containerRef.current;
                const scroll = scrollViewRef.current;
                if (!container || !scroll || typeof container.measure !== 'function') return;
                // Узел самого ScrollView для measure() (совместимо со старой и новой
                // архитектурой). Его window-top — точка отсчёта для позиции инпута.
                const scrollNode = (
                    typeof (scroll as { getScrollableNode?: () => { measure?: unknown } }).getScrollableNode ===
                    'function'
                        ? (scroll as { getScrollableNode: () => { measure?: unknown } }).getScrollableNode()
                        : scroll
                ) as { measure?: (cb: (x: number, y: number, w: number, h: number, px: number, py: number) => void) => void };
                const applyScroll = (scrollTopWindowY: number) => {
                    container.measure((_x, _y, _w, _h, _pageX, pageY) => {
                        if (!Number.isFinite(pageY)) return;
                        const currentOffset = scrollOffsetRef?.current ?? 0;
                        // Позиция инпута в контенте = текущий скролл + (окно-Y инпута −
                        // окно-Y верха ScrollView). Небольшой отступ сверху оставляет
                        // подпись над инпутом видимой. Так инпут встаёт у верхней
                        // кромки области, а выпадашка помещается над клавиатурой (F-13).
                        const inputContentY = currentOffset + (pageY - scrollTopWindowY);
                        const targetY = Math.max(0, inputContentY - DESIGN_TOKENS.spacing.lg);
                        scroll.scrollTo({ y: targetY, animated: true });
                    });
                };
                if (typeof scrollNode?.measure === 'function') {
                    scrollNode.measure((_sx, _sy, _sw, _sh, _spx, scrollPageY) => {
                        applyScroll(Number.isFinite(scrollPageY) ? scrollPageY : 0);
                    });
                } else {
                    applyScroll(0);
                }
            });
        });
    }, [scrollViewRef, scrollOffsetRef]);

    const handleFocus = useCallback(() => {
        isFocusedRef.current = true;
        scrollInputIntoView();
    }, [scrollInputIntoView]);

    const handleBlur = useCallback(() => {
        isFocusedRef.current = false;
    }, []);

    const {
        data: results = [],
        isFetching: isLoading,
        isError,
    } = useLocationSearchQuery({ query: debouncedQuery });

    const error = isError ? i18nT('travel:components.travel.LocationSearchInput.oshibka_poiska_poprobuyte_esche_raz_649dc9ce') : null;

    // Показываем выпадашку, как только пришёл задебаунсенный результат.
    useEffect(() => {
        if (debouncedQuery.trim().length >= 3) {
            setShowResults(true);
        } else {
            setShowResults(false);
        }
    }, [debouncedQuery]);

    // Инпут подтягиваем к верху видимой области ОДИН раз — на фокусе (см. handleFocus).
    // Повторный scrollInputIntoView на приход каждого результата раньше складывался
    // с фокус-скроллом и уводил инпут выше вьюпорта. Выпадашка (maxHeight 300) рендерится
    // под инпутом и помещается над клавиатурой без дополнительного скролла (F-13).
    // Докручиваем только один раз при ПЕРВОМ появлении результатов, если инпут ещё
    // не был спозиционирован (напр. результаты пришли до срабатывания фокус-скролла).
    const didScrollForResultsRef = useRef(false);
    useEffect(() => {
        if (isWeb) return;
        if (!showResults) {
            didScrollForResultsRef.current = false;
            return;
        }
        if (isFocusedRef.current && !didScrollForResultsRef.current) {
            didScrollForResultsRef.current = true;
            scrollInputIntoView();
        }
    }, [showResults, scrollInputIntoView]);

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
        <View ref={containerRef} style={styles.container}>
            <View style={styles.inputWrapper}>
                <Feather name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
                <TextInput
                    style={styles.input}
                    value={query}
                    onChangeText={setQuery}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    autoFocus={autoFocus}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {isLoading && (
                    <ActivityIndicator size="small" color={colors.primaryDark} style={styles.spinner} />
                )}
                {query.length > 0 && !isLoading && (
                    <Pressable
                        testID="location-clear-button"
                        onPress={handleClear}
                        style={styles.clearButton}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('travel:components.travel.LocationSearchInput.ochistit_pole_poiska_2b82d7d3')}
                    >
                        <Feather name="x" size={18} color={colors.textMuted} />
                    </Pressable>
                )}
            </View>

            {query.trim().length > 0 && query.trim().length < 3 && !isLoading && !error && (
                <Text style={styles.minCharsHint}>{i18nT('travel:components.travel.LocationSearchInput.vvedite_minimum_3_simvola_dlya_poiska_acf04c20')}</Text>
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
                            <Feather name="map-pin" size={16} color={colors.primaryDark} style={styles.resultIcon} />
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
                    <Text style={styles.emptyText}>{i18nT('travel:components.travel.LocationSearchInput.nichego_ne_naydeno_bb50273b')}</Text>
                    <Text style={styles.emptyHint}>{i18nT('travel:components.travel.LocationSearchInput.poprobuyte_izmenit_zapros_0f704303')}</Text>
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
