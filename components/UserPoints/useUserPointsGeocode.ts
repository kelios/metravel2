import React from 'react'

import { nominatimSearch } from '@/api/external/nominatim'
import type { MapUiApi } from '@/types/mapUi'
import { getMapGeocoderLanguage } from '@/utils/mapLocale'

export type UserPointsSearchMarker = { lat: number; lng: number; label?: string }

/** Пауза перед геокодингом: пользователь ещё может дописать запрос. */
const GEOCODE_DEBOUNCE_MS = 450
const GEOCODE_HIT_ZOOM = 13
const GEOCODE_FALLBACK_ZOOM = 10

type Params = {
  appliedSearchQuery: string
  filteredPoints: ReadonlyArray<unknown>
  isSearching: boolean
  mapUiApi: MapUiApi | null
  /**
   * Куда смотреть, если геокодер ничего не нашёл: геолокация или центр
   * коллекции (#3135; раньше — зашитый Минск). `null` — карту не двигаем.
   */
  fallbackCenter: { lat: number; lng: number } | null
}

/**
 * Поиск без результатов в коллекции → геокодим запрос и показываем маркер на
 * карте (#3135: вынесено из `PointsListGrid`, поведение без изменений).
 * Геокодинг — по применённому запросу после ответа серверного поиска (#3132,
 * #3161), иначе Nominatim дёргался бы на промежуточных буквах.
 */
export function useUserPointsGeocode({
  appliedSearchQuery,
  filteredPoints,
  isSearching,
  mapUiApi,
  fallbackCenter,
}: Params): UserPointsSearchMarker | null {
  const [searchMarker, setSearchMarker] = React.useState<UserPointsSearchMarker | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastGeocodedQueryRef = React.useRef<string>('')
  const fallbackRef = React.useRef(fallbackCenter)
  fallbackRef.current = fallbackCenter

  React.useEffect(() => {
    const reset = () => {
      setSearchMarker(null)
      lastGeocodedQueryRef.current = ''
      abortRef.current?.abort()
      abortRef.current = null
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const q = String(appliedSearchQuery || '').trim()
    if (!q || filteredPoints.length > 0) {
      reset()
      return
    }
    if (!mapUiApi?.focusOnCoord) return
    if (isSearching) return
    if (lastGeocodedQueryRef.current === q) return

    const focusWith = (coords: { lat: number; lng: number; label?: string; zoom: number }) => {
      setSearchMarker({ lat: coords.lat, lng: coords.lng, label: coords.label })
      lastGeocodedQueryRef.current = q
      try {
        mapUiApi.focusOnCoord?.(`${coords.lat},${coords.lng}`, { zoom: coords.zoom })
      } catch {
        // noop
      }
    }
    // Геокодер ничего не нашёл: карту двигаем к геолокации/центру коллекции, но
    // маркер «найдено» не ставим — иначе пустой результат выглядел бы находкой.
    const focusFallback = () => {
      const fallback = fallbackRef.current
      lastGeocodedQueryRef.current = q
      setSearchMarker(null)
      if (!fallback) return
      try {
        mapUiApi.focusOnCoord?.(`${fallback.lat},${fallback.lng}`, { zoom: GEOCODE_FALLBACK_ZOOM })
      } catch {
        // noop
      }
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      nominatimSearch(
        { q, limit: 1, addressdetails: 1, acceptLanguage: getMapGeocoderLanguage() },
        { signal: controller.signal },
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (controller.signal.aborted) return
          const item = Array.isArray(data) ? data[0] : null
          const lat = Number(item?.lat)
          const lng = Number(item?.lon)
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            focusFallback()
            return
          }
          focusWith({ lat, lng, label: String(item?.display_name ?? ''), zoom: GEOCODE_HIT_ZOOM })
        })
        .catch(() => {
          if (controller.signal.aborted) return
          focusFallback()
        })
    }, GEOCODE_DEBOUNCE_MS)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      abortRef.current?.abort()
    }
  }, [appliedSearchQuery, filteredPoints, isSearching, mapUiApi])

  return searchMarker
}
