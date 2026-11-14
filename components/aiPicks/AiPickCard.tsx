import React, { useMemo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { CARD_MEDIA_SLOT_RATIO } from '@/components/listTravel/travelListItemHelpers'
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import type { AiPickItem } from '@/api/aiPicks'
import { translate as i18nT } from '@/i18n'
import { sendAnalyticsEvent } from '@/utils/analytics'

/** Запасная высота обложки для кадров без пропорций; геометрию слота задаёт `CARD_MEDIA_SLOT_RATIO` (#1674). */
export const AI_PICK_CARD_IMAGE_HEIGHT = 170
/** Компактный вид (#3295, карточка под ответом ассистента): обложка ниже, раскладка та же. */
export const AI_PICK_CARD_COMPACT_IMAGE_HEIGHT = 120
/** Пропорция обложки компактной карточки: шире кадра ленты, чтобы карточка с действиями помещалась в экран телефона. */
export const AI_PICK_CARD_COMPACT_MEDIA_RATIO = 16 / 10
/** Две строки `snippet` под карточкой поиска: тот же резерв у текста и скелета. */
export const AI_PICK_CARD_SNIPPET_HEIGHT = 40

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
  testID?: string
}

export function AiPickCard({ item, showSnippet = false, slotWidth, actionSlot, analyticsBlock, compact = false, markerLabel, testID }: Props) {
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

export function AiPickCardSkeleton({ showSnippet = false }: { showSnippet?: boolean }) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  return (
    <View style={styles.slot} testID="ai-pick-card-skeleton">
      {/* height="auto": иначе дефолтные 20 px загрузчика перебивают aspectRatio (см. UnifiedTravelCard). */}
      <SkeletonLoader width="100%" height="auto" borderRadius={16} style={styles.skeletonMedia} />
      <SkeletonLoader width="80%" height={18} borderRadius={6} style={styles.skeletonLine} />
      <SkeletonLoader width="50%" height={14} borderRadius={6} style={styles.skeletonLine} />
      {showSnippet ? <SkeletonLoader width="100%" height={AI_PICK_CARD_SNIPPET_HEIGHT} borderRadius={6} style={styles.skeletonLine} /> : null}
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
    skeletonLine: {
      marginTop: 4,
    },
    // Та же пропорция, что у медиа-бокса карточки: каркас и карточка одной геометрии.
    skeletonMedia: {
      width: '100%',
      aspectRatio: CARD_MEDIA_SLOT_RATIO,
    },
  })
}
