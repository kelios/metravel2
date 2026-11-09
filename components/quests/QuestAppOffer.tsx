import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'

import AppStoreButtons from '@/components/appDownload/AppStoreButtons'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { AppStorePlatform } from '@/constants/appStore'
import { useThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { getPhoneStorePlatform, isStandaloneDisplayMode } from '@/utils/appInstallHint'

export type QuestAppOfferPlacement = 'quest_intro' | 'quest_finale'

/**
 * #3220: the quest page offers the app in its own flow — before the start and on
 * the finale. The floating install bar never covers a quest page (see
 * `AppInstallBar`): on a step it hid the task and the answer field.
 * Phone browsers only, as the bar (#2907); inside the app or an installed PWA
 * there is nothing to offer.
 */
export default function QuestAppOffer({ placement }: { placement: QuestAppOfferPlacement }) {
  const colors = useThemedColors()
  const { t } = useTranslation()
  const [platform, setPlatform] = useState<AppStorePlatform | null>(null)
  const shownRecorded = useRef(false)
  const styles = useMemo(() => StyleSheet.create({
    card: {
      marginTop: DESIGN_TOKENS.spacing.sm,
      gap: DESIGN_TOKENS.spacing.sm,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    title: { fontSize: 15, fontWeight: '700', color: colors.text },
    description: { fontSize: 13, color: colors.textMuted },
  }), [colors])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || isStandaloneDisplayMode()) return
    setPlatform(getPhoneStorePlatform(String(window.navigator?.userAgent || '')))
  }, [])

  useEffect(() => {
    if (!platform || shownRecorded.current) return
    shownRecorded.current = true
    // Own names (#3220 review): the floating bar's show → click funnel stays its own;
    // `placement` is not a registered GA4 dimension, so a shared name would merge them.
    void sendAnalyticsEvent('QuestAppOffer_Shown', { platform, placement })
  }, [placement, platform])

  if (!platform) return null
  return (
    <View style={styles.card} testID={`quest-app-offer-${placement}`}>
      <Text style={styles.title}>{t('sharedStatic:appHandoff.signal.quest_start.title')}</Text>
      <Text style={styles.description}>{t('sharedStatic:appHandoff.signal.quest_start.description')}</Text>
      <AppStoreButtons
        source={placement}
        size="md"
        fullWidth
        testID={`quest-app-offer-${placement}-stores`}
        onStorePress={(store) => { void sendAnalyticsEvent('QuestAppOffer_Click', { platform: store, placement }) }}
      />
    </View>
  )
}
