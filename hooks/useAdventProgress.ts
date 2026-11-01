import { useCallback, useEffect, useMemo } from 'react'

import { useAuth } from '@/context/AuthContext'
import {
  ADVENT_GUEST_OWNER,
  buildAdventOwnerKey,
  selectAdventOwnerProgress,
  useAdventProgressStore,
} from '@/stores/adventProgressStore'
import { isAdventProgressEmpty } from '@/utils/advent/adventProgressMerge'
import { toLocalIsoDate } from '@/constants/advent'
import type { AdventProgressMaps } from '@/utils/advent/adventCalendar'

export type AdventProgressApi = {
  /** `null`, пока auth не готов: экран ждёт и ничего не пишет. */
  ownerKey: string | null
  ready: boolean
  isAuthenticated: boolean
  progress: AdventProgressMaps
  openDoor: (day: number, now?: Date) => void
  completeTask: (day: number, now?: Date) => void
}

/**
 * Локальный user-scoped прогресс календаря (#2861). После входа гостевой
 * прогресс этого устройства переносится в аккаунт (#2867); серверную
 * синхронизацию ведёт экран через `useAdventServerSync`.
 */
export function useAdventProgress(): AdventProgressApi {
  const { isAuthenticated, userId, authReady } = useAuth()
  const ownerKey = useMemo(
    () => buildAdventOwnerKey({ isAuthenticated, userId, authReady }),
    [isAuthenticated, userId, authReady],
  )
  const progress = useAdventProgressStore(useMemo(() => selectAdventOwnerProgress(ownerKey), [ownerKey]))
  const openDoorInStore = useAdventProgressStore((state) => state.openDoor)
  const completeTaskInStore = useAdventProgressStore((state) => state.completeTask)
  const adoptGuest = useAdventProgressStore((state) => state.adoptGuest)
  // Флаг, а не сами данные: эффект перезапускается и после регидрации persist,
  // когда гостевая запись появляется в сторе позже первого рендера.
  const guestHasProgress = useAdventProgressStore((state) => {
    const guest = state.byOwner[ADVENT_GUEST_OWNER]
    return !!guest && !isAdventProgressEmpty(guest)
  })

  useEffect(() => {
    if (!ownerKey || ownerKey === ADVENT_GUEST_OWNER || !guestHasProgress) return
    adoptGuest(ownerKey)
  }, [ownerKey, guestHasProgress, adoptGuest])

  const openDoor = useCallback(
    (day: number, now: Date = new Date()) => {
      if (!ownerKey) return
      openDoorInStore(ownerKey, day, toLocalIsoDate(now))
    },
    [ownerKey, openDoorInStore],
  )
  const completeTask = useCallback(
    (day: number, now: Date = new Date()) => {
      if (!ownerKey) return
      completeTaskInStore(ownerKey, day, toLocalIsoDate(now))
    },
    [ownerKey, completeTaskInStore],
  )

  return { ownerKey, ready: ownerKey !== null, isAuthenticated, progress, openDoor, completeTask }
}
