// app/export.tsx (или соответствующий путь)
import { Suspense, lazy, useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { usePathname, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { fetchMyTravels, unwrapMyTravelsPayload } from '@/api/travelsApi';
import { sendAnalyticsEvent } from '@/utils/analytics';
import { buildLoginHref } from '@/utils/authNavigation';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';

const ListTravel = lazy(async () => {
    const mod: any = await import('@/components/listTravel/ListTravel');
    const Comp = mod?.default ?? mod;
    return { default: Comp };
});

export default function ExportScreen() {
    const isFocused = useIsFocused();
    const pathname = usePathname();
    const router = useRouter();
    const { isAuthenticated, userId } = useAuth();
    const title = 'Экспорт в pdf | Metravel';
    const description =
        'Экспорт ваших опубликованных и черновых путешествий на платформе Metravel.by';

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
        queryKey: ['export-my-travels-count', userId],
        queryFn: () =>
            fetchMyTravels({
                user_id: userId as any,
                includeDrafts: true,
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
        if (!shouldShowEmptyState) return;
        sendAnalyticsEvent('ExportEmptyStateShown');
    }, [isFocused, shouldShowEmptyState]);

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

            {!isAuthenticated ? (
                <EmptyState
                    icon="lock"
                    title="Войдите, чтобы собрать PDF‑книгу"
                    description="Экспорт в PDF доступен после авторизации."
                    action={{
                        label: 'Войти',
                        onPress: () => router.push(buildLoginHref({ redirect: '/export', intent: 'build-pdf' }) as any),
                    }}
                    secondaryAction={{
                        label: 'Открыть Поиск',
                        onPress: () => router.push('/search' as any),
                    }}
                    variant="empty"
                />
            ) : shouldShowEmptyState ? (
                <EmptyState
                    icon="file-text"
                    title="Чтобы собрать PDF‑книгу, добавьте хотя бы одно путешествие"
                    description="Добавьте первое путешествие — и сможете собрать книгу и сохранить её в PDF."
                    action={{
                        label: 'Добавить путешествие',
                        onPress: () => router.push('/travel/new' as any),
                    }}
                    secondaryAction={{
                        label: 'Открыть Поиск',
                        onPress: () => router.push('/search' as any),
                    }}
                    variant="empty"
                />
            ) : (
                <Suspense
                    fallback={
                        <View style={{ padding: 16 }}>
                            <Text>Загрузка...</Text>
                        </View>
                    }
                >
                    <ListTravel />
                </Suspense>
            )}
        </>
    );
}
