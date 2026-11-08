/**
 * Слой личных точек на web-карте «Мои точки»: кластеры + ленивый попап (#3131).
 *
 * До этого каждая точка была отдельным `<Marker>` react-leaflet со своим
 * смонтированным `<Popup>` и `PlacePopupCard`: 2656 точек владельца давали 2656
 * DOM-маркеров (16 тыс. узлов, 215 МБ), 2656 табстопов и слипшееся пятно
 * булавок без кластеров. Теперь маркеры создаются императивно и живут в
 * `L.markerClusterGroup` — тем же механизмом, что у общей карты `/map` и карты
 * конструктора поездки (`createMapClusterGroup`, `buildClusterIconHtml`,
 * `useApplyClusterAccessibleName`). Попап один на карту: Leaflet получает
 * функцию-контент, а React монтирует `PlacePopupCard` через портал только для
 * открытой точки.
 */
import React from 'react'
import { createPortal } from 'react-dom'

import { buildClusterIconHtml } from '@/components/MapPage/Map/mapMarkerStyles'
import { createMapClusterGroup } from '@/components/MapPage/Map/mapClusterGroup'
import { useApplyClusterAccessibleName } from '@/components/MapPage/Map/clusterAccessibleName'
import { DESIGN_COLORS, DESIGN_TOKENS } from '@/constants/designSystem'
import { useTheme } from '@/hooks/useTheme'
import type { ImportedPoint } from '@/types/userPoints'

import { getPointTitle, isSitePoint as isSitePointOf } from './userPointPresentation'

export type UserPointMarkerIconGetter = (
  color: string | undefined,
  opts?: { active?: boolean; emphasize?: boolean },
) => any

/**
 * То, что карта регистрирует в индексе `markerByCoord` для `MapUiApi`
 * (`openPopupForCoord`): у маркера внутри кластера `openPopup()` молча ничего не
 * делает, пока кластер не раскрыт, поэтому наружу отдаётся обёртка, которая
 * сначала просит группу показать маркер (`zoomToShowLayer`).
 */
export type UserPointMarkerHandle = {
  pointId: number
  openPopup: () => void
  closePopup: () => void
  setZIndexOffset: (offset: number) => void
  getLatLng: () => any
  getElement: () => HTMLElement | null
  /** Карта, на которой маркер сейчас лежит (`useMapApi.openPopupForCoord` ждёт `moveend` именно у неё). */
  readonly _map: any
  /** Сам Leaflet-маркер — для тестов и отладки. */
  marker: any
}

export type UserPointsClusterLayerProps = {
  L: any
  map: any
  points: ImportedPoint[]
  activePointId?: number | null
  isCompactPopup: boolean
  colors: { backgroundTertiary: string }
  getMarkerIconCached: UserPointMarkerIconGetter
  /** Клик по маркеру — центрирование, drive-info, выбор точки. Попап Leaflet откроет сам. */
  onMarkerClick?: (point: ImportedPoint, handle: UserPointMarkerHandle) => void
  /** Регистрация маркера в индексе карты (по id и координате). `null` — маркер снят. */
  registerPointMarker: (args: {
    pointId: number
    marker: UserPointMarkerHandle | null
    coordKey?: string
    coordKeyFixed?: string
  }) => void
  /** Содержимое попапа для открытой точки; монтируется только когда попап открыт. */
  renderPopup: (point: ImportedPoint, closePopup: () => void) => React.ReactNode
}

type MarkerEntry = {
  marker: any
  handle: UserPointMarkerHandle
  point: ImportedPoint
  lat: number
  lng: number
  icon: any
  title: string
  active: boolean
  coordKey: string
  coordKeyFixed: string
}

const DEFAULT_SITE_POINT_COLOR = DESIGN_COLORS.travelPoint
const POPUP_CLASS_NAME = 'metravel-user-point-popup metravel-place-popup'
const POPUP_MAX_WIDTH = 360
/** Длительность зум-анимации Leaflet; после неё можно просить кластер раскрыть маркер. */
const REVEAL_ACTIVE_DELAY_MS = 350

const toFiniteId = (point: ImportedPoint): number | null => {
  const id = Number(point?.id)
  return Number.isFinite(id) ? id : null
}

const applyMarkerAccessibleName = (marker: any, title: string) => {
  try {
    const element: HTMLElement | null = marker?._icon || marker?.getElement?.() || null
    if (!element) return
    element.setAttribute('aria-label', title)
    element.setAttribute('title', title)
  } catch {
    // noop
  }
}

/**
 * Leaflet ставит `tabindex="0"` и `role="button"` в `_initIcon` только при
 * `options.keyboard`, но при повторном `setIcon` переиспользует тот же `<div>`
 * и уже поставленные атрибуты не снимает. Снимаем сами, когда точка перестаёт
 * быть активной: в tab-порядке остаётся одна выбранная булавка, а не вся коллекция.
 */
const applyMarkerKeyboard = (marker: any, active: boolean) => {
  try {
    const element: HTMLElement | null = marker?._icon || marker?.getElement?.() || null
    if (!element) return
    if (active) {
      element.setAttribute('tabindex', '0')
      element.setAttribute('role', 'button')
    } else {
      element.removeAttribute('tabindex')
      element.removeAttribute('role')
    }
  } catch {
    // noop
  }
}

export const UserPointsClusterLayer: React.FC<UserPointsClusterLayerProps> = ({
  L,
  map,
  points,
  activePointId,
  isCompactPopup,
  colors,
  getMarkerIconCached,
  onMarkerClick,
  registerPointMarker,
  renderPopup,
}) => {
  const { isDark } = useTheme()
  const groupRef = React.useRef<any>(null)
  const entriesRef = React.useRef<Map<number, MarkerEntry>>(new Map())
  const popupContainerRef = React.useRef<HTMLElement | null>(null)
  const [openPointId, setOpenPointId] = React.useState<number | null>(null)
  const [groupVersion, setGroupVersion] = React.useState(0)
  const [clusterPluginNonce, setClusterPluginNonce] = React.useState(0)

  // «Latest»-рефы: клик и регистрация приходят инлайн-функциями от родителя,
  // а пересоздавать маркеры на каждый его рендер нельзя.
  const onMarkerClickRef = React.useRef(onMarkerClick)
  const registerPointMarkerRef = React.useRef(registerPointMarker)
  React.useEffect(() => {
    onMarkerClickRef.current = onMarkerClick
    registerPointMarkerRef.current = registerPointMarker
  })

  const pointsById = React.useMemo(() => {
    const byId = new Map<number, ImportedPoint>()
    for (const point of points) {
      const id = toFiniteId(point)
      if (id == null) continue
      const lat = Number(point?.latitude)
      const lng = Number(point?.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      byId.set(id, point)
    }
    return byId
  }, [points])

  const applyClusterAccessibleName = useApplyClusterAccessibleName(L)

  const clusterIconFactory = React.useMemo(() => {
    if (!L?.divIcon || typeof document === 'undefined') return null
    return (cluster: any) => {
      const { metrics, html } = buildClusterIconHtml({
        count: Number(cluster?.getChildCount?.() ?? 0),
        accentColor: String(DESIGN_TOKENS.colors.primary),
        accentDarkColor: String(DESIGN_TOKENS.colors.primaryDark),
        softGlowColor: String(DESIGN_TOKENS.colors.primaryAlpha30),
        textColor: String(DESIGN_TOKENS.colors.textOnDark),
        isDark,
      })
      return L.divIcon({
        className: 'metravel-cluster-icon',
        html,
        iconSize: [metrics.size, metrics.size],
        iconAnchor: [metrics.size / 2, metrics.size / 2],
      })
    }
  }, [L, isDark])
  const clusterIconFactoryRef = React.useRef(clusterIconFactory)
  React.useEffect(() => {
    clusterIconFactoryRef.current = clusterIconFactory
  }, [clusterIconFactory])

  const closePopup = React.useCallback(() => {
    try {
      map?.closePopup?.()
    } catch {
      // noop
    }
  }, [map])

  // Один контейнер попапа на карту: Leaflet получает функцию, React — портал.
  if (!popupContainerRef.current && typeof document !== 'undefined') {
    const container = document.createElement('div')
    container.className = 'metravel-user-point-popup-root'
    popupContainerRef.current = container
  }

  // Группа кластеров создаётся один раз на карту.
  React.useEffect(() => {
    if (!L || !map || typeof map.addLayer !== 'function') return
    if (typeof L.markerClusterGroup !== 'function') {
      // Штатно плагин уже применён в loadLeafletRuntime (#765); это фолбэк для
      // нештатного L, как в MarkerClusterGroup общей карты.
      let cancelled = false
      Promise.resolve(import('@/utils/leafletVendor'))
        .then(() => {
          if (!cancelled && typeof L.markerClusterGroup === 'function') {
            setClusterPluginNonce((v) => v + 1)
          }
        })
        .catch(() => {})
      return () => {
        cancelled = true
      }
    }

    const iconCreateFunction = clusterIconFactoryRef.current
      ? (cluster: any) => {
          const factory = clusterIconFactoryRef.current
          return factory ? factory(cluster) : undefined
        }
      : undefined

    const { group, dispose } = createMapClusterGroup(L, map, { iconCreateFunction })
    groupRef.current = group
    map.addLayer(group)
    setGroupVersion((v) => v + 1)

    const entries = entriesRef.current
    return () => {
      try {
        dispose()
        map.removeLayer(group)
        group.clearLayers()
      } catch {
        // noop
      }
      for (const entry of entries.values()) {
        try {
          entry.marker.off()
          entry.marker.unbindPopup?.()
        } catch {
          // noop
        }
        registerPointMarkerRef.current({
          pointId: entry.handle.pointId,
          marker: null,
          coordKey: entry.coordKey,
          coordKeyFixed: entry.coordKeyFixed,
        })
      }
      entries.clear()
      groupRef.current = null
      setOpenPointId(null)
    }
  }, [L, map, clusterPluginNonce])

  // Смена темы перекрашивает кластеры на месте, без пересборки группы.
  React.useEffect(() => {
    const group = groupRef.current
    if (!group || typeof group.refreshClusters !== 'function') return
    try {
      group.refreshClusters()
    } catch {
      // noop
    }
  }, [isDark, groupVersion])

  // Доступное имя кластеров — для каждой новой партии после зума/пана.
  React.useEffect(() => {
    if (!L || !map || typeof map.on !== 'function' || typeof map.off !== 'function') return
    const handleLayerAdd = (event: any) => applyClusterAccessibleName(event?.layer)
    map.on('layeradd', handleLayerAdd)
    return () => {
      map.off('layeradd', handleLayerAdd)
    }
  }, [L, map, applyClusterAccessibleName])

  // Синхронизация маркеров с точками: diff по id, без clearLayers.
  React.useEffect(() => {
    const group = groupRef.current
    if (!group || !L || typeof L.marker !== 'function') return

    const entries = entriesRef.current
    const activeId = Number(activePointId)
    const popupContainer = popupContainerRef.current
    const popupOptions = {
      className: POPUP_CLASS_NAME,
      closeButton: false,
      autoPan: true,
      autoPanPadding: isCompactPopup ? [16, 92] : [28, 120],
      maxWidth: POPUP_MAX_WIDTH,
      minWidth: 0,
    }

    const resolveIcon = (point: ImportedPoint, active: boolean) => {
      const sitePoint = isSitePointOf(point)
      const baseColor = String(point?.color ?? '').trim()
      const fill = sitePoint ? baseColor || DEFAULT_SITE_POINT_COLOR : baseColor
      return getMarkerIconCached(String(fill || '').trim() || colors.backgroundTertiary, {
        active,
        emphasize: sitePoint,
      })
    }

    // 1. Снять маркеры точек, которых больше нет.
    const removed: MarkerEntry[] = []
    for (const [id, entry] of entries) {
      if (pointsById.has(id)) continue
      removed.push(entry)
      entries.delete(id)
      try {
        entry.marker.off()
        entry.marker.unbindPopup?.()
      } catch {
        // noop
      }
    }
    if (removed.length) {
      try {
        group.removeLayers(removed.map((entry) => entry.marker))
      } catch {
        for (const entry of removed) {
          try {
            group.removeLayer(entry.marker)
          } catch {
            // noop
          }
        }
      }
      for (const entry of removed) {
        registerPointMarkerRef.current({
          pointId: entry.handle.pointId,
          marker: null,
          coordKey: entry.coordKey,
          coordKeyFixed: entry.coordKeyFixed,
        })
      }
    }

    // 2. Обновить выжившие и создать новые.
    const added: any[] = []
    for (const [id, point] of pointsById) {
      const lat = Number(point.latitude)
      const lng = Number(point.longitude)
      const active = id === activeId
      const icon = resolveIcon(point, active)
      const title = getPointTitle(point)
      const existing = entries.get(id)

      if (existing) {
        existing.point = point
        // Смена раскладки (isCompactPopup) меняет поля автопана у уже созданных попапов.
        const boundPopup = existing.marker.getPopup?.()
        if (boundPopup?.options) boundPopup.options.autoPanPadding = popupOptions.autoPanPadding
        if (existing.lat !== lat || existing.lng !== lng) {
          existing.lat = lat
          existing.lng = lng
          existing.coordKey = `${lat},${lng}`
          existing.coordKeyFixed = `${lat.toFixed(6)},${lng.toFixed(6)}`
          try {
            existing.marker.setLatLng([lat, lng])
          } catch {
            // noop
          }
          registerPointMarkerRef.current({
            pointId: id,
            marker: existing.handle,
            coordKey: existing.coordKey,
            coordKeyFixed: existing.coordKeyFixed,
          })
        }
        if (existing.icon !== icon || existing.active !== active) {
          existing.icon = icon
          existing.active = active
          try {
            // Только активная точка остаётся в tab-порядке: 2656 табстопов подряд
            // делали клавиатурную навигацию по странице невозможной.
            existing.marker.options.keyboard = active
            if (icon) existing.marker.setIcon(icon)
            applyMarkerKeyboard(existing.marker, active)
            applyMarkerAccessibleName(existing.marker, title)
          } catch {
            // noop
          }
        }
        if (existing.title !== title) {
          existing.title = title
          try {
            existing.marker.options.title = title
            existing.marker.options.alt = title
          } catch {
            // noop
          }
          applyMarkerAccessibleName(existing.marker, title)
        }
        continue
      }

      let marker: any
      try {
        marker = L.marker([lat, lng], {
          icon,
          title,
          alt: title,
          keyboard: active,
          riseOnHover: true,
        })
      } catch {
        continue
      }

      const handle: UserPointMarkerHandle = {
        pointId: id,
        marker,
        openPopup: () => {
          try {
            const currentGroup = groupRef.current
            const onMap = typeof map?.hasLayer === 'function' ? map.hasLayer(marker) : true
            if (!onMap && currentGroup && typeof currentGroup.zoomToShowLayer === 'function') {
              currentGroup.zoomToShowLayer(marker, () => {
                try {
                  marker.openPopup?.()
                } catch {
                  // noop
                }
              })
              return
            }
            marker.openPopup?.()
          } catch {
            // noop
          }
        },
        closePopup: () => {
          try {
            marker.closePopup?.()
          } catch {
            // noop
          }
        },
        setZIndexOffset: (offset: number) => {
          try {
            marker.setZIndexOffset?.(offset)
          } catch {
            // noop
          }
        },
        getLatLng: () => marker.getLatLng?.(),
        getElement: () => marker.getElement?.() ?? marker._icon ?? null,
        get _map() {
          return marker._map ?? null
        },
      }

      if (popupContainer) {
        marker.bindPopup(() => popupContainer, popupOptions)
        marker.on('popupopen', () => setOpenPointId(id))
        marker.on('popupclose', () => setOpenPointId((prev) => (prev === id ? null : prev)))
      }
      marker.on('add', () => {
        const current = entries.get(id)
        applyMarkerAccessibleName(marker, current?.title ?? title)
        applyMarkerKeyboard(marker, current?.active ?? active)
      })
      marker.on('click', (event: any) => {
        try {
          L?.DomEvent?.stopPropagation?.(event)
          event?.originalEvent?.stopPropagation?.()
        } catch {
          // noop
        }
        const current = entries.get(id)
        onMarkerClickRef.current?.(current?.point ?? point, handle)
      })

      const coordKey = `${lat},${lng}`
      const coordKeyFixed = `${lat.toFixed(6)},${lng.toFixed(6)}`
      entries.set(id, { marker, handle, point, lat, lng, icon, title, active, coordKey, coordKeyFixed })
      added.push(marker)
      registerPointMarkerRef.current({ pointId: id, marker: handle, coordKey, coordKeyFixed })
    }

    if (added.length) {
      try {
        group.addLayers(added)
      } catch {
        for (const marker of added) {
          try {
            group.addLayer(marker)
          } catch {
            // noop
          }
        }
      }
    }

    // Первая партия кластеров ставится на карту синхронно внутри addLayers — до
    // того, как сработает layeradd-слушатель; подписываем её явно (#1624).
    if (map && typeof map.eachLayer === 'function' && (added.length || removed.length)) {
      try {
        map.eachLayer(applyClusterAccessibleName)
      } catch {
        // noop
      }
    }
  }, [
    L,
    map,
    pointsById,
    activePointId,
    isCompactPopup,
    colors.backgroundTertiary,
    getMarkerIconCached,
    groupVersion,
    applyClusterAccessibleName,
  ])

  // Выбранная из списка точка может сидеть внутри кластера на текущем зуме —
  // после анимации центрирования просим группу раскрыть её, иначе выделенный
  // маркер невидим и выбор «не сработал».
  React.useEffect(() => {
    const id = Number(activePointId)
    if (!Number.isFinite(id)) return
    const entry = entriesRef.current.get(id)
    const group = groupRef.current
    if (!entry || !group || !map) return
    const timer = setTimeout(() => {
      try {
        const onMap = typeof map.hasLayer === 'function' ? map.hasLayer(entry.marker) : true
        if (!onMap && typeof group.zoomToShowLayer === 'function') {
          group.zoomToShowLayer(entry.marker, () => {})
        }
      } catch {
        // noop
      }
    }, REVEAL_ACTIVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [activePointId, map, groupVersion])

  // Открытая точка отфильтрована — попап закрывается, а не висит над пустотой.
  React.useEffect(() => {
    if (openPointId == null) return
    if (pointsById.has(openPointId)) return
    closePopup()
    setOpenPointId(null)
  }, [closePopup, openPointId, pointsById])

  const openPoint = openPointId != null ? pointsById.get(openPointId) ?? null : null
  const container = popupContainerRef.current

  // Leaflet меряет и автопанит попап в момент открытия — контейнер ещё пуст,
  // портал смонтируется следующим рендером. Пересчитываем раскладку и автопан
  // после каждого коммита содержимого, как делал `<Popup>` react-leaflet:
  // иначе высокая карточка открывается обрезанной у кромки карты.
  React.useEffect(() => {
    if (openPointId == null || !openPoint) return
    try {
      const popup = entriesRef.current.get(openPointId)?.marker?.getPopup?.()
      if (popup && (typeof popup.isOpen !== 'function' || popup.isOpen())) popup.update?.()
    } catch {
      // noop
    }
  }, [openPointId, openPoint, renderPopup])

  if (!openPoint || !container) return null
  return createPortal(
    <React.Fragment key={String(openPointId)}>{renderPopup(openPoint, closePopup)}</React.Fragment>,
    container,
  )
}

export default React.memo(UserPointsClusterLayer)
