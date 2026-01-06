// components/SearchAndFilterBar.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    Pressable,
    Platform,
    Keyboard,
    Text,
    ActivityIndicator,
} from 'react-native';
import { Feather } from "@expo/vector-icons";
import { MaterialIcons } from '@expo/vector-icons';
import IconButton from '@/components/ui/IconButton';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import SearchAutocomplete from '@/components/SearchAutocomplete';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { globalFocusStyles } from '@/styles/globalFocus';
import { METRICS } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';

const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

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

const useStyles = (colors: ReturnType<typeof useThemedColors>) => useMemo(() => StyleSheet.create({
    wrap: {
        flexDirection: "column",
        marginBottom: 0,
        gap: Platform.select({ default: 8, web: 10 }),
        paddingHorizontal: Platform.select({ default: 12, web: 16 }),
        paddingVertical: Platform.select({ default: 10, web: 12 }),
        width: '100%',
        maxWidth: '100%',
        borderRadius: Platform.select({ default: 16, web: 20 }),
        backgroundColor: colors.surface,
        ...Platform.select({
            ios: {
                shadowColor: colors.text,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
            },
            android: {
                elevation: 1,
            },
            web: {
                boxShadow: DESIGN_TOKENS.shadows.light,
                position: 'relative' as any,
                zIndex: 3000,
            },
        }),
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Platform.select({ default: spacing.xs, web: spacing.sm }),
        width: '100%',
        maxWidth: '100%',
        overflow: 'visible',
        flexWrap: 'nowrap',
    },
    topRowMobile: {
        gap: spacing.xs,
    },
    searchContainer: {
        flex: 1,
        position: 'relative',
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'visible',
        ...Platform.select({
            web: {
                zIndex: 2000,
            },
        }),
    },
    wrapMobile: {
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xxs,
        marginBottom: 0,
        marginTop: 0,
        gap: spacing.xs,
        borderRadius: DESIGN_TOKENS.radii.md,
        width: '34%',
        maxWidth: 360,
        alignSelf: 'center',
    },
    searchBox: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: Platform.select({ default: 8, web: 10 }),
        backgroundColor: colors.surfaceMuted,
        borderRadius: Platform.select({ default: 999, web: 999 }),
        borderWidth: 1,
        borderColor: colors.borderLight,
        paddingHorizontal: Platform.select({ default: 18, web: 20 }),
        height: Platform.select({
            default: 54,
            web: 56,
        }),
        minWidth: 0,
        ...Platform.select({
            ios: {
                shadowColor: colors.text,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
            },
            android: {
                elevation: 1,
            },
            web: {
                boxShadow: DESIGN_TOKENS.shadows.light,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            },
        }),
    },
    searchBoxActive: {
        borderColor: colors.primary,
        backgroundColor: colors.surface,
        ...Platform.select({
            ios: {
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 3,
            },
            web: {
                boxShadow: `0 0 0 4px ${colors.primarySoft}, ${DESIGN_TOKENS.shadows.medium}`,
            },
        }),
    },
    searchBoxMobile: {
        height: 44,
        paddingHorizontal: 12,
        gap: 6,
    },
    input: {
        flex: 1,
        fontSize: Platform.select({ default: 16, web: 18 }),
        color: colors.text,
        fontWeight: '500',
        paddingVertical: 2,
        lineHeight: Platform.select({ default: 22, web: 26 }),
        minWidth: 0,
        ...Platform.select({
            web: {
                outlineWidth: 0,
                backgroundColor: "transparent",
            },
        }),
    },
    inputMobile: {
        fontSize: 14,
        paddingVertical: 1,
        lineHeight: 20,
    },
    searchIconBadge: {
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        paddingRight: 4,
    },
    searchIconBadgeMobile: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    searchDivider: {
        width: 0,
        marginHorizontal: 0,
        opacity: 0,
        flexShrink: 0,
    },
    searchDividerMobile: {
        marginHorizontal: spacing.xxs,
    },
    clearBtn: {
        padding: 6,
        borderRadius: 50,
        minWidth: 32,
        minHeight: 32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceMuted,
        borderWidth: 0,
        flexShrink: 0,
        ...Platform.select({
            web: {
                cursor: "pointer",
                transition: 'all 0.2s ease',
                // @ts-ignore
                ':hover': {
                    backgroundColor: colors.backgroundSecondary,
                    transform: 'scale(1.05)',
                },
            }
        }),
    },
    actionIcons: {
        flexDirection: "row",
        alignItems: "center",
        gap: Platform.select({ default: spacing.xxs, web: spacing.xs }),
        marginLeft: Platform.select({ default: spacing.xxs, web: spacing.xs }),
        flexShrink: 0,
        ...Platform.select({
            web: {
                minWidth: 'fit-content' as any,
            },
        }),
    },
    actionIconsMobile: {
        gap: spacing.xxs,
        marginLeft: spacing.xxs,
    },
    resultsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        gap: Platform.select({ default: spacing.xs, web: spacing.sm }),
        marginTop: spacing.xs,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
    },
    resultsRowMobile: {
        marginTop: spacing.xs,
        flexWrap: 'wrap',
    },
    resultsContent: {
        flex: 1,
        minWidth: 0,
        maxWidth: '100%',
        ...Platform.select({
            web: {
                overflow: 'hidden' as any,
            },
        }),
    },
    resultsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceMuted,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderLight,
        flexShrink: 1,
        minWidth: 0,
    },
    resultsBadgeMobile: {
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xxs,
    },
    resultsText: {
        fontSize: Platform.select({
            default: 12,
            web: 13,
        }),
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        color: colors.text,
        lineHeight: Platform.select({
            default: 16,
            web: 18,
        }),
        flexShrink: 1,
    },
    clearAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xxs,
        paddingHorizontal: Platform.select({ default: spacing.sm, web: spacing.md }),
        paddingVertical: Platform.select({ default: spacing.xs, web: spacing.xs }),
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceMuted,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderLight,
        minHeight: Platform.select({ default: 36, web: 38 }),
        minWidth: 36,
        flexShrink: 0,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap' as any,
                // @ts-ignore
                ':hover': {
                    backgroundColor: colors.primarySoft,
                },
            },
        }),
    },
    clearAllBtnText: {
        fontSize: Platform.select({ default: 11, web: 12 }),
        fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
        color: colors.text,
        flexShrink: 1,
    },
    recommendationsToggle: {
        width: Platform.select({ default: 48, web: 52 }),
        height: Platform.select({ default: 48, web: 52 }),
        borderRadius: Platform.select({ default: 14, web: 16 }),
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 48,
        minHeight: 48,
        flexShrink: 0,
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 2,
        borderColor: colors.border,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                // @ts-ignore
                ':hover': {
                    backgroundColor: colors.primarySoft,
                    borderColor: colors.primary,
                    transform: 'scale(1.05)',
                },
            },
        }),
    },
    recommendationsToggleMobile: {
        width: 40,
        height: 40,
        minWidth: 40,
        minHeight: 40,
        borderRadius: 12,
        borderWidth: 1,
    },
    recommendationsToggleActive: {
        backgroundColor: colors.primarySoft,
        borderColor: colors.primary,
        ...Platform.select({
            web: {
                boxShadow: `0 0 0 3px ${colors.primarySoft}`,
            },
        }),
    },
}), [colors]);

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
        if (Platform.OS === 'web' && showAutocomplete) {
            const handleScroll = () => {
                setShowAutocomplete(false);
            };
            window.addEventListener('scroll', handleScroll, true);
            return () => {
                window.removeEventListener('scroll', handleScroll, true);
            };
        }
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
                    <MaterialIcons
                        name="lightbulb-outline"
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
                        <View pointerEvents="none" {...({ 'aria-hidden': true } as any)}>
                            {searchIcon}
                        </View>
                    ),
                    clear: (
                        <View pointerEvents="none" {...({ 'aria-hidden': true } as any)}>
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

    const styles = useStyles(colors);

    return (
        <View style={[styles.wrap, isMobile && styles.wrapMobile]}>
            {/* Первая строка: фильтры, поиск, иконки */}
            <View style={[styles.topRow, isMobile && styles.topRowMobile]}>
                {isMobile && onToggleFilters && (
                    <IconButton
                        label="Открыть фильтры"
                        icon={<Feather name="filter" size={16} color={colors.primary} />}
                        onPress={onToggleFilters}
                        testID="toggle-filters"
                    />
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
