import { memo, useMemo } from 'react'

import type { Travel } from '@/types/types'
import { useTravelLoaderPayload } from '../travelLoaderData'
import TravelQuestTeaserLink from './TravelQuestTeaserLink'
import { resolveTravelQuestTeaser } from './travelQuestTeaser'

/**
 * #3221: короткая ссылка на квесты города в начале статьи. Полный блок с
 * карточками остаётся под текстом (#2774); здесь одна строка высотой в один
 * ряд, чтобы начало текста не уезжало ниже второго экрана.
 *
 * Сайт: данные — подбор из серверного загрузчика статьи. Строка есть уже в
 * серверном HTML и не появляется позже, поэтому не сдвигает страницу и
 * прокрутку (#2772). Без подбора (статья без квестов, сбой подбора) строки нет.
 * Приложение берёт тот же подбор запросом — `TravelQuestTeaserLine.tsx`.
 */
function TravelQuestTeaserLine({ travel }: { travel: Travel }) {
  const graph = useTravelLoaderPayload()?.linkGraph
  const graphQuests = graph?.state === 'available' ? graph.quests : null
  const teaser = useMemo(
    () => (graphQuests ? resolveTravelQuestTeaser(graphQuests.map((match) => match.quest)) : null),
    [graphQuests],
  )

  return teaser ? <TravelQuestTeaserLink teaser={teaser} contextId={travel.id ?? travel.slug} /> : null
}

export default memo(TravelQuestTeaserLine)
