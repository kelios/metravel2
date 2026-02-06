// components/SearchAndFilterBar.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { View, TextInput, Pressable, Platform, Keyboard, Text, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import IconButton from '@/components/ui/IconButton';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import SearchAutocomplete from '@/components/forms/SearchAutocomplete';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { globalFocusStyles } from '@/styles/globalFocus';
import { METRICS } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { createSearchAndFilterBarStyles } from './searchAndFilterBarStyles';

const spacing = DESIGN_TOKENS.spacing;

interface Props {
    search: string;
    setSearch: (value: string) => void;
    onToggleFilters?: () => void;
    onToggleRecommendations?: () => void;
    isRecommendationsVisible?: boolean;
    resultsCount?: number;
    isLoading?: boolean;
    hasFilters?: boolean;
    activeFiltersCount?: number;
    onClearAll?: () => void;
    placeholderOverride?: string;
}

function SearchAndFilterBar({
    search, 
    setSearch, 
    onToggleFilters,
    onToggleRecommendations,
    isRecommendationsVisible = false,
    resultsCount,
    isLoading = false,
    hasFilters = false,
    activeFiltersCount = 0,
    onClearAll,
    placeholderOverride,
}: Props) {
    const colors = useThemedColors();
    const { width } = useResponsive();
    const effectiveWidth =
        Platform.OS === 'web' && width === 0 && typeof window !== 'undefined'
            ? window.innerWidth
            : width;
    const isMobile = effectiveWidth <= METRICS.breakpoints.tablet;
    
    const hasActiveSearchOrFilters = (search && search.trim().length > 0) || hasFilters;
    const showResultsInfo = resultsCount !== undefined && hasActiveSearchOrFilters;
    const resultsNoun = useMemo(() => {
        if (resultsCount === undefined) return "";
        const mod10 = resultsCount % 10;
        const mod100 = resultsCount % 100;
        if (mod10 === 1 && mod100 !== 11) return "путешествие";
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "путешествия";
        return "путешествий";
    }, [resultsCount]);

    // Локальное состояние с синхронизацией от внешнего пропса
    const [text, setText] = useState(search);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const lastAppliedRef = useRef(search);
    const searchBoxRef = useRef<View>(null);

    // Если внешний search поменялся (сброс фильтров/поиска извне) — обновляем инпут
    useEffect(() => {
        if (search !== lastAppliedRef.current) {
            setText(search);
            lastAppliedRef.current = search;
        }
    }, [search]);

    const handleChange = useCallback((val: string) => {
        setText(val);
        setShowAutocomplete(val.length >= 2 || val.length === 0); // Показываем при 2+ символах или при пустом поле
    }, []);

    // ✅ ИСПРАВЛЕНИЕ: Закрываем подсказки при скролле страницы
    useEffect(() => {
        if (Platform.OS !== 'web' || !showAutocomplete) return;
        const handleScroll = () => {
            setShowAutocomplete(false);
        };
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [showAutocomplete]);

    const applySearch = useCallback(
        (val: string) => {
            const next = val.trim();
            lastAppliedRef.current = next;
            setSearch(next);
        },
        [setSearch]
    );

    const handleClear = useCallback(() => {
        setText("");
        applySearch("");
        setShowAutocomplete(false);
    }, [applySearch]);

    // Более короткий дебаунс на мобиле (ощутимо отзывчивее)
    useEffect(() => {
        const delay = isMobile ? 250 : 300;
        const id = setTimeout(() => {
            if (text !== lastAppliedRef.current) {
                applySearch(text);
            }
        }, delay);
        return () => clearTimeout(id);
    }, [text, isMobile, applySearch]);


    const Icons = useMemo(
        () => {
            const searchIcon = <Feather name="search" size={isMobile ? 16 : 18} color={colors.primary} />;
            const clearIcon = <Feather name="x" size={isMobile ? 14 : 16} color={colors.textMuted} />;
            const recommendationsIcon = (
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.xxs,
                }}>
                    <Feather
                        name="zap"
                        size={isMobile ? 18 : 20}
                        color={isRecommendationsVisible ? colors.primary : colors.textMuted}
                    />
                    {!isMobile && (
                        <Text style={{
                            fontSize: 11,
                            color: colors.textMuted,
                            fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
                            maxWidth: 56,
                        }} numberOfLines={1}>
                            Реком.
                        </Text>
                    )}
                </View>
            );
            
            if (Platform.OS === 'web') {
                // Добавляем aria-hidden для веб-версии через обертку
                return {
                    search: (
                        <View style={{ pointerEvents: 'none' }} {...({ 'aria-hidden': true } as any)}>
                            {searchIcon}
                        </View>
                    ),
                    clear: (
                        <View style={{ pointerEvents: 'none' }} {...({ 'aria-hidden': true } as any)}>
                            {clearIcon}
                        </View>
                    ),
                    recommendations: recommendationsIcon,
                };
            }
            
            return {
                search: searchIcon,
                clear: clearIcon,
                recommendations: recommendationsIcon,
            };
        },
        [isMobile, isRecommendationsVisible, colors]
    );

    const onSubmit = useCallback(() => {
        applySearch(text);
        Keyboard.dismiss();
        setShowAutocomplete(false);
    }, [applySearch, text]);

    const handleSelectSuggestion = useCallback((selectedText: string) => {
        setText(selectedText);
        applySearch(selectedText);
        setShowAutocomplete(false);
        Keyboard.dismiss();
    }, [applySearch]);

    const inputRef = useRef<TextInput>(null);

    // ✅ УЛУЧШЕНИЕ: Keyboard shortcut Ctrl+K для фокуса на поиске
    useKeyboardShortcuts([
        {
            key: 'k',
            ctrlKey: true,
            action: () => {
                if (Platform.OS === 'web' && inputRef.current) {
                    inputRef.current.focus();
                    setShowAutocomplete(true);
                }
            },
            description: 'Фокус на поле поиска',
        },
    ]);

    const styles = useMemo(() => createSearchAndFilterBarStyles(colors), [colors]);

    return (
        <View style={[styles.wrap, isMobile && styles.wrapMobile]}>
            {/* Первая строка: фильтры, поиск, иконки */}
            <View style={[styles.topRow, isMobile && styles.topRowMobile]}>
                {isMobile && onToggleFilters && (
                    <View style={{ position: 'relative' as any }}>
                        <IconButton
                            label="Открыть фильтры"
                            icon={<Feather name="filter" size={16} color={colors.primary} />}
                            onPress={onToggleFilters}
                            testID="toggle-filters"
                        />
                        {activeFiltersCount > 0 && (
                            <View
                                style={{
                                    position: 'absolute' as any,
                                    top: 0,
                                    right: 0,
                                    minWidth: 18,
                                    height: 18,
                                    borderRadius: 9,
                                    backgroundColor: colors.primary,
                                    alignItems: 'center' as any,
                                    justifyContent: 'center' as any,
                                    paddingHorizontal: 4,
                                }}
                                pointerEvents="none"
                            >
                                <Text style={{ color: colors.textOnPrimary, fontSize: 10, fontWeight: '700' as any }}>
                                    {activeFiltersCount}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.searchContainer} ref={searchBoxRef}>
                    <View
                        style={[
                            styles.searchBox,
                            isMobile && styles.searchBoxMobile,
                            hasActiveSearchOrFilters && styles.searchBoxActive,
                        ]}
                    >
                        <View style={[styles.searchIconBadge, isMobile && styles.searchIconBadgeMobile]}>
                            {Icons.search}
                        </View>
                        <View
                            style={[
                                styles.searchDivider,
                                isMobile && styles.searchDividerMobile,
                                { pointerEvents: 'none' } as any,
                            ]}
                        />

                        <TextInput
                            ref={inputRef}
                            value={text}
                            onChangeText={handleChange}
                            onFocus={() => setShowAutocomplete(text.length >= 2 || text.length === 0)}
                            placeholder={
                                placeholderOverride !== undefined
                                    ? placeholderOverride
                                    : isMobile
                                    ? "Найти путешествия…"
                                    : "Найти путешествие…"
                            }
                            placeholderTextColor={colors.textMuted}
                            style={[styles.input, isMobile && styles.inputMobile]}
                            returnKeyType="search"
                            onSubmitEditing={onSubmit}
                            accessibilityLabel="Поле поиска путешествий"
                            accessibilityHint={Platform.OS === 'web' ? 'Нажмите Ctrl+K для быстрого доступа' : undefined}
                            autoCapitalize="none"
                            autoCorrect={false}
                            underlineColorAndroid="transparent"
                            clearButtonMode={Platform.OS === "ios" ? "while-editing" : "never"}
                            maxLength={120}
                            {...Platform.select({
                                web: {
                                    // @ts-ignore
                                    id: 'search-input',
                                    'aria-label': 'Поле поиска путешествий. Нажмите Ctrl+K для быстрого доступа',
                                    'aria-describedby': 'search-hint',
                                },
                            })}
                        />

                        {text !== "" && (
                            <Pressable
                                onPress={handleClear}
                                hitSlop={10}
                                accessibilityRole="button"
                                accessibilityLabel="Очистить поиск"
                                style={[styles.clearBtn, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                            >
                                {Icons.clear}
                            </Pressable>
                        )}
                    </View>

                    {/* ✅ УЛУЧШЕНИЕ: Автодополнение */}
                    {showAutocomplete && (
                        <SearchAutocomplete
                            query={text}
                            onSelect={handleSelectSuggestion}
                            onClose={() => setShowAutocomplete(false)}
                        />
                    )}
                </View>

                <View style={[styles.actionIcons, isMobile && styles.actionIconsMobile]}>
                    {/* Иконка переключения рекомендаций */}
                    {onToggleRecommendations && (
                        <Pressable
                            onPress={onToggleRecommendations}
                            style={[
                                styles.recommendationsToggle,
                                isMobile && styles.recommendationsToggleMobile,
                                isRecommendationsVisible && styles.recommendationsToggleActive,
                                globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                            ]}
                            accessibilityLabel={isRecommendationsVisible ? "Скрыть рекомендации" : "Показать рекомендации"}
                            accessibilityState={{ selected: isRecommendationsVisible }}
                            hitSlop={8}
                            {...Platform.select({
                                web: {
                                    cursor: 'pointer',
                                },
                            })}
                        >
                            {Icons.recommendations}
                        </Pressable>
                    )}
                </View>
            </View>

            {/* ✅ ИСПРАВЛЕНИЕ ВЕРСТКИ: Счетчик результатов на отдельной строке на мобильных */}
            {showResultsInfo && (
                    <View style={[styles.resultsRow, isMobile && styles.resultsRowMobile]}>
                    <View style={styles.resultsContent}>
                        {isLoading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <View style={[styles.resultsBadge, isMobile && styles.resultsBadgeMobile]}>
                                <Feather name="map" size={14} color={colors.primary} />
                                <Text style={styles.resultsText} numberOfLines={1}>
                                    {resultsCount ?? 0} {resultsNoun}
                                </Text>
                            </View>
                        )}
                    </View>
                    {onClearAll && !isMobile && (
                        <Pressable
                            onPress={onClearAll}
                            style={[styles.clearAllBtn, globalFocusStyles.focusable]}
                            accessibilityRole="button"
                            accessibilityLabel="Сбросить все фильтры и поиск"
                            hitSlop={8}
                            {...Platform.select({
                                web: {
                                    cursor: 'pointer',
                                },
                            })}
                        >
                            <Feather name="x-circle" size={Platform.select({ default: 11, web: 12 })} color={colors.primary} />
                            {!isMobile && (
                              <Text style={styles.clearAllBtnText}>
                                {activeFiltersCount > 0 ? `Сбросить все (${activeFiltersCount})` : 'Сбросить все'}
                              </Text>
                            )}
                        </Pressable>
                    )}
                </View>
            )}
        </View>
    );
}

export default memo(
    SearchAndFilterBar,
    (prev, next) =>
        prev.search === next.search &&
        (!!prev.onToggleFilters === !!next.onToggleFilters) &&
        prev.isRecommendationsVisible === next.isRecommendationsVisible &&
        prev.resultsCount === next.resultsCount &&
        prev.isLoading === next.isLoading &&
        prev.hasFilters === next.hasFilters &&
        prev.activeFiltersCount === next.activeFiltersCount
);
