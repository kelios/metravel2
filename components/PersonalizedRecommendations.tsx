import React, { useMemo, memo, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFavorites } from '@/context/FavoritesContext';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ✅ ДИЗАЙН: Импорт максимально легкой и воздушной палитры
import { AIRY_COLORS } from '@/constants/airyColors';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { METRICS } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';

const COLLAPSED_KEY = 'personalization_collapsed';

interface PersonalizedRecommendationsProps {
    forceVisible?: boolean;
    onVisibilityChange?: (visible: boolean) => void;
    showHeader?: boolean;
    onlyRecommendations?: boolean;
}

function PersonalizedRecommendations({ forceVisible, onVisibilityChange, showHeader = true, onlyRecommendations = false }: PersonalizedRecommendationsProps) {
    const { favorites, viewHistory, getRecommendations } = useFavorites();
    const { isAuthenticated } = useAuth();
    const router = useRouter();
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    // Проверяем состояние сворачивания при монтировании
    useEffect(() => {
        const checkCollapsed = async () => {
            if (Platform.OS === 'web') {
                const collapsed = sessionStorage.getItem(COLLAPSED_KEY) === 'true';
                setIsCollapsed(collapsed);
            } else {
                const collapsed = await AsyncStorage.getItem(COLLAPSED_KEY);
                setIsCollapsed(collapsed === 'true');
            }
            setIsInitialized(true);
        };
        checkCollapsed();
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

    // ✅ ИСПРАВЛЕНИЕ: Показываем только алгоритмические рекомендации (не дублируем избранное и историю)
    const recommendations = useMemo(() => {
        if (!isAuthenticated) return [];
        const raw = getRecommendations();
        if (onlyRecommendations) {
            return raw;
        }
        // getRecommendations возвращает избранное, отсортированное по дате
        // Здесь исключаем элементы, которые уже отображаются в «Избранном», чтобы не дублировать карточки
        return raw.filter(item => !favorites.some(f => f.id === item.id && f.type === item.type));
    }, [favorites, isAuthenticated, getRecommendations, onlyRecommendations]);

    const containerStyles = useMemo(() => [
        styles.container,
        !showHeader && styles.containerCompact,
    ], [showHeader]);

    // ВАЖНО: все хуки должны быть вызваны до условных возвратов
    const handleItemPress = useCallback((url: string) => {
        if (Platform.OS === 'web') {
            window.location.href = url;
        } else {
            router.push(url as any);
        }
    }, [router]);

    const handleLoginPress = useCallback(() => {
        router.push('/login' as any);
    }, [router]);

    const renderItem = useCallback((item: typeof recommendations[0]) => {
        return (
            <TabTravelCard
                key={`${item.type}-${item.id}`}
                item={{
                    id: item.id,
                    title: item.title,
                    imageUrl: item.imageUrl,
                    city: (item as any).city ?? null,
                    country: (item as any).country ?? null,
                }}
                onPress={() => handleItemPress(item.url)}
            />
        );
    }, [handleItemPress]);

    const hasFavorites = !onlyRecommendations && favorites && favorites.length > 0;
    const hasHistory = !onlyRecommendations && viewHistory && viewHistory.length > 0;

    // Условные возвраты после всех хуков
    if (!isInitialized) return null;
    
    // Если forceVisible установлен, используем его напрямую
    if (forceVisible !== undefined) {
        if (forceVisible === false) {
            return null;
        }
        // forceVisible === true - показываем компонент
    } else {
        // Если forceVisible не установлен, используем локальное состояние isCollapsed
        if (isCollapsed) {
            return (
                <View style={styles.collapsedContainer}>
                    <Pressable 
                        onPress={handleExpand}
                        style={styles.expandButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialIcons name="expand-more" size={20} color="#6b8e7f" />
                        <Text style={styles.expandButtonText}>Персонализация</Text>
                    </Pressable>
                </View>
            );
        }
    }

    if (!isAuthenticated) {
        return (
            <View style={containerStyles}>
                {showHeader && (
                    <>
                        <View style={styles.header}>
                            <View style={[styles.iconContainer, { backgroundColor: '#f0f9f9' }]}>
                                <MaterialIcons name="star" size={24} color="#6b8e7f" />
                            </View>
                            <View style={styles.titleContainer}>
                                <Text style={styles.title}>Рекомендации для вас</Text>
                                <View style={styles.badgeContainer}>
                                    <Text style={styles.badgeText}>Для вас</Text>
                                </View>
                            </View>
                            {/* ✅ ИСПРАВЛЕНИЕ: Убрана кнопка сворачивания, так как она уже есть в RecommendationsTabs */}
                        </View>
                        <Text style={styles.subtitle}>Персональные рекомендации на основе ваших интересов</Text>
                    </>
                )}
                    <View style={[styles.promptCard, isMobile ? styles.promptCardMobile : styles.promptCardDesktop]}>
                        <View style={styles.promptLead}>
                            <View style={styles.promptIcon}>
                                <MaterialIcons name="login" size={28} color="#6b8e7f" />
                            </View>
                            <View style={styles.promptCopy}>
                                <Text style={[styles.promptText, !isMobile && styles.promptTextDesktop]}>
                                    Войдите, чтобы получать персональные рекомендации и сохранять понравившиеся маршруты
                                </Text>
                            </View>
                        </View>
                        <Pressable 
                            style={[styles.loginButton, !isMobile && styles.loginButtonInline]}
                            onPress={handleLoginPress}
                            android_ripple={{ color: 'rgba(74, 140, 140, 0.1)' }}
                        >
                            <Text style={styles.loginButtonText}>Войти или зарегистрироваться</Text>
                            <MaterialIcons name="arrow-forward" size={18} color="#6b8e7f" style={{ marginLeft: 6 }} />
                        </Pressable>
                    </View>
                </View>
        );
    }

    // ✅ ИСПРАВЛЕНИЕ: Показываем пустое состояние
    // - если onlyRecommendations=true: когда нет recommendations
    // - иначе: когда нет избранного, истории и рекомендаций
    if (onlyRecommendations ? recommendations.length === 0 : (!hasFavorites && !hasHistory && recommendations.length === 0)) {
        return (
            <View style={containerStyles}>
                {showHeader && (
                    <>
                        <View style={styles.header}>
                            <View style={[styles.iconContainer, { backgroundColor: AIRY_COLORS.primaryLight }]}>
                                <MaterialIcons name="star" size={24} color={AIRY_COLORS.primary} />
                            </View>
                            <View style={styles.titleContainer}>
                                <Text style={styles.title}>Рекомендации для вас</Text>
                                <View style={styles.badgeContainer}>
                                    <Text style={styles.badgeText}>Для вас</Text>
                                </View>
                            </View>
                            {/* ✅ ИСПРАВЛЕНИЕ: Убрана кнопка сворачивания, так как она уже есть в RecommendationsTabs */}
                        </View>
                        <Text style={styles.subtitle}>Рекомендации на основе ваших интересов</Text>
                    </>
                )}
                <View style={[styles.emptyCard, isMobile ? styles.promptCardMobile : styles.promptCardDesktop]}>
                    <View style={styles.promptLead}>
                        <View style={styles.promptIcon}>
                            <MaterialIcons name="explore" size={28} color="#6b7280" />
                        </View>
                        <View style={styles.promptCopy}>
                            <Text style={[styles.emptyText, !isMobile && styles.promptTextDesktop]}>
                                Начните просматривать путешествия и добавлять их в избранное, чтобы получать персональные рекомендации
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={containerStyles}>
            {showHeader && (
                <>
                    <View style={styles.header}>
                        <View style={[styles.iconContainer, { backgroundColor: '#fff5eb' }]}> 
                            <MaterialIcons name="star" size={24} color={AIRY_COLORS.primary} />
                        </View>
                        <View style={styles.titleContainer}>
                            <Text style={styles.title}>Рекомендации для вас</Text>
                            <View style={styles.badgeContainer}>
                                <Text style={styles.badgeText}>Для вас</Text>
                            </View>
                        </View>
                        {/* ✅ ИСПРАВЛЕНИЕ: Убрана кнопка сворачивания, так как она уже есть в RecommendationsTabs */}
                    </View>
                    <Text style={styles.subtitle}>Рекомендации на основе ваших интересов</Text>
                </>
            )}

            {hasFavorites && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Избранное</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        removeClippedSubviews={Platform.OS !== "web"}
                        decelerationRate="fast"
                    >
                        {favorites.map(item => renderItem(item as any))}
                    </ScrollView>
                </View>
            )}

            {hasHistory && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Недавно просмотрено</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        removeClippedSubviews={Platform.OS !== "web"}
                        decelerationRate="fast"
                    >
                        {viewHistory.map(item => renderItem(item as any))}
                    </ScrollView>
                </View>
            )}

            {recommendations.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Рекомендации</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        removeClippedSubviews={Platform.OS !== "web"}
                        decelerationRate="fast"
                    >
                        {recommendations.map(item => renderItem(item))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 8, // ✅ МИНИМАЛИСТИЧНЫЙ ДИЗАЙН: Меньше отступов
        padding: 12, // ✅ МИНИМАЛИСТИЧНЫЙ ДИЗАЙН: Меньше padding
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
    containerCompact: {
        marginVertical: 0,
        padding: 0,
        paddingTop: 8,
        paddingBottom: 4,
    },
    section: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#fef2f2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 10,
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
        marginLeft: 0,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a202c',
        marginBottom: 8,
    },
    countBadge: {
        backgroundColor: '#fee2e2',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        minWidth: 32,
        alignItems: 'center',
    },
    count: {
        fontSize: 14,
        color: '#ef4444',
        fontWeight: '700',
    },
    scrollContent: {
        paddingHorizontal: 4,
        paddingVertical: 4,
    },
    item: {
        width: 168,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#1f1f1f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
        marginRight: 12,
        transform: [{ scale: 1 }],
    },
    itemMobile: {
        width: 140,
    },
    itemImage: {
        width: '100%',
        height: 96,
        backgroundColor: '#f3f4f6',
    },
    itemImagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: DESIGN_TOKENS.colors.mutedBackground,
    },
    itemContent: {
        padding: 10,
        backgroundColor: DESIGN_TOKENS.colors.surface,
    },
    itemTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: 6,
        lineHeight: 18,
        letterSpacing: -0.1,
    },
    itemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    itemMetaText: {
        fontSize: 12,
        color: DESIGN_TOKENS.colors.primary,
        fontWeight: '600',
    },
    historyBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: 14,
        padding: 6,
        shadowColor: '#1f1f1f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        ...Platform.select({
            web: {
                boxShadow: '0 2px 6px rgba(31, 31, 31, 0.06)',
            },
        }),
    },
    promptCard: {
        backgroundColor: '#fdf8f3',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 159, 90, 0.25)',
    },
    promptCardMobile: {
        alignItems: 'flex-start',
    },
    promptCardDesktop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    promptLead: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    promptCopy: {
        flex: 1,
        marginLeft: 12,
    },
    promptIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(15,23,42,0.08)',
    },
    promptText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'left',
        lineHeight: 20,
        fontWeight: '500',
    },
    promptTextDesktop: {
        maxWidth: 520,
    },
    loginButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#6b8e7f',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 18,
        alignSelf: 'flex-start',
        marginTop: 12,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            },
        }),
    },
    loginButtonInline: {
        marginLeft: 16,
        marginTop: 0,
    },
    loginButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b8e7f',
        letterSpacing: -0.2,
    },
    emptyCard: {
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.08)',
    },
    emptyText: {
        fontSize: 14,
        color: '#6b7280',
        lineHeight: 20,
        fontWeight: '500',
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
});

export default memo(PersonalizedRecommendations);

