import React, { useEffect, useMemo, Suspense, lazy, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { sendAnalyticsEvent } from '@/src/utils/analytics';
import { fetchMyTravels } from '@/src/api/travelsApi';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import HomeHero from './HomeHero';
import HomeHowItWorks from './HomeHowItWorks';

const HomeInspirationSections = lazy(() => import('./HomeInspirationSection'));
const HomeFinalCTA = lazy(() => import('./HomeFinalCTA'));

const SectionSkeleton = ({ isMobile }: { isMobile: boolean }) => (
  <View style={{ padding: isMobile ? 24 : 60, gap: 24 }}>
    <SkeletonLoader width={isMobile ? 200 : 300} height={isMobile ? 28 : 40} borderRadius={8} />
    <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap' }}>
      {Array.from({ length: isMobile ? 2 : 3 }).map((_, i) => (
        <SkeletonLoader key={i} width={isMobile ? '45%' : '30%'} height={280} borderRadius={12} />
      ))}
    </View>
  </View>
);

export default function Home() {
  const isFocused = useIsFocused();
  const { isAuthenticated, userId } = useAuth();
  const { width } = useWindowDimensions();
  
  // Responsive breakpoints for all devices
  const isSmallMobile = width <= 480;  // Small phones (320px-480px)
  const isMobile = width <= 768;        // Mobile & tablets (up to 768px)
  const isTablet = width > 480 && width <= 1024; // Tablets (481px-1024px)
  const isDesktop = width > 1024;       // Desktop (1025px+)

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

  if (isAuthenticated && isLoadingTravels) {
    const padding = isSmallMobile ? 16 : isMobile ? 24 : isTablet ? 40 : 60;
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ padding, gap: isSmallMobile ? 16 : 24 }}>
          <SkeletonLoader 
            width={isMobile ? '90%' : 500} 
            height={isSmallMobile ? 28 : isMobile ? 32 : 48} 
            borderRadius={8} 
          />
          <SkeletonLoader 
            width={isMobile ? '80%' : 400} 
            height={isSmallMobile ? 16 : isMobile ? 18 : 20} 
            borderRadius={4} 
          />
          <View style={{ 
            flexDirection: isSmallMobile ? 'column' : 'row', 
            gap: isSmallMobile ? 12 : 16, 
            marginTop: 16 
          }}>
            <SkeletonLoader 
              width={isSmallMobile ? '100%' : isMobile ? '100%' : 200} 
              height={56} 
              borderRadius={8} 
            />
          </View>
        </View>
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
      <HomeHero travelsCount={travelsCount} />
      <HomeHowItWorks />
      
      {showHeavyContent ? (
        <Suspense fallback={<SectionSkeleton isMobile={isMobile} />}>
          <HomeInspirationSections />
        </Suspense>
      ) : (
        <SectionSkeleton isMobile={isMobile} />
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
});
