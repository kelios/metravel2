import { useRef } from 'react'
import { MAP_RADIUS_FIT_AIR } from '@/constants/mapDefaults'
import { useBottomSheetStore } from '@/stores/bottomSheetStore'

import type { MapMode } from './types'

export type FitPadding = { paddingTopLeft: [number, number]; paddingBottomRight: [number, number] }

/**
 * Bottom-sheet reserve of a map surface, read imperatively (#2451 — no
 * subscription). The sheet is /map's (`MapMobileLayout`); its store is global and
 * outlives the screen, because tab screens stay mounted. A map on any other
 * surface has no sheet above it: after a visit to /map the quest map inherited a
 * 607 px reserve — taller than its own pane — and its fit landed on maxZoom (#3397).
 */
export const readMapSheetReserve = (ownsSheet: boolean): number =>
  ownsSheet ? useBottomSheetStore.getState().getControlsBottomOffset() : 0

/**
 * Padding of the /map radius auto-fit and of the server-cluster zoom.
 * Desktop: the panel is a flex sibling of the map pane, so only symmetric air.
 * Mobile: the bottom sheet overlays the map — its current height
 * (`sheetBottomOffset`, read imperatively by the caller, #2451) is reserved at
 * the bottom so the circle/cluster is not hidden behind it.
 */
export const getMapFitBoundsPadding = (
  mode: MapMode,
  sheetOverlaysMap: boolean,
  sheetBottomOffset: number,
): FitPadding => {
  if (mode !== 'radius') return { paddingTopLeft: [24, 140], paddingBottomRight: [360, 220] }
  const AIR = MAP_RADIUS_FIT_AIR
  if (sheetOverlaysMap) {
    // The lower arc of the circle clears the sheet; top leaves room for the
    // floating controls row.
    return {
      paddingTopLeft: [AIR, 72],
      paddingBottomRight: [AIR, Math.max(sheetBottomOffset, 96) + AIR],
    }
  }
  return { paddingTopLeft: [AIR, AIR + 56], paddingBottomRight: [AIR, AIR + 24] }
}

/**
 * Keeps the previous padding object while its numbers are unchanged, so
 * consumers that list it as an effect dependency (MapLogicComponent) do not
 * re-run on unrelated renders.
 */
export function useStablePadding(next: FitPadding): FitPadding {
  const ref = useRef(next)
  const prev = ref.current
  const same =
    prev.paddingTopLeft[0] === next.paddingTopLeft[0] &&
    prev.paddingTopLeft[1] === next.paddingTopLeft[1] &&
    prev.paddingBottomRight[0] === next.paddingBottomRight[0] &&
    prev.paddingBottomRight[1] === next.paddingBottomRight[1]
  if (!same) ref.current = next
  return same ? prev : next
}
