// app/export.tsx (или соответствующий путь)
import React, { Suspense, lazy, useEffect, useMemo } from 'react';
import { Platform, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { usePathname, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { fetchMyTravels } from '@/src/api/travelsApi';
import { sendAnalyticsEvent } from '@/src/utils/analytics';

const isWeb = Platform.OS === 'web';
const isClient = typeof window !== 'undefined';
const ListTravel = isWeb && isClient
  ? lazy(() => import('@/components/listTravel/ListTravel'))
  : require('@/components/listTravel/ListTravel').default;

export default function ExportScreen() {
    const isFocused = useIsFocused();
    const pathname = usePathname();
    const router = useRouter();
    const { isAuthenticated, userId } = useAuth();
    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
    const canonical = `${SITE}${pathname || '/export'}`;

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
        const payload: any = myTravelsPayload;
        if (!payload) return 0;
        if (Array.isArray(payload)) return payload.length;
        if (Array.isArray(payload?.data)) return payload.data.length;
        if (Array.isArray(payload?.results)) return payload.results.length;
        if (Array.isArray(payload?.items)) return payload.items.length;
        if (typeof payload?.total === 'number') return payload.total;
        if (typeof payload?.count === 'number') return payload.count;
        return 0;
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
                    canonical={canonical}
                    image={`${SITE}/og-preview.jpg`}
                    ogType="website"
                />
            )}

            {!isAuthenticated ? (
                <EmptyState
                    icon="lock"
                    title="Войдите, чтобы собрать PDF‑книгу"
                    description="Экспорт в PDF доступен после авторизации."
                    action={{
                        label: 'Войти',
                        onPress: () => router.push('/login?redirect=%2Fexport&intent=build-pdf' as any),
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
