// app/export.tsx (или соответствующий путь)
import { Suspense, lazy, useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import EmptyState from '@/components/ui/EmptyState';
import { ResponsiveContainer } from '@/components/layout';
import { useAuth } from '@/context/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { fetchMyTravels, unwrapMyTravelsPayload } from '@/api/travelsApi';
import { queryKeys } from '@/api/queryKeys';
import { sendAnalyticsEvent } from '@/utils/analytics';
import { buildLoginHref } from '@/utils/authNavigation';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';
import { translate as i18nT } from '@/i18n'


const ListTravel = lazy(async () => {
    const mod: any = await import('@/components/listTravel/ListTravelBase');
    const Comp = mod?.default ?? mod;
    return { default: Comp };
});

export default function ExportScreen() {
    const isFocused = useIsFocused();
    const pathname = usePathname();
    const router = useRouter();
    const { isAuthenticated, userId } = useAuth();
    const { isMobile, isHydrated } = useResponsive();
    const colors = useThemedColors();
    // PDF‑книга собирается только на десктопе. На мобильной версии сайта показываем
    // заглушку вместо контролов экспорта. Гейт по isHydrated — чтобы на десктопе
    // не мигала заглушка и не было hydration mismatch (до гидрации isMobile=true).
    const isMobileWebExport = isHydrated && isMobile;
    const title = i18nT('export:app.tabs.export.eksport_v_pdf_metravel_baa93748');
    const description =
        i18nT('export:app.tabs.export.eksport_vashih_opublikovannyh_i_chernovyh_pu_b70e1a2a');

    useEffect(() => {
        if (!isFocused) return;
        sendAnalyticsEvent('ExportViewed');
    }, [isFocused]);

    const isCountQueryEnabled = Boolean(isAuthenticated && userId);
    const {
        data: myTravelsPayload,
        isFetched: isMyTravelsFetched,
        isError: isMyTravelsError,
    } = useQuery({
        queryKey: queryKeys.exportMyTravelsCount(userId),
        queryFn: () =>
            fetchMyTravels({
                user_id: userId as any,
                includeDrafts: true,
                perPage: 1,
                throwOnError: true,
            }),
        enabled: isCountQueryEnabled,
        staleTime: 60_000,
    });

    const travelsCount = useMemo(() => {
        return unwrapMyTravelsPayload(myTravelsPayload).total;
    }, [myTravelsPayload]);

    const shouldShowEmptyState =
        isCountQueryEnabled &&
        isMyTravelsFetched && !isMyTravelsError && travelsCount <= 0;

    useEffect(() => {
        if (!isFocused) return;
        // На мобильной вебе рендерится заглушка «только на десктопе», а не empty‑state —
        // не засоряем воронку ExportEmptyStateShown.
        if (isMobileWebExport) return;
        if (!shouldShowEmptyState) return;
        sendAnalyticsEvent('ExportEmptyStateShown');
    }, [isFocused, shouldShowEmptyState, isMobileWebExport]);

    return (
        <>
            {isFocused && (
                <InstantSEO
                    headKey="export"
                    title={title}
                    description={description}
                    canonical={buildCanonicalUrl(pathname || '/export')}
                    image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
                    ogType="website"
                    robots="noindex, nofollow"
                />
            )}

            <View style={{ flex: 1, backgroundColor: colors.background }}>
            {isMobileWebExport ? (
                <ResponsiveContainer maxWidth="lg" padding>
                <EmptyState
                    icon="monitor"
                    title={i18nT('export:app.tabs.export.pdf_kniga_dostupna_tolko_na_kompyutere_5fa839fc')}
                    description={i18nT('export:app.tabs.export.sborka_i_eksport_puteshestviy_v_pdf_rabotayu_f77f9626')}
                    secondaryAction={{
                        label: i18nT('export:app.tabs.export.otkryt_poisk_b06cf650'),
                        onPress: () => router.push('/search' as any),
                    }}
                    variant="empty"
                />
                </ResponsiveContainer>
            ) : !isAuthenticated ? (
                <ResponsiveContainer maxWidth="lg" padding>
                <EmptyState
                    icon="lock"
                    title={i18nT('export:app.tabs.export.voydite_chtoby_sobrat_pdf_knigu_dd53ff43')}
                    description={i18nT('export:app.tabs.export.eksport_v_pdf_dostupen_posle_avtorizatsii_4948aa62')}
                    action={{
                        label: i18nT('export:app.tabs.export.voyti_70e887f8'),
                        onPress: () => router.push(buildLoginHref({ redirect: '/export', intent: 'build-pdf' }) as any),
                    }}
                    secondaryAction={{
                        label: i18nT('export:app.tabs.export.otkryt_poisk_b06cf650'),
                        onPress: () => router.push('/search' as any),
                    }}
                    variant="empty"
                />
                </ResponsiveContainer>
            ) : shouldShowEmptyState ? (
                <ResponsiveContainer maxWidth="lg" padding>
                <EmptyState
                    icon="file-text"
                    title={i18nT('export:app.tabs.export.chtoby_sobrat_pdf_knigu_dobavte_hotya_by_odn_605e941a')}
                    description={i18nT('export:app.tabs.export.dobavte_pervoe_puteshestvie_i_smozhete_sobra_376685ca')}
                    action={{
                        label: i18nT('export:app.tabs.export.dobavit_puteshestvie_31bfd4e1'),
                        onPress: () => router.push('/travel/new' as any),
                    }}
                    secondaryAction={{
                        label: i18nT('export:app.tabs.export.otkryt_poisk_b06cf650'),
                        onPress: () => router.push('/search' as any),
                    }}
                    variant="empty"
                />
                </ResponsiveContainer>
            ) : (
                <Suspense
                    fallback={
                        <View style={{ padding: 16 }}>
                            <Text>{i18nT('export:app.tabs.export.zagruzka_7f1a74fb')}</Text>
                        </View>
                    }
                >
                    <ListTravel />
                </Suspense>
            )}
            </View>
        </>
    );
}
