import React, { useMemo, memo, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, useWindowDimensions, Platform, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFavorites } from '@/context/FavoritesContext';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ✅ ДИЗАЙН: Импорт максимально легкой и воздушной палитры
import { AIRY_COLORS } from '@/constants/airyColors';

const COLLAPSED_KEY = 'personalization_collapsed';

interface PersonalizedRecommendationsProps {
    forceVisible?: boolean;
    onVisibilityChange?: (visible: boolean) => void;
}

function PersonalizedRecommendations({ forceVisible, onVisibilityChange }: PersonalizedRecommendationsProps) {
    const { viewHistory, getRecommendations } = useFavorites();
    const { isAuthenticated } = useAuth();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width <= 768;
    
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

    // ✅ ИСПРАВЛЕНИЕ: Показываем только алгоритмические рекомендации (не избранное и не историю)
    const recommendations = useMemo(() => {
        if (!isAuthenticated) return [];
        // getRecommendations возвращает избранное, отсортированное по дате
        // Для настоящих рекомендаций нужно использовать другой алгоритм
        // Пока возвращаем пустой массив, так как нет отдельного алгоритма рекомендаций
        // TODO: Реализовать алгоритм рекомендаций на основе интересов пользователя
        return [];
    }, [viewHistory, isAuthenticated, getRecommendations]);

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
            <TouchableOpacity
                key={`${item.type}-${item.id}`}
                style={[styles.item, isMobile && styles.itemMobile]}
                onPress={() => handleItemPress(item.url)}
                activeOpacity={0.8}
            >
                {item.imageUrl ? (
                    <Image 
                        source={{ uri: item.imageUrl }} 
                        style={styles.itemImage}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                        <MaterialIcons name={item.type === 'travel' ? 'route' : 'article'} size={24} color="#9ca3af" />
                    </View>
                )}
                <View style={styles.itemContent}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                        {item.title}
                    </Text>
                    {(item.country || item.city) && (
                        <View style={styles.itemMeta}>
                            <MaterialIcons name="place" size={12} color="#6b7280" style={{ marginRight: 4 }} />
                            <Text style={styles.itemMetaText}>
                                {[item.city, item.country].filter(Boolean).join(', ')}
                            </Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    }, [handleItemPress, isMobile]);

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
                <View style={styles.container}>
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
                        <Pressable 
                            onPress={handleCollapse}
                            style={styles.collapseButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <MaterialIcons name="expand-less" size={24} color="#6b7280" />
                        </Pressable>
                    </View>
                    <Text style={styles.subtitle}>Персональные рекомендации на основе ваших интересов</Text>
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

    // ✅ ИСПРАВЛЕНИЕ: Показываем пустое состояние, если нет рекомендаций
    if (recommendations.length === 0) {
        return (
            <View style={styles.container}>
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
                    <Pressable 
                        onPress={handleCollapse}
                        style={styles.collapseButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialIcons name="expand-less" size={24} color="#6b7280" />
                    </Pressable>
                </View>
                <Text style={styles.subtitle}>Рекомендации на основе ваших интересов</Text>
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
        <View style={styles.container}>
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
                <Pressable 
                    onPress={handleCollapse}
                    style={styles.collapseButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <MaterialIcons name="expand-less" size={24} color="#6b7280" />
                </Pressable>
            </View>
            <Text style={styles.subtitle}>Рекомендации на основе ваших интересов</Text>
            {recommendations.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    removeClippedSubviews={Platform.OS !== "web"}
                    decelerationRate="fast"
                >
                    {recommendations.map(item => renderItem(item))}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.08)',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: Platform.OS === 'web' ? 0 : 0.06,
        shadowRadius: 12,
        elevation: 2,
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
        fontSize: 20, // ✅ БИЗНЕС: Увеличен размер для видимости
        fontWeight: '700',
        fontFamily: Platform.select({ web: 'Georgia, serif', default: undefined }), // ✅ БИЗНЕС: Georgia для выделения
        color: '#1a202c',
        letterSpacing: -0.3,
    },
    badgeContainer: {
        backgroundColor: AIRY_COLORS.primary, // ✅ ДИЗАЙН: Воздушный легкий персиковый badge
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        ...Platform.select({
            web: {
                boxShadow: '0 2px 4px rgba(255, 159, 90, 0.3)',
            },
        }),
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.2,
    },
    subtitle: {
        fontSize: 13,
        color: '#4a5568',
        marginLeft: 0,
        marginBottom: 12,
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f0f0f0',
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
        backgroundColor: '#f9fafb',
    },
    itemContent: {
        padding: 10,
        backgroundColor: '#ffffff',
    },
    itemTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 6,
        lineHeight: 18,
        letterSpacing: -0.1,
    },
    itemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    itemMetaText: {
        fontSize: 12,
        color: '#6b8e7f',
        fontWeight: '600',
    },
    historyBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 14,
        padding: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#e5e7eb',
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

