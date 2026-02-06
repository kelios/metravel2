import React, { useEffect, Suspense, lazy, useState, memo, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { ResponsiveContainer, ResponsiveStack } from '@/components/layout';
import HomeHero from './HomeHero';
import { queueAnalyticsEvent } from '@/utils/analytics';

const isWeb = Platform.OS === 'web';

const HomeTrustBlock = lazy(() => import('./HomeTrustBlock'));
const HomeHowItWorks = lazy(() => import('./HomeHowItWorks'));
const HomeFAQSection = lazy(() => import('./HomeFAQSection'));
const HomeInspirationSections = lazy(() => import('./HomeInspirationSection'));
const HomeFinalCTA = lazy(() => import('./HomeFinalCTA'));
const OnboardingBanner = lazy(() => import('./OnboardingBanner'));

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
  const { isAuthenticated } = useAuth();
  const colors = useThemedColors();
  const { isSmallPhone, isPhone } = useResponsive();
  const isMobile = isSmallPhone || isPhone;

  const [showHeavyContent, setShowHeavyContent] = useState(false);
  const [hydrated, setHydrated] = useState(!isWeb);

  useEffect(() => {
    if (!isWeb) return;
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const show = () => {
      if (cancelled) return;
      setShowHeavyContent(true);
    };

    const fallbackMs = Platform.OS === 'web'
      ? (isMobile ? 1400 : 900)
      : (isMobile ? 700 : 150);
    const timer = setTimeout(show, fallbackMs);

    let idleId: any = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(
        () => {
          clearTimeout(timer);
          show();
        },
        { timeout: Math.max(900, fallbackMs) }
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
  }, [isMobile]);

  // Lightweight: avoid fetching full list of user travels on home screen.
  // Count can be provided later from a dedicated endpoint if needed.
  const travelsCount = 0;

  useEffect(() => {
    if (!isFocused) return;
    const payload = {
      authState: isAuthenticated ? 'authenticated' : 'guest',
      travelsCountBucket: travelsCount === 0 ? '0' : travelsCount <= 3 ? '1-3' : '4+',
    };

    queueAnalyticsEvent('HomeViewed', payload);
  }, [isFocused, isAuthenticated, travelsCount]);

  const heavyFadeStyle = useMemo(
    () =>
      isWeb
        ? ({ opacity: showHeavyContent ? 1 : 0, transition: 'opacity 0.3s ease' } as any)
        : { opacity: showHeavyContent ? 1 : 0 },
    [showHeavyContent],
  );

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      flexGrow: 1,
      paddingBottom: Platform.select({
        ios: 120,
        android: 100,
        default: 96,
      }),
    },
  }), [colors]);

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
    >
      <HomeHero travelsCount={travelsCount} />

      {isAuthenticated && (
        <Suspense fallback={null}>
          <OnboardingBanner />
        </Suspense>
      )}

      {hydrated ? (
        <Suspense fallback={<View style={{ minHeight: 220 }} />}>
          <HomeTrustBlock />
        </Suspense>
      ) : (
        <View style={{ minHeight: 220 }} />
      )}

      {hydrated ? (
        <Suspense fallback={<View style={{ minHeight: 320 }} />}>
          <HomeHowItWorks />
        </Suspense>
      ) : (
        <View style={{ minHeight: 320 }} />
      )}

      {showHeavyContent ? (
        <View style={heavyFadeStyle}>
          <Suspense fallback={<SectionSkeleton hydrated={hydrated} />}>
            <HomeInspirationSections />
          </Suspense>
        </View>
      ) : (
        <SectionSkeleton hydrated={hydrated} />
      )}

      {hydrated ? (
        <Suspense fallback={<View style={{ minHeight: 260 }} />}>
          <HomeFAQSection />
        </Suspense>
      ) : (
        <View style={{ minHeight: 260 }} />
      )}

      {showHeavyContent ? (
        <View style={heavyFadeStyle}>
          <Suspense fallback={<View style={{ height: 300 }} />}>
            <HomeFinalCTA travelsCount={travelsCount} />
          </Suspense>
        </View>
      ) : (
        <View style={{ height: 300 }} />
      )}
    </ScrollView>
  );
}

export default memo(Home);
