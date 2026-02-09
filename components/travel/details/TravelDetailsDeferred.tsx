import React, { Suspense, memo, useEffect, useState } from 'react'
import { Animated, InteractionManager, Platform, Text, View } from 'react-native'
import type { Travel } from '@/types/types'

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

export const TravelDeferredSections: React.FC<{
  travel: Travel
  isMobile: boolean
  forceOpenKey: string | null
  anchors: AnchorsMap
  scrollY: Animated.Value
  viewportHeight: number
  scrollRef: any
  scrollToMapSection: () => void
}> = memo(({
  travel,
  isMobile,
  forceOpenKey,
  anchors,
  scrollY,
  viewportHeight,
  scrollRef,
  scrollToMapSection,
}) => {
  const [canRenderHeavy, setCanRenderHeavy] = useState(false)
  const [canRenderMap, setCanRenderMap] = useState(false)
  const [canRenderSidebar, setCanRenderSidebar] = useState(false)
  const [canRenderComments, setCanRenderComments] = useState(false)

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
    rIC(() => setCanRenderMap(true), 600)
    // Sidebar (near/popular lists): after map
    rIC(() => setCanRenderSidebar(true), 1000)
    // CommentsSection chunk is ~247ms to parse — load it last.
    rIC(() => setCanRenderComments(true), 1500)
  }, [canRenderHeavy])

  return (
    <>
      <Suspense fallback={null}>
        <TravelDetailsContentSection
          travel={travel}
          isMobile={isMobile}
          anchors={anchors}
          forceOpenKey={forceOpenKey}
          scrollRef={scrollRef}
        />
      </Suspense>

      {/* P0-2: AuthorCard и ShareButtons после контента на mobile */}
      {isMobile && (
        <MobileAuthorShareSection travel={travel} />
      )}

      {canRenderMap && (
        <Suspense fallback={null}>
          <TravelDetailsMapSection
            travel={travel}
            anchors={anchors}
            canRenderHeavy={canRenderHeavy}
            scrollToMapSection={scrollToMapSection}
          />
        </Suspense>
      )}

      {canRenderSidebar && (
        <Suspense fallback={null}>
          <TravelDetailsSidebarSection
            travel={travel}
            anchors={anchors}
            scrollY={scrollY}
            viewportHeight={viewportHeight}
            canRenderHeavy={canRenderHeavy}
          />
        </Suspense>
      )}

      <View 
        ref={anchors.comments} 
        collapsable={false}
        {...(Platform.OS === 'web' ? { 'data-section-key': 'comments' } : {})}
      >
        {canRenderComments && travel?.id && (
          <CommentsSection travelId={travel.id} />
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
