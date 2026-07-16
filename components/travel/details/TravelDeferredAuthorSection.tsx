import React, { memo } from 'react'
import { Text, View, useWindowDimensions } from 'react-native'

import AuthorCard, { hasResolvableAuthor } from '@/components/travel/AuthorCard'
import ShareButtons from '@/components/travel/ShareButtons'
import type { Travel } from '@/types/types'

import TravelPeerBadgesSection from './TravelPeerBadgesSection'
import { useTravelDetailsStyles } from './TravelDetailsStyles'
import { shouldShowTravelDetailsDesktopSidebar } from './travelDetailsCriticalShellModel'
import { translate as i18nT } from '@/i18n'


const PLACEHOLDER_MT_12 = { marginTop: 12 } as const

const DesktopAuthorSection: React.FC<{ travel: Travel }> = memo(function DesktopAuthorSection({ travel }) {
  // На десктопе автор уже показан в сайдбаре (CompactSideBarTravel),
  // а ShareButtons — в TravelDetailsFooterSection. Не дублируем ни то, ни другое.
  // Peer-награды (§10) — отдельная фича, показываем и на десктопе.
  return <TravelPeerBadgesSection travel={travel} />
})

const InlineAuthorSection: React.FC<{
  authorTestID: string
  showShare: boolean
  travel: Travel
}> = memo(function InlineAuthorSection({ authorTestID, showShare, travel }) {
  const styles = useTravelDetailsStyles()
  const showAuthor = hasResolvableAuthor(travel)
  return (
    <>
      {showAuthor && (
        <View
          testID={authorTestID}
          role="region"
          accessibilityLabel={i18nT('travel:components.travel.details.TravelDeferredAuthorSection.avtor_marshruta_6986236c')}
          style={[styles.sectionContainer, styles.contentStable, styles.authorCardContainer]}
        >
          <Text style={styles.sectionHeaderText}>{i18nT('travel:components.travel.details.TravelDeferredAuthorSection.avtor_da9de0f2')}</Text>
          <View style={PLACEHOLDER_MT_12}>
            <AuthorCard travel={travel} />
          </View>
        </View>
      )}

      {showShare && (
        <View
          testID="travel-details-share-mobile"
          role="region"
          accessibilityLabel={i18nT('travel:components.travel.details.TravelDeferredAuthorSection.podelitsya_marshrutom_0d380df3')}
          style={[styles.sectionContainer, styles.contentStable, styles.shareButtonsContainer]}
        >
          <ShareButtons travel={travel} />
        </View>
      )}

      <TravelPeerBadgesSection travel={travel} />
    </>
  )
})

const TravelDeferredAuthorSection: React.FC<{ travel: Travel; isMobile: boolean }> = memo(
  function TravelDeferredAuthorSection({ travel, isMobile }) {
    const { width } = useWindowDimensions()

    if (isMobile) {
      return (
        <InlineAuthorSection
          authorTestID="travel-details-author-mobile"
          showShare
          travel={travel}
        />
      )
    }

    if (!shouldShowTravelDetailsDesktopSidebar(isMobile, width)) {
      return (
        <InlineAuthorSection
          authorTestID="travel-details-author"
          showShare={false}
          travel={travel}
        />
      )
    }

    return <DesktopAuthorSection travel={travel} />
  }
)

export default TravelDeferredAuthorSection
