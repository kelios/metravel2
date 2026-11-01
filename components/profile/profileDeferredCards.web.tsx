import { lazy } from 'react'

/**
 * Web: карточка адвента тянет конфиг кампании и календарь (#2866). Вне окна
 * 01.12–07.01 она не рендерится, поэтому её чанк не должен ехать с каждым
 * открытием /profile — lazy за Suspense, как промо-секция главной.
 */
export const AdventProgressCard = lazy(() => import('./AdventProgressCard'))
