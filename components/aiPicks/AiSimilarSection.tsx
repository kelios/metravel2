import React, { useMemo } from 'react'
import { Platform, View } from 'react-native'

import type { AiPickType } from '@/api/aiPicks'
import { useAiSimilar } from '@/hooks/useAiPicks'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { isAiSimilarEnabled } from '@/utils/aiPicksConfig'

import { AiPickCard } from './AiPickCard'
import {
  AI_SIMILAR_DEFAULT_LIMIT,
  AiPickCardSkeleton,
  AiSimilarFrame,
  aiSimilarHeading,
  aiSimilarVisibleLimit,
  createAiSimilarStyles,
} from './AiSimilarSkeleton'

/** Потолок слота сетки (`maxWidth` ниже) — ширина растра для карточки. */
const CARD_SLOT_WIDTH = 320
/**
 * Ключ секции для навигации страницы (`data-section-key` на web, #3395). Блок статьи —
 * пункт меню `similar`; ключ выводится здесь, а не передаётся из сайдбара: чанк
 * сайдбара стоит на потолке бюджета (`config/bundle-budget.json`).
 */
const SECTION_KEY_BY_TYPE: Record<AiPickType, string> = { travel: 'similar', quest: 'ai-similar' }

type Props = {
  /** Источник: статья (`travel`) или квест (`quest`). */
  type: AiPickType
  id: number | null | undefined
  limit?: number
  /** Откладывает запрос, пока секция не рядом с вьюпортом. */
  enabled?: boolean
  testID?: string
  /** Якорь секции для прокрутки на native (`AnchorsMap.similar`, #3395). */
  anchorRef?: React.Ref<React.ComponentRef<typeof View>>
}

/**
 * «Похожие статьи» (#2459): смысловые соседи источника из индекса metravel-assist —
 * от службы или из статического слепка (#3292, `getAiSimilarSource`).
 * Пустой ответ, отказ службы или выключенный флаг — `null` без зазора: блок либо
 * есть целиком, либо его нет, а карточки приходят в каркас той же геометрии.
 * Без флага не подписывается ни на кэш, ни на размеры окна.
 */
export function AiSimilarSection(props: Props) {
  return isAiSimilarEnabled() ? <AiSimilarSectionContent {...props} /> : null
}

function AiSimilarSectionContent({
  type,
  id,
  limit = AI_SIMILAR_DEFAULT_LIMIT,
  enabled = true,
  testID = 'ai-similar-section',
  anchorRef,
}: Props) {
  const colors = useThemedColors()
  // #3430: блок статьи монтируется только в отложенном сайдбаре, уже после
  // гидратации. Без `clientOnly` его первый кадр брал широкую раскладку (6 каркасов,
  // 2292 px на 390) и следующим кадром схлопывался до 3 (1290 px) — у конца
  // страницы этот перепад приходился на кадры прокрутки и считался сдвигом.
  // Блок квеста стоит в SSR-разметке страницы и сохраняет гейт гидратации.
  // Карточки статьи — по той же причине: заголовок «нулевого» кадра шёл в 2 строки
  // и через кадр в 1 (+12 px на карточку, 1290 → 1332 → 1296 px).
  const clientOnly = type === 'travel'
  const { isHydrated, isMobile } = useResponsive({ clientOnly })
  const isNarrowLayout = isHydrated && isMobile
  const styles = useMemo(() => createAiSimilarStyles(colors, isNarrowLayout), [colors, isNarrowLayout])
  const query = useAiSimilar({ type, id, limit, resultType: 'travel', enabled })
  // На телефоне карточки идут в одну колонку во всю ширину — показываем первые
  // AI_SIMILAR_NARROW_LIMIT из запрошенных, чтобы блок не растягивался на несколько экранов.
  const visibleLimit = aiSimilarVisibleLimit(limit, isNarrowLayout)
  const items = (query.data ?? []).slice(0, visibleLimit)
  const isLoading = query.isFetching && !query.data

  if (!isLoading && items.length === 0) return null

  const { heading } = aiSimilarHeading(type)

  return (
    <View
      ref={anchorRef}
      style={styles.section}
      testID={testID}
      collapsable={false}
      accessibilityLabel={heading}
      accessibilityRole={Platform.OS === 'web' ? ('region' as never) : undefined}
      {...(Platform.OS === 'web' ? { dataSet: { sectionKey: SECTION_KEY_BY_TYPE[type] } } : {})}
    >
      <AiSimilarFrame type={type} styles={styles} gridTestID={isLoading ? 'ai-similar-skeleton' : 'ai-similar-grid'}>
        {isLoading
          ? Array.from({ length: visibleLimit }, (_, index) => (
              <View key={`skeleton-${index}`} style={styles.cardWrapper}>
                <AiPickCardSkeleton />
              </View>
            ))
          : items.map((item) => (
              <View key={`${item.type}-${item.source_id}`} style={styles.cardWrapper}>
                <AiPickCard item={item} slotWidth={CARD_SLOT_WIDTH} analyticsBlock={`similar_${type}`} layoutClientOnly={clientOnly} />
              </View>
            ))}
      </AiSimilarFrame>
    </View>
  )
}

export default React.memo(AiSimilarSection)
