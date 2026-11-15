import React, { useMemo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { AiPickType } from '@/api/aiPicks'
import { CARD_MEDIA_SLOT_RATIO } from '@/components/listTravel/travelListItemHelpers'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

// Геометрия блока «Похожие» (#2459) без карточки и запроса: её повторяет каркас
// сайдбара статьи до монтирования секции (#3430), поэтому модуль не тянет
// `UnifiedTravelCard` и React Query.

/** Две строки `snippet` под карточкой поиска: тот же резерв у текста и скелета. */
export const AI_PICK_CARD_SNIPPET_HEIGHT = 40
/** Сколько карточек показывать в одноколоночной раскладке телефона. */
export const AI_SIMILAR_NARROW_LIMIT = 3
/** Сколько карточек запрашивает блок статьи. */
export const AI_SIMILAR_DEFAULT_LIMIT = 6

export const aiSimilarVisibleLimit = (limit: number, isNarrowLayout: boolean) =>
  isNarrowLayout ? Math.min(limit, AI_SIMILAR_NARROW_LIMIT) : limit

export function createAiSimilarStyles(colors: ThemedColors, isNarrowLayout: boolean) {
  return StyleSheet.create({
    section: {
      marginTop: 24,
      gap: 4,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 12,
      gap: 12,
    },
    cardWrapper: {
      flexGrow: 1,
      flexBasis: 220,
      minWidth: 200,
      maxWidth: isNarrowLayout ? undefined : 320,
    },
  })
}

export function aiSimilarHeading(type: AiPickType) {
  return type === 'quest'
    ? { heading: i18nT('aiPicksStatic:similar.questTitle'), subtitle: i18nT('aiPicksStatic:similar.questSubtitle') }
    : { heading: i18nT('aiPicksStatic:similar.travelTitle'), subtitle: i18nT('aiPicksStatic:similar.travelSubtitle') }
}

/** Заголовок, подпись и сетка блока: одна коробка у карточек, каркаса и резерва сайдбара. */
export function AiSimilarFrame({
  type,
  styles,
  gridTestID,
  children,
}: {
  type: AiPickType
  styles: ReturnType<typeof createAiSimilarStyles>
  gridTestID: string
  children: React.ReactNode
}) {
  const colors = useThemedColors()
  const { heading, subtitle } = aiSimilarHeading(type)
  return (
    <>
      <View style={styles.headerRow}>
        <Feather name="compass" size={18} color={colors.primaryDark} />
        <Text
          style={styles.title}
          accessibilityRole={Platform.OS === 'web' ? ('heading' as never) : undefined}
          aria-level={2 as never}
        >
          {heading}
        </Text>
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.grid} testID={gridTestID}>
        {children}
      </View>
    </>
  )
}

export function AiPickCardSkeleton({ showSnippet = false }: { showSnippet?: boolean }) {
  const styles = skeletonStyles
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

/**
 * Каркас блока статьи в резерве сайдбара (#3430): та же коробка, что у загрузки
 * блока, поэтому раскрытие сайдбара растёт в резерв, а не в поток. Декоративный.
 */
export function AiSimilarSectionSkeleton({ isNarrowLayout }: { isNarrowLayout: boolean }) {
  const colors = useThemedColors()
  const styles = useMemo(() => createAiSimilarStyles(colors, isNarrowLayout), [colors, isNarrowLayout])
  return (
    <View
      style={styles.section}
      testID="travel-sidebar-similar-skeleton"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AiSimilarFrame type="travel" styles={styles} gridTestID="travel-sidebar-similar-skeleton-grid">
        {Array.from({ length: aiSimilarVisibleLimit(AI_SIMILAR_DEFAULT_LIMIT, isNarrowLayout) }, (_, index) => (
          <View key={index} style={styles.cardWrapper}>
            <AiPickCardSkeleton />
          </View>
        ))}
      </AiSimilarFrame>
    </View>
  )
}

const skeletonStyles = StyleSheet.create({
  slot: {
    gap: 6,
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
