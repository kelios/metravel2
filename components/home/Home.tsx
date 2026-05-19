import React, { Suspense, lazy, memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useIsFocused } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/context/AuthContext'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useThemedColors } from '@/hooks/useTheme'
import { ResponsiveContainer, ResponsiveStack } from '@/components/layout'
import HomeHero from './HomeHero'
import { queueAnalyticsEvent } from '@/utils/analytics'
import { hapticImpact } from '@/utils/haptics'
import { fetchMyTravels, unwrapMyTravelsPayload } from '@/api/travelUserQueries'
import { useHomeViewport } from './useHomeViewport'

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

const HomeHowItWorks = lazy(() => import('./HomeHowItWorks'))
const HomeFAQSection = lazy(() => import('./HomeFAQSection'))
const HomeInspirationSections = lazy(() => import('./HomeInspirationSections'))
const HomeFavoritesHistorySection = lazy(() => import('./HomeFavoritesHistorySection'))
const HomeRandomRoutesSection = lazy(() => import('./HomeRandomRoutesSection'))
const HomeWeekendRoutesSection = lazy(() => import('./HomeWeekendRoutesSection'))
const HomeBottomCtaSection = lazy(() => import('./HomeBottomCtaSection'))

type PageSectionProps = {
  children: React.ReactNode
  marginTop: number
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'full' | number
  padding?: boolean
}

function PageSection({
  children,
  marginTop,
  maxWidth = 'xl',
  padding = true,
}: PageSectionProps) {
  return (
    <ResponsiveContainer maxWidth={maxWidth} padding={padding}>
      <View style={{ marginTop }}>{children}</View>
    </ResponsiveContainer>
  )
}

function Section({
  children,
  marginTop,
  minHeight,
}: {
  children: React.ReactNode
  marginTop: number
  minHeight?: number
}) {
  return <View style={minHeight ? { marginTop, minHeight } : { marginTop }}>{children}</View>
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
    queryKey: ['my-travels-count', userId],
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

      <PageSection marginTop={gap.hero}>
        <Suspense fallback={<SectionSkeleton />}>
          <HomeRandomRoutesSection />
        </Suspense>
      </PageSection>

      <Section marginTop={gap.howItWorks} minHeight={HOW_IT_WORKS_PLACEHOLDER_STYLE.minHeight}>
        <Suspense
          fallback={
            <HowItWorksFallback colors={colors} isMobile={isMobile} padH={padH} padV={padV} />
          }
        >
          <HomeHowItWorks />
        </Suspense>
      </Section>

      <PageSection marginTop={gap.weekends}>
        <Suspense fallback={<SectionSkeleton />}>
          <HomeWeekendRoutesSection />
        </Suspense>
      </PageSection>

      <Section marginTop={gap.history}>
        <Suspense fallback={<SectionSkeleton />}>
          <HomeFavoritesHistorySection />
        </Suspense>
      </Section>

      <Section marginTop={gap.sections}>
        <Suspense fallback={<SectionSkeleton />}>
          <HomeInspirationSections />
        </Suspense>
      </Section>

      <Section marginTop={gap.faq}>
        <Suspense
          fallback={<FaqFallback colors={colors} isMobile={isMobile} padH={padH} padV={padV} />}
        >
          <HomeFAQSection />
        </Suspense>
      </Section>

      <Section marginTop={gap.finalCta}>
        <Suspense fallback={<SectionSkeleton />}>
          <HomeBottomCtaSection travelsCount={travelsCount} />
        </Suspense>
      </Section>
    </ScrollView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, isMobile: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    contentContainer: {
      flexGrow: 1,
      paddingBottom: Platform.select({
        web: isMobile ? 96 : 120,
        ios: 96,
        android: 88,
        default: 120,
      }),
    },
  })

export default memo(Home)
