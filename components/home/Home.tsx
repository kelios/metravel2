import React, { useEffect, useRef, Suspense, lazy, useState, memo, useMemo } from 'react';
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
const TRUST_PLACEHOLDER_STYLE = { minHeight: 220 } as const;
const HOW_IT_WORKS_PLACEHOLDER_STYLE = { minHeight: 420 } as const;
const FAQ_PLACEHOLDER_STYLE = { minHeight: 360 } as const;
const FINAL_CTA_PLACEHOLDER_STYLE = { minHeight: 300 } as const;

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
        web: isMobile ? 120 : 96,
        ios: 120,
        android: 100,
        default: 96,
      }),
    },
  }), [colors, isMobile]);

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
      <HomeHero />

      {isAuthenticated && (
        <Suspense fallback={null}>
          <OnboardingBanner />
        </Suspense>
      )}

      {showHeavyContent ? (
        <View style={heavyFadeStyle}>
          <Suspense fallback={
            <View style={TRUST_PLACEHOLDER_STYLE}>
              <View style={{ paddingHorizontal: 24, paddingVertical: 40, maxWidth: 1200, alignSelf: 'center' as const, width: '100%' }}>
                <View style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, flexDirection: isMobile ? 'column' as const : 'row' as const, gap: 16 }}>
                  {[0,1,2].map(i => (
                    <View key={i} style={{ flex: isMobile ? undefined : 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 }}>
                      <SkeletonLoader width={34} height={34} borderRadius={10} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <SkeletonLoader width="60%" height={14} borderRadius={4} />
                        <SkeletonLoader width="80%" height={12} borderRadius={4} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          }>
            <HomeTrustBlock />
          </Suspense>
        </View>
      ) : (
        <View style={TRUST_PLACEHOLDER_STYLE}>
          <View style={{ paddingHorizontal: 24, paddingVertical: 40, maxWidth: 1200, alignSelf: 'center' as const, width: '100%' }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, flexDirection: isMobile ? 'column' as const : 'row' as const, gap: 16 }}>
              {[0,1,2].map(i => (
                <View key={i} style={{ flex: isMobile ? undefined : 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 }}>
                  <SkeletonLoader width={34} height={34} borderRadius={10} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <SkeletonLoader width="60%" height={14} borderRadius={4} />
                    <SkeletonLoader width="80%" height={12} borderRadius={4} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {showHeavyContent ? (
        <View style={heavyFadeStyle}>
          <Suspense fallback={
            <View style={HOW_IT_WORKS_PLACEHOLDER_STYLE}>
              <View style={{ paddingHorizontal: 24, paddingVertical: 64, maxWidth: 1200, alignSelf: 'center' as const, width: '100%' }}>
                <SkeletonLoader width={isMobile ? 180 : 260} height={isMobile ? 28 : 36} borderRadius={8} style={{ alignSelf: 'center' }} />
                <View style={{ flexDirection: isMobile ? 'column' as const : 'row' as const, gap: isMobile ? 20 : 24, marginTop: 40 }}>
                  {[0,1,2].map(i => (
                    <View key={i} style={{ flex: isMobile ? undefined : 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 28, gap: 16 }}>
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
        </View>
      ) : (
        <View style={HOW_IT_WORKS_PLACEHOLDER_STYLE}>
          <View style={{ paddingHorizontal: 24, paddingVertical: 64, maxWidth: 1200, alignSelf: 'center' as const, width: '100%' }}>
            <SkeletonLoader width={isMobile ? 180 : 260} height={isMobile ? 28 : 36} borderRadius={8} style={{ alignSelf: 'center' }} />
            <View style={{ flexDirection: isMobile ? 'column' as const : 'row' as const, gap: isMobile ? 20 : 24, marginTop: 40 }}>
              {[0,1,2].map(i => (
                <View key={i} style={{ flex: isMobile ? undefined : 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 28, gap: 16 }}>
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
        <View style={heavyFadeStyle}>
          <Suspense fallback={<SectionSkeleton hydrated />}>
            <HomeInspirationSections />
          </Suspense>
        </View>
      ) : (
        <SectionSkeleton hydrated={false} />
      )}

      <Suspense fallback={
        <View style={FAQ_PLACEHOLDER_STYLE}>
          <View style={{ paddingHorizontal: 24, paddingVertical: 64, maxWidth: 1200, alignSelf: 'center' as const, width: '100%' }}>
            <SkeletonLoader width={100} height={28} borderRadius={8} style={{ alignSelf: 'center', marginBottom: 32 }} />
            <View style={{ gap: 12 }}>
              {[0,1,2,3,4].map(i => (
                <View key={i} style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
                  <SkeletonLoader width={i % 2 === 0 ? '70%' : '55%'} height={16} borderRadius={4} />
                </View>
              ))}
            </View>
          </View>
        </View>
      }>
        <HomeFAQSection />
      </Suspense>

      {showHeavyContent ? (
        <View style={heavyFadeStyle}>
          <Suspense fallback={
            <View style={[FINAL_CTA_PLACEHOLDER_STYLE, { backgroundColor: colors.backgroundSecondary, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 72 }]}>
              <SkeletonLoader width={isMobile ? 260 : 400} height={isMobile ? 32 : 40} borderRadius={8} />
              <SkeletonLoader width={isMobile ? 200 : 340} height={20} borderRadius={6} style={{ marginTop: 16 }} />
              <SkeletonLoader width={isMobile ? 200 : 300} height={60} borderRadius={12} style={{ marginTop: 32 }} />
            </View>
          }>
            <HomeFinalCTA />
          </Suspense>
        </View>
      ) : (
        <View style={[FINAL_CTA_PLACEHOLDER_STYLE, { backgroundColor: colors.backgroundSecondary, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 72 }]}>
          <SkeletonLoader width={isMobile ? 260 : 400} height={isMobile ? 32 : 40} borderRadius={8} />
          <SkeletonLoader width={isMobile ? 200 : 340} height={20} borderRadius={6} style={{ marginTop: 16 }} />
          <SkeletonLoader width={isMobile ? 200 : 300} height={60} borderRadius={12} style={{ marginTop: 32 }} />
        </View>
      )}
    </ScrollView>
  );
}

export default memo(Home);
