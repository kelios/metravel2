import { memo, useMemo } from 'react'

import { useQuestsForLocation } from '@/hooks/useQuestForLocation'
import type { Travel } from '@/types/types'
import TravelQuestTeaserLink from './TravelQuestTeaserLink'
import { buildTravelQuestLocationQuery, TRAVEL_QUEST_LOCATION_LIMIT } from './travelQuestLocationQuery'
import { resolveTravelQuestTeaser } from './travelQuestTeaser'

/**
 * #3221: короткая ссылка на квесты города в начале статьи — вариант приложения.
 * На сайте подбор приходит с серверным загрузчиком (`TravelQuestTeaserLine.web.tsx`);
 * здесь его даёт тот же запрос, что и у полного блока под текстом
 * (`QuestForCitySection`): запрос и лимит совпадают, ключ React Query один, и
 * вторая подписка в сеть не ходит.
 *
 * Пока ответа нет, места под строку нет. У большинства статей квестов рядом
 * нет, и резерв на время запроса сдвигал бы их текст вверх при каждом открытии,
 * а при сбое сети — после повторов, когда статью уже читают (#2772). Сдвиг на
 * высоту строки остаётся только у статей с квестами, в момент ответа.
 */
function TravelQuestTeaserLine({ travel }: { travel: Travel }) {
  const query = useMemo(() => buildTravelQuestLocationQuery(travel), [travel])
  const { matches } = useQuestsForLocation(query, { limit: TRAVEL_QUEST_LOCATION_LIMIT })
  const teaser = useMemo(
    () => resolveTravelQuestTeaser(matches.map(({ quest }) => ({
      quest_id: quest.id,
      city_id: quest.cityId,
      city_name: quest.cityName ?? '',
      city_alias: quest.cityAlias,
    }))),
    [matches],
  )

  return teaser ? <TravelQuestTeaserLink teaser={teaser} contextId={travel.id ?? travel.slug} /> : null
}

export default memo(TravelQuestTeaserLine)
