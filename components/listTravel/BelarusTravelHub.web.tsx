import Feather from '@expo/vector-icons/Feather'
import { Link } from 'expo-router'
import { createElement, useMemo, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useTranslation } from '@/i18n/LocaleProvider'
import { useThemedColors } from '@/hooks/useTheme'
import {
  BELARUS_TRAVEL_CITY_LINKS,
  BELARUS_TRAVEL_THEME_LINKS,
  type BelarusTravelHubLink,
} from './belarusTravelHubModel'

type HeadingProps = {
  children: ReactNode
  level: 1 | 2
  style: Record<string, unknown>
}

function Heading({ children, level, style }: HeadingProps) {
  const htmlStyle =
    typeof style.lineHeight === 'number'
      ? { ...style, lineHeight: `${style.lineHeight}px` }
      : style

  return createElement(`h${level}`, { style: htmlStyle }, children)
}

export default function BelarusTravelHub() {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const renderThemeLink = (item: BelarusTravelHubLink) => {
    const title = t(item.titleKey)
    const description = item.descriptionKey ? t(item.descriptionKey) : null

    return (
      <Link key={item.href} href={item.href} asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={title}
          style={({ pressed }) => [styles.themeCard, pressed && styles.linkPressed]}
        >
          <View style={styles.linkTitleRow}>
            <Text style={styles.themeCardTitle}>{title}</Text>
            <Feather name="arrow-right" size={18} color={colors.primaryText} />
          </View>
          {description ? <Text style={styles.themeCardDescription}>{description}</Text> : null}
        </Pressable>
      </Link>
    )
  }

  const renderCityLink = (item: BelarusTravelHubLink) => {
    const title = t(item.titleKey)

    return (
      <Link key={item.href} href={item.href} asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={title}
          style={({ pressed }) => [styles.cityLink, pressed && styles.linkPressed]}
        >
          <Text style={styles.cityLinkText}>{title}</Text>
          <Feather name="chevron-right" size={16} color={colors.primaryText} />
        </Pressable>
      </Link>
    )
  }

  return (
    <View style={styles.wrapper} testID="belarus-travel-seo-hub">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{t('sharedStatic:travelsByHub.eyebrow')}</Text>
        <Heading level={1} style={styles.heroTitle as Record<string, unknown>}>
          {t('sharedStatic:travelsByHub.title')}
        </Heading>
        <Text style={styles.heroDescription}>
          {t('sharedStatic:travelsByHub.description')}
        </Text>
      </View>

      <View style={styles.section}>
        <Heading level={2} style={styles.sectionTitle as Record<string, unknown>}>
          {t('sharedStatic:travelsByHub.themesHeading')}
        </Heading>
        <View style={styles.themeGrid}>{BELARUS_TRAVEL_THEME_LINKS.map(renderThemeLink)}</View>
      </View>

      <View style={styles.section}>
        <Heading level={2} style={styles.sectionTitle as Record<string, unknown>}>
          {t('sharedStatic:travelsByHub.citiesHeading')}
        </Heading>
        <View style={styles.cityLinks}>{BELARUS_TRAVEL_CITY_LINKS.map(renderCityLink)}</View>
      </View>

      <View style={styles.catalogIntro}>
        <Heading level={2} style={styles.catalogTitle as Record<string, unknown>}>
          {t('sharedStatic:travelsByHub.catalogHeading')}
        </Heading>
        <Text style={styles.catalogDescription}>
          {t('sharedStatic:travelsByHub.catalogDescription')}
        </Text>
      </View>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    wrapper: {
      width: '100%',
      maxWidth: 1180,
      alignSelf: 'center',
      paddingTop: DESIGN_TOKENS.spacing.md,
      paddingBottom: DESIGN_TOKENS.spacing.lg,
      gap: DESIGN_TOKENS.spacing.lg,
    },
    hero: {
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingVertical: DESIGN_TOKENS.spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.surface,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    eyebrow: {
      ...DESIGN_TOKENS.typography.scale.label,
      color: colors.primaryText,
      textTransform: 'uppercase',
    },
    heroTitle: {
      ...DESIGN_TOKENS.typography.scale.display,
      color: colors.text,
      margin: 0,
    },
    heroDescription: {
      ...DESIGN_TOKENS.typography.scale.body,
      color: colors.textMuted,
      maxWidth: 820,
    },
    section: {
      gap: DESIGN_TOKENS.spacing.sm,
    },
    sectionTitle: {
      ...DESIGN_TOKENS.typography.scale.h2,
      color: colors.text,
      margin: 0,
    },
    themeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    themeCard: {
      minWidth: 240,
      flexBasis: 260,
      flexGrow: 1,
      padding: DESIGN_TOKENS.spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.backgroundSecondary,
      gap: DESIGN_TOKENS.spacing.xs,
      cursor: 'pointer',
    },
    linkPressed: {
      opacity: 0.76,
    },
    linkTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    themeCardTitle: {
      ...DESIGN_TOKENS.typography.scale.h3,
      color: colors.text,
      flex: 1,
    },
    themeCardDescription: {
      ...DESIGN_TOKENS.typography.scale.bodySmall,
      color: colors.textMuted,
    },
    cityLinks: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    cityLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xxs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      cursor: 'pointer',
    },
    cityLinkText: {
      ...DESIGN_TOKENS.typography.scale.bodySmall,
      color: colors.primaryText,
    },
    catalogIntro: {
      paddingTop: DESIGN_TOKENS.spacing.xs,
      gap: DESIGN_TOKENS.spacing.xxs,
    },
    catalogTitle: {
      ...DESIGN_TOKENS.typography.scale.h2,
      color: colors.text,
      margin: 0,
    },
    catalogDescription: {
      ...DESIGN_TOKENS.typography.scale.bodySmall,
      color: colors.textMuted,
    },
  })
