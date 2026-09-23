/**
 * Кластеризация маркеров leaflet.markercluster — один механизм на все web-карты
 * (#2059): настройки группы и поведение клика по кластеру раньше жили внутри
 * `MarkerClusterGroup.tsx` (/map), теперь их берут и /map, и карта
 * конструктора поездки (`components/trips/planning/TripPlanRouteMarkers.tsx`).
 * Иконку кластера каждая карта строит сама через общий `buildClusterIconHtml`,
 * потому что цвета у них из разных источников.
 */
import { CLUSTER_DISABLE_ZOOM, getClusterZoomFitBoundsOptions } from './clusterFitBounds'

// Leaflet's getBoundsZoom subtracts padding from the container size. If a padding
// component is >= the container dimension the usable size becomes <=0 and Leaflet
// falls back to min zoom (zooming the whole map OUT). Clamp each padding axis to a
// fraction of the container so a positive usable viewport always remains.
const MAX_PADDING_FRACTION = 0.4

const clampPaddingPair = (
  pair: [number, number] | undefined,
  width?: number,
  height?: number,
): [number, number] | undefined => {
  if (!Array.isArray(pair)) return pair
  const maxX = Number.isFinite(width) ? Math.max(0, Number(width) * MAX_PADDING_FRACTION) : pair[0]
  const maxY = Number.isFinite(height) ? Math.max(0, Number(height) * MAX_PADDING_FRACTION) : pair[1]
  return [Math.min(pair[0], maxX), Math.min(pair[1], maxY)]
}

const clampFitBoundsPadding = (
  options: Record<string, unknown>,
  width?: number,
  height?: number,
): void => {
  if (Array.isArray(options.paddingTopLeft)) {
    options.paddingTopLeft = clampPaddingPair(
      options.paddingTopLeft as [number, number],
      width,
      height,
    )
  }
  if (Array.isArray(options.paddingBottomRight)) {
    options.paddingBottomRight = clampPaddingPair(
      options.paddingBottomRight as [number, number],
      width,
      height,
    )
  }
}

/**
 * Handle a cluster click (zoom-to-bounds is disabled on the group, so we drive it).
 * Exported for unit testing because headless previews can't reliably exercise the
 * animated fitBounds path.
 *
 * Invariant: a cluster click must always zoom IN (or spiderfy) — it must never zoom
 * the map out, which would push all markers off-screen and look like "markers vanished".
 */
export const runClusterClick = (map: any, clusterLayer: any): void => {
  if (!map || !clusterLayer || typeof clusterLayer.getBounds !== 'function') return

  try {
    const bounds = clusterLayer.getBounds()
    const container = typeof map.getContainer === 'function' ? map.getContainer() : null
    const containerWidth =
      container?.clientWidth ??
      (typeof window !== 'undefined' ? window.innerWidth : undefined)
    const containerHeight =
      container?.clientHeight ??
      (typeof window !== 'undefined' ? window.innerHeight : undefined)
    const fitBoundsOptions = getClusterZoomFitBoundsOptions({
      width: containerWidth,
      height: containerHeight,
    })

    // Padding that meets/exceeds the container size makes Leaflet's getBoundsZoom
    // collapse the usable viewport to <=0, which it answers by zooming all the way
    // OUT (min zoom / whole world). On a small mobile viewport the bottom-sheet
    // padding alone can do this — the cluster's markers then sit off-screen and the
    // map looks empty. Clamp every padding component so usable size stays positive.
    clampFitBoundsPadding(fitBoundsOptions, containerWidth, containerHeight)

    const ne = bounds?.getNorthEast?.()
    const sw = bounds?.getSouthWest?.()
    const isDegenerate = !bounds?.isValid?.() || (ne && sw && ne.equals?.(sw))

    // Если все точки кластера в одной координате — fitBounds не разведёт их,
    // нужен явный spiderfy (плагин не зовёт его сам, т.к. zoomToBoundsOnClick=false).
    if (isDegenerate) {
      if (typeof clusterLayer.spiderfy === 'function') clusterLayer.spiderfy()
      return
    }

    const maxZoom =
      typeof fitBoundsOptions.maxZoom === 'number'
        ? fitBoundsOptions.maxZoom
        : (map.getMaxZoom?.() ?? CLUSTER_DISABLE_ZOOM)
    const rawTargetZoom =
      typeof map.getBoundsZoom === 'function' ? map.getBoundsZoom(bounds, false) : null
    const targetZoom =
      rawTargetZoom != null && Number.isFinite(rawTargetZoom) ? rawTargetZoom : null
    const currentZoom = map.getZoom?.() ?? 0

    // Если зумить уже некуда (упёрлись в maxZoom, а точки всё ещё в одном
    // кластере) — делаем spiderfy, иначе маркеры визуально не появятся.
    if (
      targetZoom != null &&
      targetZoom >= maxZoom &&
      currentZoom >= maxZoom &&
      typeof clusterLayer.spiderfy === 'function'
    ) {
      clusterLayer.spiderfy()
      return
    }

    // Кластер-клик ВСЕГДА должен приближать (или спайдерфаить). Если getBoundsZoom
    // вернул не-finite или зум <= текущего (вырожденная рамка + большой padding),
    // fitBounds увёл бы карту наружу и «спрятал» все маркеры. В этом случае —
    // принудительно центрируем кластер на текущий+1 зум, не отдаляя.
    if (targetZoom == null || targetZoom <= currentZoom) {
      const safeZoom = Math.min(maxZoom, currentZoom + 1)
      if (safeZoom > currentZoom && typeof map.setView === 'function') {
        const center = typeof bounds.getCenter === 'function' ? bounds.getCenter() : null
        if (center) {
          map.setView(center, safeZoom, { animate: true })
          return
        }
      }
      if (typeof clusterLayer.spiderfy === 'function') clusterLayer.spiderfy()
      return
    }

    map.fitBounds(bounds, fitBoundsOptions)
  } catch {
    // noop
  }
}

/** Настройки группы кластеров — общие для /map и карты конструктора поездки. */
export const MAP_CLUSTER_GROUP_OPTIONS = Object.freeze({
  chunkedLoading: true,
  // 80 = дефолт Leaflet.markercluster. Прежние 60 давали больше мелких
  // кластеров, чьи крупные бабблы (размер растёт со счётчиком) визуально
  // наезжали друг на друга при плотной кластеризации (радиус 100 км) —
  // соседние числа сливались. 80 объединяет близкие маркеры в один кластер,
  // убирая overlap, без переухода в один гигантский кластер.
  maxClusterRadius: 80,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  // Handle cluster click explicitly so viewport math stays stable on web.
  zoomToBoundsOnClick: false,
  disableClusteringAtZoom: CLUSTER_DISABLE_ZOOM,
  animate: true,
  animateAddingMarkers: false,
  // Spiderfy config for touch devices
  spiderfyDistanceMultiplier: 1.5,
})

/**
 * Создаёт группу `L.markerClusterGroup` с общими настройками и кликом по
 * кластеру, который всегда приближает (`runClusterClick`). На карту группу
 * добавляет вызывающий; `dispose` снимает обработчик клика.
 */
export function createMapClusterGroup(
  L: any,
  map: any,
  {
    iconCreateFunction,
    onClusterTap,
    overrides,
  }: {
    iconCreateFunction?: (cluster: any) => any
    onClusterTap?: () => void
    /** Карта со своим масштабом правит только числа (порог зума), не поведение. */
    overrides?: { disableClusteringAtZoom?: number }
  },
): { group: any; dispose: () => void } {
  const group = L.markerClusterGroup({ ...MAP_CLUSTER_GROUP_OPTIONS, ...overrides, iconCreateFunction })

  const handleClusterClick = (event: any) => {
    try {
      event?.originalEvent?.preventDefault?.()
      // Stop at the Leaflet layer level too so the synthesized touch `tap`
      // does not bubble a map `click` that dismisses the place card.
      L?.DomEvent?.stopPropagation?.(event)
      event?.originalEvent?.stopPropagation?.()
    } catch {
      // noop
    }
    onClusterTap?.()
    runClusterClick(map, event?.layer)
  }

  group.on('clusterclick', handleClusterClick)
  return {
    group,
    dispose: () => {
      group.off('clusterclick', handleClusterClick)
    },
  }
}
