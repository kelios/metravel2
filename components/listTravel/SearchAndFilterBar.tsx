// components/SearchAndFilterBar.tsx
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    TextInput,
    StyleSheet,
    useWindowDimensions,
    Pressable,
    Platform,
    Keyboard,
    Text,
    ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { MaterialIcons } from '@expo/vector-icons';
import IconButton from '@/components/ui/IconButton';
import { DESIGN_TOKENS } from "@/constants/designSystem";
import SearchAutocomplete from '@/components/SearchAutocomplete';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

const palette = DESIGN_TOKENS.colors;
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
    const { width } = useWindowDimensions();
    const isMobile = width <= 768;
    
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
            const searchIcon = <Feather name="search" size={isMobile ? 16 : 18} color={palette.primary} />; // ✅ КОМПАКТНОСТЬ: Еще уменьшен размер иконки поиска
            const clearIcon = <Feather name="x" size={isMobile ? 14 : 16} color={palette.textMuted} />; // ✅ КОМПАКТНОСТЬ: Еще уменьшен размер иконки очистки
            const recommendationsIcon = (
                <MaterialIcons
                    name="stars"
                    size={isMobile ? 16 : 18} // ✅ КОМПАКТНОСТЬ: Еще уменьшен размер иконки рекомендаций
                    color={isRecommendationsVisible ? palette.accent : palette.textSubtle}
                />
            );
            
            if (Platform.OS === 'web') {
                // Добавляем aria-hidden для веб-версии через обертку
                return {
                    search: <View {...({ 'aria-hidden': true } as any)}>{searchIcon}</View>,
                    clear: <View {...({ 'aria-hidden': true } as any)}>{clearIcon}</View>,
                    recommendations: recommendationsIcon,
                };
            }
            
            return {
                search: searchIcon,
                clear: clearIcon,
                recommendations: recommendationsIcon,
            };
        },
        [isMobile, isRecommendationsVisible, palette.accent, palette.primary, palette.textMuted, palette.textSubtle]
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

    return (
        <View style={[styles.wrap, isMobile && styles.wrapMobile]}>
            {/* Первая строка: фильтры, поиск, иконки */}
            <View style={[styles.topRow, isMobile && styles.topRowMobile]}>
                {isMobile && onToggleFilters && (
                    // ✅ КОМПАКТНОСТЬ: Уменьшен размер иконки с 18 до 16
                    <IconButton
                        label="Открыть фильтры"
                        icon={<Feather name="filter" size={16} color={palette.primary} />}
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
                            style={[styles.searchDivider, isMobile && styles.searchDividerMobile]}
                            pointerEvents="none"
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
                            placeholderTextColor={palette.textSubtle}
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
                            <ActivityIndicator size="small" color={palette.primary} />
                        ) : (
                            <View style={[styles.resultsBadge, isMobile && styles.resultsBadgeMobile]}>
                                <Feather name="map" size={14} color={palette.primary} />
                                <Text style={styles.resultsText} numberOfLines={1}>
                                    {resultsCount ?? 0} {resultsNoun}
                                </Text>
                            </View>
                        )}
                    </View>
                    {onClearAll && (
                        <Pressable
                            onPress={onClearAll}
                            style={[styles.clearAllBtn, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                            accessibilityRole="button"
                            accessibilityLabel="Сбросить все фильтры и поиск"
                            hitSlop={8}
                            {...Platform.select({
                                web: {
                                    cursor: 'pointer',
                                },
                            })}
                        >
                            <Feather name="x-circle" size={Platform.select({ default: 11, web: 12 })} color={palette.primary} />
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

const styles = StyleSheet.create({
    wrap: {
        flexDirection: "column",
        marginBottom: 0,
        gap: Platform.select({ default: 6, web: 8 }),
        paddingHorizontal: Platform.select({ default: spacing.sm, web: spacing.md }),
        paddingVertical: Platform.select({ default: spacing.xs, web: spacing.sm }),
        width: '100%',
        maxWidth: '100%',
        borderRadius: DESIGN_TOKENS.radii.lg,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        ...Platform.select({
            ios: {
                shadowColor: "#1f1f1f",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.05,
                shadowRadius: 16,
            },
            android: {
                elevation: 3,
            },
            web: {
                boxShadow: DESIGN_TOKENS.shadows.card,
                position: 'relative' as any,
                zIndex: 1,
            },
        }),
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Platform.select({ default: spacing.xs, web: spacing.sm }),
        width: '100%',
        maxWidth: '100%', // ✅ ИСПРАВЛЕНИЕ: Предотвращаем выход за границы
        overflow: 'hidden', // ✅ ИСПРАВЛЕНИЕ: Скрываем переполнение
        flexWrap: 'nowrap', // ✅ ИСПРАВЛЕНИЕ: Не переносим элементы первой строки
    },
    topRowMobile: {
        gap: spacing.xs,
    },
    searchContainer: {
        flex: 1,
        position: 'relative',
        minWidth: 0, // ✅ ИСПРАВЛЕНИЕ: Разрешаем сжатие flex-элемента
        maxWidth: '100%', // ✅ ИСПРАВЛЕНИЕ: Предотвращаем выход за границы
        overflow: 'visible', // ✅ ИСПРАВЛЕНИЕ: Разрешаем видимость для автодополнения
        ...Platform.select({
            web: {
                zIndex: 100, // z-index только для автодополнения
            },
        }),
    },
    wrapMobile: { 
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xs,
        marginBottom: spacing.xs,
        marginTop: 0, 
        gap: spacing.xs,
        borderRadius: DESIGN_TOKENS.radii.md,
    },
    searchBox: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: Platform.select({ default: 4, web: 6 }),
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
        borderRadius: DESIGN_TOKENS.radii.pill,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderLight,
        paddingHorizontal: Platform.select({ default: 12, web: 18 }),
        height: Platform.select({
            default: 52, // Повышена высота для лучшей читаемости
            web: 60,
        }),
        ...Platform.select({
            ios: {
                shadowColor: "#000",
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
        borderColor: DESIGN_TOKENS.colors.primaryLight,
        ...Platform.select({
            ios: {
                shadowOpacity: 0.12,
                shadowRadius: 8,
            },
            android: {
                elevation: 3,
            },
            web: {
                boxShadow: DESIGN_TOKENS.shadows.medium,
            },
        }),
    },
    searchBoxMobile: {
        height: 48,
        paddingHorizontal: 10,
        gap: 4,
    },
    input: {
        flex: 1,
        fontSize: Platform.select({ default: 14, web: 15 }),
        color: DESIGN_TOKENS.colors.text,
        paddingVertical: 0,
        lineHeight: Platform.select({ default: 20, web: 22 }),
        ...Platform.select({
            web: {
                outlineWidth: 0,
                backgroundColor: "transparent",
            },
        }),
    },
    inputMobile: {
        fontSize: 14,
        paddingVertical: 0,
        lineHeight: 20,
    },
    searchIconBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: DESIGN_TOKENS.colors.borderLight,
    },
    searchIconBadgeMobile: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    searchDivider: {
        width: StyleSheet.hairlineWidth,
        alignSelf: 'stretch',
        backgroundColor: DESIGN_TOKENS.colors.borderLight,
        opacity: 0.8,
        marginHorizontal: 10,
    },
    searchDividerMobile: {
        marginHorizontal: 8,
    },
    clearBtn: {
        padding: 6,
        borderRadius: radii.pill,
        minWidth: 36,
        minHeight: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: DESIGN_TOKENS.colors.borderLight,
        ...Platform.select({
            web: {
                cursor: "pointer",
                transition: 'all 0.2s ease',
                // @ts-ignore
                ':hover': {
                    backgroundColor: palette.primarySoft,
                },
            }
        }),
    },
    actionIcons: {
        flexDirection: "row",
        alignItems: "center",
        gap: Platform.select({ default: 6, web: 6 }), // ✅ КОМПАКТНОСТЬ: Уменьшен gap с 8 до 6
        marginLeft: Platform.select({ default: 4, web: 6 }), // ✅ КОМПАКТНОСТЬ: Уменьшен marginLeft
        flexShrink: 0,
        ...Platform.select({
            web: {
                minWidth: 'fit-content' as any,
            },
        }),
    },
    actionIconsMobile: {
        gap: 3, // ✅ КОМПАКТНОСТЬ: Еще уменьшен gap с 4 до 3
        marginLeft: 2,
    },
    resultsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: Platform.select({ default: spacing.xs, web: spacing.sm }),
        marginTop: spacing.xs,
        width: '100%',
        maxWidth: '100%',
    },
    resultsRowMobile: {
        marginTop: spacing.xs,
    },
    resultsContent: {
        flex: 1, // ✅ ИСПРАВЛЕНИЕ: Занимает доступное пространство
        minWidth: 0, // ✅ ИСПРАВЛЕНИЕ: Разрешаем сжатие
        maxWidth: '100%', // ✅ ИСПРАВЛЕНИЕ: Ограничиваем ширину
        ...Platform.select({
            web: {
                overflow: 'hidden' as any,
            },
        }),
    },
    resultsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderLight,
    },
    resultsBadgeMobile: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    resultsText: {
        fontSize: Platform.select({
            default: 13,
            web: 14,
        }),
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        color: palette.text,
        lineHeight: Platform.select({
            default: 18,
            web: 20,
        }),
    },
    clearAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Platform.select({ default: 14, web: 16 }),
        paddingVertical: Platform.select({ default: 8, web: 10 }),
        borderRadius: radii.pill,
        backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderLight,
        minHeight: Platform.select({ default: 38, web: 42 }),
        minWidth: 36, // ✅ ИСПРАВЛЕНИЕ: Минимальная ширина для touch-целей
        flexShrink: 0,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap' as any,
                // @ts-ignore
                ':hover': {
                    backgroundColor: palette.primarySoft,
                },
            },
        }),
    },
    clearAllBtnText: {
        fontSize: Platform.select({ default: 12, web: 13 }),
        fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
        color: palette.text,
    },
    recommendationsToggle: {
        width: Platform.select({ default: 36, web: 40 }), // ✅ ИСПРАВЛЕНИЕ: Увеличена ширина для touch-целей
        height: Platform.select({ default: 36, web: 40 }), // ✅ ИСПРАВЛЕНИЕ: Увеличена высота для touch-целей
        borderRadius: radii.sm,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 36, // ✅ ИСПРАВЛЕНИЕ: Минимальная ширина для touch-целей
        minHeight: 36, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                // @ts-ignore
                ':hover': {
                    backgroundColor: palette.primarySoft,
                },
            },
        }),
    },
    recommendationsToggleActive: {
        backgroundColor: palette.primarySoft,
    },
});
