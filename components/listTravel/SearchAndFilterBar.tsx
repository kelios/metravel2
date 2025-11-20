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
}: Props) {
    const { width } = useWindowDimensions();
    const isMobile = width <= 768;
    
    const hasActiveSearchOrFilters = (search && search.trim().length > 0) || hasFilters;
    const showResultsInfo = resultsCount !== undefined && hasActiveSearchOrFilters;

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
                    <View style={[
                        styles.searchBox, 
                        isMobile && styles.searchBoxMobile,
                        hasActiveSearchOrFilters && styles.searchBoxActive
                    ]}>
                        {Icons.search}

                        <TextInput
                            ref={inputRef}
                            value={text}
                            onChangeText={handleChange}
                            onFocus={() => setShowAutocomplete(text.length >= 2 || text.length === 0)}
                            placeholder={isMobile ? "Найти путешествия…" : "Найти путешествие…"}
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
                            <Text style={styles.resultsText} numberOfLines={1}>
                                {resultsCount} {resultsCount === 1 ? 'путешествие' : resultsCount < 5 ? 'путешествия' : 'путешествий'}
                            </Text>
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
        marginBottom: 0, // ✅ КОМПАКТНОСТЬ: Убран marginBottom
        gap: Platform.select({ default: 3, web: 4 }), // ✅ КОМПАКТНОСТЬ: Еще уменьшен gap между строками
        paddingHorizontal: Platform.select({ default: spacing.xs, web: spacing.sm }), // ✅ КОМПАКТНОСТЬ: Уменьшены горизонтальные отступы
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        ...Platform.select({
            web: {
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
        paddingHorizontal: Platform.select({ default: spacing.xs, web: spacing.xs }), // ✅ КОМПАКТНОСТЬ: Уменьшены отступы
        paddingBottom: Platform.select({ default: spacing.xxs, web: spacing.xxs }), // ✅ КОМПАКТНОСТЬ: Меньше нижний отступ
        paddingTop: 0, 
        marginBottom: Platform.select({ default: spacing.xxs, web: spacing.xxs }), // ✅ КОМПАКТНОСТЬ: Меньше нижний margin
        marginTop: 0, 
        gap: Platform.select({ default: spacing.xxs, web: spacing.xs }) // ✅ КОМПАКТНОСТЬ: Меньше gap
    },
    searchBox: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: Platform.select({ default: 8, web: 10 }), // ✅ КОМПАКТНОСТЬ: Еще уменьшен gap
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: Platform.select({ default: 8, web: DESIGN_TOKENS.radii.sm }), // ✅ КОМПАКТНОСТЬ: Уменьшен радиус
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
        paddingHorizontal: Platform.select({ default: 10, web: 14 }), // ✅ КОМПАКТНОСТЬ: Уменьшены горизонтальные отступы
        height: Platform.select({
            default: 44, // ✅ КОМПАКТНОСТЬ: Уменьшена высота с 48 до 44
            web: 50, // ✅ КОМПАКТНОСТЬ: Уменьшена высота с 56 до 50
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
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень для активного состояния
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
        height: 38, // ✅ КОМПАКТНОСТЬ: Еще уменьшена высота с 40 до 38
        paddingHorizontal: 8, // ✅ КОМПАКТНОСТЬ: Еще уменьшены горизонтальные отступы с 10 до 8
        gap: 5, // ✅ КОМПАКТНОСТЬ: Еще уменьшен gap с 6 до 5
        borderRadius: 7, // ✅ КОМПАКТНОСТЬ: Еще уменьшен радиус с 8 до 7
    },
    input: {
        flex: 1,
        fontSize: Platform.select({ default: 13, web: 13 }), // ✅ КОМПАКТНОСТЬ: Уменьшен размер шрифта на web
        color: DESIGN_TOKENS.colors.text,
        paddingVertical: 0,
        lineHeight: Platform.select({ default: 18, web: 20 }), // ✅ КОМПАКТНОСТЬ: Уменьшен line-height
        ...Platform.select({
            web: {
                outlineWidth: 0,
                backgroundColor: "transparent",
            },
        }),
    },
    inputMobile: {
        fontSize: 13, // ✅ КОМПАКТНОСТЬ: Уменьшен размер шрифта
        paddingVertical: 0,
        lineHeight: 18, // ✅ КОМПАКТНОСТЬ: Уменьшен line-height
    },
    clearBtn: {
        padding: 4, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding для лучшей touch-цели
        borderRadius: radii.sm, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
        minWidth: 32, // ✅ ИСПРАВЛЕНИЕ: Увеличена минимальная ширина для touch-целей
        minHeight: 32, // ✅ ИСПРАВЛЕНИЕ: Увеличена минимальная высота для touch-целей
        alignItems: 'center',
        justifyContent: 'center',
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
        flexWrap: 'wrap', // ✅ ИСПРАВЛЕНИЕ: Разрешаем перенос на новую строку
        gap: Platform.select({ default: 5, web: 6 }), // ✅ КОМПАКТНОСТЬ: Еще уменьшен gap
        marginTop: Platform.select({ default: 2, web: 4 }), // ✅ КОМПАКТНОСТЬ: Еще уменьшен marginTop
        marginLeft: Platform.select({ default: 0, web: spacing.xs }),
        paddingLeft: Platform.select({ default: 0, web: spacing.xs }),
        borderLeftWidth: Platform.select({ default: 0, web: 1 }),
        borderLeftColor: palette.border,
        paddingTop: Platform.select({ default: 2, web: 4 }), // ✅ КОМПАКТНОСТЬ: Еще уменьшен paddingTop
        paddingBottom: Platform.select({ default: 2, web: 4 }), // ✅ КОМПАКТНОСТЬ: Еще уменьшен paddingBottom
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        ...Platform.select({
            web: {
                position: 'relative' as any,
                zIndex: 1,
            },
        }),
    },
    resultsRowMobile: {
        marginTop: 1, // ✅ КОМПАКТНОСТЬ: Еще уменьшен marginTop
        paddingTop: 2, // ✅ КОМПАКТНОСТЬ: Еще уменьшен paddingTop
        paddingBottom: 2, // ✅ КОМПАКТНОСТЬ: Еще уменьшен paddingBottom
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
        borderLeftWidth: 0,
        paddingLeft: 0,
        marginLeft: 0,
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
    resultsText: {
        fontSize: Platform.select({
            default: 11,
            web: 12, // ✅ КОМПАКТНОСТЬ: Уменьшен размер шрифта
        }),
        fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
        color: palette.textMuted,
        lineHeight: Platform.select({
            default: 14,
            web: 16, // ✅ КОМПАКТНОСТЬ: Уменьшен line-height
        }),
        ...Platform.select({
            web: {
                whiteSpace: 'nowrap' as any,
                overflow: 'hidden' as any,
                textOverflow: 'ellipsis' as any,
                display: 'block' as any,
            },
        }),
    },
    clearAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Platform.select({ default: 10, web: 12 }), // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
        paddingVertical: Platform.select({ default: 6, web: 8 }), // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
        borderRadius: radii.sm,
        backgroundColor: palette.primarySoft,
        minHeight: Platform.select({ default: 36, web: 40 }), // ✅ ИСПРАВЛЕНИЕ: Увеличена минимальная высота для touch-целей
        minWidth: 36, // ✅ ИСПРАВЛЕНИЕ: Минимальная ширина для touch-целей
        flexShrink: 0,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap' as any,
                // @ts-ignore
                ':hover': {
                    backgroundColor: palette.primary,
                    transform: 'scale(1.05)',
                },
            },
        }),
    },
    clearAllBtnText: {
        fontSize: Platform.select({ default: 11, web: 12 }), // ✅ КОМПАКТНОСТЬ: Уменьшен размер шрифта
        fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
        color: palette.primary,
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
