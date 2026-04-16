import React, { memo } from 'react'
import { Animated, Platform, View } from 'react-native'
import type { Travel } from '@/types/types'

import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDeferredSectionsModel } from './hooks/useTravelDeferredSectionsModel'
import TravelDeferredAuthorSection from './TravelDeferredAuthorSection'
import TravelDeferredRatingSection from './TravelDeferredRatingSection'

import { TravelDetailsSidebarSection } from './sections/TravelDetailsSidebarSection'
import { TravelDetailsFooterSection } from './sections/TravelDetailsFooterSection'
import { TravelDetailsMapSection } from './sections/TravelDetailsMapSection'
import { CommentsSection } from '@/components/travel/CommentsSection'

const PLACEHOLDER_MIN_H_160 = { minHeight: 160 } as const
const PLACEHOLDER_MIN_H_56 = { minHeight: 56 } as const
const PLACEHOLDER_MIN_H_240 = { minHeight: 240 } as const
const PLACEHOLDER_MIN_H_320 = { minHeight: 320 } as const
const AUTHOR_PLACEHOLDER = (
  <>
    <View style={PLACEHOLDER_MIN_H_160} />
    <View style={PLACEHOLDER_MIN_H_56} />
  </>
)

const MAP_FORCE_OPEN_KEYS = new Set(['map', 'points', 'excursions'])
const SIDEBAR_FORCE_OPEN_KEYS = new Set(['near', 'popular'])

function shouldForceLoadMapSection(forceOpenKey: string | null) {
  return !!forceOpenKey && MAP_FORCE_OPEN_KEYS.has(forceOpenKey)
}

function shouldForceLoadSidebarSection(forceOpenKey: string | null) {
  return !!forceOpenKey && SIDEBAR_FORCE_OPEN_KEYS.has(forceOpenKey)
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
  const {
    canRenderHeavy,
    setAuthorSectionRef,
    setCommentsRef,
    setFooterRef,
    setMapRef,
    setRatingRef,
    setSidebarRef,
    shouldLoadAuthorSection,
    shouldLoadComments,
    shouldLoadFooter,
    shouldLoadMap,
    shouldLoadRating,
    shouldLoadSidebar,
  } = useTravelDeferredSectionsModel({
    travelId: travel?.id,
  })

  const shouldLoadAuthor = shouldLoadAuthorSection
  const shouldLoadRatingSection = shouldLoadRating
  const shouldLoadMapSection = shouldLoadMap || shouldForceLoadMapSection(forceOpenKey)
  const shouldLoadSidebarSection = shouldLoadSidebar || shouldForceLoadSidebarSection(forceOpenKey)
  const shouldLoadCommentsSection = shouldLoadComments || forceOpenKey === 'comments'
  const shouldLoadFooterSection = shouldLoadFooter
  const handleCommentsRef = (el: unknown) => {
    ;(anchors.comments as any).current = el
    setCommentsRef(el)
  }

  return (
    <>
      {/* Author details: on mobile — full card + share; on desktop — null (sidebar has author). */}
      {isMobile ? (
        <View
          ref={setAuthorSectionRef}
          collapsable={false}
        >
          {shouldLoadAuthor ? (
            <TravelDeferredAuthorSection travel={travel} isMobile={isMobile} />
          ) : (
            AUTHOR_PLACEHOLDER
          )}
        </View>
      ) : (
        <View ref={setAuthorSectionRef} collapsable={false} />
      )}

      {/* Рейтинг и интерактивные блоки остаются после контентного слоя. */}
      <View
        ref={setRatingRef}
        collapsable={false}
      >
        {shouldLoadRatingSection ? (
          <TravelDeferredRatingSection travel={travel} />
        ) : (
          <View style={PLACEHOLDER_MIN_H_56} />
        )}
      </View>

      <View
        ref={setMapRef}
        collapsable={false}
      >
        {shouldLoadMapSection ? (
          <TravelDetailsMapSection
            travel={travel}
            anchors={anchors}
            canRenderHeavy={canRenderHeavy}
            scrollToMapSection={scrollToMapSection}
            forceOpenKey={forceOpenKey}
          />
        ) : (
          <View style={PLACEHOLDER_MIN_H_320} />
        )}
      </View>

      <View
        ref={setSidebarRef}
        collapsable={false}
      >
        {shouldLoadSidebarSection ? (
          <TravelDetailsSidebarSection
            travel={travel}
            anchors={anchors}
            scrollY={scrollY}
            viewportHeight={viewportHeight}
            canRenderHeavy={canRenderHeavy}
            forceOpenKey={forceOpenKey}
          />
        ) : (
          <View style={PLACEHOLDER_MIN_H_240} />
        )}
      </View>

      <View 
        ref={handleCommentsRef}
        collapsable={false}
        {...(Platform.OS === 'web' ? { 'data-section-key': 'comments' } : {})}
      >
        {shouldLoadCommentsSection && travel?.id ? (
          <CommentsSection
            travelId={travel.id}
            lazyLoad
            autoload={shouldLoadCommentsSection}
            canLoadComments
          />
        ) : (
          <View style={PLACEHOLDER_MIN_H_240} />
        )}
      </View>

      <View
        ref={setFooterRef}
        collapsable={false}
      >
        {shouldLoadFooterSection ? (
          <TravelDetailsFooterSection travel={travel} isMobile={isMobile} />
        ) : (
          <View style={PLACEHOLDER_MIN_H_240} />
        )}
      </View>
    </>
  )
})

export const TravelEngagementSection = TravelDetailsFooterSection
