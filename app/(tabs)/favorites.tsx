import { useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, Platform, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import EmptyState from '@/components/ui/EmptyState';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { confirmAction } from '@/utils/confirmAction';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useResponsive } from '@/hooks/useResponsive';
import { calculateColumns } from '@/components/listTravel/utils/listTravelHelpers';
import { BREAKPOINTS } from '@/components/listTravel/utils/listTravelConstants';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { useIsFocused } from '@react-navigation/native';

export default function FavoritesScreen() {
    const router = useRouter();
    const isFocused = useIsFocused();
    const canonical = buildCanonicalUrl('/favorites');
    const { width } = useResponsive();
    const { isAuthenticated, authReady } = useAuth();
    const { favorites, removeFavorite, clearFavorites } = useFavorites() as any;
    const colors = useThemedColors();
    const [isLoading, setIsLoading] = useState(true);

    const handleBackToProfile = useCallback(() => {
        router.push('/profile' as any);
    }, [router]);

    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 8,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 12,
        },
        headerTitleBlock: {
            flex: 1,
        },
        title: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
        },
        subtitle: {
            marginTop: 4,
            fontSize: 13,
            color: colors.textMuted,
        },
        clearButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: DESIGN_TOKENS.radii.md,
            borderWidth: 1,
            borderColor: colors.danger,
            backgroundColor: colors.surface,
            minHeight: 40,
        },
        clearButtonText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.danger,
        },
        backToProfileButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: DESIGN_TOKENS.radii.md,
            borderWidth: 1,
            borderColor: colors.borderLight,
            backgroundColor: colors.surface,
            minHeight: 40,
        },
        backToProfileButtonText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.primary,
        },
        listContent: {
            paddingHorizontal: 16,
            paddingBottom: 24,
            paddingTop: 12,
        },
        cardsGrid: {
            width: '100%',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
        },
        gridItem: {
            position: 'relative',
        },
        card: {
            width: '100%',
            marginRight: 0,
        },
        cardWrap: {
            marginBottom: 14,
        },
        removeButton: {
            position: 'absolute',
            top: 10,
            left: 10,
            width: 32,
            height: 32,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.danger,
            borderWidth: 1,
            borderColor: colors.borderLight,
        },
    }), [colors]);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 300);
        return () => clearTimeout(timer);
    }, [favorites]);

    const handleClearAll = useCallback(async () => {
        try {
            if (!clearFavorites) return;

            const confirmed = await confirmAction({
                title: 'Очистить избранное',
                message: 'Очистить избранное?',
                confirmText: 'Очистить',
                cancelText: 'Отмена',
            });
            if (!confirmed) return;

            await clearFavorites();
        } catch (error) {
            console.error('Error clearing favorites:', error);
        }
    }, [clearFavorites]);

    const handleOpen = useCallback(
        (url: string) => {
            router.push(url as any);
        },
        [router]
    );

    // Функция для очистки заголовка от информации о стране
    const cleanTitle = useCallback((title: string, country: string | null) => {
        if (!country || !title) return title;
        
        // Удаляем страну из заголовка
        const countryPatterns = [
            `в ${country}`,
            `в ${country.toLowerCase()}`,
            `${country}`,
            `${country.toLowerCase()}`,
        ];
        
        let cleanedTitle = title;
        countryPatterns.forEach(pattern => {
            cleanedTitle = cleanedTitle.replace(pattern, '').trim();
        });
        
        // Удаляем лишние пробелы и знаки препинания в конце
        cleanedTitle = cleanedTitle.replace(/\s*[,.\-:]\s*$/, '').trim();
        
        return cleanedTitle || title; // Возвращаем оригинал если что-то пошло не так
    }, []);

    const { isPhone, isLargePhone, isTablet: isTabletSize, isDesktop: isDesktopSize, isPortrait } = useResponsive();
    const isMobileDevice = isPhone || isLargePhone || (isTabletSize && isPortrait);
    const isCardsSingleColumn = (width || 0) < BREAKPOINTS.MOBILE;

    const gapSize = (width || 0) < BREAKPOINTS.XS ? 6
        : (width || 0) < BREAKPOINTS.SM ? 8
        : (width || 0) < BREAKPOINTS.MOBILE ? 10
        : (width || 0) < BREAKPOINTS.TABLET ? 12
        : (width || 0) < BREAKPOINTS.DESKTOP ? 14
        : 16;

    const numColumns = (() => {
        if (isCardsSingleColumn) return 1;
        const effectiveWidth = isDesktopSize ? (width || 0) - 0 : (width || 0);
        if (isMobileDevice) return calculateColumns(width || 0, isPortrait ? 'portrait' : 'landscape');
        if (!isTabletSize || !isPortrait) return calculateColumns(effectiveWidth, 'landscape');
        return calculateColumns(effectiveWidth, 'portrait');
    })();

    const data = useMemo(() => (Array.isArray(favorites) ? favorites : []), [favorites]);

    if (!authReady) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.listContent}>
                    {Array.from({ length: 3 }).map((_, index) => (
                        <View key={index} style={styles.cardWrap}>
                            <SkeletonLoader width="100%" height={280} borderRadius={12} style={styles.card} />
                        </View>
                    ))}
                </View>
            </SafeAreaView>
        );
    }

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.container}>
                <EmptyState
                    icon="heart"
                    title="Войдите в аккаунт"
                    description="Войдите, чтобы сохранять избранное и синхронизировать его между устройствами."
                    action={{
                        label: 'Войти',
                        onPress: () => router.push(buildLoginHref({ redirect: '/favorites', intent: 'favorites' }) as any),
                    }}
                />
            </SafeAreaView>
        );
    }

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <View style={styles.headerTitleBlock}>
                            <Text style={styles.title}>Избранное</Text>
                            <Text style={styles.subtitle}>Профиль</Text>
                        </View>
                        <Pressable
                            style={[styles.backToProfileButton, globalFocusStyles.focusable]}
                            onPress={handleBackToProfile}
                            accessibilityRole="button"
                            accessibilityLabel="Перейти в профиль"
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <Feather name="user" size={16} color={colors.primary} />
                            <Text style={styles.backToProfileButtonText}>В профиль</Text>
                        </Pressable>
                    </View>
                </View>
                <View style={styles.listContent}>
                    {Array.from({ length: 3 }).map((_, index) => (
                        <View key={index} style={styles.cardWrap}>
                            <SkeletonLoader width="100%" height={280} borderRadius={12} style={styles.card} />
                        </View>
                    ))}
                </View>
            </SafeAreaView>
        );
    }

    if (data.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <EmptyState
                    icon="heart"
                    title="Сохраняй маршруты, чтобы вернуться к ним позже"
                    description="Нажми на сердечко на карточке маршрута, чтобы добавить его в избранное."
                    variant="empty"
                    action={{
                        label: 'Найти маршруты',
                        onPress: () => router.push('/search'),
                    }}
                    secondaryAction={{
                        label: 'Популярные маршруты',
                        onPress: () => router.push('/travelsby'),
                    }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {isFocused && (
                <InstantSEO
                    headKey="favorites"
                    title="Избранное | Metravel"
                    description="Ваши избранные путешествия"
                    canonical={canonical}
                    robots="noindex, nofollow"
                />
            )}
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <View style={styles.headerTitleBlock}>
                        <Text style={styles.title}>Избранное</Text>
                        <Text style={styles.subtitle}>Профиль</Text>
                    </View>

                    <Pressable
                        style={[styles.backToProfileButton, globalFocusStyles.focusable]}
                        onPress={handleBackToProfile}
                        accessibilityRole="button"
                        accessibilityLabel="Перейти в профиль"
                        {...Platform.select({ web: { cursor: 'pointer' } })}
                    >
                        <Feather name="user" size={16} color={colors.primary} />
                        <Text style={styles.backToProfileButtonText}>В профиль</Text>
                    </Pressable>

                    {typeof clearFavorites === 'function' && data.length > 0 && (
                        <Pressable
                            style={[styles.clearButton, globalFocusStyles.focusable]}
                            onPress={handleClearAll}
                            accessibilityRole="button"
                            accessibilityLabel="Очистить избранное"
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <Feather name="trash-2" size={16} color={colors.danger} />
                            <Text style={styles.clearButtonText}>Очистить</Text>
                        </Pressable>
                    )}
                </View>
            </View>

            {Platform.OS === 'web' ? (
                <ScrollView
                    contentContainerStyle={styles.listContent}
                >
                    <View style={[styles.cardsGrid, { gap: gapSize, rowGap: gapSize, columnGap: gapSize }]}>
                        {data.map((item: any) => {
                            const cols = Math.max(1, numColumns);
                            const calcWidth = cols > 1
                                ? `calc((100% - ${(cols - 1) * gapSize}px) / ${cols})`
                                : '100%';

                            return (
                            <View
                                key={`${item.type || 'travel'}-${item.id}`}
                                style={[
                                    styles.gridItem,
                                    isCardsSingleColumn
                                        ? { flex: 1, width: '100%', maxWidth: '100%', minWidth: 0, flexBasis: '100%' as any }
                                        : { flexGrow: 0, flexShrink: 0, flexBasis: calcWidth as any, width: calcWidth as any, maxWidth: calcWidth as any, minWidth: 0 },
                                ]}
                            >
                                <TabTravelCard
                                    item={{
                                        id: item.id,
                                        title: cleanTitle(item.title, item.country ?? item.countryName),
                                        imageUrl: item.imageUrl,
                                        city: item.city ?? null,
                                        country: item.country ?? item.countryName ?? null,
                                    }}
                                    badge={{
                                        icon: 'heart',
                                        backgroundColor: colors.danger,
                                        iconColor: colors.textOnDark,
                                    }}
                                    onPress={() => handleOpen(item.url)}
                                    layout="grid"
                                    style={styles.card}
                                />

                                <Pressable
                                    style={[styles.removeButton, globalFocusStyles.focusable]}
                                    onPress={() => removeFavorite?.(item.id, item.type)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Удалить из избранного"
                                    {...Platform.select({ web: { cursor: 'pointer' } })}
                                >
                                    <Feather name="trash-2" size={16} color={colors.textOnPrimary} />
                                </Pressable>
                            </View>
                            );
                        })}
                    </View>
                </ScrollView>
            ) : (
                <FlashList
                    data={data}
                    keyExtractor={(item: any) => `${item.type || 'travel'}-${item.id}`}
                    numColumns={numColumns}
                    key={numColumns}
                    contentContainerStyle={styles.listContent}
                    drawDistance={500}
                    renderItem={({ item, index }: { item: any; index: number }) => {
                        const columnIndex = numColumns > 0 ? index % numColumns : 0;
                        const isFirstColumn = numColumns <= 1 || columnIndex === 0;
                        const isLastColumn = numColumns <= 1 || columnIndex === numColumns - 1;
                        const paddingLeft = numColumns > 1 ? (isFirstColumn ? 0 : gapSize / 2) : 0;
                        const paddingRight = numColumns > 1 ? (isLastColumn ? 0 : gapSize / 2) : 0;

                        return (
                        <View style={[styles.gridItem, { flex: 1, paddingLeft, paddingRight, paddingBottom: gapSize }]}>
                            <TabTravelCard
                                item={{
                                    id: item.id,
                                    title: cleanTitle(item.title, item.country ?? item.countryName),
                                    imageUrl: item.imageUrl,
                                    city: item.city ?? null,
                                    country: item.country ?? item.countryName ?? null,
                                }}
                                badge={{
                                    icon: 'heart',
                                    backgroundColor: colors.danger,
                                    iconColor: colors.textOnDark,
                                }}
                                onPress={() => handleOpen(item.url)}
                                layout="grid"
                                style={styles.card}
                            />

                            <Pressable
                                style={[styles.removeButton, globalFocusStyles.focusable]}
                                onPress={() => removeFavorite?.(item.id, item.type)}
                                accessibilityRole="button"
                                accessibilityLabel="Удалить из избранного"
                                {...Platform.select({ web: { cursor: 'pointer' } })}
                            >
                                <Feather name="trash-2" size={16} color={colors.textOnPrimary} />
                            </Pressable>
                        </View>
                        );
                    }}
                />
            )}
        </SafeAreaView>
    );
}
