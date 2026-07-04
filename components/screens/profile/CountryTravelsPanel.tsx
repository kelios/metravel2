// [FE-635-T3] Компактная панель маршрутов страны (мини-карточки).
// Desktop — сетка 2–3 колонки, mobile — горизонтальный скролл-рэйл.
// Фото-доминанта сохраняется (mini/utility-исключение): ImageCardMedia
// contain+blur. Показываем первые N, остальное — «Показать все (K)».

import { useMemo, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'

const INITIAL_LIMIT = 6

export type CountryTravelCard = {
  id: string
  name: string
  url: string
  imageUrl: string
}

interface CountryTravelsPanelProps {
  travels: CountryTravelCard[]
  isMobile: boolean
  onOpenTravel: (url: string) => void
  onShowAll: () => void
}

export function CountryTravelsPanel({
  travels,
  isMobile,
  onOpenTravel,
  onShowAll,
}: CountryTravelsPanelProps) {
  const colors = useThemedColors()
  const [expanded, setExpanded] = useState(false)

  const cardWidth = isMobile ? 148 : 168
  const photoHeight = isMobile ? 104 : 116

  const visible = expanded ? travels : travels.slice(0, INITIAL_LIMIT)
  const hiddenCount = travels.length - visible.length

  const styles = useMemo(
    () =>
      StyleSheet.create({
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: DESIGN_TOKENS.spacing.sm,
        },
        rail: {
          gap: DESIGN_TOKENS.spacing.sm,
          paddingBottom: DESIGN_TOKENS.spacing.xxs,
        },
        card: {
          width: cardWidth,
          backgroundColor: colors.surface,
          borderRadius: DESIGN_TOKENS.radii.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          overflow: 'hidden',
          ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
        },
        titleWrap: {
          paddingTop: DESIGN_TOKENS.spacing.xs,
          paddingBottom: DESIGN_TOKENS.spacing.sm,
          paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        },
        title: {
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          lineHeight: 16,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as '600',
          color: colors.text,
          minHeight: 32,
        },
        showAll: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          marginTop: DESIGN_TOKENS.spacing.xs,
          paddingVertical: DESIGN_TOKENS.spacing.xs,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.surfaceMuted,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
        },
        showAllText: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as '600',
          color: colors.text,
        },
      }),
    [colors, cardWidth],
  )

  const renderCard = (travel: CountryTravelCard) => (
    <Pressable
      key={travel.id}
      onPress={() => onOpenTravel(travel.url)}
      accessibilityRole="link"
      accessibilityLabel={travel.name}
      style={styles.card}
    >
      <ImageCardMedia
        src={travel.imageUrl}
        alt={travel.name}
        height={photoHeight}
        width="100%"
        fit="contain"
        blurBackground
      />
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={2}>
          {travel.name}
        </Text>
      </View>
    </Pressable>
  )

  const showAllButton =
    hiddenCount > 0 ? (
      <Pressable
        onPress={() => setExpanded(true)}
        accessibilityRole="button"
        accessibilityLabel={`Показать все маршруты (${hiddenCount})`}
        style={styles.showAll}
      >
        <Text style={styles.showAllText}>Ещё {hiddenCount}</Text>
        <Feather name="chevron-down" size={16} color={colors.text} />
      </Pressable>
    ) : travels.length > INITIAL_LIMIT ? (
      <Pressable
        onPress={onShowAll}
        accessibilityRole="button"
        accessibilityLabel="Все маршруты"
        style={styles.showAll}
      >
        <Text style={styles.showAllText}>Все маршруты</Text>
        <Feather name="arrow-right" size={16} color={colors.text} />
      </Pressable>
    ) : null

  if (isMobile) {
    return (
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {visible.map(renderCard)}
        </ScrollView>
        {showAllButton}
      </View>
    )
  }

  return (
    <View>
      <View style={styles.grid}>{visible.map(renderCard)}</View>
      {showAllButton}
    </View>
  )
}

export default CountryTravelsPanel
