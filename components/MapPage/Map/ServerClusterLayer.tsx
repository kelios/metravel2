/**
 * ServerClusterLayer — backend clusters of the /map page as ONE imperative
 * `L.layerGroup` with a keyed diff (#2451).
 *
 * The declarative predecessor rendered a react-leaflet `<Marker>` + `<Popup>`
 * with an RN subtree per cluster, keyed by geometry: every zoom step changed all
 * keys, so React unmounted and re-created every cluster marker (measured on prod:
 * 132–435 DOM mutations per zoom step on a throttled phone), inline refs and
 * handlers re-ran on every render and a new `L.divIcon` per render made Leaflet
 * rebuild icon DOM that had not changed.
 *
 * Contract:
 * - input `clusters: ClusterData[]` from `useServerPlaceLayerData` (2+ points;
 *   single-point clusters are places and go to MarkerClusterGroup);
 * - identity is `cluster.key` (geometric: centre to 4 decimals + count). A key
 *   present in the previous and the next input keeps its Leaflet marker and DOM
 *   node; only keys that appeared/disappeared are added/removed. The same input
 *   set again is 0 add / 0 remove;
 * - the layer group lives as long as the map — it is never torn down on zoom;
 * - tap on a cluster → `onClusterTap()` (background-tap guard) and
 *   `onClusterZoom(payload)` with the CURRENT bounds of that key; no popup.
 */
import React, { useEffect, useRef, useState } from 'react'

import { useTheme } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { useLocaleRevision } from '@/i18n/useLocaleRevision'
import { formatMapPoints } from '@/utils/mapPointCount'

import { getServerClusterIcon, getServerClusterIconKey } from './serverClusterIcons'
import type { ClusterData, Point } from './types'

export type ServerClusterZoomPayload = {
  center: [number, number]
  bounds: [[number, number], [number, number]]
  key: string
  items: Point[]
}

type ServerClusterLayerProps = {
  L: any
  useMap: () => any
  clusters: ClusterData[]
  onClusterZoom?: (payload: ServerClusterZoomPayload) => void
  onClusterTap?: () => void
}

type Entry = { marker: any; cluster: ClusterData; iconKey: string }

type Handlers = Pick<ServerClusterLayerProps, 'onClusterZoom' | 'onClusterTap'>

export type ServerClusterSyncStats = { added: number; removed: number; updated: number }

const hasFiniteCenter = (cluster: ClusterData) =>
  Number.isFinite(cluster?.center?.[0]) && Number.isFinite(cluster?.center?.[1])

const hasFiniteBounds = (cluster: ClusterData) => {
  const b = cluster?.bounds
  return (
    Number.isFinite(b?.[0]?.[0]) &&
    Number.isFinite(b?.[0]?.[1]) &&
    Number.isFinite(b?.[1]?.[0]) &&
    Number.isFinite(b?.[1]?.[1])
  )
}

const getServerClusterAccessibleName = (count: number): string =>
  i18nT('map:components.MapPage.Map.ClusterLayer.klaster_value1_01722671', {
    value1: formatMapPoints(count),
  })

// Leaflet only derives an accessible name from `alt` for <img> icons; a divIcon
// needs `aria-label` on the real DOM node (#1624). The icon exists synchronously
// once the marker is added to a group that is on the map.
const applyAccessibleName = (marker: any, name: string) => {
  try {
    const el = marker?.getElement?.() ?? marker?._icon
    if (!el) return
    el.setAttribute('aria-label', name)
    el.setAttribute('title', name)
  } catch {
    // noop
  }
}

/**
 * Pure keyed diff of the layer — exported for unit tests. Mutates `entries`.
 */
export function syncServerClusterLayer({
  L,
  group,
  entries,
  clusters,
  isDark,
  handlersRef,
}: {
  L: any
  group: any
  entries: Map<string, Entry>
  clusters: ClusterData[]
  isDark: boolean
  handlersRef: { current: Handlers }
}): ServerClusterSyncStats {
  const stats: ServerClusterSyncStats = { added: 0, removed: 0, updated: 0 }
  const next = new Map<string, ClusterData>()
  for (const cluster of Array.isArray(clusters) ? clusters : []) {
    if (!cluster || !hasFiniteCenter(cluster) || next.has(cluster.key)) continue
    next.set(cluster.key, cluster)
  }

  for (const [key, entry] of entries) {
    if (next.has(key)) continue
    try {
      group.removeLayer(entry.marker)
      entry.marker.off?.()
    } catch {
      // noop
    }
    entries.delete(key)
    stats.removed += 1
  }

  for (const [key, cluster] of next) {
    const iconKey = getServerClusterIconKey(cluster.count, isDark)
    const existing = entries.get(key)
    if (existing) {
      // Same key = same cluster on screen. Keep the marker; refresh the data the
      // click handler reads, and touch Leaflet only where something really moved.
      const prev = existing.cluster
      existing.cluster = cluster
      let touched = false
      if (prev.center[0] !== cluster.center[0] || prev.center[1] !== cluster.center[1]) {
        existing.marker.setLatLng?.([cluster.center[0], cluster.center[1]])
        touched = true
      }
      if (existing.iconKey !== iconKey) {
        existing.iconKey = iconKey
        existing.marker.setIcon?.(getServerClusterIcon(L, cluster.count, isDark))
        // setIcon replaces the icon element — label the new one.
        applyAccessibleName(existing.marker, getServerClusterAccessibleName(cluster.count))
        touched = true
      }
      if (touched) stats.updated += 1
      continue
    }

    const name = getServerClusterAccessibleName(cluster.count)
    const marker = L.marker([cluster.center[0], cluster.center[1]], {
      icon: getServerClusterIcon(L, cluster.count, isDark),
      title: name,
      keyboard: true,
    })
    marker.on('click', (event: any) => {
      try {
        // Stop at the Leaflet layer level too so the synthesized touch `tap` does
        // not bubble a map `click` that dismisses the place card. Do NOT call
        // preventDefault — it breaks touch-to-click on mobile.
        L?.DomEvent?.stopPropagation?.(event)
        event?.originalEvent?.stopPropagation?.()
      } catch {
        // noop
      }
      const current = entries.get(key)?.cluster
      if (!current) return
      handlersRef.current.onClusterTap?.()
      if (!hasFiniteBounds(current)) return
      handlersRef.current.onClusterZoom?.({
        center: [current.center[0], current.center[1]],
        bounds: [
          [current.bounds[0][0], current.bounds[0][1]],
          [current.bounds[1][0], current.bounds[1][1]],
        ],
        key: current.key,
        items: current.items,
      })
    })
    entries.set(key, { marker, cluster, iconKey })
    try {
      group.addLayer(marker)
    } catch {
      // noop
    }
    applyAccessibleName(marker, name)
    stats.added += 1
  }

  return stats
}

const ServerClusterLayer: React.FC<ServerClusterLayerProps> = ({
  L,
  useMap,
  clusters,
  onClusterZoom,
  onClusterTap,
}) => {
  const map = useMap()
  const { isDark } = useTheme()
  const localeRevision = useLocaleRevision()
  const groupRef = useRef<any>(null)
  const entriesRef = useRef<Map<string, Entry>>(new Map())
  const [groupVersion, setGroupVersion] = useState(0)

  // Latest handlers through a ref: the markers are long-lived, the parent's
  // callbacks may change identity (padding, theme) without touching the markers.
  const handlersRef = useRef<Handlers>({ onClusterZoom, onClusterTap })
  useEffect(() => {
    handlersRef.current = { onClusterZoom, onClusterTap }
  })

  // One group per map instance — never re-created on zoom, data or theme.
  useEffect(() => {
    if (!L || !map || typeof L.layerGroup !== 'function') return
    const group = L.layerGroup()
    try {
      group.addTo(map)
    } catch {
      return
    }
    groupRef.current = group
    const entries = entriesRef.current
    setGroupVersion((v) => v + 1)
    return () => {
      try {
        for (const entry of entries.values()) entry.marker.off?.()
        group.clearLayers?.()
        group.remove?.()
      } catch {
        // noop
      }
      entries.clear()
      groupRef.current = null
    }
  }, [L, map])

  useEffect(() => {
    const group = groupRef.current
    if (!group || !L) return
    syncServerClusterLayer({
      L,
      group,
      entries: entriesRef.current,
      clusters,
      isDark,
      handlersRef,
    })
  }, [L, clusters, isDark, groupVersion])

  // Locale switch: relabel in place, never rebuild markers.
  useEffect(() => {
    for (const { marker, cluster } of entriesRef.current.values()) {
      applyAccessibleName(marker, getServerClusterAccessibleName(cluster.count))
    }
  }, [localeRevision])

  return null
}

export default React.memo(ServerClusterLayer)
