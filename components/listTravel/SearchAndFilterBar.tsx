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
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { MaterialIcons } from '@expo/vector-icons';
import IconButton from '@/components/ui/IconButton';
import { DESIGN_TOKENS } from "@/constants/designSystem";

interface Props {
    search: string;
    setSearch: (value: string) => void;
    onToggleFilters?: () => void;
    onToggleRecommendations?: () => void;
    isRecommendationsVisible?: boolean;
}

function SearchAndFilterBar({ 
    search, 
    setSearch, 
    onToggleFilters,
    onToggleRecommendations,
    isRecommendationsVisible = false,
}: Props) {
    const { width } = useWindowDimensions();
    const isMobile = width <= 768;

    // Локальное состояние с синхронизацией от внешнего пропса
    const [text, setText] = useState(search);
    const lastAppliedRef = useRef(search);

    // Если внешний search поменялся (сброс фильтров/поиска извне) — обновляем инпут
    useEffect(() => {
        if (search !== lastAppliedRef.current) {
            setText(search);
            lastAppliedRef.current = search;
        }
    }, [search]);

    const handleChange = useCallback((val: string) => {
        setText(val);
    }, []);

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

    const palette = DESIGN_TOKENS.colors;

    const Icons = useMemo(
        () => ({
            search: <Feather name="search" size={20} color={palette.primary} aria-hidden="true" />,
            clear: <Feather name="x" size={18} color={palette.textMuted} aria-hidden="true" />,
            recommendations: (
                <MaterialIcons
                    name="stars"
                    size={20}
                    color={isRecommendationsVisible ? palette.accent : palette.textSubtle}
                />
            ),
        }),
        [isRecommendationsVisible, palette.accent, palette.primary, palette.textMuted, palette.textSubtle]
    );

    const onSubmit = useCallback(() => {
        applySearch(text);
        Keyboard.dismiss();
    }, [applySearch, text]);

    return (
        <View style={[styles.wrap, isMobile && styles.wrapMobile]}>
            {isMobile && onToggleFilters && (
                <IconButton
                    label="Открыть фильтры"
                    icon={<Feather name="filter" size={18} color={palette.primary} />}
                    onPress={onToggleFilters}
                    testID="toggle-filters"
                />
            )}

            <View style={[styles.searchBox, isMobile && styles.searchBoxMobile]}>
                {Icons.search}

                <TextInput
                    value={text}
                    onChangeText={handleChange}
                    placeholder="Найти путешествие…"
                    placeholderTextColor="#999"
                    style={[styles.input, isMobile && styles.inputMobile]}
                    returnKeyType="search"
                    onSubmitEditing={onSubmit}
                    accessibilityLabel="Поле поиска путешествий"
                    autoCapitalize="none"
                    autoCorrect={false}
                    underlineColorAndroid="transparent"
                    clearButtonMode={Platform.OS === "ios" ? "while-editing" : "never"}
                    maxLength={120}
                />

                {text !== "" && (
                    <Pressable
                        onPress={handleClear}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Очистить поиск"
                        style={styles.clearBtn}
                    >
                        {Icons.clear}
                    </Pressable>
                )}
            </View>

            <View style={[styles.actionIcons, isMobile && styles.actionIconsMobile]}>
                {onToggleRecommendations && (
                    <IconButton
                        label={isRecommendationsVisible ? "Скрыть рекомендации" : "Показать рекомендации"}
                        active={isRecommendationsVisible}
                        onPress={onToggleRecommendations}
                        icon={Icons.recommendations}
                        testID="toggle-recommendations"
                    />
                )}
            </View>
        </View>
    );
}

export default memo(
    SearchAndFilterBar,
    (prev, next) =>
        prev.search === next.search &&
        // Изменение наличия кнопки фильтров влияет на разметку
        (!!prev.onToggleFilters === !!next.onToggleFilters) &&
        prev.isRecommendationsVisible === next.isRecommendationsVisible
);

const styles = StyleSheet.create({
    wrap: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        gap: Platform.select({ default: 8, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше gap на мобильных
        paddingHorizontal: Platform.select({ default: 12, web: 16 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    },
    wrapMobile: { 
        paddingHorizontal: Platform.select({ default: 10, web: 6 }), // ✅ АДАПТИВНОСТЬ: Больше на мобильных для лучшей читаемости
        paddingBottom: Platform.select({ default: 6, web: 4 }), 
        paddingTop: 0, 
        marginBottom: Platform.select({ default: 8, web: 4 }), 
        marginTop: 0, 
        gap: Platform.select({ default: 8, web: 6 }) 
    },
    searchBox: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше gap на мобильных
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: Platform.select({ default: 10, web: DESIGN_TOKENS.radii.md }), // ✅ АДАПТИВНОСТЬ: Меньше радиус на мобильных
        borderWidth: 0.5, // ✅ ДИЗАЙН: Более тонкая граница
        borderColor: 'rgba(0, 0, 0, 0.06)', // ✅ ДИЗАЙН: Более светлая граница
        paddingHorizontal: Platform.select({ default: 12, web: 16 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        height: Platform.select({
            default: 48, // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
            web: 56,
        }),
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.02, // ✅ ДИЗАЙН: Более легкая тень
                shadowRadius: 2,
            },
            android: {
                elevation: 1, // ✅ ДИЗАЙН: Меньше elevation
            },
            web: {
            },
        }),
    },
    searchBoxMobile: {
        height: 44,
        paddingHorizontal: 12,
        gap: 8,
        borderRadius: 10,
    },
    input: {
        flex: 1,
        fontSize: Platform.select({ default: 13, web: 14 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        color: DESIGN_TOKENS.colors.text,
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineWidth: 0,
                backgroundColor: "transparent",
            },
        }),
    },
    inputMobile: {
        fontSize: 13,
    },
    clearBtn: {
        padding: 6,
        borderRadius: 16,
        ...Platform.select({ web: { cursor: "pointer" } }),
    },
    actionIcons: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginLeft: 8,
    },
    actionIconsMobile: {
        gap: 6,
        marginLeft: 4,
    },
});
