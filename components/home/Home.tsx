import React, { Suspense, memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useIsFocused } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/context/AuthContext'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useThemedColors } from '@/hooks/useTheme'
import { ResponsiveContainer, ResponsiveStack } from '@/components/layout'
import HomeHero from './HomeHero'
import { queueAnalyticsEvent } from '@/utils/analytics'
import { hapticImpact } from '@/utils/haptics'
import { fetchMyTravels, unwrapMyTravelsPayload } from '@/api/travelUserQueries'
import { queryKeys } from '@/api/queryKeys'
import { useHomeViewport } from './useHomeViewport'
import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'
import {
  HomeBottomCtaSection,
  HomeFAQSection,
  HomeHowItWorks,
  HomeInspirationSections,
  HomeQuestsPromoSection,
  HomeStartHereSection,
  HomeWeekendRoutesSection,
} from './homeDeferredSections'

const IS_WEB = Platform.OS === 'web'

const HOW_IT_WORKS_PLACEHOLDER_STYLE = { minHeight: 420 } as const
const FAQ_PLACEHOLDER_STYLE = { minHeight: 360 } as const

const WEB_SCROLL_STYLE = IS_WEB
  ? ({
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-y',
      overscrollBehaviorY: 'contain',
    } as any)
  : undefined

type PageSectionProps = {
  children: React.ReactNode
  marginTop: number
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'full' | number
  padding?: boolean
}

type DeferredSectionProps = {
  children: React.ReactNode
  fallback: React.ReactNode
  marginTop: number
  minHeight?: number
  container?: { maxWidth?: PageSectionProps['maxWidth']; padding?: boolean }
  rootMargin?: string
  fallbackDelay?: number
}

// Below-the-fold island: on web its lazy chunk only starts loading when the
// section approaches the viewport (or after a short fallback timer), so heavy
// sections don't compete with the hero LCP. On native useProgressiveLoad
// returns shouldLoad=true immediately, preserving current behavior.
function DeferredSection({
  children,
  fallback,
  marginTop,
  minHeight,
  container,
  rootMargin = '400px',
  fallbackDelay = 1000,
}: DeferredSectionProps) {
  const { shouldLoad, setElementRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin,
    fallbackDelay,
  })

  const content = shouldLoad ? <Suspense fallback={fallback}>{children}</Suspense> : fallback
  const wrapped = container ? (
    <ResponsiveContainer maxWidth={container.maxWidth ?? 'xl'} padding={container.padding ?? true}>
      {content}
    </ResponsiveContainer>
  ) : (
    content
  )

  return (
    <View
      ref={IS_WEB ? (setElementRef as any) : undefined}
      style={minHeight ? { marginTop, minHeight } : { marginTop }}
    >
      {wrapped}
    </View>
  )
}

const SectionSkeleton = memo(function SectionSkeleton() {
  return (
    <ResponsiveContainer padding>
      <ResponsiveStack direction="vertical" gap={24}>
        <SkeletonLoader width={300} height={40} borderRadius={8} />
        <ResponsiveStack direction="responsive" gap={20} wrap>
          {[0, 1, 2].map((i) => (
            <SkeletonLoader key={i} width="30%" height={280} borderRadius={12} />
          ))}
        </ResponsiveStack>
      </ResponsiveStack>
    </ResponsiveContainer>
  )
})

type FallbackProps = {
  colors: ReturnType<typeof useThemedColors>
  isMobile: boolean
  padH: number
  padV: number
}

const skeletonShellStyle = (padH: number, padV: number) =>
  ({
    paddingHorizontal: padH,
    paddingVertical: padV,
    maxWidth: 1200,
    alignSelf: 'center' as const,
    width: '100%' as const,
  })

const HowItWorksFallback = memo(function HowItWorksFallback({
  colors,
  isMobile,
  padH,
  padV,
}: FallbackProps) {
  return (
    <View style={skeletonShellStyle(padH, padV)}>
      <SkeletonLoader
        width={isMobile ? 180 : 260}
        height={isMobile ? 28 : 36}
        borderRadius={8}
        style={{ alignSelf: 'center' }}
      />
      <View
        style={{
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 16 : 24,
          marginTop: isMobile ? 24 : 40,
        }}
      >
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              flex: isMobile ? undefined : 1,
              backgroundColor: colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              padding: isMobile ? 20 : 28,
              gap: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <SkeletonLoader width={56} height={56} borderRadius={8} />
              <SkeletonLoader width={36} height={36} borderRadius={18} />
            </View>
            <SkeletonLoader width="70%" height={20} borderRadius={6} />
            <SkeletonLoader width="90%" height={14} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  )
})

const FaqFallback = memo(function FaqFallback({
  colors,
  isMobile,
  padH,
  padV,
}: FallbackProps) {
  return (
    <View style={FAQ_PLACEHOLDER_STYLE}>
      <View style={skeletonShellStyle(padH, padV)}>
        <SkeletonLoader
          width={100}
          height={28}
          borderRadius={8}
          style={{ alignSelf: 'center', marginBottom: isMobile ? 20 : 32 }}
        />
        <View style={{ gap: isMobile ? 8 : 12 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                padding: isMobile ? 12 : 16,
              }}
            >
              <SkeletonLoader
                width={i % 2 === 0 ? '70%' : '55%'}
                height={16}
                borderRadius={4}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
})

function Home() {
  const isFocused = useIsFocused()
  const { isAuthenticated, userId } = useAuth()
  const colors = useThemedColors()
  const queryClient = useQueryClient()
  const { isSmallPhone, isPhone } = useHomeViewport()
  const isMobile = isSmallPhone || isPhone

  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    hapticImpact('light')
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries()
    } finally {
      setRefreshing(false)
    }
  }, [queryClient])

  const { data: myTravelsData, isLoading: travelsCountLoading } = useQuery({
    queryKey: queryKeys.myTravelsCount(userId),
    queryFn: async (): Promise<{ items: Record<string, unknown>[]; total: number }> => {
      if (!userId) return { items: [], total: 0 }
      try {
        const payload = await fetchMyTravels({ user_id: userId, perPage: 1 })
        return unwrapMyTravelsPayload(payload)
      } catch {
        return { items: [], total: 0 }
      }
    },
    enabled: isAuthenticated && !!userId && isFocused,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const travelsCount = myTravelsData?.total ?? 0

  useEffect(() => {
    if (!isFocused) return
    queueAnalyticsEvent('HomeViewed', {
      authState: isAuthenticated ? 'authenticated' : 'guest',
    })
  }, [isFocused, isAuthenticated])

  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile])

  const layout = useMemo(
    () =>
      isMobile
        ? {
            gap: { hero: 28, howItWorks: 32, weekends: 36, history: 24, sections: 40, faq: 48, finalCta: 24 },
            padH: 8,
            padV: 36,
          }
        : {
            gap: { hero: 48, howItWorks: 56, weekends: 64, history: 40, sections: 72, faq: 80, finalCta: 40 },
            padH: 24,
            padV: 64,
          },
    [isMobile],
  )
  const { gap, padH, padV } = layout

  return (
    <ScrollView
      style={[styles.container, WEB_SCROLL_STYLE]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={IS_WEB ? 32 : 16}
      nestedScrollEnabled={Platform.OS === 'android'}
      refreshControl={
        IS_WEB ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        )
      }
    >
      <HomeHero
        travelsCount={travelsCount}
        travelsCountLoading={isAuthenticated && travelsCountLoading}
      />

      <DeferredSection marginTop={gap.hero} fallback={<SectionSkeleton />}>
        <HomeStartHereSection />
      </DeferredSection>

      <DeferredSection marginTop={gap.weekends} container={{}} fallback={<SectionSkeleton />}>
        <HomeWeekendRoutesSection />
      </DeferredSection>

      <DeferredSection marginTop={gap.sections} fallback={null}>
        <HomeQuestsPromoSection />
      </DeferredSection>

      <DeferredSection marginTop={gap.sections} fallback={<SectionSkeleton />}>
        <HomeInspirationSections />
      </DeferredSection>

      <DeferredSection
        marginTop={gap.howItWorks}
        minHeight={HOW_IT_WORKS_PLACEHOLDER_STYLE.minHeight}
        fallback={
          <HowItWorksFallback colors={colors} isMobile={isMobile} padH={padH} padV={padV} />
        }
      >
        <HomeHowItWorks />
      </DeferredSection>

      <DeferredSection
        marginTop={gap.faq}
        fallback={<FaqFallback colors={colors} isMobile={isMobile} padH={padH} padV={padV} />}
      >
        <HomeFAQSection />
      </DeferredSection>

      <DeferredSection marginTop={gap.finalCta} fallback={<SectionSkeleton />}>
        <HomeBottomCtaSection travelsCount={travelsCount} />
      </DeferredSection>
    </ScrollView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, isMobile: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    contentContainer: {
      flexGrow: 1,
      // On web also reserve the floating cookie banner height (ConsentBanner publishes
      // --mt-consent-h) so the bottom CTA/sections are not hidden behind it on mobile
      // (D-004). max() keeps the existing base padding when the banner is absent/shorter.
      paddingBottom: Platform.select({
        web: (isMobile
          ? `calc(max(96px, var(--mt-consent-h, 0px)) + 8px)`
          : `calc(max(120px, var(--mt-consent-h, 0px)) + 8px)`) as any,
        ios: 96,
        android: 88,
        default: 120,
      }),
    },
  })

export default memo(Home)
