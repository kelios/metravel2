import React, { useEffect, Suspense, lazy, useState, useCallback, memo, useMemo } from 'react';
import { View, StyleSheet, FlatList, Platform, Animated } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { sendAnalyticsEvent } from '@/src/utils/analytics';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { ResponsiveContainer, ResponsiveStack } from '@/components/layout';
import HomeHero from './HomeHero';

const isWeb = Platform.OS === 'web';

const HomeTrustBlock = lazy(() => import('./HomeTrustBlock'));
const HomeHowItWorks = lazy(() => import('./HomeHowItWorks'));
const HomeFAQSection = lazy(() => import('./HomeFAQSection'));
const HomeInspirationSections = lazy(() => import('./HomeInspirationSection'));
const HomeFavoritesHistorySection = lazy(() => import('./HomeFavoritesHistorySection'));
const HomeFinalCTA = lazy(() => import('./HomeFinalCTA'));

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

  const [showHeavyContent, setShowHeavyContent] = useState(false);
  const [hydrated, setHydrated] = useState(!isWeb);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isWeb) return;
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const show = () => {
      if (cancelled) return;
      setShowHeavyContent(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(show, { timeout: 2000 });
      return () => {
        cancelled = true;
        try {
          ;(window as any).cancelIdleCallback?.(id);
        } catch {
          // noop
        }
      };
    }

    const timer = setTimeout(show, Platform.OS === 'web' ? 800 : 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fadeAnim]);

  // Lightweight: avoid fetching full list of user travels on home screen.
  // Count can be provided later from a dedicated endpoint if needed.
  const travelsCount = 0;

  useEffect(() => {
    if (!isFocused) return;
    const payload = {
      authState: isAuthenticated ? 'authenticated' : 'guest',
      travelsCountBucket: travelsCount === 0 ? '0' : travelsCount <= 3 ? '1-3' : '4+',
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => sendAnalyticsEvent('HomeViewed', payload));
      return;
    }

    setTimeout(() => sendAnalyticsEvent('HomeViewed', payload), 0);
  }, [isFocused, isAuthenticated, travelsCount]);

  const sections = useMemo(() => (
    [
      'hero',
      'trust',
      'howItWorks',
      ...(isAuthenticated ? (['favoritesHistory'] as const) : []),
      'inspiration',
      'faq',
      'finalCta',
    ] as const
  ), [isAuthenticated]);

  const sectionCount = sections.length;

  const renderSection = useCallback(({ item }: { item: typeof sections[number] }) => {
    switch (item) {
      case 'hero':
        return <HomeHero travelsCount={travelsCount} />;
      case 'trust':
        if (!hydrated) return <View style={{ minHeight: 220 }} />;
        return (
          <Suspense fallback={<View style={{ minHeight: 220 }} />}>
            <HomeTrustBlock />
          </Suspense>
        );
      case 'howItWorks':
        if (!hydrated) return <View style={{ minHeight: 320 }} />;
        return (
          <Suspense fallback={<View style={{ minHeight: 320 }} />}>
            <HomeHowItWorks />
          </Suspense>
        );
      case 'favoritesHistory':
        return showHeavyContent ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            <Suspense fallback={<View style={{ height: 240 }} />}>
              <HomeFavoritesHistorySection />
            </Suspense>
          </Animated.View>
        ) : (
          <View style={{ height: 240 }} />
        );
      case 'inspiration':
        return showHeavyContent ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            <Suspense fallback={<SectionSkeleton hydrated={hydrated} />}>
              <HomeInspirationSections />
            </Suspense>
          </Animated.View>
        ) : (
          <SectionSkeleton hydrated={hydrated} />
        );
      case 'faq':
        if (!hydrated) return <View style={{ minHeight: 260 }} />;
        return (
          <Suspense fallback={<View style={{ minHeight: 260 }} />}>
            <HomeFAQSection />
          </Suspense>
        );
      case 'finalCta':
        return showHeavyContent ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            <Suspense fallback={<View style={{ height: 300 }} />}>
              <HomeFinalCTA travelsCount={travelsCount} />
            </Suspense>
          </Animated.View>
        ) : (
          <View style={{ height: 300 }} />
        );
      default:
        return null;
    }
  }, [travelsCount, showHeavyContent, hydrated, fadeAnim]);

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

  const isTestEnv = process.env.NODE_ENV === 'test';
  const initialNumToRender = isTestEnv ? sectionCount : (Platform.OS === 'web' ? 1 : 3);
  const maxToRenderPerBatch = isTestEnv ? sectionCount : (Platform.OS === 'web' ? 1 : 3);

  return (
    <FlatList
      data={sections}
      keyExtractor={(item) => item}
      renderItem={renderSection}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={Platform.OS === 'web' ? 32 : 16}
      removeClippedSubviews={Platform.OS === 'android'}
      initialNumToRender={Math.min(initialNumToRender, sectionCount)}
      maxToRenderPerBatch={Math.min(maxToRenderPerBatch, sectionCount)}
      windowSize={Platform.OS === 'web' ? 5 : 7}
      updateCellsBatchingPeriod={Platform.OS === 'web' ? 50 : 16}
      nestedScrollEnabled={Platform.OS === 'android'}
      {...Platform.select({
        web: {
          style: [
            styles.container,
            { touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' } as any,
          ],
        },
      })}
    />
  );
}

export default memo(Home);
