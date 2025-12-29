import React, { useEffect, Suspense, lazy, useState, useCallback, memo } from 'react';
import { View, StyleSheet, FlatList, Platform, Animated } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { sendAnalyticsEvent } from '@/src/utils/analytics';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { useResponsive } from '@/hooks/useResponsive';
import { ResponsiveContainer, ResponsiveStack } from '@/components/layout';
import HomeHero from './HomeHero';
import HomeTrustBlock from './HomeTrustBlock';
import HomeHowItWorks from './HomeHowItWorks';
import HomeFAQSection from './HomeFAQSection';

const HomeInspirationSections = lazy(() => import('./HomeInspirationSection'));
const HomeFavoritesHistorySection = lazy(() => import('./HomeFavoritesHistorySection'));
const HomeFinalCTA = lazy(() => import('./HomeFinalCTA'));

const SectionSkeleton = memo(() => {
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
});

SectionSkeleton.displayName = 'SectionSkeleton';

function Home() {
  const isFocused = useIsFocused();
  const { isAuthenticated } = useAuth();

  const [showHeavyContent, setShowHeavyContent] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Уменьшаем задержку с 100ms до 50ms для быстрой загрузки
    const timer = setTimeout(() => {
      setShowHeavyContent(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 50);
    return () => clearTimeout(timer);
  }, [fadeAnim]);

  // Lightweight: avoid fetching full list of user travels on home screen.
  // Count can be provided later from a dedicated endpoint if needed.
  const travelsCount = 0;

  useEffect(() => {
    if (!isFocused) return;
    sendAnalyticsEvent('HomeViewed', {
      authState: isAuthenticated ? 'authenticated' : 'guest',
      travelsCountBucket: travelsCount === 0 ? '0' : travelsCount <= 3 ? '1-3' : '4+',
    });
  }, [isFocused, isAuthenticated, travelsCount]);

  const sections = [
    'hero',
    'trust',
    'howItWorks',
    ...(isAuthenticated ? (['favoritesHistory'] as const) : []),
    'inspiration',
    'faq',
    'finalCta',
  ] as const;

  const sectionCount = sections.length;

  const renderSection = useCallback(({ item }: { item: typeof sections[number] }) => {
    switch (item) {
      case 'hero':
        return <HomeHero travelsCount={travelsCount} />;
      case 'trust':
        return <HomeTrustBlock />;
      case 'howItWorks':
        return <HomeHowItWorks />;
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
            <Suspense fallback={<SectionSkeleton />}>
              <HomeInspirationSections />
            </Suspense>
          </Animated.View>
        ) : (
          <SectionSkeleton />
        );
      case 'faq':
        return <HomeFAQSection />;
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
  }, [travelsCount, showHeavyContent, fadeAnim]);

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
      initialNumToRender={sectionCount}
      maxToRenderPerBatch={sectionCount}
      windowSize={Platform.OS === 'web' ? 5 : 7}
      updateCellsBatchingPeriod={Platform.OS === 'web' ? 50 : 16}
      nestedScrollEnabled={Platform.OS === 'android'}
      getItemLayout={(data, index) => ({
        length: 400, // Средняя высота секции
        offset: 400 * index,
        index,
      })}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DESIGN_TOKENS.colors.background,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: Platform.select({
      ios: 120,
      android: 100,
      default: 96,
    }),
  },
});
