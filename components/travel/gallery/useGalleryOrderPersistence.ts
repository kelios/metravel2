import { useCallback, useContext, useEffect, useRef } from 'react'
import { QueryClientContext } from '@tanstack/react-query'

import { reorderGallery } from '@/api/misc'
import { queryKeys } from '@/api/queryKeys'
import { translate as i18nT } from '@/i18n'
import { devError } from '@/utils/logger'
import { showToast } from '@/utils/toast'

export const GALLERY_REORDER_DEBOUNCE_MS = 700

/**
 * `current` in the order of `order`; items `order` does not know (uploaded or
 * re-added since) keep their relative place at the end. Deleted items stay deleted.
 */
export function restoreGalleryOrder<T>(current: T[], order: T[], keyOf: (item: T) => string): T[] {
  const rank = new Map(order.map((item, index) => [keyOf(item), index]))
  const known = current.filter((item) => rank.has(keyOf(item)))
    .sort((a, b) => (rank.get(keyOf(a)) ?? 0) - (rank.get(keyOf(b)) ?? 0))
  return [...known, ...current.filter((item) => !rank.has(keyOf(item)))]
}

interface GalleryOrderPersistenceOptions<T> {
  collection: string
  travelId: string | number | null | undefined
  /** Current items in display order, read at send time. */
  getItems: () => T[]
  /** Server id of an item, or null for items the server does not know yet. */
  getBackendId: (item: T) => string | null
  /** Restores the order the server still has after a failed save. */
  onRollback: (items: T[]) => void
}

/**
 * Saves the gallery order with `reorderGallery` — the only place it is saved:
 * the travel upsert does not read the gallery order (#3215). Web and native
 * galleries share it: debounce, abort of the previous request, flush on unmount,
 * and on failure the author gets the server order back with a message instead of
 * a silently unsaved order.
 */
export function useGalleryOrderPersistence<T>({
  collection,
  travelId,
  getItems,
  getBackendId,
  onRollback,
}: GalleryOrderPersistenceOptions<T>) {
  const queryClient = useContext(QueryClientContext)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Order before the first move that the server has not confirmed yet.
  const baselineRef = useRef<T[] | null>(null)
  const latestRef = useRef({ getItems, getBackendId, onRollback })
  useEffect(() => {
    latestRef.current = { getItems, getBackendId, onRollback }
  }, [getItems, getBackendId, onRollback])

  const persist = useCallback(() => {
    const numericTravelId = Number(travelId)
    const { getItems: readItems, getBackendId: readId } = latestRef.current
    const sentItems = readItems()
    const orderedIds = sentItems
      .map(readId)
      .filter((id): id is string => Boolean(id))
    if (collection !== 'gallery' || !Number.isInteger(numericTravelId) || numericTravelId <= 0 || orderedIds.length < 2) {
      baselineRef.current = null
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    void reorderGallery(numericTravelId, orderedIds, controller.signal)
      .then(() => {
        // A move made while this request was in flight is measured against the
        // order the server has just confirmed.
        if (abortRef.current === controller) baselineRef.current = timerRef.current ? sentItems : null
        void queryClient?.invalidateQueries?.({ queryKey: queryKeys.travel(numericTravelId) })
      })
      .catch((error) => {
        if (controller.signal.aborted || abortRef.current !== controller) return
        devError('Gallery reorder request failed:', error)
        // A newer move is already scheduled: it carries the whole order and the
        // baseline stays unconfirmed, so rolling back now would erase that move.
        if (timerRef.current) return
        const baseline = baselineRef.current
        baselineRef.current = null
        if (baseline) latestRef.current.onRollback(baseline)
        void showToast({
          type: 'error',
          text1: i18nT('travel:components.travel.ImageGalleryComponent.errorTitle'),
          text2: i18nT('travel:components.travel.ImageGalleryComponent.reorderFailed'),
          position: 'bottom',
        })
      })
  }, [collection, queryClient, travelId])

  /** Call after a move with the order shown before that move. */
  const scheduleOrderSave = useCallback((previousItems: T[]) => {
    if (!baselineRef.current) baselineRef.current = previousItems
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      persist()
    }, GALLERY_REORDER_DEBOUNCE_MS)
  }, [persist])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        persist()
      }
    }
  }, [persist])

  return { scheduleOrderSave }
}
