/**
 * #2059 — маркер точки маршрута планировщика: номер как в списке, активная
 * капля крупнее, одна разметка на web и native, отступы кадра под каплю и
 * кнопки карты.
 */
import { NATIVE_ROUTE_POINT_MARKERS_SCRIPT } from '@/components/MapPage/Map/nativeRoutePointMarkersScript'
import { MAP_CLUSTER_GROUP_OPTIONS } from '@/components/MapPage/Map/mapClusterGroup'
import { ROUTE_DAY_COLLAPSE_THRESHOLD } from '@/components/trips/planning/routeDayCollapse'
import { FOCUS_POINT_ZOOM } from '@/components/trips/planning/tripPlanRouteMap.types'
import {
  ROUTE_MAP_FIT_PADDING,
  ROUTE_MARKER_ACTIVE_SIZE,
  ROUTE_MARKER_SIZE,
  fillRouteMarkerTemplate,
  nativeRoutePointMarkers,
  routeMapFitBoundsOptions,
  routeMarkerIconTemplate,
  routeMarkerLabel,
} from '@/components/trips/planning/tripPlanMapMarkers'
import { formatRoutePointCount } from '@/components/trips/planning/TripPlanRouteMarkers'

const colors = {
  primary: '#7a9d8f',
  primaryDark: '#5a7d6f',
  warning: '#a08850',
  textOnPrimary: '#111827',
}

describe('#2059 маркер точки маршрута планировщика', () => {
  it('номер маркера = номер строки списка (`index + 1`)', () => {
    expect(routeMarkerLabel(0)).toBe('1')
    expect(routeMarkerLabel(36)).toBe('37')
    expect(routeMarkerLabel(60)).toBe('61')
  })

  it('активная капля крупнее обычной, остриё — в середине нижнего края', () => {
    const normal = routeMarkerIconTemplate(colors, false)
    const active = routeMarkerIconTemplate(colors, true)

    expect(ROUTE_MARKER_ACTIVE_SIZE).toBeGreaterThan(ROUTE_MARKER_SIZE)
    expect(normal.size).toEqual([ROUTE_MARKER_SIZE, ROUTE_MARKER_SIZE])
    expect(active.size).toEqual([ROUTE_MARKER_ACTIVE_SIZE, ROUTE_MARKER_ACTIVE_SIZE])
    expect(normal.anchor).toEqual([ROUTE_MARKER_SIZE / 2, ROUTE_MARKER_SIZE])
    expect(active.className).toContain('metravel-trip-plan-marker-active')
    expect(normal.className).toBe('metravel-trip-plan-marker')
  })

  it('подставляет номер и уменьшает цифру для трёхзначных номеров', () => {
    const { html } = routeMarkerIconTemplate(colors, false)

    const seven = fillRouteMarkerTemplate(html, '7')
    expect(seven).toContain('>7</text>')
    expect(seven).toContain('font-size="8"')
    expect(seven).not.toContain('{{')

    const hundred = fillRouteMarkerTemplate(html, '100')
    expect(hundred).toContain('>100</text>')
    expect(hundred).toContain('font-size="6.4"')
  })

  it('native WebView собирает ту же разметку, что web, из шаблона payload', () => {
    const payload = nativeRoutePointMarkers(['1', '12', '100'], colors)
    const L = { divIcon: (options: { html: string }) => options }
    const escapeHtml = (value: unknown) => String(value)
    const routePointIcon = new Function(
      'L',
      'escapeHtml',
      'ROUTE_SURFACE',
      'ROUTE_START',
      'ROUTE_COLOR',
      'map',
      `${NATIVE_ROUTE_POINT_MARKERS_SCRIPT}\nreturn routePointIcon;`,
    )(L, escapeHtml, '#fff', '#0f0', '#00f', {}) as (
      spec: unknown,
      index: number,
      isStart: boolean,
      isEnd: boolean,
    ) => { html: string; iconSize: unknown; iconAnchor: unknown; className: string }

    const web = routeMarkerIconTemplate(colors, false)
    payload.labels.forEach((label, index) => {
      const icon = routePointIcon(payload, index, index === 0, false)
      expect(icon.html).toBe(fillRouteMarkerTemplate(web.html, label))
      expect(icon.iconSize).toEqual(web.size)
      expect(icon.iconAnchor).toEqual(web.anchor)
      expect(icon.className).toBe('metravel-trip-plan-marker')
    })
    // Без номеров (маршрут /map) — прежний кружок точки маршрута.
    expect(routePointIcon(null, 0, true, false).className).toBe('metravel-route-point')
    expect(payload.fitPadding).toEqual(ROUTE_MAP_FIT_PADDING)
  })

  // #2071: активная точка на native берёт крупный activeIcon, а не обычный —
  // тем же routePointIcon(spec, index, isStart, isEnd, isActive), что и выше.
  it('#2071 активная точка на native берёт крупный activeIcon, вне кластера', () => {
    const payload = nativeRoutePointMarkers(['1', '2'], colors, { activeIndex: 1 })
    const L = { divIcon: (options: { html: string }) => options }
    const escapeHtml = (value: unknown) => String(value)
    const routePointIcon = new Function(
      'L',
      'escapeHtml',
      'ROUTE_SURFACE',
      'ROUTE_START',
      'ROUTE_COLOR',
      'map',
      `${NATIVE_ROUTE_POINT_MARKERS_SCRIPT}\nreturn routePointIcon;`,
    )(L, escapeHtml, '#fff', '#0f0', '#00f', {}) as (
      spec: unknown,
      index: number,
      isStart: boolean,
      isEnd: boolean,
      isActive: boolean,
    ) => { className: string; iconSize: unknown }

    const activeWeb = routeMarkerIconTemplate(colors, true)
    const normal = routePointIcon(payload, 0, true, false, false)
    const active = routePointIcon(payload, 1, false, true, true)

    expect(normal.className).toBe('metravel-trip-plan-marker')
    expect(active.className).toBe('metravel-trip-plan-marker metravel-trip-plan-marker-active')
    expect(active.iconSize).toEqual(activeWeb.size)
    expect(payload.activeIndex).toBe(1)
  })

  it('#2071 кластеризация — включается только у крупного маршрута, теми же числами, что на web', () => {
    const short = nativeRoutePointMarkers(
      Array.from({ length: ROUTE_DAY_COLLAPSE_THRESHOLD }, (_v, i) => String(i + 1)),
      colors,
    )
    expect(short.cluster).toBeNull()

    const long = nativeRoutePointMarkers(
      Array.from({ length: ROUTE_DAY_COLLAPSE_THRESHOLD + 1 }, (_v, i) => String(i + 1)),
      colors,
    )
    // Числа не задублированы: тот же MAP_CLUSTER_GROUP_OPTIONS/FOCUS_POINT_ZOOM,
    // что у web-кластера конструктора маршрута (mapClusterGroup.ts + #2059).
    expect(long.cluster).toEqual({
      maxClusterRadius: MAP_CLUSTER_GROUP_OPTIONS.maxClusterRadius,
      disableClusteringAtZoom: FOCUS_POINT_ZOOM,
    })
    expect(long.activeIndex).toBeNull()
  })

  it('отступы кадра учитывают кнопки карты и высоту капли и не съедают низкую карту', () => {
    expect(routeMapFitBoundsOptions(null, 13)).toEqual({
      paddingTopLeft: [28, 116],
      paddingBottomRight: [28, 28],
      maxZoom: 13,
    })
    // Верх = зум Leaflet (74) + капля (36) + зазор: точка не встаёт под контролы.
    expect(ROUTE_MAP_FIT_PADDING.topLeft[1]).toBeGreaterThanOrEqual(74 + ROUTE_MARKER_SIZE)
    expect(routeMapFitBoundsOptions({ x: 390, y: 354 }, 14).paddingTopLeft).toEqual([28, 116])
    expect(routeMapFitBoundsOptions({ x: 390, y: 200 }, 14).paddingTopLeft).toEqual([28, 80])
    expect(routeMapFitBoundsOptions({ x: 0, y: 0 }, 14).paddingTopLeft).toEqual([28, 116])
  })

  it('счётчик и подпись кластера — «N точек» по правилам множественного числа', () => {
    expect(formatRoutePointCount(1)).toBe('1 точка')
    expect(formatRoutePointCount(22)).toBe('22 точки')
    expect(formatRoutePointCount(25)).toBe('25 точек')
    expect(formatRoutePointCount(61)).toBe('61 точка')
  })
})
