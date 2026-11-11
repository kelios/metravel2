import React, { useMemo } from 'react'

import { useQuestsForLocation } from '@/hooks/useQuestForLocation'
import type { Travel } from '@/types/types'
import { QuestForCityMatches } from './QuestForCityMatches'
import { buildTravelQuestLocationQuery, TRAVEL_QUEST_LOCATION_LIMIT } from './travelQuestLocationQuery'

export const QuestForCitySection: React.FC<{
  travel: Travel
  styles: any
}> = ({ travel, styles }) => {
  const query = useMemo(() => buildTravelQuestLocationQuery(travel), [travel])

  const { matches } = useQuestsForLocation(query, { limit: TRAVEL_QUEST_LOCATION_LIMIT })

  return <QuestForCityMatches travel={travel} styles={styles} matches={matches} />
}

export default React.memo(QuestForCitySection)
