import React, { useEffect, useRef, Suspense, lazy, useState, memo, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform, RefreshControl } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { ResponsiveContainer, ResponsiveStack } from '@/components/layout';
import HomeHero from './HomeHero';
import FadeInSection from '@/components/ui/FadeInSection';
import { queueAnalyticsEvent } from '@/utils/analytics';
import { hapticImpact } from '@/utils/haptics';
import { fetchMyTravels, unwrapMyTravelsPayload } from '@/api/travelUserQueries';
import { HomeInspirationSection } from './HomeInspirationSection';
import { fetchTravelsRandom, fetchTravelsOfMonth } from '@/api/map';

const isWeb = Platform.OS === 'web';
const HOW_IT_WORKS_PLACEHOLDER_STYLE = { minHeight: 420 } as const;
const FAQ_PLACEHOLDER_STYLE = { minHeight: 360 } as const;

const HomeHowItWorks = lazy(() => import('./HomeHowItWorks'));
const HomeFAQSection = lazy(() => import('./HomeFAQSection'));
const HomeInspirationSections = lazy(() => import('./HomeInspirationSection'));

const SectionSkeleton = memo(({ hydrated }: { hydrated: boolean }) => {
  const { isSmallPhone, isPhone } = useResponsive();
  const isMobile = hydrated ? isSmallPhone || isPhone : false;

  return (
    <ResponsiveContainer padding>
      <ResponsiveStack direction="vertical" gap={24}>
        <SkeletonLoader width={isMobile ? 200 : 300} height={isMobile ? 28 : 40} borderRadius={8} />
        <ResponsiveStack direction="responsive" gap={20} wrap>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonLoader key={i} width={isMobile ? '100%' : '30%'} height={280} borderRadius={12} />
          ))}
        </ResponsiveStack>
      </ResponsiveStack>
    </ResponsiveContainer>
  );
});

SectionSkeleton.displayName = 'SectionSkeleton';

function Home() {
  const isFocused = useIsFocused();
  const { isAuthenticated, userId } = useAuth();
  const colors = useThemedColors();
  const queryClient = useQueryClient();
  const { isSmallPhone, isPhone } = useResponsive();
  const isMobile = isSmallPhone || isPhone;

  // AND-14: Pull-to-Refresh state
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    hapticImpact('light');
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  // HERO-06: Загружаем количество путешествий для авторизованного пользователя
  // Только для авторизованных, чтобы кнопка сразу показывала нужный текст
  const { data: myTravelsData, isLoading: travelsCountLoading } = useQuery({
    queryKey: ['my-travels-count', userId],
    queryFn: async (): Promise<{ items: Record<string, unknown>[]; total: number }> => {
      // Никогда не возвращаем undefined — TanStack Query требует валидные данные
      if (!userId) return { items: [], total: 0 };
      try {
        const payload = await fetchMyTravels({ user_id: userId, perPage: 1 });
        return unwrapMyTravelsPayload(payload);
      } catch {
        return { items: [], total: 0 };
      }
    },
    enabled: isAuthenticated && !!userId,
    staleTime: 5 * 60 * 1000,
    initialData: undefined,
  });

  const travelsCount = myTravelsData?.total ?? 0;

  const shouldRenderHeavyContentImmediately =
    typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  const [showHeavyContent, setShowHeavyContent] = useState(shouldRenderHeavyContentImmediately);
  const isMobileRef = useRef(isMobile);

  useEffect(() => {
    if (shouldRenderHeavyContentImmediately) return;

    let cancelled = false;

    const show = () => {
      if (cancelled) return;
      setShowHeavyContent(true);
    };

    const mobile = isMobileRef.current;
    const fallbackMs = Platform.OS === 'web'
      ? (mobile ? 500 : 100)
      : (mobile ? 300 : 100);
    const timer = setTimeout(show, fallbackMs);

    let idleId: any = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(
        () => {
          clearTimeout(timer);
          show();
        },
        { timeout: Math.max(200, fallbackMs) }
      );
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (idleId != null) {
        try {
          ;(window as any).cancelIdleCallback?.(idleId);
        } catch {
          // noop
        }
      }
    };
  }, [shouldRenderHeavyContentImmediately]);

  useEffect(() => {
    if (!isFocused) return;
    queueAnalyticsEvent('HomeViewed', {
      authState: isAuthenticated ? 'authenticated' : 'guest',
    });
  }, [isFocused, isAuthenticated]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      flexGrow: 1,
      paddingBottom: Platform.select({
        web: isMobile ? 80 : 96,
        ios: 80,
        android: 72,
        default: 96,
      }),
    },
  }), [colors, isMobile]);

  // Responsive skeleton padding — reduce on mobile to match tighter layout
  const skeletonPadH = isMobile ? 8 : 24;
  const skeletonPadVLarge = isMobile ? 36 : 64;

  return (
    <ScrollView
      style={[
        styles.container,
        isWeb && ({ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' } as any),
      ]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={isWeb ? 32 : 16}
      nestedScrollEnabled={Platform.OS === 'android'}
      refreshControl={
        Platform.OS !== 'web' ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
        <HomeHero travelsCount={travelsCount} travelsCountLoading={isAuthenticated && travelsCountLoading} />


      {showHeavyContent ? (
        <FadeInSection delay={80}>
          <ResponsiveContainer maxWidth="xl" padding>
            <HomeInspirationSection
              title="Не хотите"
              titleAccent="выбирать долго?"
              subtitle="Откройте случайный маршрут для спонтанного выезда"
              queryKey="home-random-travels"
              fetchFn={fetchTravelsRandom}
              fixedCount={3}
              hideAuthor
            />
          </ResponsiveContainer>
        </FadeInSection>
      ) : (
        <View style={{ minHeight: 380 }} />
      )}

      {showHeavyContent ? (
        <FadeInSection delay={100}>
          <Suspense fallback={
            <View style={HOW_IT_WORKS_PLACEHOLDER_STYLE}>
              <View style={{ paddingHorizontal: skeletonPadH, paddingVertical: skeletonPadVLarge, maxWidth: 1200, alignSelf: 'center' as const, width: '100%' }}>
                <SkeletonLoader width={isMobile ? 180 : 260} height={isMobile ? 28 : 36} borderRadius={8} style={{ alignSelf: 'center' }} />
                <View style={{ flexDirection: isMobile ? 'column' as const : 'row' as const, gap: isMobile ? 16 : 24, marginTop: isMobile ? 24 : 40 }}>
                  {[0,1,2].map(i => (
                    <View key={i} style={{ flex: isMobile ? undefined : 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: isMobile ? 20 : 28, gap: 16 }}>
                      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16 }}>
                        <SkeletonLoader width={56} height={56} borderRadius={8} />
                        <SkeletonLoader width={36} height={36} borderRadius={18} />
                      </View>
                      <SkeletonLoader width="70%" height={20} borderRadius={6} />
                      <SkeletonLoader width="90%" height={14} borderRadius={4} />
                    </View>
                  ))}
                </View>
              </View>
            </View>
          }>
            <HomeHowItWorks />
          </Suspense>
        </FadeInSection>
      ) : (
        <View style={HOW_IT_WORKS_PLACEHOLDER_STYLE}>
          <View style={{ paddingHorizontal: skeletonPadH, paddingVertical: skeletonPadVLarge, maxWidth: 1200, alignSelf: 'center' as const, width: '100%' }}>
            <SkeletonLoader width={isMobile ? 180 : 260} height={isMobile ? 28 : 36} borderRadius={8} style={{ alignSelf: 'center' }} />
            <View style={{ flexDirection: isMobile ? 'column' as const : 'row' as const, gap: isMobile ? 16 : 24, marginTop: isMobile ? 24 : 40 }}>
              {[0,1,2].map(i => (
                <View key={i} style={{ flex: isMobile ? undefined : 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: isMobile ? 20 : 28, gap: 16 }}>
                  <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16 }}>
                    <SkeletonLoader width={56} height={56} borderRadius={8} />
                    <SkeletonLoader width={36} height={36} borderRadius={18} />
                  </View>
                  <SkeletonLoader width="70%" height={20} borderRadius={6} />
                  <SkeletonLoader width="90%" height={14} borderRadius={4} />
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {showHeavyContent ? (
        <FadeInSection delay={150}>
          <ResponsiveContainer maxWidth="xl" padding>
            <HomeInspirationSection
              title="Маршруты на"
              titleAccent="ближайшие выходные"
              subtitle="Реальные поездки, которые можно успеть за 1-2 дня"
              queryKey="home-travels-of-month"
              fetchFn={fetchTravelsOfMonth}
            />
          </ResponsiveContainer>
        </FadeInSection>
      ) : (
        <View style={{ minHeight: 480 }} />
      )}

      {showHeavyContent ? (
        <FadeInSection delay={200}>
          <Suspense fallback={<SectionSkeleton hydrated />}>
            <HomeInspirationSections />
          </Suspense>
        </FadeInSection>
      ) : (
        <SectionSkeleton hydrated={false} />
      )}

      <Suspense fallback={
        <View style={FAQ_PLACEHOLDER_STYLE}>
          <View style={{ paddingHorizontal: skeletonPadH, paddingVertical: skeletonPadVLarge, maxWidth: 1200, alignSelf: 'center' as const, width: '100%' }}>
            <SkeletonLoader width={100} height={28} borderRadius={8} style={{ alignSelf: 'center', marginBottom: isMobile ? 20 : 32 }} />
            <View style={{ gap: isMobile ? 8 : 12 }}>
              {[0,1,2,3,4].map(i => (
                <View key={i} style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: isMobile ? 12 : 16 }}>
                  <SkeletonLoader width={i % 2 === 0 ? '70%' : '55%'} height={16} borderRadius={4} />
                </View>
              ))}
            </View>
          </View>
        </View>
      }>
        <HomeFAQSection />
      </Suspense>

    </ScrollView>
  );
}

export default memo(Home);
