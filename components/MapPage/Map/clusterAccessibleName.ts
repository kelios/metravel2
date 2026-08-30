// components/MapPage/Map/clusterAccessibleName.ts
//
// Split out of MarkerClusterGroup.tsx (#1624 follow-up): the parent file sat
// right under `scripts/guard-file-complexity-changed.js`'s 800-LOC push-gate
// threshold, and this hook's own logic + explanatory comment pushed it over.
// Kept as a dedicated module rather than trimmed comments so the "why" isn't
// lost — same accessible-name contract is described where it is used from
// `ClusterLayer.tsx` (its own `applyAccessibleName` helper).
import { useCallback } from 'react'
import { translate as i18nT } from '@/i18n'
import { formatPlaces } from '@/utils/pluralize'

/**
 * Cluster bubbles built by `MarkerClusterGroup` are entirely leaflet.markercluster's
 * own doing: its `clusterIconFactory` only supplies the divIcon's `html`/size for
 * `iconCreateFunction`, and the plugin constructs the actual `L.MarkerCluster`
 * (a `<div role="button" tabindex="0">`) itself — there is no React ref to
 * attach an accessible name to, unlike `ClusterLayer`'s declarative `<Marker>`.
 * A divIcon never gets a name for free either: Leaflet only copies `alt` onto
 * `<img>` icons (`leaflet/src/layer/marker/Marker.js` `_initIcon`), so without
 * this, every cluster's accessible name falls back to nothing (verified live:
 * `.metravel-cluster-icon[role="button"]` had no `title`/`aria-label`, only the
 * bare visible digit in its DOM subtree — #1624).
 *
 * Returns a stable `(layer) => void` that the caller wires into both a
 * `map.on('layeradd', ...)` listener (every zoom/pan re-cluster) and a
 * post-sync `map.eachLayer(...)` sweep (the very first cluster batch, which
 * can land on the map before the `layeradd` listener attaches).
 */
export function useApplyClusterAccessibleName(L: any): (layer: any) => void {
  return useCallback(
    (layer: any) => {
      // `L.MarkerCluster` only exists once leaflet.markercluster has augmented
      // the shared `L` namespace (guarded the same way the group-creation
      // effect in MarkerClusterGroup checks `L.markerClusterGroup`) —
      // `instanceof` against a missing constructor throws instead of
      // returning `false`.
      if (!L || !layer || typeof L.MarkerCluster !== 'function') return
      if (!(layer instanceof L.MarkerCluster)) return
      try {
        const el = layer._icon || layer.getElement?.()
        if (!el) return
        const count =
          typeof layer.getChildCount === 'function' ? layer.getChildCount() : 0
        const label = i18nT(
          'map:components.MapPage.Map.ClusterLayer.klaster_value1_01722671',
          { value1: formatPlaces(count) },
        )
        el.setAttribute('aria-label', label)
      } catch {
        // noop
      }
    },
    [L],
  )
}
