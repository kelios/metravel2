import React, { useMemo } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

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
          borderRadius: DESIGN_TOKENS.radii.sm,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderStyle: 'solid',
          padding: DESIGN_TOKENS.spacing.lg,
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: DESIGN_TOKENS.spacing.lg,
          ...(Platform.OS === 'web'
            ? ({
                boxShadow: `0 3px 0 ${colors.primarySoft}`,
              } as any)
            : {}),
        },
        sharePane: {
          flex: 1,
          minWidth: 0,
          justifyContent: 'flex-start',
        },
        actionPane: {
          width: 430,
          maxWidth: '42%',
          justifyContent: 'center',
        },
        combinedDivider: {
          width: 1,
          backgroundColor: colors.borderStrong,
          alignSelf: 'stretch',
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
            <View style={footerStyles.sharePane}>
              <ShareButtons travel={travel} surface="plain" />
            </View>
            <View style={footerStyles.combinedDivider} />
            <View style={footerStyles.actionPane}>
              <CTASection travel={travel} surface="plain" />
            </View>
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
