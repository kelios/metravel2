import React, { memo } from 'react'
import { Text, View } from 'react-native'

import AuthorCard from '@/components/travel/AuthorCard'
import ShareButtons from '@/components/travel/ShareButtons'
import type { Travel } from '@/types/types'

import { useTravelDetailsStyles } from './TravelDetailsStyles'

const PLACEHOLDER_MT_12 = { marginTop: 12 } as const

const DesktopAuthorSection: React.FC<{ travel: Travel }> = memo(function DesktopAuthorSection(_props) {
  // На десктопе автор уже показан в сайдбаре (CompactSideBarTravel),
  // а ShareButtons — в TravelDetailsFooterSection.
  // Не дублируем ни то, ни другое.
  return null
})

const MobileAuthorShareSection: React.FC<{ travel: Travel }> = memo(function MobileAuthorShareSection({ travel }) {
  const styles = useTravelDetailsStyles()
  return (
    <>
      <View
        testID="travel-details-author-mobile"
        accessibilityRole={'region' as any}
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
        accessibilityRole={'region' as any}
        accessibilityLabel="Поделиться маршрутом"
        style={[styles.sectionContainer, styles.contentStable, styles.shareButtonsContainer]}
      >
        <ShareButtons travel={travel} />
      </View>
    </>
  )
})

const TravelDeferredAuthorSection: React.FC<{ travel: Travel; isMobile: boolean }> = memo(
  function TravelDeferredAuthorSection({ travel, isMobile }) {
    if (isMobile) {
      return <MobileAuthorShareSection travel={travel} />
    }

    return <DesktopAuthorSection travel={travel} />
  }
)

export default TravelDeferredAuthorSection
