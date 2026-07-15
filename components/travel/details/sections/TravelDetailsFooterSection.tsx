import React, { Suspense, lazy, useMemo } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

import ShareButtons from '@/components/travel/ShareButtons'
import CTASection from '@/components/travel/CTASection'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'

import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { translate as i18nT } from '@/i18n'


const TelegramDiscussionSectionLazy = lazy(() => import('@/components/travel/TelegramDiscussionSection'))

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
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
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
        accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelDetailsFooterSection.obsuzhdenie_v_telegram_63bdc570')}
        accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
        style={[styles.sectionContainer, styles.authorCardContainer, footerStyles.compactSection]}
      >
        <Suspense fallback={null}>
          <TelegramDiscussionSectionLazy travel={travel} />
        </Suspense>
      </View>

      {!isMobile && (
        <View
          testID="travel-details-share"
          accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelDetailsFooterSection.podelitsya_marshrutom_18019d80')}
          accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
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
          accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelDetailsFooterSection.prizyv_k_deystviyu_f84d6e75')}
          accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
          style={[styles.sectionContainer, footerStyles.compactSection]}
        >
          <CTASection travel={travel} />
        </View>
      )}
    </>
  )
})

TravelDetailsFooterSection.displayName = 'TravelDetailsFooterSection'
