import React, { useCallback, useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { queueAnalyticsEvent } from '@/utils/analytics'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import {
  getAffiliateOffers,
  type AffiliateOffer,
  type AffiliateOfferContext,
} from './affiliateConfig'
import { useAffiliateImpression } from './useAffiliateImpression'

type Props = AffiliateOfferContext

function AffiliateOffers({ city, country, countryCode, travelId }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  const offers = useMemo(
    () => getAffiliateOffers({ city, country, countryCode, travelId }),
    [city, country, countryCode, travelId],
  )

  const trackImpression = useCallback(() => {
    queueAnalyticsEvent('Affiliate_Impression', {
      travelId: travelId != null ? String(travelId) : undefined,
      city: city || undefined,
      offers: offers.map((o) => o.key).join(','),
    })
  }, [offers, travelId, city])

  const impressionRef = useAffiliateImpression(trackImpression)

  const handlePress = useCallback(
    (offer: AffiliateOffer) => {
      queueAnalyticsEvent('Affiliate_Click', {
        program: offer.key,
        travelId: travelId != null ? String(travelId) : undefined,
        city: city || undefined,
      })
      void openExternalUrlInNewTab(offer.url, {
        allowedProtocols: ['https:'],
        windowFeatures: 'noopener',
      })
    },
    [travelId, city],
  )

  if (offers.length === 0) return null

  return (
    <View ref={impressionRef as any} style={styles.grid}>
      {offers.map((offer) => (
        <View key={offer.key} style={styles.card}>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{offer.title}</Text>
            <Text style={styles.cardSubtitle}>{offer.subtitle}</Text>
          </View>
          <Pressable
            onPress={() => handlePress(offer)}
            accessibilityRole="link"
            accessibilityLabel={`${offer.cta}: ${offer.title}`}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaText}>{offer.cta}</Text>
          </Pressable>
        </View>
      ))}
      <Text style={styles.disclosure}>Реклама · Партнёрские предложения. Цена для вас не меняется.</Text>
    </View>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    grid: {
      gap: DESIGN_TOKENS.spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.md,
      flexWrap: 'wrap',
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web' ? { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } : colors.shadows.light),
    },
    cardBody: {
      flex: 1,
      minWidth: 160,
      gap: DESIGN_TOKENS.spacing.xxs,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.text,
    },
    cardSubtitle: {
      fontSize: Platform.select({ default: 13, web: 14 }),
      lineHeight: 18,
      color: colors.textMuted,
    },
    cta: {
      minHeight: 44,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'opacity 0.15s' } as any) : null),
    },
    ctaPressed: {
      opacity: 0.85,
    },
    ctaText: {
      fontSize: 14,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.textOnPrimary,
    },
    disclosure: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: DESIGN_TOKENS.spacing.xxs,
    },
  })

export default React.memo(AffiliateOffers)
