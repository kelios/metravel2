import React, { useEffect } from 'react'
import { Platform } from 'react-native'

import { useLeafletLoader } from '@/hooks/useLeafletLoader'
import {
  getOsmTileUrl,
  getOsmTileCrossOrigin,
  OSM_PROXY_ATTRIBUTION,
  OSM_PROXY_MAX_ZOOM,
} from '@/config/mapWebLayers'

type LeafletNS = typeof import('leaflet')
type ReactLeafletNS = typeof import('react-leaflet')
type LeafletMap = ReturnType<ReactLeafletNS['useMap']>

/**
 * Загруженный движок Leaflet/react-leaflet, который `MapCanvas` отдаёт детям.
 * `L` — сам Leaflet (иконки/границы), `RL` — namespace react-leaflet
 * (Marker/Popup/Polyline/useMap/useMapEvents/…).
 */
export interface MapCanvasEngine {
  L: LeafletNS
  RL: ReactLeafletNS
}

export interface MapCanvasProps {
  // ── Вид карты ────────────────────────────────────────────────────────────
  center?: [number, number]
  zoom?: number
  /** Стартовые границы (альтернатива center/zoom); имеет приоритет у Leaflet. */
  bounds?: Array<[number, number]>
  maxZoom?: number

  // ── Идентичность/размер контейнера ───────────────────────────────────────
  /** key для remount MapContainer (leaflet «container already initialized»). */
  containerKey?: string
  id?: string
  mapStyle?: React.CSSProperties

  // ── Проброс опций Leaflet MapContainer (без бизнес-логики) ────────────────
  // Не заданные (undefined) не меняют дефолт Leaflet.
  zoomControl?: boolean
  dragging?: boolean
  scrollWheelZoom?: boolean
  touchZoom?: boolean
  doubleClickZoom?: boolean
  keyboard?: boolean
  tap?: boolean
  preferCanvas?: boolean

  // ── Поведение движка ─────────────────────────────────────────────────────
  /**
   * Встроенная карта: колесо зумит только с зажатым Ctrl/Cmd, обычный скролл
   * уходит странице (перенесено из TravelMap.web `CtrlWheelZoom`).
   */
  ctrlWheelZoom?: boolean
  /** Смена значения запускает `invalidateSize` (раскрытие секции/ресайз). */
  resizeTrigger?: number | string

  // ── Движок ───────────────────────────────────────────────────────────────
  /**
   * Уже загруженный движок. Если задан — MapCanvas НЕ грузит Leaflet сам
   * (экран держит собственный loader/loading-UX). Если нет — грузит через
   * `useLeafletLoader`.
   */
  engine?: MapCanvasEngine | null

  // ── Жизненный цикл ───────────────────────────────────────────────────────
  onMapRef?: (map: LeafletMap) => void
  whenReady?: () => void

  // ── Fallback пока движок не готов ────────────────────────────────────────
  fallback?: React.ReactNode

  /** Дети рендерятся ВНУТРИ MapContainer и получают доступ к движку. */
  children?: (engine: MapCanvasEngine) => React.ReactNode
}

/**
 * Внутренний lifecycle-компонент: живёт внутри MapContainer, поэтому имеет
 * доступ к leaflet-инстансу через useMap. Отвечает за общий для всех карт
 * контракт: onMapRef, invalidateSize (mount + resizeTrigger), ctrl-wheel-zoom.
 */
const MapCanvasLifecycle: React.FC<{
  useMap: ReactLeafletNS['useMap']
  onMapRef?: (map: LeafletMap) => void
  resizeTrigger?: number | string
  ctrlWheelZoom?: boolean
}> = ({ useMap, onMapRef, resizeTrigger, ctrlWheelZoom }) => {
  const map = useMap()

  useEffect(() => {
    if (!map) return
    onMapRef?.(map)
  }, [map, onMapRef])

  // invalidateSize на маунте и при смене resizeTrigger — карта считает размер
  // корректно, даже если контейнер раскрылся/переразмерился после init.
  useEffect(() => {
    if (!map) return
    let raf: number | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const invalidate = () => {
      if (cancelled) return
      try {
        map.invalidateSize()
      } catch {
        // noop
      }
    }

    try {
      if (typeof requestAnimationFrame !== 'undefined') {
        raf = requestAnimationFrame(invalidate)
      } else {
        timer = setTimeout(invalidate, 0)
      }
    } catch {
      // noop
    }
    const settleTimer = setTimeout(invalidate, 250)

    return () => {
      cancelled = true
      if (raf != null) {
        try {
          cancelAnimationFrame(raf)
        } catch {
          // noop
        }
      }
      if (timer != null) clearTimeout(timer)
      clearTimeout(settleTimer)
    }
  }, [map, resizeTrigger])

  // ctrl-wheel-zoom: колесо зумит только с Ctrl/Cmd, иначе страница скроллится.
  useEffect(() => {
    if (!ctrlWheelZoom || !map?.scrollWheelZoom) return
    map.scrollWheelZoom.disable()
    const el = map.getContainer()
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) map.scrollWheelZoom.enable()
      else map.scrollWheelZoom.disable()
    }
    el.addEventListener('wheel', onWheel, { passive: true })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ctrlWheelZoom, map])

  return null
}

/**
 * Engine-only движок карты на react-leaflet: MapContainer + единый OSM
 * tile-провайдер (`getOsmTileUrl`) + lifecycle (invalidateSize / cleanup /
 * ctrl-wheel-zoom). Никакой бизнес-логики MapPage — всё предметное (маркеры,
 * роут, попапы, fit-bounds) экраны отдают как `children(engine)`.
 *
 * Один движок вместо трёх параллельных `<MapContainer>/<TileLayer>` на
 * travel-wizard / trip-planner / quest-web (эпик #988, тикет #992). Провайдер
 * тайлов централизован здесь — гейт `guard:no-direct-osm-tiles` держит его
 * единственным источником OSM-подложки.
 */
export const MapCanvas: React.FC<MapCanvasProps> = ({
  center,
  zoom,
  bounds,
  maxZoom,
  containerKey,
  id,
  mapStyle,
  zoomControl,
  dragging,
  scrollWheelZoom,
  touchZoom,
  doubleClickZoom,
  keyboard,
  tap,
  preferCanvas,
  ctrlWheelZoom,
  resizeTrigger,
  engine: providedEngine,
  onMapRef,
  whenReady,
  fallback = null,
  children,
}) => {
  const isWeb = Platform.OS === 'web'
  // Хук вызываем всегда (rules-of-hooks); при переданном engine loader выключен.
  const loaded = useLeafletLoader({
    enabled: isWeb && !providedEngine,
    useIdleCallback: false,
    fallbackDelay: 0,
  })

  if (!isWeb) return <>{fallback}</>

  const engine: MapCanvasEngine | null =
    providedEngine ??
    (loaded.ready && loaded.L && loaded.RL ? { L: loaded.L, RL: loaded.RL } : null)

  if (!engine) return <>{fallback}</>

  const { RL } = engine
  const { MapContainer, TileLayer } = RL
  if (!MapContainer || !TileLayer) return <>{fallback}</>

  return (
    <MapContainer
      key={containerKey}
      {...(center !== undefined ? { center } : {})}
      {...(zoom !== undefined ? { zoom } : {})}
      {...(bounds !== undefined ? { bounds } : {})}
      {...(maxZoom !== undefined ? { maxZoom } : {})}
      {...(id !== undefined ? { id } : {})}
      {...(zoomControl !== undefined ? { zoomControl } : {})}
      {...(dragging !== undefined ? { dragging } : {})}
      {...(scrollWheelZoom !== undefined ? { scrollWheelZoom } : {})}
      {...(touchZoom !== undefined ? { touchZoom } : {})}
      {...(doubleClickZoom !== undefined ? { doubleClickZoom } : {})}
      {...(keyboard !== undefined ? { keyboard } : {})}
      {...(tap !== undefined ? { tap } : {})}
      {...(preferCanvas !== undefined ? { preferCanvas } : {})}
      {...(mapStyle !== undefined ? { style: mapStyle } : {})}
      {...(whenReady !== undefined ? { whenReady } : {})}
    >
      <TileLayer
        url={getOsmTileUrl()}
        attribution={OSM_PROXY_ATTRIBUTION}
        maxZoom={maxZoom ?? OSM_PROXY_MAX_ZOOM}
        crossOrigin={getOsmTileCrossOrigin()}
      />
      <MapCanvasLifecycle
        useMap={RL.useMap}
        onMapRef={onMapRef}
        resizeTrigger={resizeTrigger}
        ctrlWheelZoom={ctrlWheelZoom}
      />
      {typeof children === 'function' ? children(engine) : null}
    </MapContainer>
  )
}

export default MapCanvas
