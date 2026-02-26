import { useCallback, useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import EmptyState from '@/components/ui/EmptyState';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { confirmAction } from '@/utils/confirmAction';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { useIsFocused } from '@react-navigation/native';
import { cleanTravelTitle } from '@/utils/cleanTravelTitle';
import ProfileCollectionHeader from '@/components/profile/ProfileCollectionHeader';

export default function HistoryScreen() {
    const router = useRouter();
    const isFocused = useIsFocused();
    const { width } = useResponsive();
    const { isAuthenticated, authReady } = useAuth();
    const { viewHistory, clearHistory } = useFavorites() as any;
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
        gridContent: {
            paddingHorizontal: 16,
            paddingBottom: 24,
            paddingTop: 6,
        },
        gridRow: {
            justifyContent: 'flex-start',
            gap: 14,
            paddingTop: 12,
        },
        gridItem: {
            flex: 1,
            paddingTop: 12,
        },
        card: {
            marginRight: 0,
            width: '100%',
            minWidth: 320,
            maxWidth: 360,
            alignSelf: 'center',
        },
    }), [colors]);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 300);
        return () => clearTimeout(timer);
    }, [viewHistory]);

    const horizontalPadding = 16;
    const columnGap = 14;
    const minCardWidth = 320;
    const availableWidth = Math.max(0, (width || 0) - horizontalPadding * 2);
    const computedColumns = Math.max(1, Math.floor((availableWidth + columnGap) / (minCardWidth + columnGap)));
    const numColumns = Math.min(computedColumns, 3);

    const handleOpen = useCallback(
        (url: string) => {
            router.push(url as any);
        },
        [router]
    );

    const handleClear = useCallback(async () => {
        if (!clearHistory) return;

        const confirmed = await confirmAction({
            title: 'Очистить историю',
            message: 'Очистить историю просмотров?',
            confirmText: 'Очистить',
            cancelText: 'Отмена',
        });
        if (!confirmed) return;

        await clearHistory();
    }, [clearHistory]);

    const data = useMemo(() => (Array.isArray(viewHistory) ? viewHistory : []), [viewHistory]);

    if (!authReady) {
        return (
            <SafeAreaView style={styles.container}>
                <ProfileCollectionHeader title="История" onBackPress={handleBackToProfile} />
                <View style={styles.gridContent}>
                    {Array.from({ length: numColumns > 1 ? numColumns * 2 : 3 }).map((_, index) => (
                        <View key={index} style={styles.gridItem}>
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
                    icon="clock"
                    title="Войдите в аккаунт"
                    description="Войдите, чтобы сохранять историю просмотров и синхронизировать её между устройствами."
                    action={{
                        label: 'Войти',
                        onPress: () => router.push(buildLoginHref({ redirect: '/history', intent: 'history' }) as any),
                    }}
                />
            </SafeAreaView>
        );
    }

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <ProfileCollectionHeader title="История" onBackPress={handleBackToProfile} />
                <View style={styles.gridContent}>
                    {Array.from({ length: numColumns > 1 ? numColumns * 2 : 3 }).map((_, index) => (
                        <View key={index} style={styles.gridItem}>
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
                    icon="clock"
                    title="Ты ещё не открывал маршруты"
                    description="Открой любой маршрут — он автоматически сохранится в истории просмотров."
                    variant="empty"
                    action={{
                        label: 'Начать исследовать',
                        onPress: () => router.push('/search'),
                    }}
                    secondaryAction={{
                        label: 'Случайный маршрут',
                        onPress: () => router.push('/roulette'),
                    }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {isFocused && (
                <InstantSEO
                    headKey="history"
                    title="История просмотров | Metravel"
                    description="История просмотренных путешествий"
                    canonical={buildCanonicalUrl('/history')}
                    robots="noindex, nofollow"
                />
            )}
            <ProfileCollectionHeader
                title="История"
                onBackPress={handleBackToProfile}
                showClearButton
                onClearPress={handleClear}
                clearAccessibilityLabel="Очистить историю просмотров"
            />

            {Platform.OS === 'web' ? (
                <ScrollView
                    contentContainerStyle={[styles.gridContent, numColumns > 1 && { flexDirection: 'row', flexWrap: 'wrap' }]}
                >
                    {data.map((item: any, index: number) => {
                        const gap = 14;
                        const columnIndex = numColumns > 0 ? index % numColumns : 0;
                        const isFirstColumn = numColumns <= 1 || columnIndex === 0;
                        const isLastColumn = numColumns <= 1 || columnIndex === numColumns - 1;
                        const paddingLeft = numColumns > 1 ? (isFirstColumn ? 0 : gap / 2) : 0;
                        const paddingRight = numColumns > 1 ? (isLastColumn ? 0 : gap / 2) : 0;

                        return (
                        <View
                            key={`history-${item.type || 'travel'}-${item.id}-${item.viewedAt || ''}`}
                            style={[
                            styles.gridItem,
                            numColumns > 1 ? { width: `${100 / numColumns}%`, paddingLeft, paddingRight } : null,
                            ]}
                        >
                            <TabTravelCard
                                item={{
                                    id: item.id,
                                    title: cleanTravelTitle(item.title, item.country ?? item.countryName),
                                    imageUrl: item.imageUrl,
                                    city: item.city ?? null,
                                    country: item.country ?? item.countryName ?? null,
                                }}
                                badge={{
                                    icon: 'clock',
                                    backgroundColor: colors.overlay,
                                    iconColor: colors.textOnDark,
                                }}
                                onPress={() => handleOpen(item.url)}
                                layout="grid"
                                style={styles.card}
                            />
                        </View>
                        );
                    })}
                </ScrollView>
            ) : (
                <FlashList
                    data={data}
                    keyExtractor={(item: any) => `history-${item.type || 'travel'}-${item.id}-${item.viewedAt || ''}`}
                    numColumns={numColumns}
                    key={numColumns}
                    contentContainerStyle={styles.gridContent}
                    drawDistance={500}
                    renderItem={({ item, index }: { item: any; index: number }) => {
                        const gap = 14;
                        const columnIndex = numColumns > 0 ? index % numColumns : 0;
                        const isFirstColumn = numColumns <= 1 || columnIndex === 0;
                        const isLastColumn = numColumns <= 1 || columnIndex === numColumns - 1;
                        const paddingLeft = numColumns > 1 ? (isFirstColumn ? 0 : gap / 2) : 0;
                        const paddingRight = numColumns > 1 ? (isLastColumn ? 0 : gap / 2) : 0;

                        return (
                        <View
                            style={[
                            styles.gridItem,
                            numColumns > 1 ? { maxWidth: `${100 / numColumns}%`, paddingLeft, paddingRight } : null,
                            ]}
                        >
                            <TabTravelCard
                                item={{
                                    id: item.id,
                                    title: cleanTravelTitle(item.title, item.country ?? item.countryName),
                                    imageUrl: item.imageUrl,
                                    city: item.city ?? null,
                                    country: item.country ?? item.countryName ?? null,
                                }}
                                badge={{
                                    icon: 'clock',
                                    backgroundColor: colors.overlay,
                                    iconColor: colors.textOnDark,
                                }}
                                onPress={() => handleOpen(item.url)}
                                layout="grid"
                                style={styles.card}
                            />
                        </View>
                        );
                    }}
                />
            )}
        </SafeAreaView>
    );
}
