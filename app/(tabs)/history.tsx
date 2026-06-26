import { useCallback, useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Platform, ScrollView, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { confirmAction } from '@/utils/confirmAction';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { buildLoginHref } from '@/utils/authNavigation';
import { webTouchScrollStyle } from '@/utils';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { useIsFocused } from 'expo-router';
import { cleanTravelTitle } from '@/utils/cleanTravelTitle';
import { formatRelativeTime } from '@/utils/relativeTime';
import { pluralizeRu } from '@/utils/pluralize';
import ProfileCollectionHeader from '@/components/profile/ProfileCollectionHeader';
import ContributionBanner from '@/components/common/ContributionBanner';
import { useViewHistoryStore, type ViewHistoryItem } from '@/stores/viewHistoryStore';

const getHistorySubtitle = (count: number) => {
    if (count <= 0) return 'Профиль';

    return `${count} ${pluralizeRu(count, 'последнее открытие', 'последних открытия', 'последних открытий')}`;
};

export default function HistoryScreen() {
    const router = useRouter();
    const isFocused = useIsFocused();
    const { width } = useResponsive();
    const { isAuthenticated, authReady, userId } = useAuth();
    const { viewHistory, clearHistory, ensureServerData } = useFavorites();
    const colors = useThemedColors();
    const [isInitialSyncing, setIsInitialSyncing] = useState(false);

    const [refreshing, setRefreshing] = useState(false);
    const data = useMemo<ViewHistoryItem[]>(() => (Array.isArray(viewHistory) ? viewHistory : []), [viewHistory]);
    const latestHistoryItem = data[0] ?? null;
    const latestHistoryTitle = latestHistoryItem
        ? cleanTravelTitle(latestHistoryItem.title, latestHistoryItem.country ?? latestHistoryItem.city)
        : null;

    const onRefresh = useCallback(async () => {
        if (refreshing) return;

        setRefreshing(true);
        try {
            if (isAuthenticated && userId) {
                useViewHistoryStore.getState().resetFetchState(userId);
                await useViewHistoryStore.getState().refreshFromServer(userId);
                return;
            }

            await useViewHistoryStore.getState().loadLocal(userId ?? null);
        } finally {
            setRefreshing(false);
        }
    }, [isAuthenticated, refreshing, userId]);

    const handleBackToProfile = useCallback(() => {
        router.back();
    }, [router]);

    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        gridContent: {
            paddingHorizontal: 16,
            paddingBottom: 24,
            paddingTop: 12,
        },
        webGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'stretch',
        },
        gridItem: {
            flexGrow: 0,
            flexShrink: 0,
            width: '100%',
            paddingTop: 14,
        },
        card: {
            marginRight: 0,
            width: '100%',
        },
        cardCaptionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingTop: 8,
            paddingHorizontal: 2,
        },
        cardCaptionText: {
            color: colors.textMuted,
            fontSize: DESIGN_TOKENS.typography.scale.bodySmall.fontSize,
            lineHeight: DESIGN_TOKENS.typography.scale.bodySmall.lineHeight,
            fontWeight: DESIGN_TOKENS.typography.scale.bodySmall.fontWeight as any,
        },
        summaryWrap: {
            width: '100%',
            paddingBottom: 18,
        },
        summaryCard: {
            borderRadius: DESIGN_TOKENS.radii.lg,
            borderWidth: 1,
            borderColor: colors.borderLight,
            backgroundColor: colors.surface,
            padding: DESIGN_TOKENS.spacing.lg,
            gap: DESIGN_TOKENS.spacing.md,
            ...(Platform.OS === 'web'
                ? ({ boxShadow: colors.boxShadows.card } as any)
                : Platform.OS === 'ios'
                  ? colors.shadows.light
                  : { elevation: 2 }),
        },
        summaryHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: DESIGN_TOKENS.spacing.md,
        },
        summaryIcon: {
            width: 44,
            height: 44,
            borderRadius: DESIGN_TOKENS.radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primarySoft,
        },
        summaryCopy: {
            flex: 1,
            gap: 4,
        },
        summaryEyebrow: {
            color: colors.textMuted,
            fontSize: DESIGN_TOKENS.typography.scale.label.fontSize,
            lineHeight: DESIGN_TOKENS.typography.scale.label.lineHeight,
            fontWeight: DESIGN_TOKENS.typography.scale.label.fontWeight as any,
            letterSpacing: DESIGN_TOKENS.typography.scale.label.letterSpacing,
            textTransform: 'uppercase',
        },
        summaryTitle: {
            color: colors.text,
            fontSize: DESIGN_TOKENS.typography.scale.h2.fontSize,
            lineHeight: DESIGN_TOKENS.typography.scale.h2.lineHeight,
            fontWeight: DESIGN_TOKENS.typography.scale.h2.fontWeight as any,
        },
        summaryDescription: {
            color: colors.textMuted,
            fontSize: DESIGN_TOKENS.typography.scale.body.fontSize,
            lineHeight: DESIGN_TOKENS.typography.scale.body.lineHeight,
            fontWeight: DESIGN_TOKENS.typography.scale.body.fontWeight as any,
        },
        summaryMetaRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: DESIGN_TOKENS.spacing.sm,
        },
        summaryMetaPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            minHeight: DESIGN_TOKENS.touchTarget.minHeight,
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.xs,
            borderRadius: DESIGN_TOKENS.radii.pill,
            borderWidth: 1,
            borderColor: colors.borderLight,
            backgroundColor: colors.backgroundSecondary,
        },
        summaryMetaText: {
            color: colors.text,
            fontSize: DESIGN_TOKENS.typography.scale.bodySmall.fontSize,
            lineHeight: DESIGN_TOKENS.typography.scale.bodySmall.lineHeight,
            fontWeight: DESIGN_TOKENS.typography.scale.bodyStrong.fontWeight as any,
        },
        summaryActions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: DESIGN_TOKENS.spacing.sm,
        },
        summaryActionButton: {
            flexGrow: 1,
            flexBasis: 160,
            minWidth: 160,
        },
    }), [colors]);

    useEffect(() => {
        if (!authReady || !isAuthenticated || data.length > 0 || typeof ensureServerData !== 'function') {
            setIsInitialSyncing(false);
            return undefined;
        }

        let isActive = true;
        setIsInitialSyncing(true);

        ensureServerData('history')
            .catch(() => {
                // no-op: empty state is still a valid fallback for this page
            })
            .finally(() => {
                if (isActive) {
                    setIsInitialSyncing(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [authReady, data.length, ensureServerData, isAuthenticated]);

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

    const renderCard = useCallback(
        (item: ViewHistoryItem, index: number) => {
            const isWeb = Platform.OS === 'web';
            const columnIndex = numColumns > 0 ? index % numColumns : 0;
            const isFirstColumn = numColumns <= 1 || columnIndex === 0;
            const isLastColumn = numColumns <= 1 || columnIndex === numColumns - 1;
            const paddingLeft = numColumns > 1 ? (isFirstColumn ? 0 : columnGap / 2) : 0;
            const paddingRight = numColumns > 1 ? (isLastColumn ? 0 : columnGap / 2) : 0;
            const viewedLabel = formatRelativeTime(item.viewedAt);

            // Web: explicit per-column width inside a flex-wrap container.
            // Native: FlashList already lays out columns, so fill the cell.
            const columnStyle =
                numColumns > 1
                    ? isWeb
                        ? { width: `${100 / numColumns}%` as const, paddingLeft, paddingRight }
                        : { paddingLeft, paddingRight }
                    : null;

            return (
                <View
                    key={`history-${item.type || 'travel'}-${item.id}-${item.viewedAt || ''}`}
                    style={[styles.gridItem, columnStyle]}
                >
                    <TabTravelCard
                        item={{
                            id: item.id,
                            title: cleanTravelTitle(item.title, item.country),
                            imageUrl: item.imageUrl,
                            city: item.city ?? null,
                            country: item.country ?? null,
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
                    {viewedLabel ? (
                        <View style={styles.cardCaptionRow}>
                            <Feather name="eye" size={13} color={colors.textMuted} />
                            <Text style={styles.cardCaptionText} numberOfLines={1}>
                                Просмотрено {viewedLabel}
                            </Text>
                        </View>
                    ) : null}
                </View>
            );
        },
        [colors.overlay, colors.textMuted, colors.textOnDark, columnGap, handleOpen, numColumns, styles]
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

    const renderHistorySummary = useCallback(
        () => (
            <View style={styles.summaryWrap}>
                <View style={styles.summaryCard}>
                    <View style={styles.summaryHeader}>
                        <View style={styles.summaryIcon}>
                            <Feather name="clock" size={20} color={colors.primary} />
                        </View>

                        <View style={styles.summaryCopy}>
                            <Text style={styles.summaryEyebrow}>Недавние открытия</Text>
                            <Text style={styles.summaryTitle}>Быстрый возврат к тому, что уже смотрел</Text>
                            <Text style={styles.summaryDescription}>
                                История помогает не терять интересные маршруты и продолжать поиск с того места, где ты остановился.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.summaryMetaRow}>
                        <View style={styles.summaryMetaPill}>
                            <Feather name="layers" size={16} color={colors.primary} />
                            <Text style={styles.summaryMetaText}>
                                {data.length} {pluralizeRu(data.length, 'элемент', 'элемента', 'элементов')} в истории
                            </Text>
                        </View>

                        {latestHistoryTitle ? (
                            <View style={styles.summaryMetaPill}>
                                <Feather name="arrow-up-right" size={16} color={colors.primary} />
                                <Text style={styles.summaryMetaText} numberOfLines={1}>
                                    Последнее: {latestHistoryTitle}
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.summaryActions}>
                        <Button
                            label="Продолжить поиск"
                            onPress={() => router.push('/search')}
                            variant="secondary"
                            size="md"
                            style={styles.summaryActionButton}
                        />
                        <Button
                            label="Случайный маршрут"
                            onPress={() => router.push('/roulette')}
                            variant="outline"
                            size="md"
                            style={styles.summaryActionButton}
                        />
                    </View>
                </View>
            </View>
        ),
        [colors.primary, data.length, latestHistoryTitle, router, styles]
    );

    const isLoading = !authReady || (isInitialSyncing && data.length === 0);

    if (!authReady) {
        return (
            <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
                <ProfileCollectionHeader title="История" subtitle={getHistorySubtitle(0)} onBackPress={handleBackToProfile} />
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
            <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
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
            <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
                <ProfileCollectionHeader title="История" subtitle={getHistorySubtitle(data.length)} onBackPress={handleBackToProfile} />
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
            <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
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
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
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
                subtitle={getHistorySubtitle(data.length)}
                onBackPress={handleBackToProfile}
                showClearButton={typeof clearHistory === 'function' && data.length > 0}
                onClearPress={handleClear}
                clearAccessibilityLabel="Очистить историю просмотров"
            />

            {Platform.OS === 'web' ? (
                <ScrollView
                    style={webTouchScrollStyle}
                    contentContainerStyle={styles.gridContent}
                >
                    {renderHistorySummary()}
                    <View style={styles.webGrid}>
                        {data.map((item, index) => renderCard(item, index))}
                    </View>
                    <ContributionBanner variant="history" />
                </ScrollView>
            ) : (
                <FlashList<ViewHistoryItem>
                    data={data}
                    keyExtractor={(item: ViewHistoryItem) => `history-${item.type || 'travel'}-${item.id}-${item.viewedAt || ''}`}
                    numColumns={numColumns}
                    key={numColumns}
                    {...({ estimatedItemSize: 280 } as any)}
                    contentContainerStyle={styles.gridContent}
                    drawDistance={500}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    ListHeaderComponent={renderHistorySummary}
                    renderItem={({ item, index }: { item: ViewHistoryItem; index: number }) =>
                        renderCard(item, index)
                    }
                    ListFooterComponent={<ContributionBanner variant="history" />}
                />
            )}
        </SafeAreaView>
    );
}
