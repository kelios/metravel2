import React, { Suspense, memo, useCallback } from 'react'
import { Platform, View } from 'react-native'
import type { Travel } from '@/types/types'
import {
  AuthorSectionSkeleton,
  CommentsSkeleton,
  FooterSectionSkeleton,
  MapSectionSkeleton,
  RatingSectionSkeleton,
  SidebarSectionSkeleton,
} from '@/components/travel/TravelDetailSkeletons'

import type { AnchorsMap } from './TravelDetailsTypes'
import { withLazy } from './TravelDetailsLazy'
import { useTravelDeferredSectionsModel } from './hooks/useTravelDeferredSectionsModel'
import TravelDeferredAuthorSection from './TravelDeferredAuthorSection'
import TravelDeferredRatingSection from './TravelDeferredRatingSection'

const CommentsSectionLazy = withLazy(() =>
  Promise.resolve(import('@/components/travel/CommentsSection')).then((module) => ({
    default: module.CommentsSection,
  })),
)
const TravelDetailsSidebarSectionLazy = withLazy(() =>
  Promise.resolve(import('./sections/TravelDetailsSidebarSection')).then((module) => ({
    default: module.TravelDetailsSidebarSection,
  })),
)
const TravelDetailsFooterSectionLazy = withLazy(() =>
  Promise.resolve(import('./sections/TravelDetailsFooterSection')).then((module) => ({
    default: module.TravelDetailsFooterSection,
  })),
)
const TravelDetailsMapSectionLazy = withLazy(() =>
  Promise.resolve(import('./sections/TravelDetailsMapSection')).then((module) => ({
    default: module.TravelDetailsMapSection ?? module.default,
  })),
)

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
  scrollToMapSection: () => void
}> = memo(({
  travel,
  isMobile,
  forceOpenKey,
  anchors,
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
  const setCommentsSectionRef = useCallback(
    (node: unknown) => {
      ;(anchors.comments as any).current = node
      setCommentsRef(node)
    },
    [anchors.comments, setCommentsRef],
  )

  return (
    <>
      {/* Author details: on mobile — full card + share; on desktop — peer badges only (author lives in sidebar). */}
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
        <View ref={setAuthorSectionRef} collapsable={false}>
          {shouldLoadAuthor ? (
            <TravelDeferredAuthorSection travel={travel} isMobile={isMobile} />
          ) : null}
        </View>
      )}

      {/* Рейтинг и интерактивные блоки остаются после контентного слоя. */}
      <View
        ref={setRatingRef}
        collapsable={false}
      >
        {shouldLoadRatingSection ? (
          <TravelDeferredRatingSection travel={travel} />
        ) : (
          RATING_PLACEHOLDER
        )}
      </View>

      <View
        ref={setMapRef}
        collapsable={false}
      >
        {shouldLoadMapSection ? (
          <Suspense fallback={MAP_PLACEHOLDER}>
            <TravelDetailsMapSectionLazy
              travel={travel}
              anchors={anchors}
              canRenderHeavy={canRenderHeavy}
              scrollToMapSection={scrollToMapSection}
              forceOpenKey={forceOpenKey}
            />
          </Suspense>
        ) : (
          MAP_PLACEHOLDER
        )}
      </View>

      <View
        ref={setSidebarRef}
        collapsable={false}
      >
        {shouldLoadSidebarSection ? (
          <Suspense fallback={SIDEBAR_PLACEHOLDER}>
            <TravelDetailsSidebarSectionLazy
              travel={travel}
              anchors={anchors}
              canRenderHeavy={canRenderHeavy}
              forceOpenKey={forceOpenKey}
            />
          </Suspense>
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
          <Suspense fallback={COMMENTS_PLACEHOLDER}>
            <CommentsSectionLazy
              travelId={travel.id}
              lazyLoad
              autoload={shouldLoadCommentsSection}
              canLoadComments
            />
          </Suspense>
        ) : (
          COMMENTS_PLACEHOLDER
        )}
      </View>

      <View
        ref={setFooterRef}
        collapsable={false}
      >
        {shouldLoadFooterSection ? (
          <Suspense fallback={<FooterSectionSkeleton isMobile={isMobile} />}>
            <TravelDetailsFooterSectionLazy travel={travel} isMobile={isMobile} />
          </Suspense>
        ) : (
          <FooterSectionSkeleton isMobile={isMobile} />
        )}
      </View>
    </>
  )
})

export const TravelEngagementSection = TravelDetailsFooterSectionLazy
