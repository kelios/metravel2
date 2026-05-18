import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import ShareButtons from '@/components/travel/ShareButtons'
import TelegramDiscussionSection from '@/components/travel/TelegramDiscussionSection'
import CTASection from '@/components/travel/CTASection'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'

import { useTravelDetailsStyles } from '../TravelDetailsStyles'

export const TravelDetailsFooterSection: React.FC<{ travel: Travel; isMobile: boolean }> = React.memo(({
  travel,
  isMobile,
}) => {
  const styles = useTravelDetailsStyles()
  const colors = useThemedColors()
  const footerStyles = useMemo(
    () =>
      StyleSheet.create({
        compactSection: {
          marginBottom: DESIGN_TOKENS.spacing.md,
        },
        combinedCard: {
          width: '100%',
          backgroundColor: colors.surface,
          borderRadius: DESIGN_TOKENS.radii.md,
          borderWidth: 1,
          borderColor: colors.borderLight,
          padding: DESIGN_TOKENS.spacing.lg,
        },
        combinedDivider: {
          height: 1,
          backgroundColor: colors.borderLight,
          marginVertical: DESIGN_TOKENS.spacing.lg,
        },
      }),
    [colors]
  )

  return (
    <>
      <View
        testID="travel-details-telegram"
        accessibilityLabel="Обсуждение в Telegram"
        style={[styles.sectionContainer, styles.authorCardContainer, footerStyles.compactSection]}
      >
        <TelegramDiscussionSection travel={travel} />
      </View>

      {!isMobile && (
        <View
          testID="travel-details-share"
          accessibilityLabel="Поделиться маршрутом"
          style={[styles.sectionContainer, styles.shareButtonsContainer, footerStyles.compactSection]}
        >
          <View style={footerStyles.combinedCard}>
            <ShareButtons travel={travel} surface="plain" />
            <View style={footerStyles.combinedDivider} />
            <CTASection travel={travel} surface="plain" />
          </View>
        </View>
      )}

      {isMobile && (
        <View
          testID="travel-details-cta"
          accessibilityLabel="Призыв к действию"
          style={[styles.sectionContainer, footerStyles.compactSection]}
        >
          <CTASection travel={travel} />
        </View>
      )}
    </>
  )
})

TravelDetailsFooterSection.displayName = 'TravelDetailsFooterSection'
