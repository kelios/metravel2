import React, { memo, useCallback, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useTrackedImpression } from '@/hooks/useTrackedImpression'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import {
  trackContextualNextStepClicked,
  trackContextualNextStepImpression,
} from '@/utils/growthFunnelAnalytics'
import { translate as i18nT } from '@/i18n'

type ArticleNextStepSectionProps = {
  articleId?: string | number | null
}

const SOURCE = 'article_detail_intro'

function ArticleNextStepSection({ articleId }: ArticleNextStepSectionProps) {
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const contentId = articleId == null ? undefined : String(articleId)

  const impression = useTrackedImpression(
    `${SOURCE}:${contentId ?? 'unknown'}`,
    useCallback(() => {
      trackContextualNextStepImpression({
        source: SOURCE,
        contentType: 'article',
        contentId,
      })
    }, [contentId]),
  )

  const openDestination = useCallback((action: 'map' | 'quests') => {
    trackContextualNextStepClicked({
      source: SOURCE,
      contentType: 'article',
      contentId,
      action,
    })
    router.push((action === 'map' ? '/map' : '/quests') as never)
  }, [contentId, router])

  return (
    <View
      ref={impression.ref}
      onLayout={impression.onLayout}
      style={styles.container}
      accessibilityLabel={i18nT('shared:components.article.ArticleNextStepSection.heading')}
    >
      <View style={styles.headingRow}>
        <View style={styles.iconWrap}>
          <Feather name="compass" size={20} color={colors.primaryDark} />
        </View>
        <View style={styles.copy}>
          <Text
            style={styles.heading}
            accessibilityRole="header"
            aria-level={2}
          >
            {i18nT('shared:components.article.ArticleNextStepSection.heading')}
          </Text>
          <Text style={styles.subtitle}>
            {i18nT('shared:components.article.ArticleNextStepSection.subtitle')}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label={i18nT('shared:components.article.ArticleNextStepSection.openMap')}
          onPress={() => openDestination('map')}
          variant="primary"
          size="md"
          fullWidth
          icon={<Feather name="map" size={16} color={colors.textOnPrimary} />}
          accessibilityLabel={i18nT('shared:components.article.ArticleNextStepSection.openMapAccessibility')}
        />
        <Button
          label={i18nT('shared:components.article.ArticleNextStepSection.openQuests')}
          onPress={() => openDestination('quests')}
          variant="outline"
          size="md"
          fullWidth
          icon={<Feather name="navigation" size={16} color={colors.primary} />}
          accessibilityLabel={i18nT('shared:components.article.ArticleNextStepSection.openQuestsAccessibility')}
        />
      </View>
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      width: '100%',
      marginTop: DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.sm,
      padding: DESIGN_TOKENS.spacing.md,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.primarySoft,
      gap: DESIGN_TOKENS.spacing.md,
    },
    headingRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    iconWrap: {
      width: 40,
      height: 40,
      flexShrink: 0,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    heading: {
      color: colors.text,
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      lineHeight: 24,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      lineHeight: 21,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
    },
  })

export default memo(ArticleNextStepSection)
