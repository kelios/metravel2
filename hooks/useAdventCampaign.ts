import { useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import { getAdventNow } from '@/constants/advent'
import { useLocalCalendarDate } from '@/hooks/useLocalCalendarDate'
import { getAdventCampaign } from '@/services/advent/loadCampaign'
import {
  EMPTY_ADVENT_PROGRESS,
  computeStreak,
  countDoneMain,
  countOpenedMain,
  doorKey,
  findNextLockedDoor,
  findTodayDoor,
  getDoorState,
  isCampaignDay,
  millisecondsUntilDoor,
  todayIsoOf,
} from '@/utils/advent/adventCalendar'
import type { AdventCampaignConfig, AdventDoor, AdventDoorState } from '@/types/advent'
import { useAdventProgress, type AdventProgressApi } from '@/hooks/useAdventProgress'

export type AdventDoorView = AdventDoor & {
  state: AdventDoorState
  openedAt?: string
  doneAt?: string
}

export type AdventCampaignView = AdventProgressApi & {
  campaign: AdventCampaignConfig
  /**
   * Web: статический HTML и первый клиентский рендер не зависят от даты
   * (все дверцы закрыты, окно кампании «нет»); реальная дата включается после
   * монтирования — иначе HTML, собранный в другой день/час, расходится с
   * клиентом и React сбрасывает дерево (#1340/#2112). Native — сразу `true`.
   */
  hydrated: boolean
  /** Местная календарная дата клиента `YYYY-MM-DD`; обновляется по местной полуночи. */
  today: string
  now: Date
  /** Сегодня внутри окна кампании (баннер, меню, карточка профиля). */
  isInWindow: boolean
  doors: AdventDoorView[]
  todayDoor: AdventDoorView | null
  nextDoor: AdventDoorView | null
  /** До местной полуночи дня ближайшей закрытой дверцы; `null`, когда всё открыто. */
  msUntilNextDoor: number | null
  openedCount: number
  doneCount: number
  streak: number
}

/** Состояния 27 дверец из конфига, местной даты и локального прогресса (#2861). */
const BEFORE_CAMPAIGN = '0000-00-00'

export function useAdventCampaign(): AdventCampaignView {
  const now = useLocalCalendarDate({ readNow: getAdventNow })
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web')
  useEffect(() => {
    setHydrated(true)
  }, [])
  const today = hydrated ? todayIsoOf(now) : BEFORE_CAMPAIGN
  const campaign = useMemo(() => getAdventCampaign(), [])
  const progressApi = useAdventProgress()
  const progress = hydrated ? progressApi.progress : EMPTY_ADVENT_PROGRESS

  const doors = useMemo<AdventDoorView[]>(
    () =>
      campaign.doors.map((door) => ({
        ...door,
        state: getDoorState(door, today, progress),
        openedAt: progress.opened[doorKey(door.day)],
        doneAt: progress.tasksDone[doorKey(door.day)],
      })),
    [campaign, today, progress],
  )

  const todayDoor = useMemo(() => {
    const door = findTodayDoor(doors, today)
    return door ? (doors.find((item) => item.day === door.day) ?? null) : null
  }, [doors, today])
  const nextDoor = useMemo(() => {
    const door = findNextLockedDoor(doors, today)
    return door ? (doors.find((item) => item.day === door.day) ?? null) : null
  }, [doors, today])

  return {
    ...progressApi,
    progress,
    hydrated,
    campaign,
    today,
    now,
    isInWindow: isCampaignDay(campaign, today),
    doors,
    todayDoor,
    nextDoor,
    msUntilNextDoor: nextDoor ? millisecondsUntilDoor(nextDoor, now) : null,
    openedCount: countOpenedMain(doors, progress),
    doneCount: countDoneMain(doors, progress),
    streak: computeStreak(doors, today, progress),
  }
}
