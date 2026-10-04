// #2133: скрыт ли объект у текущего владельца сессии и как его скрыть/вернуть.

import { useCallback } from 'react'

import { useQueryOwner } from '@/hooks/useQueryOwner'
import { useHiddenContentStore } from '@/stores/hiddenContentStore'
import { contentRefKey, type ContentRef } from '@/types/contentSafety'

const EMPTY: string[] = []

export function useHiddenContent(ref: ContentRef | null) {
  const owner = useQueryOwner()
  const key = ref ? contentRefKey(ref) : null
  const keys = useHiddenContentStore((state) => (owner ? state.byOwner[owner] ?? EMPTY : EMPTY))
  const hideInStore = useHiddenContentStore((state) => state.hide)
  const unhideInStore = useHiddenContentStore((state) => state.unhide)

  const hide = useCallback(() => {
    if (owner && key) hideInStore(owner, key)
  }, [hideInStore, key, owner])
  const unhide = useCallback(() => {
    if (owner && key) unhideInStore(owner, key)
  }, [key, owner, unhideInStore])

  return { hidden: key !== null && keys.includes(key), hide, unhide, canHide: owner !== null && key !== null }
}
