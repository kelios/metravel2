import { buildClusterIconHtml, getClusterIconClass } from './mapMarkerStyles'

/**
 * #2451 — one Leaflet divIcon per visual cluster class (`size|label|theme`).
 *
 * The server-cluster layers used to cache icons only for seven exact counts and
 * build a fresh `L.divIcon` for every other count on every render; Leaflet's
 * `setIcon` then tore down and rebuilt the icon DOM of markers whose picture had
 * not changed at all. Icons are immutable option bags, so sharing one instance
 * between markers is safe and lets `marker.setIcon(sameIcon)` be skipped.
 *
 * The cache is scoped to the Leaflet namespace (tests and HMR may swap it).
 */
const iconCacheByLeaflet = new WeakMap<object, Map<string, unknown>>()

export const getServerClusterIconKey = (count: number, isDark: boolean): string => {
  const { label, metrics } = getClusterIconClass(count)
  return `${metrics.size}|${label}|${isDark ? 'dark' : 'light'}`
}

export const getServerClusterIcon = (L: any, count: number, isDark: boolean): any => {
  if (!L || typeof L.divIcon !== 'function') return undefined
  let cache = iconCacheByLeaflet.get(L)
  if (!cache) {
    cache = new Map()
    iconCacheByLeaflet.set(L, cache)
  }
  const key = getServerClusterIconKey(count, isDark)
  const cached = cache.get(key)
  if (cached) return cached

  // Default accent/text colours of buildClusterIconHtml are the brand primary
  // and its on-primary text — the same values the old per-render icons passed.
  const { metrics, html } = buildClusterIconHtml({ count, isDark })
  const icon = L.divIcon({
    className: 'metravel-cluster-icon',
    html,
    iconSize: [metrics.size, metrics.size],
    iconAnchor: [metrics.size / 2, metrics.size / 2],
  })
  cache.set(key, icon)
  return icon
}
