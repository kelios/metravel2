import React, { Suspense, memo, useCallback, useEffect, useState } from 'react'
import { Animated, InteractionManager, Platform, Text, View } from 'react-native'
import type { Travel } from '@/types/types'
import {
  CommentsSkeleton,
  MapSkeleton,
  TravelListSkeleton,
} from '@/components/travel/TravelDetailSkeletons'

import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDetailsStyles } from './TravelDetailsStyles'
import { withLazy } from './TravelDetailsLazy'
import { rIC } from '@/utils/rIC'

const TravelDetailsContentSection = withLazy(() =>
  import('./sections/TravelDetailsContentSection').then((m) => ({
    default: m.TravelDetailsContentSection,
  }))
)
const TravelDetailsMapSection = withLazy(() =>
  import('./sections/TravelDetailsMapSection').then((m) => ({
    default: m.TravelDetailsMapSection,
  }))
)
const TravelDetailsSidebarSection = withLazy(() =>
  import('./sections/TravelDetailsSidebarSection').then((m) => ({
    default: m.TravelDetailsSidebarSection,
  }))
)
const TravelDetailsFooterSection = withLazy(() =>
  import('./sections/TravelDetailsFooterSection').then((m) => ({
    default: m.TravelDetailsFooterSection,
  }))
)

const CommentsSection = withLazy(() =>
  import('@/components/travel/CommentsSection').then((m) => ({
    default: m.CommentsSection,
  }))
)

const AuthorCard = withLazy(() => import('@/components/travel/AuthorCard'))
const ShareButtons = withLazy(() => import('@/components/travel/ShareButtons'))

const DeferredMapPlaceholder = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}>
      <Text style={styles.sectionHeaderText}>Карта маршрута</Text>
      <View style={{ marginTop: 12 }}>
        <MapSkeleton />
      </View>
    </View>
  )
}

const DeferredSidebarPlaceholder = () => {
  const styles = useTravelDetailsStyles()
  return (
    <>
      <View style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}>
        <Text style={styles.sectionHeaderText}>Рядом можно посмотреть</Text>
        <View style={{ marginTop: 8 }}>
          <TravelListSkeleton count={3} />
        </View>
      </View>
      <View style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}>
        <Text style={styles.sectionHeaderText}>Популярные маршруты</Text>
        <View style={{ marginTop: 8 }}>
          <TravelListSkeleton count={3} />
        </View>
      </View>
    </>
  )
}

const DeferredCommentsPlaceholder = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}>
      <Text style={styles.sectionHeaderText}>Комментарии</Text>
      <View style={{ marginTop: 8 }}>
        <CommentsSkeleton />
      </View>
    </View>
  )
}

export const TravelDeferredSections: React.FC<{
  travel: Travel
  isMobile: boolean
  forceOpenKey: string | null
  anchors: AnchorsMap
  scrollY: Animated.Value
  viewportHeight: number
  scrollToMapSection: () => void
}> = memo(({
  travel,
  isMobile,
  forceOpenKey,
  anchors,
  scrollY,
  viewportHeight,
  scrollToMapSection,
}) => {
  const [canRenderHeavy, setCanRenderHeavy] = useState(false)
  const [canRenderMap, setCanRenderMap] = useState(false)
  const [canRenderSidebar, setCanRenderSidebar] = useState(false)
  const [canRenderComments, setCanRenderComments] = useState(false)

  const tdTraceEnabled =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    (process.env.EXPO_PUBLIC_TD_TRACE === '1' || (window as any).__METRAVEL_TD_TRACE === true)

  const tdTrace = useCallback(
    (event: string, data?: any) => {
      if (!tdTraceEnabled) return
      try {
        const perf = (window as any).performance
        const now = typeof perf?.now === 'function' ? perf.now() : Date.now()
        const base =
          (window as any).__METRAVEL_TD_TRACE_START ??
          (typeof perf?.now === 'function' ? perf.now() : now)
        ;(window as any).__METRAVEL_TD_TRACE_START = base
        const delta = Math.round(now - base)
        // eslint-disable-next-line no-console
        console.log(`[TD] +${delta}ms ${event}`, data ?? '')
        if (typeof perf?.mark === 'function') perf.mark(`TD:${event}`)
      } catch {
        // noop
      }
    },
    [tdTraceEnabled]
  )

  useEffect(() => {
    tdTrace('deferred:mount', { travelId: travel?.id })
    return () => tdTrace('deferred:unmount', { travelId: travel?.id })
  }, [tdTrace, travel?.id])

  useEffect(() => {
    if (Platform.OS === 'web') return
    const task = InteractionManager.runAfterInteractions(() => setCanRenderHeavy(true))
    return () => task.cancel()
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Parent Defer wrapper already gates mounting — no extra delay needed.
      setCanRenderHeavy(true)
    }
  }, [])

  useEffect(() => {
    if (canRenderHeavy) tdTrace('deferred:heavy:enabled')
  }, [canRenderHeavy, tdTrace])

  // Stagger heavy sections on web to spread TBT across multiple idle periods
  // instead of mounting all chunks at once.
  useEffect(() => {
    if (!canRenderHeavy) return
    if (Platform.OS !== 'web') {
      setCanRenderMap(true)
      setCanRenderSidebar(true)
      setCanRenderComments(true)
      return
    }
    // Map section: next idle after content
    const cancelMap = rIC(() => setCanRenderMap(true), 600)
    // Sidebar (near/popular lists): after map
    const cancelSidebar = rIC(() => setCanRenderSidebar(true), 1000)
    // CommentsSection chunk is ~247ms to parse — load it last.
    const cancelComments = rIC(() => setCanRenderComments(true), 1500)
    return () => {
      cancelMap()
      cancelSidebar()
      cancelComments()
    }
  }, [canRenderHeavy])

  useEffect(() => {
    if (canRenderMap) tdTrace('deferred:map:enabled')
  }, [canRenderMap, tdTrace])

  useEffect(() => {
    if (canRenderSidebar) tdTrace('deferred:sidebar:enabled')
  }, [canRenderSidebar, tdTrace])

  useEffect(() => {
    if (canRenderComments) tdTrace('deferred:comments:enabled')
  }, [canRenderComments, tdTrace])

  return (
    <>
      <Suspense fallback={null}>
        <TravelDetailsContentSection
          travel={travel}
          isMobile={isMobile}
          anchors={anchors}
          forceOpenKey={forceOpenKey}
        />
      </Suspense>

      {/* P0-2: AuthorCard и ShareButtons после контента на mobile */}
      {isMobile && (
        <MobileAuthorShareSection travel={travel} />
      )}

      {canRenderMap ? (
        <Suspense fallback={<DeferredMapPlaceholder />}>
          <TravelDetailsMapSection
            travel={travel}
            anchors={anchors}
            canRenderHeavy={canRenderHeavy}
            scrollToMapSection={scrollToMapSection}
          />
        </Suspense>
      ) : (
        <DeferredMapPlaceholder />
      )}

      {canRenderSidebar ? (
        <Suspense fallback={<DeferredSidebarPlaceholder />}>
          <TravelDetailsSidebarSection
            travel={travel}
            anchors={anchors}
            scrollY={scrollY}
            viewportHeight={viewportHeight}
            canRenderHeavy={canRenderHeavy}
          />
        </Suspense>
      ) : (
        <DeferredSidebarPlaceholder />
      )}

      <View 
        ref={anchors.comments} 
        collapsable={false}
        {...(Platform.OS === 'web' ? { 'data-section-key': 'comments' } : {})}
      >
        {canRenderComments && travel?.id ? (
          <Suspense fallback={<DeferredCommentsPlaceholder />}>
            <CommentsSection travelId={travel.id} />
          </Suspense>
        ) : (
          <DeferredCommentsPlaceholder />
        )}
      </View>

      <TravelEngagementSection travel={travel} isMobile={isMobile} />
    </>
  )
})

const MobileAuthorShareSection: React.FC<{ travel: Travel }> = memo(({ travel }) => {
  const styles = useTravelDetailsStyles()
  return (
    <>
      <View
        testID="travel-details-author-mobile"
        accessibilityRole="none"
        accessibilityLabel="Автор маршрута"
        style={[styles.sectionContainer, styles.contentStable, styles.authorCardContainer]}
      >
        <Text style={styles.sectionHeaderText}>Автор</Text>
        <Text style={styles.sectionSubtitle}>Профиль, соцсети и другие путешествия автора</Text>
        <View style={{ marginTop: 12 }}>
          <Suspense fallback={<View style={{ minHeight: 160 }} />}>
            <AuthorCard travel={travel} />
          </Suspense>
        </View>
      </View>

      <View
        testID="travel-details-share-mobile"
        accessibilityRole="none"
        accessibilityLabel="Поделиться маршрутом"
        style={[styles.sectionContainer, styles.contentStable, styles.shareButtonsContainer]}
      >
        <Suspense fallback={<View style={{ minHeight: 56 }} />}>
          <ShareButtons travel={travel} />
        </Suspense>
      </View>
    </>
  )
})

export const TravelEngagementSection: React.FC<{ travel: Travel; isMobile: boolean }> = (props) => {
  return <TravelDetailsFooterSection {...props} />
}
