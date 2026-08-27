import React, { Suspense, memo, useCallback, useEffect, useState } from 'react'
import { Platform, Text, View, type LayoutChangeEvent } from 'react-native'
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
import { importWithRetry, lazyWithRetry } from '@/utils/chunkReload'
import { translate as i18nT } from '@/i18n'
import { useTravelDeferredSectionsModel } from './hooks/useTravelDeferredSectionsModel'
import TravelDeferredAuthorSection from './TravelDeferredAuthorSection'
import TravelDeferredRatingSection from './TravelDeferredRatingSection'
import {
  TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT,
  TravelDetailsDeferredTransition,
} from './TravelDetailsDeferredTransition'

const CommentsSectionLazy = lazyWithRetry(() =>
  Promise.resolve(import('@/components/travel/CommentsSection')).then((module) => ({
    default: module.CommentsSection,
  })),
  { name: 'CommentsSection' },
)
const TravelDetailsSidebarSectionLazy = withLazy(() =>
  Promise.resolve(import('./sections/TravelDetailsSidebarSection')).then((module) => ({
    default: module.TravelDetailsSidebarSection,
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

type FooterRuntimeFrameProps = {
  isMobile: boolean
  onRuntimeFrameLayout: (event: LayoutChangeEvent) => void
  travel: Travel
}

function FooterRuntimeLoadFailure({ onRuntimeFrameLayout }: FooterRuntimeFrameProps) {
  return (
    <View
      testID="travel-details-footer-resolved-frame"
      onLayout={onRuntimeFrameLayout}
      collapsable={false}
    >
      <Text testID="travel-details-footer-load-error">
        {i18nT(
          'travel:components.travel.details.TravelDetailsLazy.component_failed_to_load_05315fe8',
        )}
      </Text>
    </View>
  )
}

const TravelDetailsFooterSectionLazy = React.lazy(() =>
  importWithRetry(() => import('./TravelDetailsFooterRuntimeFrame'), {
    name: 'TravelDetailsFooterRuntimeFrame',
  })
    .catch(() => ({ default: FooterRuntimeLoadFailure })),
)

const MAP_FORCE_OPEN_KEYS = new Set(['map', 'points', 'excursions'])
const SIDEBAR_FORCE_OPEN_KEYS = new Set(['near', 'popular'])

function shouldForceLoadMapSection(forceOpenKey: string | null) {
  return !!forceOpenKey && MAP_FORCE_OPEN_KEYS.has(forceOpenKey)
}

function shouldForceLoadSidebarSection(forceOpenKey: string | null) {
  return !!forceOpenKey && SIDEBAR_FORCE_OPEN_KEYS.has(forceOpenKey)
}

export function shouldLoadFooterSectionForPlatform(
  platformOS: typeof Platform.OS,
  shouldLoadFooter: boolean,
) {
  return platformOS === 'web' || shouldLoadFooter
}

export const TravelDeferredSections: React.FC<{
  travel: Travel
  isMobile: boolean
  forceOpenKey: string | null
  anchors: AnchorsMap
  scrollToMapSection: () => void
  settledScrollOffsetY?: number
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
  // Resolve the web footer inside the already post-LCP deferred tree, while it
  // is still offscreen. A content-dependent footer can exceed the 100vh reserve;
  // waiting for the bottom IntersectionObserver would then grow the live scroll
  // area in-view. Native keeps the existing visibility gate.
  const shouldLoadFooterSection = shouldLoadFooterSectionForPlatform(
    Platform.OS,
    shouldLoadFooter,
  )
  const [footerRuntimeFrameReadyTravelId, setFooterRuntimeFrameReadyTravelId] = useState<
    number | null
  >(null)
  useEffect(() => {
    if (!shouldLoadFooterSection) setFooterRuntimeFrameReadyTravelId(null)
  }, [shouldLoadFooterSection])
  const handleFooterRuntimeFrameLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height, width } = event.nativeEvent.layout
      if (height <= 0 || width <= 0) return
      setFooterRuntimeFrameReadyTravelId(travel.id)
    },
    [travel.id],
  )
  const footerRuntimeFrameReady =
    shouldLoadFooterSection &&
    travel.id != null &&
    footerRuntimeFrameReadyTravelId === travel.id
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
        {...(Platform.OS === 'web' ? { 'data-section-key': 'rating' } : {})}
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
        <TravelDetailsDeferredTransition
          testID="travel-details-footer-transition"
          isMobile={isMobile}
          pending={!shouldLoadFooterSection}
          placeholder={<FooterSectionSkeleton isMobile={isMobile} />}
          reserveHeight={TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT}
          runtimeFrameReady={footerRuntimeFrameReady}
        >
          {shouldLoadFooterSection ? (
            <Suspense fallback={<FooterSectionSkeleton isMobile={isMobile} />}>
              <TravelDetailsFooterSectionLazy
                key={travel.id}
                travel={travel}
                isMobile={isMobile}
                onRuntimeFrameLayout={handleFooterRuntimeFrameLayout}
              />
            </Suspense>
          ) : null}
        </TravelDetailsDeferredTransition>
      </View>
    </>
  )
})
