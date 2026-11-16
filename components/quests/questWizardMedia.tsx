import { lazy } from 'react'

import QuestFullMapLazy from '@/components/quests/QuestFullMapLazy'

export const BelkrajWidgetLazy = lazy(() => import('@/components/belkraj/BelkrajWidget'))

export { QuestFullMapLazy }
