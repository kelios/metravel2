import React, { memo, useCallback, useEffect, useMemo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import { useAuth } from '@/context/AuthContext'
import { useFavorites } from '@/context/FavoritesContext'
import TabTravelCard from '@/components/listTravel/TabTravelCard'
import { ResponsiveContainer } from '@/components/layout'
import { useResponsive } from '@/hooks/useResponsive'
import { useVisibleCardCount } from '@/hooks/useVisibleCardCount'
import { useTheme, useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import Button from '@/components/ui/Button'
import { createSectionStyles } from '@/components/home/homeInspirationStyles'

const MAX_ITEMS_PER_SHELF = 10
const DESKTOP_CARD_WIDTH = 208
const DESKTOP_CARD_GAP = 16

type TravelLikeItem = {
  id: string | number
  title?: string | null
  imageUrl?: string | null
  url: string
  country?: string | null
  city?: string | null
}

type ShelfSection = {
  badge?: { icon: 'clock' | 'favorite' }
  countLabel: string
  countValue: number
  ctaPath: '/favorites' | '/history'
  eyebrow: string
  icon: keyof typeof Feather.glyphMap
  items: TravelLikeItem[]
  listTestID: string
  subtitle: string
  title: string
  titleTestID: string
}

type Styles = ReturnType<typeof createStyles>
type SectionStyles = ReturnType<typeof createSectionStyles>

function mapToTravelLikeList(source: unknown): TravelLikeItem[] {
  const arr = Array.isArray(source) ? source : []
  return arr
    .filter((item: any) => item && item.url && item.id != null)
    .slice(0, MAX_ITEMS_PER_SHELF)
    .map(
      (item: any): TravelLikeItem => ({
        id: item.id,
        title: item.title,
        imageUrl: item.imageUrl,
        url: item.url,
        country: item.country ?? null,
        city: item.city ?? null,
      }),
    )
}

function toCardItem(item: TravelLikeItem) {
  return {
    id: item.id,
    title: item.title,
    imageUrl: item.imageUrl,
    city: item.city ?? null,
    country: item.country ?? (item as any).countryName ?? null,
  }
}

function SectionHeader({
  icon,
  eyebrow,
  title,
  subtitle,
  countLabel,
  countValue,
  testID,
  styles,
  sec,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap
  eyebrow: string
  title: string
  subtitle: string
  countLabel: string
  countValue: number
  testID: string
  styles: Styles
  sec: SectionStyles
  colors: ThemedColors
}) {
  return (
    <View style={sec.heroHeader} testID={testID}>
      <View style={sec.sectionBadge}>
        <Feather
          name={icon}
          size={12}
          color={colors.textMuted}
          {...({ 'aria-hidden': true, focusable: false } as any)}
        />
        <Text style={sec.sectionBadgeText}>{eyebrow}</Text>
      </View>

      <Text
        style={sec.heroTitle}
        accessibilityRole="header"
        {...({ 'aria-level': 2 } as any)}
      >
        {title}
      </Text>

      <Text style={sec.heroSubtitle}>{subtitle}</Text>

      <View style={styles.metaPill}>
        <Text style={styles.metaPillValue}>{countValue}</Text>
        <Text style={styles.metaPillLabel}>{countLabel}</Text>
      </View>
    </View>
  )
}

function HorizontalCards({
  data,
  badge,
  onPressItem,
  testID,
  colors,
  isMobile,
  styles,
}: {
  data: TravelLikeItem[]
  badge?: { icon: 'clock' | 'favorite' }
  onPressItem: (url: string) => void
  testID: string
  colors: ThemedColors
  isMobile: boolean
  styles: Styles
}) {
  const { isDark } = useTheme()
  const { onLayout, visibleCount } = useVisibleCardCount({
    itemCount: data.length,
    itemWidth: DESKTOP_CARD_WIDTH,
    gap: DESKTOP_CARD_GAP,
    max: MAX_ITEMS_PER_SHELF,
  })
  const previewData = isMobile ? data.slice(0, 2) : data.slice(0, visibleCount)

  const historyBadge = useMemo(
    () =>
      badge?.icon === 'clock'
        ? {
            icon: 'clock' as const,
            backgroundColor: colors.overlay,
            iconColor: isDark ? colors.text : colors.textOnDark,
          }
        : undefined,
    [badge?.icon, colors.overlay, colors.text, colors.textOnDark, isDark],
  )

  const keyExtractor = useCallback(
    (item: TravelLikeItem) => `${String(item.id)}-${item.url}`,
    [],
  )

  if (isMobile) {
    return (
      <View testID={testID} style={styles.mobileCardStack}>
        {previewData.map((item) => (
          <View key={keyExtractor(item)} style={styles.mobileCardStackItem}>
            <TabTravelCard
              item={toCardItem(item)}
              badge={historyBadge}
              onPress={() => onPressItem(item.url)}
              layout="grid"
            />
          </View>
        ))}
      </View>
    )
  }

  return (
    <View
      testID={testID}
      style={styles.previewRow}
      onLayout={onLayout}
    >
      {previewData.map((item) => (
        <TabTravelCard
          key={keyExtractor(item)}
          item={toCardItem(item)}
          badge={historyBadge}
          onPress={() => onPressItem(item.url)}
        />
      ))}
    </View>
  )
}

function HomeFavoritesHistorySection() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const { favorites, viewHistory, ensureServerData } = useFavorites() as any
  const colors = useThemedColors()
  const { isPhone, isLargePhone } = useResponsive()
  const isMobile = isPhone || isLargePhone
  const styles = useMemo(
    () => createStyles(colors, DESIGN_TOKENS, isMobile),
    [colors, isMobile],
  )
  const sec = useMemo(
    () => createSectionStyles(colors, isMobile),
    [colors, isMobile],
  )

  useEffect(() => {
    if (!isAuthenticated || typeof ensureServerData !== 'function') return
    ensureServerData('favorites')
    ensureServerData('history')
  }, [ensureServerData, isAuthenticated])

  const favoritesData = useMemo(() => mapToTravelLikeList(favorites), [favorites])
  const historyData = useMemo(() => mapToTravelLikeList(viewHistory), [viewHistory])

  const sections = useMemo<ShelfSection[]>(
    () =>
      (
        [
          {
            eyebrow: 'Сохранено',
            icon: 'bookmark',
            title: 'Избранное',
            subtitle: 'Маршруты, к которым вы хотите вернуться позже.',
            countLabel: 'в списке',
            countValue: favoritesData.length,
            ctaPath: '/favorites',
            items: favoritesData,
            listTestID: 'home-favorites-list',
            titleTestID: 'home-favorites-header',
          },
          {
            eyebrow: 'Недавнее',
            icon: 'clock',
            title: 'История',
            subtitle: 'Последние маршруты, которые вы уже открывали.',
            countLabel: 'просмотрено',
            countValue: historyData.length,
            ctaPath: '/history',
            items: historyData,
            listTestID: 'home-history-list',
            titleTestID: 'home-history-header',
            badge: { icon: 'clock' },
          },
        ] satisfies ShelfSection[]
      ).filter((section) => section.items.length > 0),
    [favoritesData, historyData],
  )

  const openUrl = useCallback(
    (url: string) => router.push(url as any),
    [router],
  )

  if (!isAuthenticated) return null

  if (sections.length === 0) {
    return (
      <View style={styles.band} testID="home-favorites-history-empty">
        <ResponsiveContainer maxWidth="xl" padding>
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Feather name="bookmark" size={22} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Здесь появятся ваши маршруты</Text>
            <Text style={styles.emptySubtitle}>
              Добавьте маршруты в избранное или откройте их — они сохранятся в истории.
            </Text>
            <Button
              label="Смотреть маршруты"
              onPress={() => router.push('/search' as any)}
              variant="secondary"
              icon={<Feather name="compass" size={16} color={colors.text} />}
              style={styles.emptyButton}
              labelStyle={styles.emptyButtonText}
              hoverStyle={styles.emptyButtonHover}
              pressedStyle={styles.emptyButtonHover}
              accessibilityLabel="Смотреть маршруты"
            />
          </View>
        </ResponsiveContainer>
      </View>
    )
  }

  return (
    <View style={styles.band} testID="home-favorites-history">
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.container}>
          {sections.map((section) => (
            <View key={section.ctaPath} style={sec.sectionFrame}>
              <SectionHeader
                icon={section.icon}
                eyebrow={section.eyebrow}
                title={section.title}
                subtitle={section.subtitle}
                countLabel={section.countLabel}
                countValue={section.countValue}
                testID={section.titleTestID}
                styles={styles}
                sec={sec}
                colors={colors}
              />
              <HorizontalCards
                data={section.items}
                badge={section.badge}
                onPressItem={openUrl}
                testID={section.listTestID}
                colors={colors}
                isMobile={isMobile}
                styles={styles}
              />
              <View style={[sec.headerActions, { marginTop: isMobile ? 14 : 20 }]}>
                <Button
                  label="Смотреть все"
                  onPress={() => router.push(section.ctaPath as any)}
                  accessibilityLabel={`Смотреть все: ${section.title}`}
                  icon={<Feather name="arrow-right" size={16} color={colors.text} />}
                  iconPosition="right"
                  variant="secondary"
                  style={[sec.viewMoreButton, isMobile && sec.viewMoreButtonMobile]}
                  labelStyle={sec.viewMoreText}
                  hoverStyle={sec.viewMoreButtonHover}
                  pressedStyle={sec.viewMoreButtonHover}
                />
              </View>
            </View>
          ))}
        </View>
      </ResponsiveContainer>
    </View>
  )
}

const createStyles = (
  colors: ThemedColors,
  tokens: typeof DESIGN_TOKENS,
  isMobile: boolean,
) =>
  StyleSheet.create({
    band: {
      paddingVertical: isMobile ? 24 : 36,
      backgroundColor: colors.background,
      width: '100%',
      alignSelf: 'stretch',
    },
    container: { gap: isMobile ? 20 : 32, width: '100%' },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: isMobile ? 32 : 48,
      gap: 12,
    },
    emptyIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyTitle: {
      fontSize: isMobile ? 17 : 20,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    emptySubtitle: {
      fontSize: isMobile ? 13 : 15,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: isMobile ? 20 : 23,
      maxWidth: 360,
    },
    emptyButton: {
      marginTop: 8,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: tokens.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      ...Platform.select({ web: { transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)' } }),
    },
    emptyButtonHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
    },
    emptyButtonText: { fontSize: 14, fontWeight: '600', color: colors.text },
    metaPill: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 5,
      paddingHorizontal: 13,
      paddingVertical: 6,
      borderRadius: tokens.radii.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    metaPillValue: { fontSize: 13, fontWeight: '800', color: colors.text },
    metaPillLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    previewRow: {
      width: '100%',
      paddingTop: 8,
      paddingBottom: 4,
      flexDirection: 'row',
      alignItems: 'stretch',
      overflow: 'hidden',
    },
    mobileCardStack: { width: '100%', gap: 14, paddingTop: 8, paddingBottom: 4 },
    mobileCardStackItem: { width: '100%', minWidth: 0 },
  })

export default memo(HomeFavoritesHistorySection)
