import React, { Suspense, useEffect, useState } from 'react'
import { Animated, InteractionManager, Platform, Text, View } from 'react-native'
import type { Travel } from '@/types/types'

import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDetailsStyles } from './TravelDetailsStyles'
import { withLazy } from './TravelDetailsLazy'

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

const rIC = (cb: () => void, timeout = 300) => {
  if (typeof (window as any)?.requestIdleCallback === 'function') {
    ;(window as any).requestIdleCallback(cb, { timeout })
  } else {
    setTimeout(cb, timeout)
  }
}

export const TravelDeferredSections: React.FC<{
  travel: Travel
  isMobile: boolean
  forceOpenKey: string | null
  anchors: AnchorsMap
  scrollY: Animated.Value
  viewportHeight: number
  scrollRef: any
  scrollToMapSection: () => void
}> = ({
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
  const [canRenderComments, setCanRenderComments] = useState(false)

  useEffect(() => {
    if (Platform.OS === 'web') return
    const task = InteractionManager.runAfterInteractions(() => setCanRenderHeavy(true))
    return () => task.cancel()
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web') {
      rIC(() => {
        setCanRenderHeavy(true)
      }, 600)
    }
  }, [])

  // Defer comments even further to avoid blocking main thread during initial render.
  // CommentsSection chunk is ~247ms to parse — loading it later reduces TBT.
  useEffect(() => {
    if (!canRenderHeavy) return
    if (Platform.OS !== 'web') {
      setCanRenderComments(true)
      return
    }
    rIC(() => {
      setCanRenderComments(true)
    }, 1500)
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

      <Suspense fallback={null}>
        <TravelDetailsMapSection
          travel={travel}
          anchors={anchors}
          canRenderHeavy={canRenderHeavy}
          scrollToMapSection={scrollToMapSection}
        />
      </Suspense>

      <Suspense fallback={null}>
        <TravelDetailsSidebarSection
          travel={travel}
          anchors={anchors}
          scrollY={scrollY}
          viewportHeight={viewportHeight}
          canRenderHeavy={canRenderHeavy}
        />
      </Suspense>

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
}

const MobileAuthorShareSection: React.FC<{ travel: Travel }> = ({ travel }) => {
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
}

export const TravelEngagementSection: React.FC<{ travel: Travel; isMobile: boolean }> = (props) => {
  return <TravelDetailsFooterSection {...props} />
}
