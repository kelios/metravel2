import React, { useMemo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { AiPickType } from '@/api/aiPicks'
import { useAiSimilar } from '@/hooks/useAiPicks'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { isAiPicksEnabled } from '@/utils/aiPicksConfig'

import { AiPickCard, AiPickCardSkeleton } from './AiPickCard'

/** Потолок слота сетки (`maxWidth` ниже) — ширина растра для карточки. */
const CARD_SLOT_WIDTH = 320
/** Сколько карточек показывать в одноколоночной раскладке телефона. */
const NARROW_LIMIT = 3

type Props = {
  /** Источник: статья (`travel`) или квест (`quest`). */
  type: AiPickType
  id: number | null | undefined
  limit?: number
  /** Откладывает запрос, пока секция не рядом с вьюпортом. */
  enabled?: boolean
  testID?: string
}

/**
 * «Похожие статьи» (#2459): смысловые соседи источника из индекса metravel-assist.
 * Пустой ответ, отказ службы или выключенный флаг — `null` без зазора: блок либо
 * есть целиком, либо его нет, а карточки приходят в каркас той же геометрии.
 * Без флага не подписывается ни на кэш, ни на размеры окна.
 */
export function AiSimilarSection(props: Props) {
  return isAiPicksEnabled() ? <AiSimilarSectionContent {...props} /> : null
}

function AiSimilarSectionContent({ type, id, limit = 6, enabled = true, testID = 'ai-similar-section' }: Props) {
  const colors = useThemedColors()
  const { isHydrated, isMobile } = useResponsive()
  const isNarrowLayout = isHydrated && isMobile
  const styles = useMemo(() => createStyles(colors, isNarrowLayout), [colors, isNarrowLayout])
  const query = useAiSimilar({ type, id, limit, resultType: 'travel', enabled })
  // На телефоне карточки идут в одну колонку во всю ширину — показываем первые
  // NARROW_LIMIT из запрошенных, чтобы блок не растягивался на несколько экранов.
  const visibleLimit = isNarrowLayout ? Math.min(limit, NARROW_LIMIT) : limit
  const items = (query.data ?? []).slice(0, visibleLimit)
  const isLoading = query.isFetching && !query.data

  if (!isLoading && items.length === 0) return null

  const heading = type === 'quest' ? i18nT('aiPicksStatic:similar.questTitle') : i18nT('aiPicksStatic:similar.travelTitle')
  const subtitle = type === 'quest' ? i18nT('aiPicksStatic:similar.questSubtitle') : i18nT('aiPicksStatic:similar.travelSubtitle')

  return (
    <View
      style={styles.section}
      testID={testID}
      collapsable={false}
      accessibilityLabel={heading}
      accessibilityRole={Platform.OS === 'web' ? ('region' as never) : undefined}
      {...(Platform.OS === 'web' ? { dataSet: { sectionKey: 'ai-similar' } } : {})}
    >
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
      <View style={styles.grid} testID={isLoading ? 'ai-similar-skeleton' : 'ai-similar-grid'}>
        {isLoading
          ? Array.from({ length: visibleLimit }, (_, index) => (
              <View key={`skeleton-${index}`} style={styles.cardWrapper}>
                <AiPickCardSkeleton />
              </View>
            ))
          : items.map((item) => (
              <View key={`${item.type}-${item.source_id}`} style={styles.cardWrapper}>
                <AiPickCard item={item} slotWidth={CARD_SLOT_WIDTH} />
              </View>
            ))}
      </View>
    </View>
  )
}

function createStyles(colors: ThemedColors, isNarrowLayout: boolean) {
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

export default React.memo(AiSimilarSection)
