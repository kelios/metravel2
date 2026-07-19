import { useCallback, useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Platform, ScrollView, Text, Pressable } from 'react-native';
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
import { translate as i18nT } from '@/i18n'


// На native глобальный HeaderContextBar уже показывает «Назад» + заголовок «История»
// для /history (см. components/layout/customHeaderModel.ts), поэтому in-page шапку
// не рендерим — иначе дублируется. На web этот бар для /history скрыт (top-level path),
// поэтому там оставляем компактную ProfileCollectionHeader как единственную навигацию.
const hasGlobalHeader = Platform.OS !== 'web';

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
        nativeClearRow: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingHorizontal: 16,
            paddingTop: 8,
        },
        nativeClearButton: {
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: DESIGN_TOKENS.radii.md,
            borderWidth: 1,
            borderColor: colors.danger,
            backgroundColor: colors.surface,
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
                                {i18nT('shared:app.tabs.history.prosmotreno_708c9fc4')}{viewedLabel}
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
            title: i18nT('shared:app.tabs.history.ochistit_istoriyu_b56d803a'),
            message: i18nT('shared:app.tabs.history.ochistit_istoriyu_prosmotrov_f8fc9029'),
            confirmText: i18nT('shared:app.tabs.history.ochistit_60c1f61d'),
            cancelText: i18nT('shared:app.tabs.history.otmena_373b932d'),
        });
        if (!confirmed) return;

        await clearHistory();
    }, [clearHistory]);

    const renderHeader = useCallback(
        (showClear: boolean) => {
            if (hasGlobalHeader) {
                if (!showClear) return null;

                return (
                    <View style={styles.nativeClearRow}>
                        <Pressable
                            style={styles.nativeClearButton}
                            onPress={handleClear}
                            accessibilityRole="button"
                            accessibilityLabel={i18nT('shared:app.tabs.history.ochistit_istoriyu_prosmotrov_9a61aea8')}
                        >
                            <Feather name="trash-2" size={16} color={colors.danger} />
                        </Pressable>
                    </View>
                );
            }

            return (
                <ProfileCollectionHeader
                    title={i18nT('shared:app.tabs.history.vy_smotreli_e2be38ed')}
                    dense
                    onBackPress={handleBackToProfile}
                    showClearButton={showClear}
                    onClearPress={handleClear}
                    clearAccessibilityLabel={i18nT('shared:app.tabs.history.ochistit_istoriyu_prosmotrov_9a61aea8')}
                    compactClear
                />
            );
        },
        [colors.danger, handleBackToProfile, handleClear, styles]
    );

    const renderHistorySummary = useCallback(
        () => (
            <View style={styles.summaryWrap}>
                <View style={styles.summaryCard}>
                    <View style={styles.summaryHeader}>
                        <View style={styles.summaryIcon}>
                            <Feather name="clock" size={20} color={colors.primaryDark} />
                        </View>

                        <View style={styles.summaryCopy}>
                            <Text style={styles.summaryEyebrow}>{i18nT('shared:app.tabs.history.vy_smotreli_e2be38ed')}</Text>
                            <Text style={styles.summaryTitle}>{i18nT('shared:app.tabs.history.bystryy_vozvrat_k_tomu_chto_uzhe_smotrel_8d05fc78')}</Text>
                            <Text style={styles.summaryDescription}>
                                {i18nT('shared:app.tabs.history.posle_svorachivaniya_ili_perezapuska_prilozh_d129bc74')}</Text>
                        </View>
                    </View>

                    <View style={styles.summaryMetaRow}>
                        <View style={styles.summaryMetaPill}>
                            <Feather name="layers" size={16} color={colors.primaryDark} />
                            <Text style={styles.summaryMetaText}>
                                {data.length} {pluralizeRu(data.length, i18nT('shared:app.tabs.history.element_503c6985'), i18nT('shared:app.tabs.history.elementa_0031c492'), i18nT('shared:app.tabs.history.elementov_8c06bb27'))} {i18nT('shared:app.tabs.history.v_istorii_6c948436')}</Text>
                        </View>

                        {latestHistoryTitle ? (
                            <View style={styles.summaryMetaPill}>
                                <Feather name="arrow-up-right" size={16} color={colors.primaryDark} />
                                <Text style={styles.summaryMetaText} numberOfLines={1}>
                                    {i18nT('shared:app.tabs.history.poslednee_bc246b4e')}{latestHistoryTitle}
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.summaryActions}>
                        <Button
                            label={latestHistoryItem ? i18nT('shared:app.tabs.history.prodolzhit_s_poslednego_22c6c480') : i18nT('shared:app.tabs.history.prodolzhit_poisk_9044fea2')}
                            onPress={() =>
                                latestHistoryItem
                                    ? router.push(latestHistoryItem.url as any)
                                    : router.push('/search')
                            }
                            variant="secondary"
                            size="md"
                            style={styles.summaryActionButton}
                        />
                        <Button
                            label={i18nT('shared:app.tabs.history.sluchaynyy_marshrut_5309a92b')}
                            onPress={() => router.push('/roulette')}
                            variant="outline"
                            size="md"
                            style={styles.summaryActionButton}
                        />
                    </View>
                </View>
            </View>
        ),
        [colors.primaryDark, data.length, latestHistoryItem, latestHistoryTitle, router, styles]
    );

    const isLoading = !authReady || (isInitialSyncing && data.length === 0);

    if (!authReady) {
        return (
            <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
                {renderHeader(false)}
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
                    title={i18nT('shared:app.tabs.history.voydite_v_akkaunt_329ef9aa')}
                    description={i18nT('shared:app.tabs.history.voydite_chtoby_sohranyat_istoriyu_prosmotrov_0fcb9b17')}
                    action={{
                        label: i18nT('shared:app.tabs.history.voyti_a42df773'),
                        onPress: () => router.push(buildLoginHref({ redirect: '/history', intent: 'history' }) as any),
                    }}
                />
            </SafeAreaView>
        );
    }

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
                {renderHeader(false)}
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
                    title={i18nT('shared:app.tabs.history.ty_esche_ne_otkryval_marshruty_e7f97c1c')}
                    description={i18nT('shared:app.tabs.history.otkroy_lyuboy_marshrut_on_avtomaticheski_soh_b6b47c2a')}
                    variant="empty"
                    action={{
                        label: i18nT('shared:app.tabs.history.nachat_issledovat_e4fa48dc'),
                        onPress: () => router.push('/search'),
                    }}
                    secondaryAction={{
                        label: i18nT('shared:app.tabs.history.sluchaynyy_marshrut_5309a92b'),
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
                    title={i18nT('shared:app.tabs.history.vy_smotreli_metravel_b6568942')}
                    description={i18nT('shared:app.tabs.history.istoriya_prosmotrennyh_puteshestviy_af016f88')}
                    canonical={buildCanonicalUrl('/history')}
                    robots="noindex, nofollow"
                />
            )}
            {renderHeader(typeof clearHistory === 'function' && data.length > 0)}

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
