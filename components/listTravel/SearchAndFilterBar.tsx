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
// ✅ ДИЗАЙН: Импорт максимально легкой и воздушной палитры
import { AIRY_COLORS, AIRY_BOX_SHADOWS } from "@/constants/airyColors";

interface Props {
    search: string;
    setSearch: (value: string) => void;
    onToggleFilters?: () => void;
    onTogglePersonalization?: () => void;
    onToggleWeeklyHighlights?: () => void;
    isPersonalizationVisible?: boolean;
    isWeeklyHighlightsVisible?: boolean;
}

function SearchAndFilterBar({ 
    search, 
    setSearch, 
    onToggleFilters,
    onTogglePersonalization,
    onToggleWeeklyHighlights,
    isPersonalizationVisible = false,
    isWeeklyHighlightsVisible = false,
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

    const Icons = useMemo(
        () => ({
            search: <Feather name="search" size={20} color={AIRY_COLORS.primary} aria-hidden="true" />, // ✅ ДИЗАЙН: Пастельный персик, увеличен размер
            clear: <Feather name="x" size={18} color="#666" aria-hidden="true" />,
            filter: <Feather name="filter" size={22} color={AIRY_COLORS.primary} aria-hidden="true" />, // ✅ ДИЗАЙН: Пастельный персик
            personalization: <MaterialIcons name="star" size={20} color={isPersonalizationVisible ? AIRY_COLORS.primary : "#999"} />, // ✅ ДИЗАЙН: Пастельный персик при активном
            weeklyHighlights: <MaterialIcons name="auto-awesome" size={20} color={isWeeklyHighlightsVisible ? AIRY_COLORS.primary : "#999"} />, // ✅ ДИЗАЙН: Пастельный персик при активном
        }),
        [isPersonalizationVisible, isWeeklyHighlightsVisible, AIRY_COLORS.primary]
    );

    const onSubmit = useCallback(() => {
        applySearch(text);
        Keyboard.dismiss();
    }, [applySearch, text]);

    return (
        <View style={[styles.wrap, isMobile && styles.wrapMobile]}>
            {isMobile && onToggleFilters && (
                <Pressable
                    onPress={onToggleFilters}
                    accessibilityRole="button"
                    accessibilityLabel="Открыть фильтры"
                    style={styles.filterBtn}
                    hitSlop={10}
                >
                    {Icons.filter}
                </Pressable>
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
                {onTogglePersonalization && (
                    <Pressable
                        onPress={onTogglePersonalization}
                        accessibilityRole="button"
                        accessibilityLabel={isPersonalizationVisible ? "Скрыть персонализацию" : "Показать персонализацию"}
                        style={[styles.iconBtn, isPersonalizationVisible && styles.iconBtnActive]}
                        hitSlop={8}
                    >
                        {Icons.personalization}
                    </Pressable>
                )}
                {onToggleWeeklyHighlights && (
                    <Pressable
                        onPress={onToggleWeeklyHighlights}
                        accessibilityRole="button"
                        accessibilityLabel={isWeeklyHighlightsVisible ? "Скрыть подборку недели" : "Показать подборку недели"}
                        style={[styles.iconBtn, isWeeklyHighlightsVisible && styles.iconBtnActive]}
                        hitSlop={8}
                    >
                        {Icons.weeklyHighlights}
                    </Pressable>
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
        prev.isPersonalizationVisible === next.isPersonalizationVisible &&
        prev.isWeeklyHighlightsVisible === next.isWeeklyHighlightsVisible
);

const styles = StyleSheet.create({
    wrap: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        gap: 8,
        paddingHorizontal: 16,
    },
    wrapMobile: { paddingHorizontal: 6, paddingBottom: 4, paddingTop: 0, marginBottom: 4, marginTop: 0, gap: 6 },
    filterBtn: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: "#f5f5f5",
        ...Platform.select({ 
            web: { 
                cursor: "pointer",
                transition: "all 0.2s ease",
            } 
        }),
    },
    searchBox: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12, // ✅ ДИЗАЙН: Увеличен gap
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: Platform.OS === "web" ? 2 : 1, // ✅ ДИЗАЙН: Утолщена граница
        borderColor: AIRY_COLORS.primary, // ✅ ДИЗАЙН: Пастельная персиковая граница как акцент
        paddingHorizontal: 16, // ✅ ДИЗАЙН: Увеличены отступы
        height: Platform.select({
            default: 52,
            web: 56,
        }),
        ...Platform.select({
            ios: {
                shadowColor: AIRY_COLORS.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
            web: {
                boxShadow: AIRY_BOX_SHADOWS.light, // ✅ ДИЗАЙН: Легкая воздушная тень
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                // @ts-ignore
                ":focus-within": {
                    borderColor: AIRY_COLORS.primaryDark, // ✅ ДИЗАЙН: Более темный пастельный персик при focus
                    boxShadow: AIRY_BOX_SHADOWS.hover, // ✅ ДИЗАЙН: Легкая воздушная тень при hover
                    transform: "scale(1.01)",
                },
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
        fontSize: 14,
        color: "#333",
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
        gap: 8, // ✅ ДИЗАЙН: Увеличен gap
        marginLeft: 8, // ✅ ДИЗАЙН: Увеличен marginLeft
    },
    actionIconsMobile: {
        gap: 6,
        marginLeft: 4,
    },
    iconBtn: {
        padding: 10, // ✅ ДИЗАЙН: Увеличен padding
        borderRadius: 12,
        backgroundColor: AIRY_COLORS.primaryLight, // ✅ ДИЗАЙН: Светлый пастельный персиковый фон
        borderWidth: 1,
        borderColor: "rgba(255, 159, 90, 0.2)",
        ...Platform.select({ 
            web: { 
                cursor: "pointer",
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                // @ts-ignore
                ":hover": {
                    backgroundColor: AIRY_COLORS.primaryLight, // ✅ ДИЗАЙН: Воздушный легкий персиковый фон при hover
                    borderColor: AIRY_COLORS.primary,
                    transform: "scale(1.05)",
                },
            } 
        }),
    },
    iconBtnActive: {
        backgroundColor: AIRY_COLORS.primary, // ✅ ДИЗАЙН: Пастельный персиковый фон при активном
        borderColor: AIRY_COLORS.primary,
        ...Platform.select({
            web: {
                boxShadow: AIRY_BOX_SHADOWS.medium, // ✅ ДИЗАЙН: Легкая воздушная тень
                transform: "scale(1.05)",
            },
        }),
    },
});
