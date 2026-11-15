import React, { useMemo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { CARD_MEDIA_SLOT_RATIO } from '@/components/listTravel/travelListItemHelpers'
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import type { AiPickItem } from '@/api/aiPicks'
import { translate as i18nT } from '@/i18n'
import { sendAnalyticsEvent } from '@/utils/analytics'

import { AI_PICK_CARD_SNIPPET_HEIGHT } from './AiSimilarSkeleton'

/** Запасная высота обложки для кадров без пропорций; геометрию слота задаёт `CARD_MEDIA_SLOT_RATIO` (#1674). */
export const AI_PICK_CARD_IMAGE_HEIGHT = 170
/** Компактный вид (#3295, карточка под ответом ассистента): обложка ниже, раскладка та же. */
export const AI_PICK_CARD_COMPACT_IMAGE_HEIGHT = 120
/** Пропорция обложки компактной карточки: шире кадра ленты, чтобы карточка с действиями помещалась в экран телефона. */
export const AI_PICK_CARD_COMPACT_MEDIA_RATIO = 16 / 10
export { AI_PICK_CARD_SNIPPET_HEIGHT, AiPickCardSkeleton } from './AiSimilarSkeleton'

export function aiPickMetaText(item: Pick<AiPickItem, 'type' | 'city' | 'country'>): string | null {
  const place = [item.city, item.country].filter(Boolean).join(', ')
  const typeLabel = item.type === 'quest' ? i18nT('aiPicksStatic:type.quest') : null
  return [typeLabel, place].filter(Boolean).join(' · ') || null
}

type Props = {
  item: AiPickItem
  /** Показывать фрагмент текста, объясняющий совпадение (поиск по описанию). */
  showSnippet?: boolean
  /** Ширина слота в сетке/ряду — только для сайзинга растра, не для раскладки (#1487). */
  slotWidth: number
  /** Действие под карточкой (#2911: «Добавить в маршрут»); карточка по-прежнему открывает страницу. */
  actionSlot?: React.ReactNode
  /** Блок, в котором стоит карточка (#3292): с ним клик уходит событием `AiPick_Click` — доля переходов из блока. */
  analyticsBlock?: string
  /** Компактный вид (#3295): обложка ниже — карточка стоит под ответом ассистента, а не в ленте. */
  compact?: boolean
  /** Отметка в углу обложки (#3295: «Из ответа» у карточки, которую ассистент назвал в тексте). */
  markerLabel?: string
  /** Карточка смонтирована после гидратации (#3430): см. `UnifiedTravelCard.layoutClientOnly`. */
  layoutClientOnly?: boolean
  testID?: string
}

export function AiPickCard({ item, showSnippet = false, slotWidth, actionSlot, analyticsBlock, compact = false, markerLabel, layoutClientOnly, testID }: Props) {
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const snippet = showSnippet ? item.snippet.trim() : ''

  return (
    <View style={styles.slot} testID={testID ?? `ai-pick-card-${item.type}-${item.source_id}`}>
      <UnifiedTravelCard
        title={item.title}
        imageUrl={item.cover}
        metaText={aiPickMetaText(item)}
        onPress={() => {
          if (analyticsBlock) void sendAnalyticsEvent('AiPick_Click', { block: analyticsBlock, type: item.type, id: item.source_id })
          router.push(item.path as never)
        }}
        imageHeight={compact ? AI_PICK_CARD_COMPACT_IMAGE_HEIGHT : AI_PICK_CARD_IMAGE_HEIGHT}
        mediaAspectRatio={compact ? AI_PICK_CARD_COMPACT_MEDIA_RATIO : CARD_MEDIA_SLOT_RATIO}
        mediaSlotWidth={slotWidth}
        layoutClientOnly={layoutClientOnly}
        mediaFit={compact ? 'cover' : 'contain'}
        mediaProps={{ blurBackground: true, allowCriticalWebBlur: true }}
        leftTopSlot={
          markerLabel ? (
            <View style={styles.marker} testID="ai-pick-card-marker">
              <Text style={styles.markerText} numberOfLines={1}>
                {markerLabel}
              </Text>
            </View>
          ) : undefined
        }
        style={styles.card}
      />
      {snippet ? (
        <Text style={styles.snippet} numberOfLines={2} testID="ai-pick-card-snippet">
          {snippet}
        </Text>
      ) : null}
      {actionSlot ?? null}
    </View>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    slot: {
      gap: 6,
    },
    card: {
      backgroundColor: colors.surface,
      ...Platform.select({ web: { height: '100%' as const } }),
    },
    snippet: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
      minHeight: AI_PICK_CARD_SNIPPET_HEIGHT,
    },
    marker: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    markerText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
  })
}
