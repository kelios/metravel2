import React from 'react'
import { View } from 'react-native'

import ShareButtons from '@/components/travel/ShareButtons'
import TelegramDiscussionSection from '@/components/travel/TelegramDiscussionSection'
import CTASection from '@/components/travel/CTASection'
import type { Travel } from '@/src/types/types'

import { useTravelDetailsStyles } from '../TravelDetailsStyles'

export const TravelDetailsFooterSection: React.FC<{ travel: Travel; isMobile: boolean }> = React.memo(({
  travel,
  isMobile,
}) => {
  const styles = useTravelDetailsStyles()

  return (
    <>
      <View
        testID="travel-details-telegram"
        accessibilityLabel="Обсуждение в Telegram"
        style={[styles.sectionContainer, styles.authorCardContainer, styles.webDeferredSection]}
      >
        <TelegramDiscussionSection travel={travel} />
      </View>

      {!isMobile && (
        <View
          testID="travel-details-share"
          accessibilityLabel="Поделиться маршрутом"
          style={[styles.sectionContainer, styles.shareButtonsContainer, styles.webDeferredSection]}
        >
          <ShareButtons travel={travel} />
        </View>
      )}

      <View
        testID="travel-details-cta"
        accessibilityLabel="Призыв к действию"
        style={[styles.sectionContainer, styles.ctaContainer, styles.webDeferredSection]}
      >
        <CTASection travel={travel} />
      </View>
    </>
  )
})

TravelDetailsFooterSection.displayName = 'TravelDetailsFooterSection'
