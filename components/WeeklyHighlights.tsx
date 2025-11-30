import React, { useMemo, memo, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Platform, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFavorites } from '@/context/FavoritesContext';
import { fetchTravelsOfMonth } from '@/src/api/travels';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIRY_COLORS } from '@/constants/airyColors'; // ✅ ИСПРАВЛЕНИЕ: Добавлен импорт AIRY_COLORS
import { Image as ExpoImage } from 'expo-image';

const COLLAPSED_KEY = 'weekly_highlights_collapsed';

interface WeeklyHighlightsProps {
    forceVisible?: boolean;
    onVisibilityChange?: (visible: boolean) => void;
}

function WeeklyHighlights({ forceVisible, onVisibilityChange }: WeeklyHighlightsProps) {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width <= 768;
    const { viewHistory } = useFavorites();
    
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

    const handleCollapse = useCallback(() => {
        setIsCollapsed(true);
        if (Platform.OS === 'web') {
            sessionStorage.setItem(COLLAPSED_KEY, 'true');
        } else {
            AsyncStorage.setItem(COLLAPSED_KEY, 'true');
        }
        // Уведомляем родителя о сворачивании
        if (onVisibilityChange) {
            onVisibilityChange(false);
        }
    }, [onVisibilityChange]);

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
                <View style={styles.collapsedContainer}>
                    <Pressable 
                        onPress={handleExpand}
                        style={styles.expandButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialIcons name="expand-more" size={20} color="#6b8e7f" />
                        <Text style={styles.expandButtonText}>Подборка месяца</Text>
                    </Pressable>
                </View>
            );
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                {/* ✅ ДИЗАЙН: Воздушный легкий персиковый фон */}
            <View style={[styles.iconContainer, { backgroundColor: AIRY_COLORS.primaryLight }]}>
                    {/* ✅ БИЗНЕС: Оранжевая иконка */}
                    <MaterialIcons name="auto-awesome" size={20} color={AIRY_COLORS.primary} />
                </View>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Подборка месяца</Text>
                    <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>Выбор месяца</Text>
                    </View>
                </View>
                {/* ✅ ИСПРАВЛЕНИЕ: Убрана кнопка сворачивания, так как она уже есть в RecommendationsTabs */}
            </View>
            <Text style={styles.subtitle}>Самые популярные маршруты этого месяца</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                removeClippedSubviews={Platform.OS !== "web"}
                decelerationRate="fast"
            >
                {highlights.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={[styles.item, isMobile && styles.itemMobile]}
                        onPress={() => handleItemPress(item.url)}
                        activeOpacity={0.8}
                    >
                        {item.imageUrl ? (
                            <ExpoImage
                                source={{ uri: item.imageUrl }}
                                style={styles.itemImage}
                                contentFit="cover"
                                transition={120}
                                cachePolicy="memory-disk"
                            />
                        ) : (
                            <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                                <MaterialIcons name="route" size={24} color="#9ca3af" />
                            </View>
                        )}
                        <View style={styles.itemContent}>
                            <Text style={styles.itemTitle} numberOfLines={2}>
                                {item.title}
                            </Text>
                            {item.country && (
                                <View style={styles.itemMeta}>
                                    <MaterialIcons name="place" size={12} color="#6b7280" style={{ marginRight: 4 }} />
                                    <Text style={styles.itemMetaText}>{item.country}</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.badge}>
                            <MaterialIcons name="trending-up" size={14} color="#6b8e7f" />
                        </View>
                    </TouchableOpacity>
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
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6b8e7f',
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
        color: '#1a202c',
        letterSpacing: -0.1,
    },
    badgeContainer: {
        backgroundColor: 'rgba(74, 140, 140, 0.1)', // ✅ МИНИМАЛИСТИЧНЫЙ ДИЗАЙН: Прозрачный фон
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#4a8c8c', // ✅ МИНИМАЛИСТИЧНЫЙ ДИЗАЙН: Цвет текста вместо белого
        letterSpacing: 0.1,
    },
    subtitle: {
        fontSize: 13,
        color: '#4a5568',
        paddingHorizontal: 12,
        marginLeft: 0,
        marginBottom: 12,
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
        backgroundColor: '#f0f9f9',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#d1e7e7',
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
        color: '#6b8e7f',
        marginLeft: 6,
    },
    scrollContent: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    item: {
        width: 220,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        overflow: 'hidden',
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        position: 'relative',
        transform: [{ scale: 1 }],
        ...Platform.select({
            web: {
                cursor: 'pointer',
            },
        }),
    },
    itemMobile: {
        width: 180,
    },
    itemImage: {
        width: '100%',
        height: 140,
        backgroundColor: '#f3f4f6',
    },
    itemImagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
    },
    itemContent: {
        padding: 8,
        backgroundColor: '#ffffff',
    },
    itemTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
        lineHeight: 16,
        letterSpacing: -0.1,
    },
    itemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f9f9',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    itemMetaText: {
        fontSize: 11,
        color: '#6b8e7f',
        fontWeight: '600',
    },
    badge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 4,
        shadowColor: '#6b8e7f',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#6b8e7f',
    },
});

export default memo(WeeklyHighlights);

