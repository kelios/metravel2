import React, { memo, useCallback } from 'react'
import { Animated, Platform, View } from 'react-native'
import type { Travel } from '@/types/types'
import {
  AuthorSectionSkeleton,
  CommentsSkeleton,
  FooterSectionSkeleton,
  MapSectionSkeleton,
  RatingSectionSkeleton,
  SidebarSectionSkeleton,
} from '@/components/travel/TravelDetailSkeletons'
import { CommentsSection } from '@/components/travel/CommentsSection'

import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDeferredSectionsModel } from './hooks/useTravelDeferredSectionsModel'
import TravelDeferredAuthorSection from './TravelDeferredAuthorSection'
import TravelDeferredRatingSection from './TravelDeferredRatingSection'
import { TravelDetailsFooterSection } from './sections/TravelDetailsFooterSection'
import { TravelDetailsMapSection } from './sections/TravelDetailsMapSection'
import { TravelDetailsSidebarSection } from './sections/TravelDetailsSidebarSection'

const AUTHOR_PLACEHOLDER = <AuthorSectionSkeleton />
const RATING_PLACEHOLDER = <RatingSectionSkeleton />
const MAP_PLACEHOLDER = <MapSectionSkeleton />
const SIDEBAR_PLACEHOLDER = <SidebarSectionSkeleton />
const COMMENTS_PLACEHOLDER = <CommentsSkeleton />

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

  const shouldLoadMapSection = shouldLoadMap || shouldForceLoadMapSection(forceOpenKey)
  const shouldLoadSidebarSection = shouldLoadSidebar || shouldForceLoadSidebarSection(forceOpenKey)
  const shouldLoadCommentsSection = shouldLoadComments || forceOpenKey === 'comments'
  const setCommentsSectionRef = useCallback(
    (node: unknown) => {
      ;(anchors.comments as any).current = node
      setCommentsRef(node)
    },
    [anchors.comments, setCommentsRef],
  )

  return (
    <>
      {isMobile ? (
        <View ref={setAuthorSectionRef} collapsable={false}>
          {shouldLoadAuthorSection ? (
            <TravelDeferredAuthorSection travel={travel} isMobile={isMobile} />
          ) : (
            AUTHOR_PLACEHOLDER
          )}
        </View>
      ) : (
        <View ref={setAuthorSectionRef} collapsable={false}>
          {shouldLoadAuthorSection ? (
            <TravelDeferredAuthorSection travel={travel} isMobile={isMobile} />
          ) : null}
        </View>
      )}

      <View ref={setRatingRef} collapsable={false}>
        {shouldLoadRating ? (
          <TravelDeferredRatingSection travel={travel} />
        ) : (
          RATING_PLACEHOLDER
        )}
      </View>

      <View ref={setMapRef} collapsable={false}>
        {shouldLoadMapSection ? (
          <TravelDetailsMapSection
            travel={travel}
            anchors={anchors}
            canRenderHeavy={canRenderHeavy}
            scrollToMapSection={scrollToMapSection}
            forceOpenKey={forceOpenKey}
          />
        ) : (
          MAP_PLACEHOLDER
        )}
      </View>

      <View ref={setSidebarRef} collapsable={false}>
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
          SIDEBAR_PLACEHOLDER
        )}
      </View>

      <View
        ref={setCommentsSectionRef}
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
          COMMENTS_PLACEHOLDER
        )}
      </View>

      <View ref={setFooterRef} collapsable={false}>
        {shouldLoadFooter ? (
          <TravelDetailsFooterSection travel={travel} isMobile={isMobile} />
        ) : (
          <FooterSectionSkeleton isMobile={isMobile} />
        )}
      </View>
    </>
  )
})

export const TravelEngagementSection = TravelDetailsFooterSection
