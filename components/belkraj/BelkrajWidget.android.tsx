import React, { memo, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import ErrorDisplay from '@/components/ui/ErrorDisplay'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { SectionSkeleton } from '@/components/ui/SectionSkeleton'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { openExternalUrl } from '@/utils/externalLinks'
import {
  canRenderBelkrajWidget,
  parseBelkrajCoord,
  resolveBelkrajCountryCode,
} from './belkrajAvailability'
import { loadBelkrajNativeData, type BelkrajNativeData } from './belkrajNativeData'
import { buildBelkrajWidgetUrl } from './belkrajWidgetUrl'

interface TravelAddress {
  id: number
  address: string
  coord?: string
  lat?: number
  lng?: number
}

type Props = {
  points: TravelAddress[]
  countryCode?: string
  cardsCount?: number
  /** Web props remain accepted because moduleSuffixes resolves this native type. */
  collapsedHeight?: number
  expandedHeight?: number
  allowScroll?: boolean
  className?: string
}

type LoadState =
  | { url: string; status: 'loading' }
  | { url: string; status: 'error' }
  | { url: string; status: 'ready'; data: BelkrajNativeData }

const REQUEST_TIMEOUT_MS = 15_000

const openPartnerUrl = (url: string) => {
  void openExternalUrl(url, { allowedProtocols: ['https:'] })
}

/** Render partner data as native cards without executing its page or tracking scripts. */
function BelkrajWidget({ points, countryCode, cardsCount = 6 }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [state, setState] = useState<LoadState | null>(null)
  const [attempt, setAttempt] = useState(0)
  const canRender = useMemo(
    () => canRenderBelkrajWidget(points, countryCode),
    [countryCode, points],
  )

  const partnerUrl = useMemo(() => {
    const coord = parseBelkrajCoord(points?.[0])
    if (!coord) return null
    return buildBelkrajWidgetUrl({
      coord,
      countryCode: resolveBelkrajCountryCode(points, countryCode),
      cardsCount,
    })
  }, [cardsCount, countryCode, points])

  useEffect(() => {
    if (!canRender || !partnerUrl) return
    const controller = new AbortController()
    let active = true
    setState({ url: partnerUrl, status: 'loading' })
    const timeout = setTimeout(() => {
      if (!active) return
      active = false
      controller.abort()
      setState({ url: partnerUrl, status: 'error' })
    }, REQUEST_TIMEOUT_MS)

    void loadBelkrajNativeData(partnerUrl, controller.signal)
      .then((data) => {
        if (!active) return
        setState(data.cards.length
          ? { url: partnerUrl, status: 'ready', data }
          : { url: partnerUrl, status: 'error' })
      })
      .catch(() => {
        if (active) setState({ url: partnerUrl, status: 'error' })
      })
      .finally(() => clearTimeout(timeout))

    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [attempt, canRender, partnerUrl])

  if (!canRender || !partnerUrl) return null
  // A changed point must never show the previous location's excursions, even
  // during the render before the new effect starts.
  if (!state || state.url !== partnerUrl || state.status === 'loading') {
    return <SectionSkeleton lines={3} height={104} />
  }
  if (state.status === 'error') {
    return (
      <ErrorDisplay
        message={i18nT('home:components.home.HomeInspirationSection.ne_udalos_zagruzit_podborku_520d6c7c')}
        onRetry={() => setAttempt((value) => value + 1)}
        showContact={false}
      />
    )
  }

  const { data } = state
  return (
    <View testID="belkraj-native-excursions" style={styles.container}>
      <Text accessibilityRole="header" style={styles.heading}>{data.title}</Text>
      <Text style={styles.brand}>belkraj.by</Text>
      {data.cards.map((card) => (
        <Pressable
          key={card.url}
          testID="belkraj-native-excursion-card"
          accessibilityRole="link"
          accessibilityLabel={[card.title, card.subtitle, card.rating].filter(Boolean).join(', ')}
          onPress={() => openPartnerUrl(card.url)}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={styles.image}>
            <ImageCardMedia
              src={card.imageUrl}
              alt=""
              width={104}
              height={104}
              fit="contain"
              blurBackground
              borderRadius={DESIGN_TOKENS.radii.md}
            />
          </View>
          <View style={styles.content}>
            <Text style={styles.title}>{card.title}</Text>
            {!!card.subtitle && <Text style={styles.subtitle}>{card.subtitle}</Text>}
            {!!card.rating && <Text style={styles.rating}>{card.rating}</Text>}
          </View>
        </Pressable>
      ))}
      {!!data.listUrl && !!data.listLabel && (
        <Pressable
          testID="belkraj-native-excursions-list-link"
          accessibilityRole="link"
          onPress={() => openPartnerUrl(data.listUrl!)}
          style={({ pressed }) => [styles.listLink, pressed && styles.pressed]}
        >
          <Text style={styles.listLabel}>{data.listLabel}</Text>
        </Pressable>
      )}
    </View>
  )
}

const createStyles = (colors: ThemedColors) => StyleSheet.create({
  container: { gap: DESIGN_TOKENS.spacing.sm },
  heading: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '600',
  },
  brand: { color: colors.textMuted, fontSize: DESIGN_TOKENS.typography.sizes.xs },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DESIGN_TOKENS.spacing.sm,
    padding: DESIGN_TOKENS.spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: DESIGN_TOKENS.radii.lg,
    backgroundColor: colors.surface,
  },
  image: { width: 104, height: 104, flexShrink: 0 },
  content: { flex: 1, minWidth: 0, gap: DESIGN_TOKENS.spacing.xs },
  title: {
    color: colors.primaryText,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
  },
  subtitle: { color: colors.textMuted, fontSize: DESIGN_TOKENS.typography.sizes.sm },
  rating: { color: colors.text, fontSize: DESIGN_TOKENS.typography.sizes.sm },
  listLink: { minHeight: 44, justifyContent: 'center', paddingVertical: DESIGN_TOKENS.spacing.sm },
  listLabel: { color: colors.primaryText, fontSize: DESIGN_TOKENS.typography.sizes.sm, textDecorationLine: 'underline' },
  pressed: { opacity: 0.85 },
})

export default memo(BelkrajWidget)
