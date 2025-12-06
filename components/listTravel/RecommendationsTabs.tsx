import React, { useState, useMemo, lazy, Suspense, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions, ScrollView, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useRouter } from 'expo-router';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';

// Ленивая загрузка компонентов
const PersonalizedRecommendations = lazy(() => 
    typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? new Promise(resolve => {
            (window as any).requestIdleCallback(() => {
                resolve(import('@/components/PersonalizedRecommendations'));
            }, { timeout: 2000 });
        })
        : import('@/components/PersonalizedRecommendations')
);

const WeeklyHighlights = lazy(() => 
    typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? new Promise(resolve => {
            (window as any).requestIdleCallback(() => {
                resolve(import('@/components/WeeklyHighlights'));
            }, { timeout: 2000 });
        })
        : import('@/components/WeeklyHighlights')
);

type TabType = 'recommendations' | 'highlights' | 'favorites' | 'history';

interface RecommendationsTabsProps {
    forceVisible?: boolean;
    onVisibilityChange?: (visible: boolean) => void;
}

const RecommendationsPlaceholder = () => (
    <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Загрузка...</Text>
    </View>
);

function FavoritesTab({ favorites, isAuthenticated, router }: { favorites: any[], isAuthenticated: boolean, router: any }) {
    if (!isAuthenticated) {
        return (
            <View style={styles.emptyState}>
                <MaterialIcons name="favorite-border" size={48} color={DESIGN_TOKENS.colors.textMuted} />
                <Text style={styles.emptyTitle}>Войдите, чтобы видеть избранное</Text>
                <Text style={styles.emptyDescription}>
                    Сохраняйте понравившиеся маршруты и возвращайтесь к ним позже
                </Text>
                <Pressable
                    onPress={() => router.push('/login')}
                    style={styles.loginButton}
                >
                    <Text style={styles.loginButtonText}>Войти или зарегистрироваться</Text>
                </Pressable>
            </View>
        );
    }

    if (!favorites || favorites.length === 0) {
        return (
            <View style={styles.emptyState}>
                <MaterialIcons name="favorite-border" size={48} color={DESIGN_TOKENS.colors.textMuted} />
                <Text style={styles.emptyTitle}>Пока нет избранных маршрутов</Text>
                <Text style={styles.emptyDescription}>
                    Добавляйте понравившиеся путешествия в избранное, нажимая на звездочку
                </Text>
            </View>
        );
    }

    return (
        <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favoritesScroll}
        >
            {favorites.map((item) => (
                <Pressable
                    key={`${item.type}-${item.id}`}
                    onPress={() => router.push(item.url)}
                    style={styles.favoriteCard}
                >
                    {item.imageUrl && (
                        <Image 
                            source={{ uri: item.imageUrl }} 
                            style={styles.favoriteImage}
                            resizeMode="cover"
                        />
                    )}
                    <View style={styles.favoriteContent}>
                        <Text style={styles.favoriteTitle} numberOfLines={2}>
                            {item.title}
                        </Text>
                        {(item.country || item.city) && (
                            <Text style={styles.favoriteLocation} numberOfLines={1}>
                                {[item.city, item.country].filter(Boolean).join(', ')}
                            </Text>
                        )}
                    </View>
                </Pressable>
            ))}
        </ScrollView>
    );
}

function RecommendationsTabs({ forceVisible, onVisibilityChange }: RecommendationsTabsProps) {
    // По умолчанию показываем "Подборка месяца"
    const [activeTab, setActiveTab] = useState<TabType>('highlights');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { width } = useWindowDimensions();
    const isMobile = width <= 768;
    const router = useRouter();
    const { favorites, viewHistory } = useFavorites();
    const { isAuthenticated } = useAuth();

    const handleCollapse = useCallback(() => {
        setIsCollapsed(true);
        onVisibilityChange?.(false);
    }, [onVisibilityChange]);

    const handleExpand = useCallback(() => {
        setIsCollapsed(false);
        onVisibilityChange?.(true);
    }, [onVisibilityChange]);

    // ✅ ИСПРАВЛЕНИЕ: Если свернуто - полностью скрываем компонент (не показываем кнопку "Показать рекомендации")
    if (!forceVisible && isCollapsed) {
        return null;
    }

    const tabs = useMemo(() => {
        const tabsList = [
            { id: 'highlights' as TabType, label: 'Подборка месяца', icon: 'auto-awesome' },
            { id: 'recommendations' as TabType, label: 'Рекомендации', icon: 'star' },
            { id: 'favorites' as TabType, label: 'Избранное', icon: 'favorite' },
            { id: 'history' as TabType, label: 'История', icon: 'history' },
        ];
        return tabsList;
    }, []);

    const renderFavorites = useCallback(() => {
        return <FavoritesTab favorites={favorites} isAuthenticated={isAuthenticated} router={router} />;
    }, [favorites, isAuthenticated, router]);

    const renderHistory = useCallback(() => {
        return <HistoryTab viewHistory={viewHistory} isAuthenticated={isAuthenticated} router={router} />;
    }, [viewHistory, isAuthenticated, router]);

    return (
        <View style={styles.container}>
            {/* Заголовок с кнопкой сворачивания */}
            <View style={styles.header}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabsContainer}
                    style={Platform.select({ default: { flex: 1 }, web: {} })}
                >
                    {tabs.map((tab) => (
                        <Pressable
                            key={tab.id}
                            onPress={() => setActiveTab(tab.id)}
                            style={[
                                styles.tab,
                                activeTab === tab.id && styles.tabActive
                            ]}
                        >
                            <MaterialIcons
                                name={tab.icon as any}
                                size={Platform.select({ default: 16, web: 18 })}
                                color={activeTab === tab.id ? DESIGN_TOKENS.colors.text : DESIGN_TOKENS.colors.textMuted}
                            />
                            <Text
                                style={[
                                    styles.tabText,
                                    activeTab === tab.id && styles.tabTextActive
                                ]}
                            >
                                {tab.label}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
                <Pressable onPress={handleCollapse} style={styles.collapseButton}>
                    <Feather name="chevron-up" size={20} color={DESIGN_TOKENS.colors.textMuted} />
                </Pressable>
            </View>

            {/* Контент табов */}
            <View style={styles.content}>
                {activeTab === 'recommendations' && (
                    <Suspense fallback={<RecommendationsPlaceholder />}>
                        <PersonalizedRecommendations 
                            forceVisible={true}
                            onVisibilityChange={() => {}}
                        />
                    </Suspense>
                )}
                
                {activeTab === 'highlights' && (
                    <Suspense fallback={<RecommendationsPlaceholder />}>
                        <WeeklyHighlights 
                            forceVisible={true}
                            onVisibilityChange={() => {}}
                        />
                    </Suspense>
                )}
                
                {activeTab === 'favorites' && renderFavorites()}
                
                {activeTab === 'history' && renderHistory()}
            </View>
        </View>
    );
}

function HistoryTab({ viewHistory, isAuthenticated, router }: { viewHistory: any[], isAuthenticated: boolean, router: any }) {
    if (!isAuthenticated) {
        return (
            <View style={styles.emptyState}>
                <MaterialIcons name="history" size={48} color={DESIGN_TOKENS.colors.textMuted} />
                <Text style={styles.emptyTitle}>Войдите, чтобы видеть историю просмотров</Text>
                <Text style={styles.emptyDescription}>
                    Мы сохраняем историю просмотренных вами путешествий для удобного доступа
                </Text>
                <Pressable
                    onPress={() => router.push('/login')}
                    style={styles.loginButton}
                >
                    <Text style={styles.loginButtonText}>Войти или зарегистрироваться</Text>
                </Pressable>
            </View>
        );
    }

    if (!viewHistory || viewHistory.length === 0) {
        return (
            <View style={styles.emptyState}>
                <MaterialIcons name="history" size={48} color={DESIGN_TOKENS.colors.textMuted} />
                <Text style={styles.emptyTitle}>История просмотров пуста</Text>
                <Text style={styles.emptyDescription}>
                    Начните просматривать путешествия, и они появятся здесь
                </Text>
            </View>
        );
    }

    return (
        <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favoritesScroll}
        >
            {viewHistory.map((item) => (
                <Pressable
                    key={`${item.type}-${item.id}`}
                    onPress={() => router.push(item.url)}
                    style={styles.favoriteCard}
                >
                    {item.imageUrl && (
                        <View style={styles.favoriteImageContainer}>
                            <Image 
                                source={{ uri: item.imageUrl }} 
                                style={styles.favoriteImage}
                                resizeMode="cover"
                            />
                            <View style={styles.historyBadge}>
                                <MaterialIcons name="history" size={14} color={DESIGN_TOKENS.colors.textMuted} />
                            </View>
                        </View>
                    )}
                    {!item.imageUrl && (
                        <View style={[styles.favoriteImage, styles.favoriteImagePlaceholder]}>
                            <MaterialIcons name={item.type === 'travel' ? 'route' : 'article'} size={24} color={DESIGN_TOKENS.colors.textMuted} />
                            <View style={[styles.historyBadge, { position: 'absolute', top: 8, right: 8 }]}>
                                <MaterialIcons name="history" size={14} color={DESIGN_TOKENS.colors.textMuted} />
                            </View>
                        </View>
                    )}
                    <View style={styles.favoriteContent}>
                        <Text style={styles.favoriteTitle} numberOfLines={2}>
                            {item.title}
                        </Text>
                        {(item.country || item.city) && (
                            <Text style={styles.favoriteLocation} numberOfLines={1}>
                                {[item.city, item.country].filter(Boolean).join(', ')}
                            </Text>
                        )}
                    </View>
                </Pressable>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Platform.select({ default: 16, web: 24 }),
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
        overflow: 'hidden',
        shadowColor: '#1f1f1f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
        ...Platform.select({
            web: {
                boxShadow: DESIGN_TOKENS.shadows.medium,
            },
        }),
        // ✅ ИСПРАВЛЕНИЕ: Убираем фиксированное позиционирование, чтобы блок скроллился с основной страницей
        position: 'relative',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Platform.select({ default: 12, web: 16 }),
        paddingVertical: Platform.select({ default: 10, web: 12 }),
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется отступ для разделения
        marginBottom: 4,
    },
    tabsContainer: {
        flexDirection: 'row',
        gap: Platform.select({ default: 4, web: 8 }),
        alignItems: 'center',
        ...Platform.select({
            web: {
                flex: 1,
            },
        }),
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Platform.select({ default: 4, web: 6 }),
        paddingHorizontal: Platform.select({ default: 12, web: 14 }),
        paddingVertical: Platform.select({ default: 8, web: 10 }),
        borderRadius: DESIGN_TOKENS.radii.sm,
        minHeight: 44,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                // @ts-ignore
                ':hover': {
                    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
                },
            },
        }),
    },
    tabActive: {
        backgroundColor: DESIGN_TOKENS.colors.primaryLight,
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон и тень
        ...Platform.select({
            web: {
                boxShadow: `0 2px 4px rgba(93, 140, 124, 0.15)`,
            },
        }),
    },
    tabText: {
        fontSize: Platform.select({ default: 13, web: 14 }),
        fontWeight: '500',
        color: DESIGN_TOKENS.colors.textMuted,
    },
    tabTextActive: {
        color: DESIGN_TOKENS.colors.primary,
        fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
    },
    collapseButton: {
        padding: 8,
        ...Platform.select({
            web: {
                cursor: 'pointer',
            },
        }),
    },
    content: {
        minHeight: 200,
    },
    placeholder: {
        padding: 40,
        alignItems: 'center',
    },
    placeholderText: {
        color: DESIGN_TOKENS.colors.textMuted,
        fontSize: 14,
    },
    collapsedContainer: {
        marginBottom: Platform.select({ default: 16, web: 24 }),
        padding: Platform.select({ default: 12, web: 16 }),
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 0.5, // Более тонкая граница
        borderColor: 'rgba(0, 0, 0, 0.06)', // Более светлая граница
    },
    expandButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...Platform.select({
            web: {
                cursor: 'pointer',
            },
        }),
    },
    expandText: {
        fontSize: Platform.select({ default: 13, web: 14 }),
        fontWeight: '500',
        color: DESIGN_TOKENS.colors.text, // Нейтральный цвет вместо яркого primary
    },
    emptyState: {
        padding: Platform.select({ default: 32, web: 40 }),
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        fontSize: Platform.select({ default: 15, web: 16 }),
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.text,
        marginTop: Platform.select({ default: 12, web: 16 }),
        marginBottom: Platform.select({ default: 6, web: 8 }),
    },
    emptyDescription: {
        fontSize: Platform.select({ default: 13, web: 14 }),
        color: DESIGN_TOKENS.colors.textMuted,
        textAlign: 'center',
        marginBottom: Platform.select({ default: 20, web: 24 }),
        paddingHorizontal: Platform.select({ default: 16, web: 0 }),
    },
    loginButton: {
        paddingHorizontal: Platform.select({ default: 20, web: 24 }),
        paddingVertical: Platform.select({ default: 10, web: 12 }),
        backgroundColor: DESIGN_TOKENS.colors.primary,
        borderRadius: DESIGN_TOKENS.radii.md,
        shadowColor: '#1f1f1f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 3,
        minHeight: 44,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: DESIGN_TOKENS.shadows.medium,
                // @ts-ignore
                ':hover': {
                    backgroundColor: DESIGN_TOKENS.colors.primaryDark,
                    transform: 'translateY(-2px)',
                    boxShadow: DESIGN_TOKENS.shadows.hover,
                },
                ':active': {
                    transform: 'translateY(0)',
                },
            },
        }),
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    favoritesScroll: {
        padding: Platform.select({ default: 12, web: 16 }),
        gap: Platform.select({ default: 10, web: 12 }),
    },
    favoriteCard: {
        width: Platform.select({
            default: 240, // Уже для мобильных
            web: 280,
        }),
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        overflow: 'hidden',
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
        shadowColor: '#1f1f1f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: DESIGN_TOKENS.shadows.medium,
                // @ts-ignore
                ':hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: DESIGN_TOKENS.shadows.hover,
                },
            },
        }),
    },
    favoriteImageContainer: {
        position: 'relative',
        width: '100%',
        height: 160,
    },
    favoriteImage: {
        width: '100%',
        height: Platform.select({ default: 140, web: 160 }),
        backgroundColor: 'rgba(0, 0, 0, 0.04)', // Более светлый placeholder
    },
    favoriteImagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.04)', // Более светлый placeholder
    },
    historyBadge: {
        position: 'absolute',
        top: Platform.select({ default: 6, web: 8 }),
        right: Platform.select({ default: 6, web: 8 }),
        backgroundColor: 'rgba(255, 255, 255, 0.9)', // Более прозрачный
        borderRadius: 8, // Меньше радиус для прозаичности
        padding: Platform.select({ default: 4, web: 6 }),
        borderWidth: 0.5, // Более тонкая граница
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    favoriteContent: {
        padding: Platform.select({ default: 10, web: 12 }),
    },
    favoriteTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: 4,
    },
    favoriteLocation: {
        fontSize: 12,
        color: DESIGN_TOKENS.colors.textMuted,
    },
});

export default RecommendationsTabs;
