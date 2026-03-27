import React, { memo } from 'react'
import { Animated, Platform, View } from 'react-native'
import type { Travel } from '@/types/types'

import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDeferredSectionsModel } from './hooks/useTravelDeferredSectionsModel'
import TravelDeferredAuthorSection from './TravelDeferredAuthorSection'
import TravelDeferredRatingSection from './TravelDeferredRatingSection'

import { TravelDetailsContentSection } from './sections/TravelDetailsContentSection'
import { TravelDetailsSidebarSection } from './sections/TravelDetailsSidebarSection'
import { TravelDetailsFooterSection } from './sections/TravelDetailsFooterSection'
import { TravelDetailsMapSection } from './sections/TravelDetailsMapSection'
import { CommentsSection } from '@/components/travel/CommentsSection'

const PLACEHOLDER_MIN_H_160 = { minHeight: 160 } as const
const PLACEHOLDER_MIN_H_56 = { minHeight: 56 } as const


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
    shouldLoadRating,
  } = useTravelDeferredSectionsModel({
    travelId: travel?.id,
  })

  const shouldLoadAuthor = shouldLoadAuthorSection
  const shouldLoadRatingSection = shouldLoadRating
  return (
    <>
      <TravelDetailsContentSection
        travel={travel}
        isMobile={isMobile}
        anchors={anchors}
        forceOpenKey={forceOpenKey}
      />

      {/* Author details: on mobile — full card + share; on desktop — null (sidebar has author). */}
      {isMobile ? (
        <View
          ref={setAuthorSectionRef}
          collapsable={false}
        >
          {shouldLoadAuthor ? (
            <TravelDeferredAuthorSection travel={travel} isMobile={isMobile} />
          ) : (
            <>
              <View style={PLACEHOLDER_MIN_H_160} />
              <View style={PLACEHOLDER_MIN_H_56} />
            </>
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
        <TravelDetailsMapSection
          travel={travel}
          anchors={anchors}
          canRenderHeavy={canRenderHeavy}
          scrollToMapSection={scrollToMapSection}
          forceOpenKey={forceOpenKey}
        />
      </View>

      <View
        ref={setSidebarRef}
        collapsable={false}
      >
        <TravelDetailsSidebarSection
          travel={travel}
          anchors={anchors}
          scrollY={scrollY}
          viewportHeight={viewportHeight}
          canRenderHeavy={canRenderHeavy}
          forceOpenKey={forceOpenKey}
        />
      </View>

      <View 
        ref={(el) => {
          (anchors.comments as any).current = el;
          setCommentsRef(el)
        }}
        collapsable={false}
        {...(Platform.OS === 'web' ? { 'data-section-key': 'comments' } : {})}
      >
        {travel?.id && (
          <CommentsSection
            travelId={travel.id}
            lazyLoad
            autoload={forceOpenKey === 'comments'}
            canLoadComments
          />
        )}
      </View>

      <View
        ref={setFooterRef}
        collapsable={false}
      >
        <TravelDetailsFooterSection travel={travel} isMobile={isMobile} />
      </View>
    </>
  )
})

export const TravelEngagementSection = TravelDetailsFooterSection
