import { useMemo, memo, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useFavorites } from '@/context/FavoritesContext';
import { useRecommendedTravels } from '@/hooks/useRecommendedTravels';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { METRICS } from '@/constants/layout';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import Button from '@/components/ui/Button';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';
import { useVisibleCardCount } from '@/hooks/useVisibleCardCount';
import { translate as i18nT } from '@/i18n'


const COLLAPSED_KEY = 'personalization_collapsed';
const PREVIEW_CARD_WIDTH = 208;
const PREVIEW_CARD_GAP = 12;

interface PersonalizedRecommendationsProps {
    forceVisible?: boolean;
    onVisibilityChange?: (visible: boolean) => void;
    showHeader?: boolean;
    onlyRecommendations?: boolean;
}

function PersonalizedRecommendations({ forceVisible, onVisibilityChange, showHeader = true, onlyRecommendations = false }: PersonalizedRecommendationsProps) {
    const { favorites, viewHistory } = useFavorites();
    const recommended = useRecommendedTravels();
    const { isAuthenticated } = useAuth();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < METRICS.breakpoints.tablet;
    const isMobileWeb = Platform.OS === 'web' && isMobile;
    const colors = useThemedColors(); // ✅ МИГРАЦИЯ: Добавлен useThemedColors

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    // ✅ МИГРАЦИЯ: Мемоизация стилей
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Проверяем состояние сворачивания при монтировании
    useEffect(() => {
        let cancelled = false;
        const checkCollapsed = async () => {
            if (Platform.OS === 'web') {
                const collapsed = sessionStorage.getItem(COLLAPSED_KEY) === 'true';
                if (!cancelled) {
                    setIsCollapsed(collapsed);
                    setIsInitialized(true);
                }
            } else {
                const collapsed = await AsyncStorage.getItem(COLLAPSED_KEY);
                if (!cancelled) {
                    setIsCollapsed(collapsed === 'true');
                    setIsInitialized(true);
                }
            }
        };
        checkCollapsed();
        return () => {
            cancelled = true;
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

    // O(1) lookup set instead of O(n*m) some() scan
    const favoriteKeys = useMemo(
        () => new Set(favorites.map((f) => `${f.type}-${f.id}`)),
        [favorites],
    );

    // ✅ ИСПРАВЛЕНИЕ: Показываем только алгоритмические рекомендации (не дублируем избранное и историю)
    const recommendations = useMemo(() => {
        if (!isAuthenticated) return [];
        const raw = Array.isArray(recommended) ? recommended : [];
        if (onlyRecommendations) {
            return raw;
        }
        // recommended возвращает избранное, отсортированное по дате
        // Здесь исключаем элементы, которые уже отображаются в «Избранном», чтобы не дублировать карточки
        return raw.filter((item) => !favoriteKeys.has(`${item.type}-${item.id}`));
    }, [favoriteKeys, isAuthenticated, recommended, onlyRecommendations]);

    const containerStyles = useMemo(() => [
        styles.container,
        !showHeader && styles.containerCompact,
    ], [styles.container, styles.containerCompact, showHeader]);

    // ВАЖНО: все хуки должны быть вызваны до условных возвратов
    const handleItemPress = useCallback((url: string) => {
        router.push(url as any);
    }, [router]);

    const handleLoginPress = useCallback(() => {
        router.push(buildLoginHref({ intent: 'recommendations' }) as any);
    }, [router]);

    const favoritesPreview = useVisibleCardCount({
        itemCount: favorites.length,
        itemWidth: PREVIEW_CARD_WIDTH,
        gap: PREVIEW_CARD_GAP,
        max: 8,
    });
    const historyPreview = useVisibleCardCount({
        itemCount: viewHistory.length,
        itemWidth: PREVIEW_CARD_WIDTH,
        gap: PREVIEW_CARD_GAP,
        max: 8,
    });
    const recommendationsPreview = useVisibleCardCount({
        itemCount: recommendations.length,
        itemWidth: PREVIEW_CARD_WIDTH,
        gap: PREVIEW_CARD_GAP,
        max: 8,
    });

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
                layout={isMobile ? 'grid' : 'horizontal'}
            />
        );
    }, [handleItemPress, isMobile]);

    const hasFavorites = !onlyRecommendations && favorites && favorites.length > 0;
    const hasHistory = !onlyRecommendations && viewHistory && viewHistory.length > 0;
    const renderSectionTitle = useCallback((title: string, href?: string | null, label = i18nT('travel:components.travel.PersonalizedRecommendations.smotret_vse_bf757be0')) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {href ? (
                <Pressable
                    onPress={() => router.push(href as any)}
                    style={styles.sectionLink}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                >
                    <Text style={styles.sectionLinkText}>{label}</Text>
                    <Feather name="arrow-right" size={14} color={colors.primaryDark} />
                </Pressable>
            ) : null}
        </View>
    ), [colors.primaryDark, router, styles.sectionHeader, styles.sectionLink, styles.sectionLinkText, styles.sectionTitle]);

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
                        <Feather name="chevron-down" size={20} color={colors.primaryDark} />
                        <Text style={styles.expandButtonText}>{i18nT('travel:components.travel.PersonalizedRecommendations.personalizatsiya_8f1a3bac')}</Text>
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
                            <View style={[styles.iconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                                <Feather name="star" size={24} color={colors.primaryDark} />
                            </View>
                            <View style={styles.titleContainer}>
                                <Text style={styles.title}>{i18nT('travel:components.travel.PersonalizedRecommendations.rekomendatsii_dlya_vas_9f2c924b')}</Text>
                            </View>
                            {/* ✅ ИСПРАВЛЕНИЕ: Убрана кнопка сворачивания, так как она уже есть в RecommendationsTabs */}
                        </View>
                        <Text style={styles.subtitle}>{i18nT('travel:components.travel.PersonalizedRecommendations.personalnye_rekomendatsii_na_osnove_vashih_i_a4a59741')}</Text>
                    </>
                )}
                    <View style={[styles.promptCard, isMobile ? styles.promptCardMobile : styles.promptCardDesktop]}>
                        <View style={styles.promptLead}>
                            <View style={styles.promptIcon}>
                                <Feather name="log-in" size={28} color={colors.primaryDark} />
                            </View>
                            <View style={styles.promptCopy}>
                                <Text style={[styles.promptText, !isMobile && styles.promptTextDesktop]}>
                                    {i18nT('travel:components.travel.PersonalizedRecommendations.voydite_chtoby_poluchat_personalnye_rekomend_55bff68d')}</Text>
                            </View>
                        </View>
                        <Button
                            variant="outline"
                            onPress={handleLoginPress}
                            label={i18nT('travel:components.travel.PersonalizedRecommendations.voyti_ili_zaregistrirovatsya_6e6efcab')}
                            icon={<Feather name="arrow-right" size={18} color={colors.primaryDark} />}
                            iconPosition="right"
                            labelStyle={styles.loginButtonText}
                            style={[styles.loginButton, !isMobile && styles.loginButtonInline]}
                        />
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
                            <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
                                <Feather name="star" size={24} color={colors.primaryDark} />
                            </View>
                            <View style={styles.titleContainer}>
                                <Text style={styles.title}>{i18nT('travel:components.travel.PersonalizedRecommendations.rekomendatsii_dlya_vas_9f2c924b')}</Text>
                            </View>
                            {/* ✅ ИСПРАВЛЕНИЕ: Убрана кнопка сворачивания, так как она уже есть в RecommendationsTabs */}
                        </View>
                        <Text style={styles.subtitle}>{i18nT('travel:components.travel.PersonalizedRecommendations.rekomendatsii_na_osnove_vashih_interesov_42542e30')}</Text>
                    </>
                )}
                <View style={[styles.emptyCard, isMobile ? styles.promptCardMobile : styles.promptCardDesktop]}>
                    <View style={styles.promptLead}>
                        <View style={styles.promptIcon}>
                            <Feather name="compass" size={28} color={colors.textMuted} />
                        </View>
                        <View style={styles.promptCopy}>
                            <Text style={[styles.emptyText, !isMobile && styles.promptTextDesktop]}>
                                {i18nT('travel:components.travel.PersonalizedRecommendations.nachnite_prosmatrivat_puteshestviya_i_dobavl_9c7e1a3e')}</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={containerStyles} testID="personalized-recommendations-section">
            {showHeader && (
                <>
                    <View style={styles.header}>
                        <View style={[styles.iconContainer, { backgroundColor: colors.primarySoft }]}>
                            <Feather name="star" size={24} color={colors.primaryDark} />
                        </View>
                        <View style={styles.titleContainer}>
                            <Text style={styles.title}>{i18nT('travel:components.travel.PersonalizedRecommendations.rekomendatsii_dlya_vas_9f2c924b')}</Text>
                        </View>
                        {/* ✅ ИСПРАВЛЕНИЕ: Убрана кнопка сворачивания, так как она уже есть в RecommendationsTabs */}
                    </View>
                    <Text style={styles.subtitle}>{i18nT('travel:components.travel.PersonalizedRecommendations.rekomendatsii_na_osnove_vashih_interesov_42542e30')}</Text>
                </>
            )}

            {hasFavorites && (
                <View style={styles.section} testID="personalized-favorites-section">
                    {renderSectionTitle(i18nT('travel:components.travel.PersonalizedRecommendations.hochu_poehat_465ffbdd'), '/favorites', i18nT('travel:components.travel.PersonalizedRecommendations.smotret_vse_hochu_poehat_dc779511'))}
                    {isMobileWeb ? (
                        <View style={styles.mobileWebStack} testID="personalized-favorites-stack">
                            {favorites.slice(0, 2).map(item => (
                                <View key={`${(item as any).type}-${item.id}`} style={styles.mobileWebStackItem}>
                                    {renderItem(item as any)}
                                </View>
                            ))}
                        </View>
                    ) : (
                        Platform.OS === 'web' ? (
                        <View
                            testID="personalized-favorites-rail"
                            style={styles.previewRow}
                            onLayout={favoritesPreview.onLayout}
                        >
                            {favorites.slice(0, favoritesPreview.visibleCount).map(item => renderItem(item as any))}
                        </View>
                        ) : (
                            <ScrollView
                                testID="personalized-favorites-rail"
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                nestedScrollEnabled
                                scrollEnabled={true}
                                style={styles.webHorizontalScroll}
                                contentContainerStyle={styles.scrollContent}
                                removeClippedSubviews
                                decelerationRate="fast"
                            >
                                {favorites.map(item => renderItem(item as any))}
                            </ScrollView>
                        )
                    )}
                </View>
            )}

            {hasHistory && (
                <View style={styles.section} testID="personalized-history-section">
                    {renderSectionTitle(i18nT('travel:components.travel.PersonalizedRecommendations.nedavno_prosmotreno_d89351d9'), '/history', i18nT('travel:components.travel.PersonalizedRecommendations.smotret_vsyu_istoriyu_224342eb'))}
                    {isMobileWeb ? (
                        <View style={styles.mobileWebStack} testID="personalized-history-stack">
                            {viewHistory.slice(0, 2).map(item => (
                                <View key={`${(item as any).type}-${item.id}-${(item as any).viewedAt ?? ''}`} style={styles.mobileWebStackItem}>
                                    {renderItem(item as any)}
                                </View>
                            ))}
                        </View>
                    ) : (
                        Platform.OS === 'web' ? (
                        <View
                            testID="personalized-history-rail"
                            style={styles.previewRow}
                            onLayout={historyPreview.onLayout}
                        >
                            {viewHistory.slice(0, historyPreview.visibleCount).map(item => renderItem(item as any))}
                        </View>
                        ) : (
                            <ScrollView
                                testID="personalized-history-rail"
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                nestedScrollEnabled
                                scrollEnabled={true}
                                style={styles.webHorizontalScroll}
                                contentContainerStyle={styles.scrollContent}
                                removeClippedSubviews
                                decelerationRate="fast"
                            >
                                {viewHistory.map(item => renderItem(item as any))}
                            </ScrollView>
                        )
                    )}
                </View>
            )}

            {recommendations.length > 0 && (
                <View style={styles.section} testID="personalized-recommendations-list-section">
                    {renderSectionTitle(i18nT('travel:components.travel.PersonalizedRecommendations.rekomendatsii_44105f7c'), null)}
                    {isMobileWeb ? (
                        <View style={styles.mobileWebStack} testID="personalized-recommendations-stack">
                            {recommendations.slice(0, 2).map(item => (
                                <View key={`${item.type}-${item.id}`} style={styles.mobileWebStackItem}>
                                    {renderItem(item)}
                                </View>
                            ))}
                        </View>
                    ) : (
                        Platform.OS === 'web' ? (
                        <View
                            testID="personalized-recommendations-rail"
                            style={styles.previewRow}
                            onLayout={recommendationsPreview.onLayout}
                        >
                            {recommendations.slice(0, recommendationsPreview.visibleCount).map(item => renderItem(item))}
                        </View>
                        ) : (
                            <ScrollView
                                testID="personalized-recommendations-rail"
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                nestedScrollEnabled
                                scrollEnabled={true}
                                style={styles.webHorizontalScroll}
                                contentContainerStyle={styles.scrollContent}
                                removeClippedSubviews
                                decelerationRate="fast"
                            >
                                {recommendations.map(item => renderItem(item))}
                            </ScrollView>
                        )
                    )}
                </View>
            )}
        </View>
    );
}

// ✅ МИГРАЦИЯ: Вынесена функция создания стилей с динамическими цветами
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: {
        marginVertical: 8,
        padding: 12,
        backgroundColor: 'transparent',
        borderRadius: 12,
        borderWidth: 0,
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
        backgroundColor: colors.primaryLight,
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
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        letterSpacing: -0.1,
    },
    subtitle: {
        fontSize: 13,
        color: colors.textMuted,
        marginLeft: 0,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 8,
    },
    sectionLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: DESIGN_TOKENS.radii.sm,
        ...Platform.select({
            web: {
                cursor: 'pointer',
            } as any,
            default: {},
        }),
    },
    sectionLinkText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.primaryText,
    },
    // Зазор задаёт рельса, как в WeeklyHighlights: у TabTravelCard нет внешних отступов
    // (обёртка UnifiedTravelCard с фиксированной width гасит margin).
    previewRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: PREVIEW_CARD_GAP,
        paddingHorizontal: 4,
        paddingVertical: 4,
        overflow: 'hidden',
    },
    countBadge: {
        backgroundColor: colors.dangerLight,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        minWidth: 32,
        alignItems: 'center',
    },
    count: {
        fontSize: 14,
        color: colors.danger,
        fontWeight: '700',
    },
    scrollContent: {
        paddingHorizontal: 4,
        paddingVertical: 4,
        gap: 12,
        ...(Platform.OS === 'web' ? ({ minWidth: 'max-content' } as any) : {}),
    },
    webHorizontalScroll: {
        ...Platform.select({
            web: {
                overflowX: 'auto',
                overflowY: 'hidden',
                overscrollBehaviorX: 'contain',
                width: '100%',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-x',
            } as any,
            default: {},
        }),
    },
    mobileWebStack: {
        gap: 12,
        paddingHorizontal: 4,
        paddingVertical: 4,
    },
    mobileWebStackItem: {
        width: '100%',
        minWidth: 0,
    },
    item: {
        width: 168,
        backgroundColor: colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        marginRight: 12,
        transform: [{ scale: 1 }],
    },
    itemMobile: {
        width: 140,
    },
    itemImage: {
        width: '100%',
        height: 96,
        backgroundColor: colors.backgroundSecondary,
    },
    itemImagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.mutedBackground,
    },
    itemContent: {
        padding: 10,
        backgroundColor: colors.surface,
    },
    itemTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 6,
        lineHeight: 18,
        letterSpacing: -0.1,
    },
    itemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.backgroundSecondary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    itemMetaText: {
        fontSize: 12,
        color: colors.primaryText,
        fontWeight: '600',
    },
    historyBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 6,
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
        borderWidth: 1,
        borderColor: colors.border,
        ...Platform.select({
            web: {
                boxShadow: DESIGN_TOKENS.shadows.light,
            },
        }),
    },
    promptCard: {
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.borderAccent,
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
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    promptText: {
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'left',
        lineHeight: 20,
        fontWeight: '500',
    },
    promptTextDesktop: {
        maxWidth: 520,
    },
    loginButton: {
        alignSelf: 'flex-start',
        marginTop: 12,
    },
    loginButtonInline: {
        marginLeft: 16,
        marginTop: 0,
    },
    loginButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primaryText,
        letterSpacing: -0.2,
    },
    emptyCard: {
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    emptyText: {
        fontSize: 14,
        color: colors.textMuted,
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
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.borderLight,
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
        color: colors.primaryText,
        marginLeft: 6,
    },
});

export default memo(PersonalizedRecommendations);
