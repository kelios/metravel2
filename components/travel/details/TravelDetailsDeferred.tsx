import React, { Suspense, memo, useEffect, useState } from 'react'
import { Animated, InteractionManager, Platform, Text, View } from 'react-native'
import type { Travel } from '@/types/types'
import {
  CommentsSkeleton,
  MapSkeleton,
  TravelListSkeleton,
} from '@/components/travel/TravelDetailSkeletons'
import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'
import TravelRatingSection from '@/components/travel/TravelRatingSection'
import AuthorCard from '@/components/travel/AuthorCard'
import ShareButtons from '@/components/travel/ShareButtons'

import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDetailsStyles } from './TravelDetailsStyles'
import { withLazy } from './TravelDetailsLazy'
import { useTdTrace } from '@/hooks/useTdTrace'

import { TravelDetailsContentSection } from './sections/TravelDetailsContentSection'
import { TravelDetailsSidebarSection } from './sections/TravelDetailsSidebarSection'
import { TravelDetailsFooterSection } from './sections/TravelDetailsFooterSection'

const TravelDetailsMapSection = withLazy(() =>
  import('./sections/TravelDetailsMapSection').then((m) => ({
    default: m.TravelDetailsMapSection,
  }))
)
const CommentsSection = withLazy(() =>
  import('@/components/travel/CommentsSection').then((m) => ({
    default: m.CommentsSection,
  }))
)

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
  const [canRenderHeavy, setCanRenderHeavy] = useState(Platform.OS === 'web')
  const isWebAutomation =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    Boolean((navigator as unknown as Record<string, unknown>).webdriver)

  const tdTrace = useTdTrace()
  const { shouldLoad: shouldLoadMap, setElementRef: setMapRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 800,
    enabled: canRenderHeavy,
  })
  const { shouldLoad: shouldLoadSidebar, setElementRef: setSidebarRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 900,
    enabled: canRenderHeavy,
  })
  const { shouldLoad: shouldLoadComments, setElementRef: setCommentsRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 950,
    enabled: canRenderHeavy,
  })
  const { shouldLoad: shouldLoadFooter, setElementRef: setFooterRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 1000,
    enabled: canRenderHeavy,
  })
  const { shouldLoad: shouldLoadAuthorSection, setElementRef: setAuthorSectionRef } = useProgressiveLoad({
    priority: 'high',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 500,
    enabled: canRenderHeavy,
  })
  const { shouldLoad: shouldLoadRating, setElementRef: setRatingRef } = useProgressiveLoad({
    priority: 'high',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 600,
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

  const shouldLoadAuthor = isWebAutomation || shouldLoadAuthorSection
  const shouldLoadRatingSection = isWebAutomation || shouldLoadRating
  const shouldRenderSidebarSection =
    isWebAutomation || shouldLoadSidebar || forceOpenKey === 'near' || forceOpenKey === 'popular'
  const shouldRenderCommentsSection =
    isWebAutomation || shouldLoadComments || forceOpenKey === 'comments'
  const shouldRenderFooterSection = isWebAutomation || shouldLoadFooter

  return (
    <>
      <TravelDetailsContentSection
        travel={travel}
        isMobile={isMobile}
        anchors={anchors}
        forceOpenKey={forceOpenKey}
      />

      {/* Full author details stay below the hero shell on every platform. */}
      <View
        ref={setAuthorSectionRef}
        collapsable={false}
      >
        {shouldLoadAuthor ? (
          <DeferredAuthorSection travel={travel} isMobile={isMobile} />
        ) : (
          <>
            <View style={PLACEHOLDER_MIN_H_160} />
            {isMobile && <View style={PLACEHOLDER_MIN_H_56} />}
          </>
        )}
      </View>

      {/* Рейтинг и интерактивные блоки остаются после контентного слоя. */}
      <View
        ref={setRatingRef}
        collapsable={false}
      >
        {shouldLoadRatingSection ? (
          <TravelRatingWrapper travel={travel} />
        ) : (
          <View style={PLACEHOLDER_MIN_H_56} />
        )}
      </View>

      <View
        ref={setMapRef}
        collapsable={false}
      >
        <Suspense fallback={<DeferredMapPlaceholder />}>
          <TravelDetailsMapSection
            travel={travel}
            anchors={anchors}
            canRenderHeavy={canRenderHeavy}
            scrollToMapSection={scrollToMapSection}
            forceOpenKey={forceOpenKey}
          />
        </Suspense>
      </View>

      <View
        ref={setSidebarRef}
        collapsable={false}
      >
        {shouldRenderSidebarSection ? (
          <Suspense fallback={<DeferredSidebarPlaceholder />}>
            <TravelDetailsSidebarSection
              travel={travel}
              anchors={anchors}
              scrollY={scrollY}
              viewportHeight={viewportHeight}
              canRenderHeavy={canRenderHeavy}
              forceOpenKey={forceOpenKey}
            />
          </Suspense>
        ) : (
          <DeferredSidebarPlaceholder />
        )}
      </View>

      <View 
        ref={(el) => {
          (anchors.comments as any).current = el;
          setCommentsRef(el)
        }}
        collapsable={false}
        {...(Platform.OS === 'web' ? { 'data-section-key': 'comments' } : {})}
      >
        {shouldRenderCommentsSection && travel?.id ? (
          <Suspense fallback={<DeferredCommentsPlaceholder />}>
            <CommentsSection travelId={travel.id} />
          </Suspense>
        ) : (
          <DeferredCommentsPlaceholder />
        )}
      </View>

      <View
        ref={setFooterRef}
        collapsable={false}
      >
        {shouldRenderFooterSection ? (
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

const DeferredAuthorSection: React.FC<{ travel: Travel; isMobile: boolean }> = memo(
  function DeferredAuthorSection({ travel, isMobile }) {
    if (isMobile) {
      return <MobileAuthorShareSection travel={travel} />
    }

    return <DesktopAuthorSection travel={travel} />
  }
)

const DesktopAuthorSection: React.FC<{ travel: Travel }> = memo(function DesktopAuthorSection({ travel }) {
  const styles = useTravelDetailsStyles()
  return (
    <View
      testID="travel-details-author"
      accessibilityRole="region"
      accessibilityLabel="Автор маршрута"
      style={[styles.sectionContainer, styles.contentStable, styles.authorCardContainer]}
    >
      <Text style={styles.sectionHeaderText}>Автор</Text>
      <Text style={styles.sectionSubtitle}>Профиль, соцсети и другие путешествия автора</Text>
      <View style={PLACEHOLDER_MT_12}>
        <AuthorCard travel={travel} />
      </View>
    </View>
  )
})

const MobileAuthorShareSection: React.FC<{ travel: Travel }> = memo(function MobileAuthorShareSection({ travel }) {
  const styles = useTravelDetailsStyles()
  return (
    <>
      <View
        testID="travel-details-author-mobile"
        accessibilityRole="region"
        accessibilityLabel="Автор маршрута"
        style={[styles.sectionContainer, styles.contentStable, styles.authorCardContainer]}
      >
        <Text style={styles.sectionHeaderText}>Автор</Text>
        <Text style={styles.sectionSubtitle}>Профиль, соцсети и другие путешествия автора</Text>
        <View style={PLACEHOLDER_MT_12}>
          <AuthorCard travel={travel} />
        </View>
      </View>

      <View
        testID="travel-details-share-mobile"
        accessibilityRole="region"
        accessibilityLabel="Поделиться маршрутом"
        style={[styles.sectionContainer, styles.contentStable, styles.shareButtonsContainer]}
      >
        <ShareButtons travel={travel} />
      </View>
    </>
  )
})

const TravelRatingWrapper: React.FC<{ travel: Travel }> = memo(function TravelRatingWrapper({ travel }) {
  const styles = useTravelDetailsStyles()

  if (!travel?.id) return null

  return (
    <View
      testID="travel-details-rating"
      accessibilityRole="region"
      accessibilityLabel="Рейтинг путешествия"
      style={[styles.sectionContainer, styles.contentStable]}
    >
      <TravelRatingSection
        travelId={travel.id}
        initialRating={travel.rating}
        initialCount={travel.rating_count}
        initialUserRating={travel.user_rating}
      />
    </View>
  )
})

export const TravelEngagementSection = TravelDetailsFooterSection
