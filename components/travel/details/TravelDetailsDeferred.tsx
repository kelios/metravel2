import React, { Suspense, memo, useEffect, useState } from 'react'
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
import { useTdTrace } from '@/hooks/useTdTrace'

import { TravelDetailsContentSection } from './sections/TravelDetailsContentSection'
import { TravelDetailsFooterSection } from './sections/TravelDetailsFooterSection'

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
const CommentsSection = withLazy(() =>
  import('@/components/travel/CommentsSection').then((m) => ({
    default: m.CommentsSection,
  }))
)

const TravelRatingSection = withLazy(() =>
  import('@/components/travel/TravelRatingSection')
)

const AuthorCard = withLazy(() => import('@/components/travel/AuthorCard'))
const ShareButtons = withLazy(() => import('@/components/travel/ShareButtons'))

const PLACEHOLDER_MT_12 = { marginTop: 12 } as const
const PLACEHOLDER_MT_8 = { marginTop: 8 } as const
const PLACEHOLDER_MIN_H_160 = { minHeight: 160 } as const
const PLACEHOLDER_MIN_H_56 = { minHeight: 56 } as const

const DeferredMapPlaceholder = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}>
      <Text style={styles.sectionHeaderText}>Карта маршрута</Text>
      <View style={PLACEHOLDER_MT_12}>
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
        <View style={PLACEHOLDER_MT_8}>
          <TravelListSkeleton count={3} />
        </View>
      </View>
      <View style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}>
        <Text style={styles.sectionHeaderText}>Популярные маршруты</Text>
        <View style={PLACEHOLDER_MT_8}>
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
      <View style={PLACEHOLDER_MT_8}>
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

  const tdTrace = useTdTrace()

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
    const cancelMap = rIC(() => setCanRenderMap(true), 1200)
    // Sidebar (near/popular lists): after map
    const cancelSidebar = rIC(() => setCanRenderSidebar(true), 2500)
    // CommentsSection chunk is ~247ms to parse — load it last.
    const cancelComments = rIC(() => setCanRenderComments(true), 4000)
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
      <TravelDetailsContentSection
        travel={travel}
        isMobile={isMobile}
        anchors={anchors}
        forceOpenKey={forceOpenKey}
      />

      {/* P0-2: AuthorCard и ShareButtons после контента на mobile */}
      {isMobile && (
        <MobileAuthorShareSection travel={travel} />
      )}

      {/* Секция рейтинга путешествия */}
      <TravelRatingWrapper travel={travel} />

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

      <TravelDetailsFooterSection travel={travel} isMobile={isMobile} />
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
        <View style={PLACEHOLDER_MT_12}>
          <Suspense fallback={<View style={PLACEHOLDER_MIN_H_160} />}>
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
        <Suspense fallback={<View style={PLACEHOLDER_MIN_H_56} />}>
          <ShareButtons travel={travel} />
        </Suspense>
      </View>
    </>
  )
})

const TravelRatingWrapper: React.FC<{ travel: Travel }> = memo(({ travel }) => {
  const styles = useTravelDetailsStyles()

  if (!travel?.id) return null

  return (
    <View
      testID="travel-details-rating"
      accessibilityRole="none"
      accessibilityLabel="Рейтинг путешествия"
      style={[styles.sectionContainer, styles.contentStable]}
    >
      <Suspense fallback={<View style={PLACEHOLDER_MIN_H_56} />}>
        <TravelRatingSection
          travelId={travel.id}
          initialRating={travel.rating}
          initialCount={travel.rating_count}
          initialUserRating={travel.user_rating}
        />
      </Suspense>
    </View>
  )
})

export const TravelEngagementSection = TravelDetailsFooterSection
