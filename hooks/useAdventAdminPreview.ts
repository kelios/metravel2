import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/context/AuthContext'
import { toLocalIsoDate } from '@/constants/advent'
import type { AdventDoorView } from '@/hooks/useAdventCampaign'

export function useAdventAdminPreview(doors: AdventDoorView[], hydrated: boolean, now: Date) {
  const { authReady, isAuthenticated, isSuperuser, userId } = useAuth()
  const owner = hydrated && authReady && isAuthenticated && isSuperuser ? userId : null
  const [session, setSession] = useState<{ owner: string; day: number | null; done: boolean } | null>(null)
  const active = owner !== null && session?.owner === owner

  useEffect(() => {
    setSession((current) => current?.owner === owner ? current : null)
  }, [owner])

  const previewDoors = useMemo<AdventDoorView[]>(() => active
    ? doors.map((door) => ({ ...door, state: 'available', openedAt: undefined, doneAt: undefined }))
    : doors, [active, doors])

  const selected = active ? previewDoors.find((door) => door.day === session.day) : undefined
  const selectedDoor: AdventDoorView | null = selected ? {
    ...selected,
    state: session?.done ? 'done' : 'opened',
    doneAt: session?.done ? toLocalIsoDate(now) : undefined,
  } : null

  const selectDay = useCallback((day: number | null) => {
    const done = doors.find((door) => door.day === day)?.task.type === 'open'
    setSession((current) => current && current.owner === owner
      ? { ...current, day, done }
      : current)
  }, [doors, owner])

  const toggle = useCallback(() => {
    setSession((current) => owner && current?.owner !== owner ? { owner, day: null, done: false } : null)
  }, [owner])

  const completeTask = useCallback((day: number) => {
    setSession((current) => current && current.owner === owner && current.day === day
      ? { ...current, done: true }
      : current)
  }, [owner])

  return {
    allowed: !!owner,
    active,
    doors: previewDoors,
    selectedDoor,
    selectDay,
    toggle,
    completeTask,
  }
}
