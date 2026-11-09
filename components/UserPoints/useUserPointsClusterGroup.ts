import React from 'react'

import { createMapClusterGroup } from '@/components/MapPage/Map/mapClusterGroup'
import { OSM_PROXY_MAX_ZOOM } from '@/config/mapWebLayers'
import { logError } from '@/utils/logger'

type Params = {
  L: any
  map: any
  /** Фабрика иконки кластера (latest-ref: смена темы не пересоздаёт группу). */
  clusterIconFactoryRef: React.MutableRefObject<((cluster: any) => any) | null>
  /** Снять маркеры и индекс карты перед удалением группы. */
  onDispose: () => void
}

/**
 * Группа кластеров Leaflet для «Моих точек» — одна на карту (#3135: вынесено из
 * `UserPointsClusterLayer.web.tsx`, поведение без изменений). Возвращает ref
 * группы и счётчик пересозданий, по которому слой синхронизирует маркеры.
 */
export function useUserPointsClusterGroup({ L, map, clusterIconFactoryRef, onDispose }: Params) {
  const groupRef = React.useRef<any>(null)
  const [groupVersion, setGroupVersion] = React.useState(0)
  const [clusterPluginNonce, setClusterPluginNonce] = React.useState(0)
  const onDisposeRef = React.useRef(onDispose)
  React.useEffect(() => {
    onDisposeRef.current = onDispose
  })

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

    // Плагин кластеров при `onAdd` бросает «Map has no maxZoom specified», если у
    // карты нет потолка зума — на проде 08.11 это уронило весь экран. Потолок
    // задаёт MapContainer; здесь страховка для карты без него, а сам addLayer
    // под try, чтобы сбой слоя не превращался в белую страницу.
    let created: { group: any; dispose: () => void } | null = null
    try {
      if (!Number.isFinite(Number(map.getMaxZoom?.())) && typeof map.setMaxZoom === 'function') {
        map.setMaxZoom(OSM_PROXY_MAX_ZOOM)
      }
      created = createMapClusterGroup(L, map, { iconCreateFunction })
      map.addLayer(created.group)
    } catch (error) {
      // Leaflet регистрирует слой в `_layers` до `onAdd`, поэтому упавшую группу
      // снимаем с карты; сбой уходит в лог/мониторинг — пустая карта при живом
      // списке иначе останется немой.
      if (created) {
        try {
          created.dispose()
          map.removeLayer?.(created.group)
        } catch {
          // noop
        }
      }
      logError(error, { scope: 'UserPointsClusterLayer.createGroup' })
      return
    }
    const { group, dispose } = created
    groupRef.current = group
    setGroupVersion((v) => v + 1)

    return () => {
      try {
        dispose()
        map.removeLayer(group)
        group.clearLayers()
      } catch {
        // noop
      }
      onDisposeRef.current()
      groupRef.current = null
    }
  }, [L, map, clusterPluginNonce, clusterIconFactoryRef])

  return { groupRef, groupVersion }
}
