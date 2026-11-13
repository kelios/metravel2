import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocationSearchQuery, type LocationSearchResult } from '@/api/geoQueries'
import { isValidCoordinate } from '@/utils/coordinateValidator'
import type { MapCitySearchResult } from '@/types/mapUi'
import { useLocaleRevision } from '@/i18n/useLocaleRevision'

const SETTLEMENT_TYPES = new Set(['city', 'town', 'village', 'hamlet', 'municipality', 'administrative'])
const normalizeName = (value: string) => value.trim().normalize('NFKC').toLowerCase()
// Only this consumer, in this JS context. This is not an application-wide SLA.
let lastCityRequestAt = -Infinity
const CITY_REQUEST_INTERVAL_MS = 1000

/** An address containing a city does not make its POI a city search result. */
export function resolveMapCity(result: LocationSearchResult): MapCitySearchResult | null {
  if (!result || !SETTLEMENT_TYPES.has(result.type ?? '')) return null
  const objectName = result.name ?? result.display_name?.split(',')[0]
  const name = typeof objectName === 'string' ? normalizeName(objectName) : ''
  const settlements = [result.address?.city, result.address?.town, result.address?.village, result.address?.municipality]
  if (!name || !settlements.some(value => typeof value === 'string' && normalizeName(value) === name)) return null
  if (typeof result.lat !== 'string' || !result.lat.trim() || typeof result.lon !== 'string' || !result.lon.trim()) return null
  const lat = Number(result.lat)
  const lng = Number(result.lon)
  const label = typeof result.display_name === 'string' ? result.display_name.trim() : ''
  if (!label || !isValidCoordinate(lat, lng)) return null
  return { id: `${result.place_id}:${lat},${lng}`, label, lat, lng }
}

export function useMapCitySearch({
  query,
  enabled,
  onSelect,
}: {
  query: string
  enabled: boolean
  onSelect: (coordinates: { lat: number; lng: number }) => void
}) {
  const trimmed = query.trim()
  const locale = useLocaleRevision()
  const requestKey = JSON.stringify([trimmed, locale])
  const eligible = enabled && trimmed.length >= 3
  const [requestedKey, setRequestedKey] = useState<string | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const active = eligible && requestedKey === requestKey
  useEffect(() => {
    if (!eligible || requestedKey !== requestKey) setRequestedKey(null)
  }, [eligible, requestKey, requestedKey])
  useEffect(() => {
    if (cooldownUntil === null) return
    const timer = setTimeout(() => setCooldownUntil(null), Math.max(0, cooldownUntil - Date.now()))
    return () => clearTimeout(timer)
  }, [cooldownUntil])
  const takeRequestSlot = useCallback(() => {
    const now = Date.now()
    const nextAllowedAt = lastCityRequestAt + CITY_REQUEST_INTERVAL_MS
    if (now < nextAllowedAt) {
      setCooldownUntil(nextAllowedAt)
      return false
    }
    lastCityRequestAt = now
    setCooldownUntil(now + CITY_REQUEST_INTERVAL_MS)
    return true
  }, [])
  // Keep the default result limit: it is deliberately not a cache-key dimension.
  const { data, isFetching, isPending, isError, refetch } = useLocationSearchQuery({ query: trimmed, enabled: active, userInitiatedOnly: true })
  const status = !eligible ? null : !active ? 'idle' : isFetching || isPending
    ? 'pending' : isError ? 'error' : 'settled'
  const results = useMemo(() => {
    if (status !== 'settled') return []
    return (data ?? []).map(resolveMapCity).filter((city): city is MapCitySearchResult => city !== null)
  }, [data, status])
  const current = useRef({ results, onSelect, eligible, active, requestKey, isFetching, isError, refetch })
  current.current = { results, onSelect, eligible, active, requestKey, isFetching, isError, refetch }
  const request = useCallback(() => {
    const live = current.current
    if (!live.eligible || live.active || !takeRequestSlot()) return
    setRequestedKey(live.requestKey)
  }, [takeRequestSlot])
  const select = useCallback((city: MapCitySearchResult) => {
    // Read the current offer, not the response/handler from an earlier query.
    const candidate = current.current.results.find(result => result.id === city.id && result.lat === city.lat && result.lng === city.lng)
    if (candidate) current.current.onSelect({ lat: candidate.lat, lng: candidate.lng })
  }, [])
  const retry = useCallback(() => {
    const live = current.current
    if (!live.active || !live.isError || live.isFetching || !takeRequestSlot()) return
    void live.refetch()
  }, [takeRequestSlot])
  return { status, results, select, retry, request, coolingDown: cooldownUntil !== null }
}
