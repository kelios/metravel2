import React, { Suspense, memo, useEffect, useRef, useState } from 'react'
import { Animated, InteractionManager, Platform, Text, View } from 'react-native'
import type { Travel } from '@/types/types'
import {
  CommentsSkeleton,
  MapSkeleton,
  TravelListSkeleton,
} from '@/components/travel/TravelDetailSkeletons'
import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'

import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDetailsStyles } from './TravelDetailsStyles'
import { withLazy } from './TravelDetailsLazy'
import { useTdTrace } from '@/hooks/useTdTrace'

import { TravelDetailsContentSection } from './sections/TravelDetailsContentSection'

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
const TravelDetailsFooterSection = withLazy(() =>
  import('./sections/TravelDetailsFooterSection').then((m) => ({
    default: m.TravelDetailsFooterSection,
  }))
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
  // TD-06: ref для IntersectionObserver на секции комментариев
  const commentsObserverRef = useRef<View>(null)
  const footerObserverRef = useRef<View>(null)
  const mobileAuthorShareObserverRef = useRef<View>(null)
  const ratingObserverRef = useRef<View>(null)
  const mapObserverRef = useRef<View>(null)
  const sidebarObserverRef = useRef<View>(null)

  const tdTrace = useTdTrace()
  const { shouldLoad: shouldLoadMap, setElementRef: setMapRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '120px',
    threshold: 0.05,
    fallbackDelay: 5200,
    enabled: canRenderHeavy,
  })
  const { shouldLoad: shouldLoadSidebar, setElementRef: setSidebarRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '160px',
    threshold: 0.05,
    fallbackDelay: 6200,
    enabled: canRenderHeavy,
  })
  const { shouldLoad: shouldLoadComments, setElementRef: setCommentsRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '160px',
    threshold: 0.05,
    fallbackDelay: 7000,
    enabled: canRenderHeavy,
  })
  const { shouldLoad: shouldLoadFooter, setElementRef: setFooterRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '160px',
    threshold: 0.05,
    fallbackDelay: 5200,
    enabled: canRenderHeavy,
  })
  const { shouldLoad: shouldLoadMobileAuthorShare, setElementRef: setMobileAuthorShareRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '180px',
    threshold: 0.05,
    fallbackDelay: 2600,
    enabled: canRenderHeavy && isMobile,
  })
  const { shouldLoad: shouldLoadRating, setElementRef: setRatingRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '180px',
    threshold: 0.05,
    fallbackDelay: 3000,
    enabled: canRenderHeavy,
  })

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

  useEffect(() => {
    if (shouldLoadMap) tdTrace('deferred:map:visible')
  }, [shouldLoadMap, tdTrace])

  useEffect(() => {
    if (shouldLoadSidebar) tdTrace('deferred:sidebar:visible')
  }, [shouldLoadSidebar, tdTrace])

  useEffect(() => {
    if (shouldLoadComments) tdTrace('deferred:comments:visible')
  }, [shouldLoadComments, tdTrace])

  useEffect(() => {
    if (shouldLoadFooter) tdTrace('deferred:footer:visible')
  }, [shouldLoadFooter, tdTrace])

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
        <View
          ref={(el) => {
            ;(mobileAuthorShareObserverRef as any).current = el
            setMobileAuthorShareRef(el)
          }}
          collapsable={false}
        >
          {shouldLoadMobileAuthorShare ? (
            <MobileAuthorShareSection travel={travel} />
          ) : (
            <>
              <View style={PLACEHOLDER_MIN_H_160} />
              <View style={PLACEHOLDER_MIN_H_56} />
            </>
          )}
        </View>
      )}

      {/* Секция рейтинга путешествия */}
      <View
        ref={(el) => {
          ;(ratingObserverRef as any).current = el
          setRatingRef(el)
        }}
        collapsable={false}
      >
        {shouldLoadRating ? (
          <TravelRatingWrapper travel={travel} />
        ) : (
          <View style={PLACEHOLDER_MIN_H_56} />
        )}
      </View>

      <View
        ref={(el) => {
          ;(mapObserverRef as any).current = el
          setMapRef(el)
        }}
        collapsable={false}
      >
        {shouldLoadMap ? (
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
      </View>

      <View
        ref={(el) => {
          ;(sidebarObserverRef as any).current = el
          setSidebarRef(el)
        }}
        collapsable={false}
      >
        {shouldLoadSidebar ? (
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
      </View>

      <View 
        ref={(el) => {
          (anchors.comments as any).current = el;
          (commentsObserverRef as any).current = el;
          setCommentsRef(el)
        }}
        collapsable={false}
        {...(Platform.OS === 'web' ? { 'data-section-key': 'comments' } : {})}
      >
        {shouldLoadComments && travel?.id ? (
          <Suspense fallback={<DeferredCommentsPlaceholder />}>
            <CommentsSection travelId={travel.id} />
          </Suspense>
        ) : (
          <DeferredCommentsPlaceholder />
        )}
      </View>

      <View
        ref={(el) => {
          (footerObserverRef as any).current = el
          setFooterRef(el)
        }}
        collapsable={false}
      >
        {shouldLoadFooter ? (
          <Suspense fallback={<View style={PLACEHOLDER_MIN_H_160} />}>
            <TravelDetailsFooterSection travel={travel} isMobile={isMobile} />
          </Suspense>
        ) : (
          <View style={PLACEHOLDER_MIN_H_160} />
        )}
      </View>
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
