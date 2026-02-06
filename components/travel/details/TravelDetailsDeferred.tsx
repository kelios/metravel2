import React, { Suspense, useEffect, useState } from 'react'
import { Animated, InteractionManager, Platform, Text, View } from 'react-native'
import type { Travel } from '@/types/types'

import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDetailsStyles } from './TravelDetailsStyles'
import { TravelDetailsContentSection } from './sections/TravelDetailsContentSection'
import { TravelDetailsMapSection } from './sections/TravelDetailsMapSection'
import { TravelDetailsSidebarSection } from './sections/TravelDetailsSidebarSection'
import { TravelDetailsFooterSection } from './sections/TravelDetailsFooterSection'
import { CommentsSection } from '@/components/travel/CommentsSection'
import { withLazy } from './TravelDetailsLazy'

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

  useEffect(() => {
    if (Platform.OS === 'web') return
    const task = InteractionManager.runAfterInteractions(() => setCanRenderHeavy(true))
    return () => task.cancel()
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web') {
      rIC(() => {
        setCanRenderHeavy(true)
      }, 1200)
    }
  }, [])

  return (
    <>
      <TravelDetailsContentSection
        travel={travel}
        isMobile={isMobile}
        anchors={anchors}
        forceOpenKey={forceOpenKey}
        scrollRef={scrollRef}
      />

      {/* P0-2: AuthorCard и ShareButtons после контента на mobile */}
      {isMobile && (
        <MobileAuthorShareSection travel={travel} />
      )}

      <View 
        ref={anchors.comments} 
        collapsable={false}
        {...(Platform.OS === 'web' ? { 'data-section-key': 'comments' } : {})}
      >
        {canRenderHeavy && travel?.id && (
          <CommentsSection travelId={travel.id} />
        )}
      </View>

      <TravelDetailsMapSection
        travel={travel}
        anchors={anchors}
        canRenderHeavy={canRenderHeavy}
        scrollToMapSection={scrollToMapSection}
      />

      <TravelDetailsSidebarSection
        travel={travel}
        anchors={anchors}
        scrollY={scrollY}
        viewportHeight={viewportHeight}
        canRenderHeavy={canRenderHeavy}
      />

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
