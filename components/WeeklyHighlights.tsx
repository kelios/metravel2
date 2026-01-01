import React, { useMemo, memo, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFavorites } from '@/context/FavoritesContext';
import { fetchTravelsOfMonth } from '@/src/api/map';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { useThemedColors } from '@/hooks/useTheme';

const COLLAPSED_KEY = 'weekly_highlights_collapsed';

interface WeeklyHighlightsProps {
    forceVisible?: boolean;
    onVisibilityChange?: (visible: boolean) => void;
    showHeader?: boolean;
    enabled?: boolean;
}

function WeeklyHighlights({ forceVisible, onVisibilityChange, showHeader = true, enabled = true }: WeeklyHighlightsProps) {
    const router = useRouter();
    const { viewHistory } = useFavorites();
    const colors = useThemedColors();

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    // Проверяем состояние сворачивания при монтировании
    useEffect(() => {
        let isMounted = true;

        const checkCollapsed = async () => {
            try {
                if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
                    const collapsed = sessionStorage.getItem(COLLAPSED_KEY) === 'true';
                    if (isMounted) {
                        setIsCollapsed(collapsed);
                    }
                } else if (typeof AsyncStorage?.getItem === 'function') {
                    const collapsed = (await AsyncStorage.getItem(COLLAPSED_KEY)) === 'true';
                    if (isMounted) {
                        setIsCollapsed(collapsed);
                    }
                }
            } catch (error) {
                // ✅ BUG-001: Логируем только в dev режиме
                if (__DEV__) {
                    console.warn('[WeeklyHighlights] Failed to read collapsed state', error);
                }
            }
        };

        checkCollapsed();
        setIsInitialized(true);

        return () => {
            isMounted = false;
        };
    }, []);

    const handleExpand = useCallback(() => {
        setIsCollapsed(false);
        if (Platform.OS === 'web') {
            sessionStorage.removeItem(COLLAPSED_KEY);
        } else {
            AsyncStorage.removeItem(COLLAPSED_KEY);
        }
        // Уведомляем родителя о разворачивании
        if (onVisibilityChange) {
            onVisibilityChange(true);
        }
    }, [onVisibilityChange]);

    // Получаем популярные путешествия месяца
    const { data: popularTravels } = useQuery({
        queryKey: ['travelsOfMonth'],
        queryFn: fetchTravelsOfMonth,
        staleTime: 3600000, // 1 час
        enabled,
    });

    // Фильтруем те, которые пользователь еще не видел
    const highlights = useMemo(() => {
        if (!popularTravels || typeof popularTravels !== 'object') return [];
        
        const viewedIds = new Set(viewHistory.map(h => `${h.type}-${h.id}`));
        const travels = Object.values(popularTravels) as any[];
        
        return travels
            .filter((t: any) => {
                const key = `travel-${t.id}`;
                return !viewedIds.has(key);
            })
            .slice(0, 5)
            .map((t: any) => ({
                id: t.id,
                title: t.name,
                imageUrl: t.travel_image_thumb_url,
                url: `/travels/${t.slug || t.id}`,
                country: t.countryName,
            }));
    }, [popularTravels, viewHistory]);

    // ВАЖНО: все хуки должны быть вызваны до условных возвратов
    const handleItemPress = useCallback((url: string) => {
        if (Platform.OS === 'web') {
            window.location.href = url;
        } else {
            router.push(url as any);
        }
    }, [router]);

    const handleHorizontalWheel = useCallback((e: any) => {
        if (Platform.OS !== 'web') return;

        const deltaY = Number(e?.deltaY ?? 0);
        const deltaX = Number(e?.deltaX ?? 0);

        if (!deltaY || Math.abs(deltaY) <= Math.abs(deltaX)) return;

        const target = e?.currentTarget as any;
        const el = target?._nativeNode || target?._domNode || target;
        if (!el || typeof (el as any).scrollLeft !== 'number') return;

        const maxScrollLeft = (el.scrollWidth ?? 0) - (el.clientWidth ?? 0);
        if (maxScrollLeft <= 0) return;

        e.preventDefault?.();
        (el as any).scrollLeft += deltaY;
    }, []);

    // Условный возврат после всех хуков
    if (highlights.length === 0) return null;
    
    // Если forceVisible установлен, используем его напрямую
    if (forceVisible !== undefined) {
        if (forceVisible === false) {
            return null;
        }
        // forceVisible === true - показываем компонент
    } else {
        // Если forceVisible не установлен, используем локальное состояние isCollapsed
        if (isInitialized && isCollapsed) {
            return (
                <View style={[styles.collapsedContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight }]}>
                    <Pressable
                        onPress={handleExpand}
                        style={styles.expandButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialIcons name="expand-more" size={20} color={colors.primary} />
                        <Text style={[styles.expandButtonText, { color: colors.primary }]}>Подборка месяца</Text>
                    </Pressable>
                </View>
            );
        }
    }

    return (
        <View style={styles.container}>
            {showHeader && (
                <>
                    <View style={styles.header}>
                        <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
                            <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.titleContainer}>
                            <Text style={[styles.title, { color: colors.text }]}>Подборка месяца</Text>
                            <View style={[styles.badgeContainer, { backgroundColor: colors.primarySoft }]}>
                                <Text style={[styles.badgeText, { color: colors.primary }]}>Выбор месяца</Text>
                            </View>
                        </View>
                    </View>
                    <Text style={[styles.subtitle, { color: colors.textMuted }]}>Самые популярные маршруты этого месяца</Text>
                </>
            )}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={Platform.OS === 'web'}
                contentContainerStyle={styles.scrollContent}
                removeClippedSubviews={Platform.OS !== "web"}
                decelerationRate="fast"
                // Явно включаем горизонтальный скролл на вебе
                style={Platform.select({
                    web: {
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        width: '100%',
                        touchAction: 'pan-x',
                    } as any,
                    default: {},
                })}
                {...(Platform.OS === 'web' ? ({ onWheel: handleHorizontalWheel } as any) : {})}
            >
                {highlights.map((item) => (
                    <TabTravelCard
                        key={item.id}
                        item={{
                            id: item.id,
                            title: item.title,
                            imageUrl: item.imageUrl,
                            city: null,
                            country: item.country ?? null,
                        }}
                        badge={{
                            icon: 'trending-up',
                            backgroundColor: colors.surface,
                            iconColor: colors.primary,
                        }}
                        onPress={() => handleItemPress(item.url)}
                    />
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 8, // ✅ МИНИМАЛИСТИЧНЫЙ ДИЗАЙН: Меньше отступов
        paddingHorizontal: 0,
        paddingVertical: 8, // ✅ МИНИМАЛИСТИЧНЫЙ ДИЗАЙН: Меньше padding
        backgroundColor: 'transparent', // ✅ МИНИМАЛИСТИЧНЫЙ ДИЗАЙН: Прозрачный фон
        borderRadius: 12, // ✅ МИНИМАЛИСТИЧНЫЙ ДИЗАЙН: Меньше радиус
        borderWidth: 0, // ✅ МИНИМАЛИСТИЧНЫЙ ДИЗАЙН: Без границы
        borderColor: 'transparent',
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        marginBottom: 2,
    },
    iconContainer: {
        width: 28,
        height: 28,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
    },
    titleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
        gap: 8,
    },
    title: {
        fontSize: 15, // ✅ МИНИМАЛИСТИЧНЫЙ ДИЗАЙН: Меньше размер
        fontWeight: '600', // ✅ МИНИМАЛИСТИЧНЫЙ ДИЗАЙН: Меньше жирность
        letterSpacing: -0.1,
    },
    badgeContainer: {
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.1,
    },
    subtitle: {
        fontSize: 13,
        paddingHorizontal: 12,
        marginLeft: 0,
        marginBottom: 12,
    },
    subtitleCompact: {
        marginTop: 4,
        marginBottom: 8,
    },
    collapseButton: {
        padding: 4,
        marginLeft: 8,
        ...Platform.select({
            web: {
                cursor: 'pointer',
            },
        }),
    },
    collapsedContainer: {
        marginVertical: 8,
        marginHorizontal: 4,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    expandButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
        ...Platform.select({
            web: {
                cursor: 'pointer',
            },
        }),
    },
    expandButtonText: {
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    scrollContent: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        flexDirection: 'row',
        flexWrap: 'nowrap',
        ...(Platform.select({
            web: {
                width: 'max-content',
            } as any,
            default: {},
        }) as any),
    },
});

export default memo(WeeklyHighlights);
