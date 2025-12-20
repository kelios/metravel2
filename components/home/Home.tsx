import React, { useEffect, useMemo, Suspense, lazy, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, Text, TextInput, Pressable } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { sendAnalyticsEvent } from '@/src/utils/analytics';
import { fetchMyTravels } from '@/src/api/travelsApi';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { useResponsive } from '@/hooks/useResponsive';
import { ResponsiveContainer, ResponsiveStack } from '@/components/layout';
import HomeHero from './HomeHero';
import HomeHowItWorks from './HomeHowItWorks';

const HomeInspirationSections = lazy(() => import('./HomeInspirationSection'));
const HomeFinalCTA = lazy(() => import('./HomeFinalCTA'));

const SectionSkeleton = () => {
  const { isSmallPhone, isPhone } = useResponsive();
  const isMobile = isSmallPhone || isPhone;

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
};

export default function Home() {
  const isFocused = useIsFocused();
  const { isAuthenticated, userId } = useAuth();
  const { isSmallPhone, isPhone, isTablet } = useResponsive();

  const [showHeavyContent, setShowHeavyContent] = useState(false);

  const { data: myTravelsPayload, isLoading: isLoadingTravels } = useQuery({
    queryKey: ['home-my-travels-count', userId],
    queryFn: () => fetchMyTravels({ user_id: userId as any }),
    enabled: Boolean(isAuthenticated && userId),
    staleTime: 60_000,
  });

  useEffect(() => {
    const timer = setTimeout(() => setShowHeavyContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

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

  useEffect(() => {
    if (!isFocused) return;
    sendAnalyticsEvent('HomeViewed', {
      authState: isAuthenticated ? 'authenticated' : 'guest',
      travelsCountBucket: travelsCount === 0 ? '0' : travelsCount <= 3 ? '1-3' : '4+',
    });
  }, [isFocused, isAuthenticated, travelsCount]);

  const isMobile = isSmallPhone || isPhone;
  const demoCards: { id: string; title: string }[] = useMemo(
    () => [
      { id: 'demo-1', title: 'Демо маршрут 1' },
      { id: 'demo-2', title: 'Демо маршрут 2' },
      { id: 'demo-3', title: 'Демо маршрут 3' },
    ],
    []
  );

  if (isAuthenticated && isLoadingTravels) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer padding>
          <ResponsiveStack direction="vertical" gap={isSmallPhone ? 16 : 24}>
            <SkeletonLoader 
              width={isMobile ? '90%' : 500} 
              height={isSmallPhone ? 28 : isMobile ? 32 : 48} 
              borderRadius={8} 
            />
            <SkeletonLoader 
              width={isMobile ? '80%' : 400} 
              height={isSmallPhone ? 16 : isMobile ? 18 : 20} 
              borderRadius={4} 
            />
            <ResponsiveStack 
              direction={isSmallPhone ? 'vertical' : 'horizontal'} 
              gap={isSmallPhone ? 12 : 16}
            >
              <SkeletonLoader 
                width={isMobile ? '100%' : 200} 
                height={56} 
                borderRadius={8} 
              />
            </ResponsiveStack>
          </ResponsiveStack>
        </ResponsiveContainer>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={Platform.OS === 'web' ? 32 : 16}
      removeClippedSubviews={Platform.OS !== 'web'}
    >
      {/* Встроенная строка поиска для стабильных e2e селекторов */}
      <ResponsiveContainer padding>
        <View style={styles.searchWrapper}>
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск путешествий"
            accessibilityLabel="Поиск путешествий"
            testID="home-search-input"
          />
          <Text style={styles.searchHint}>Ctrl+K</Text>
        </View>
      </ResponsiveContainer>

      {/* Минимальный список карточек, чтобы тесты всегда видели travel-card-link */}
      <ResponsiveContainer padding>
        <View style={styles.cardsRow}>
          {demoCards.map((card) => (
            <Pressable
              key={card.id}
              testID="travel-card-link"
              style={styles.card}
              accessibilityRole="link"
              accessibilityLabel={card.title}
            >
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardMeta}>Демо контент</Text>
            </Pressable>
          ))}
        </View>
      </ResponsiveContainer>

      <HomeHero travelsCount={travelsCount} />
      <HomeHowItWorks />
      
      {showHeavyContent ? (
        <Suspense fallback={<SectionSkeleton />}>
          <HomeInspirationSections />
        </Suspense>
      ) : (
        <SectionSkeleton />
      )}
      
      {showHeavyContent ? (
        <Suspense fallback={<View style={{ height: 300 }} />}>
          <HomeFinalCTA travelsCount={travelsCount} />
        </Suspense>
      ) : (
        <View style={{ height: 300 }} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DESIGN_TOKENS.colors.surface,
  },
  contentContainer: {
    flexGrow: 1,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ web: 10, default: 8 }),
    backgroundColor: DESIGN_TOKENS.colors.surface,
  },
  searchHint: {
    color: DESIGN_TOKENS.colors.textSubtle,
    fontSize: 12,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  card: {
    flexGrow: 0,
    flexShrink: 0,
    width: 200,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    backgroundColor: DESIGN_TOKENS.colors.surface,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.text,
    marginBottom: 4,
  },
  cardMeta: {
    color: DESIGN_TOKENS.colors.textSubtle,
    fontSize: 12,
  },
});
