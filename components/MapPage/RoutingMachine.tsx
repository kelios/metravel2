// components/MapPage/RoutingMachine.tsx
import { useEffect, useMemo, useRef } from 'react'
import { useRouting } from './useRouting'

// Open-Meteo elevation endpoint supports batch arrays; keep this comfortably under the limit
// to reduce URL size and rate-limit pressure.
const MAX_ELEVATION_SAMPLES = 60
const elevationCache = new Map<string, { gain: number; loss: number }>()
let elevationNextAllowedAtMs = 0
let elevationLastAttemptAtMs = 0
const ELEVATION_MIN_INTERVAL_MS = 1500
const ELEVATION_429_COOLDOWN_MS = 30_000

const sampleIndices = (total: number, maxSamples: number) => {
    if (!Number.isFinite(total) || total <= 0) return [] as number[]
    if (total <= maxSamples) return Array.from({ length: total }, (_, i) => i)
    if (maxSamples <= 1) return [0]
    const out: number[] = []
    for (let i = 0; i < maxSamples; i++) {
        const idx = Math.round((i * (total - 1)) / (maxSamples - 1))
        out.push(idx)
    }
    // Ensure unique / sorted indices
    return Array.from(new Set(out)).sort((a, b) => a - b)
}

const computeElevationGainLoss = (elevations: number[]) => {
    let gain = 0
    let loss = 0
    const noiseThresholdMeters = 3
    for (let i = 1; i < elevations.length; i++) {
        const prev = elevations[i - 1]
        const next = elevations[i]
        if (!Number.isFinite(prev) || !Number.isFinite(next)) continue
        const delta = next - prev
        if (Math.abs(delta) < noiseThresholdMeters) continue
        if (delta > 0) gain += delta
        else loss += Math.abs(delta)
    }
    return { gain: Math.round(gain), loss: Math.round(loss) }
}

interface RoutingMachineProps {
    routePoints: [number, number][]
    transportMode: 'car' | 'bike' | 'foot'
    setRoutingLoading: (loading: boolean) => void
    setErrors: (errors: any) => void
    setRouteDistance: (distance: number) => void
    setRouteDuration?: (durationSeconds: number) => void
    setFullRouteCoords: (coords: [number, number][]) => void
    setRouteElevationStats?: (gainMeters: number | null, lossMeters: number | null) => void
    ORS_API_KEY: string | undefined
}

/**
 * RoutingMachine Component
 * 
 * Отвечает за построение маршрута между двумя точками на карте.
 * Использует OpenRouteService (ORS) API или OSRM в качестве fallback.
 * 
 * Основные возможности:
 * - Построение оптимального маршрута по дорогам
 * - Поддержка разных видов транспорта (авто, велосипед, пешком)
 * - Кэширование маршрутов для оптимизации
 * - Fallback на прямую линию при недоступности сервисов
 * - Визуальная индикация статуса построения маршрута
 */

const RoutingMachine: React.FC<RoutingMachineProps> = ({
    routePoints,
    transportMode,
    setRoutingLoading,
    setErrors,
    setRouteDistance,
    setRouteDuration,
    setFullRouteCoords,
    setRouteElevationStats,
    ORS_API_KEY,
}) => {
    const debugRouting = useMemo(() => {
        if (typeof process === 'undefined') return false
        const flag = (process.env as any)?.EXPO_PUBLIC_DEBUG_ROUTING
        return flag === '1' || flag === 'true'
    }, [])
    const prevStateRef = useRef<{
        loading: boolean
        error: string | boolean
        distance: number
        duration: number
        coords: string
    } | null>(null)
    const lastSentRef = useRef<{
        loading: boolean
        error: string | boolean
        distance: number
        duration: number
        coords: string
    } | null>(null)

    // Use custom hook for routing logic
    const routingState = useRouting(routePoints, transportMode, ORS_API_KEY)
    const hasTwoPoints = routePoints.length >= 2

    const clearedNoPointsRef = useRef(false)
    const routeKey = useMemo(
        () => routePoints.length >= 2 ? `${transportMode}-${routePoints.map(p => p.join(',')).join('|')}` : '',
        [routePoints, transportMode]
    )
    const lastRouteKeyLoadingRef = useRef<string | null>(null)

    // Sync routing state to parent callbacks (only when changed)
    // Use coordsKey to prevent infinite loops from array reference changes
    const coordsKeyForSync = JSON.stringify(routingState.coords)
    
    // Если точек меньше двух — сбрасываем состояние и выходим (без лишних setState на каждом рендере)
    useEffect(() => {
        if (hasTwoPoints) {
            clearedNoPointsRef.current = false
            return
        }

        if (clearedNoPointsRef.current) return
        clearedNoPointsRef.current = true

        try {
            setErrors({ routing: false })
        } catch {
            // noop
        }
        setRouteDistance(0)
        setFullRouteCoords([])
    }, [hasTwoPoints, setErrors, setFullRouteCoords, setRouteDistance, setRoutingLoading])

    // Явно сигнализируем о старте построения маршрута при смене ключа маршрута
    useEffect(() => {
        if (!hasTwoPoints || !routeKey) return
        if (lastRouteKeyLoadingRef.current === routeKey) return
        lastRouteKeyLoadingRef.current = routeKey
        setRoutingLoading(true)
    }, [hasTwoPoints, routeKey, setRoutingLoading])

    useEffect(() => {
        if (!hasTwoPoints) return

        const currentState = {
            loading: routingState.loading,
            error: routingState.error,
            distance: routingState.distance,
            duration: routingState.duration,
            coords: coordsKeyForSync,
        }

        const prevState = prevStateRef.current
        // Пропускаем первоначальный синк пустого состояния (loading=false, coords=[])
        if (!prevState && !routingState.loading && routingState.distance === 0 && routingState.coords.length === 0) {
            prevStateRef.current = currentState
            return
        }
        const hasChanged = !prevState ||
            prevState.loading !== currentState.loading ||
            prevState.error !== currentState.error ||
            prevState.distance !== currentState.distance ||
            prevState.duration !== currentState.duration ||
            prevState.coords !== currentState.coords

        if (hasChanged) {
            prevStateRef.current = currentState
            // Дополнительно предотвращаем зацикливание: шлём обновления вверх только если реально новое состояние
            const lastSent = lastSentRef.current
            const isNew =
                !lastSent ||
                lastSent.loading !== currentState.loading ||
                lastSent.error !== currentState.error ||
                lastSent.distance !== currentState.distance ||
                lastSent.duration !== currentState.duration ||
                lastSent.coords !== currentState.coords

            if (!isNew) return

            lastSentRef.current = currentState

            // Передаем фактический флаг загрузки (без учета дистанции), чтобы тесты видели завершение
            setRoutingLoading(routingState.loading)
            
            // Передаем ошибку только если она есть
            if (typeof routingState.error === 'string' && routingState.error) {
                try {
                    setErrors({ routing: routingState.error })
                } catch {
                    // noop
                }
            } else {
                try {
                    setErrors({ routing: false })
                } catch {
                    // noop
                }
            }
            
            setRouteDistance(routingState.distance)
            try {
                setRouteDuration?.(routingState.duration)
            } catch {
                // noop
            }
            if (debugRouting) {
                try {
                    console.info('[RoutingMachine] sync -> setFullRouteCoords', {
                        len: Array.isArray(routingState.coords) ? routingState.coords.length : null,
                        first: Array.isArray(routingState.coords) ? routingState.coords?.[0] : null,
                        last: Array.isArray(routingState.coords)
                            ? routingState.coords?.[routingState.coords.length - 1]
                            : null,
                        distance: routingState.distance,
                        duration: routingState.duration,
                    })
                } catch {
                    // noop
                }
            }
            // Не сбрасываем fullRouteCoords в [] при старте загрузки: это создает "прямую линию" миганием
            // и может триггерить лишние эффекты/перерендеры. Очищаем только когда точек < 2 (отдельный эффект),
            // либо когда реально есть геометрия.
            if (Array.isArray(routingState.coords) && routingState.coords.length >= 2) {
                setFullRouteCoords(routingState.coords)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        routingState.loading,
        routingState.error,
        routingState.distance,
        coordsKeyForSync,
        hasTwoPoints,
        // Не включаем setters в зависимости - они стабильны
    ])

    // Elevation stats (bike/foot only): fetch elevations for sampled route geometry and compute gain/loss.
    useEffect(() => {
        if (!hasTwoPoints) return
        if (transportMode === 'car') return
        if (!setRouteElevationStats) return
        if (routingState.loading) return
        if (!Array.isArray(routingState.coords) || routingState.coords.length < 2) return

        const indices = sampleIndices(routingState.coords.length, MAX_ELEVATION_SAMPLES)
        if (indices.length < 2) return

        const sampled = indices
            .map((i) => routingState.coords[i])
            .filter((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))

        if (sampled.length < 2) return

        const latitudes = sampled.map((p) => Number(p[1]).toFixed(5)).join(',')
        const longitudes = sampled.map((p) => Number(p[0]).toFixed(5)).join(',')

        // Stable cache key (rounded samples) to avoid re-fetching on tiny floating diffs.
        const cacheKey = `${transportMode}:${latitudes}:${longitudes}`
        const cached = elevationCache.get(cacheKey)
        if (cached) {
            try {
                setRouteElevationStats(cached.gain, cached.loss)
            } catch {
                // noop
            }
            return
        }

        // Clear stale values while we fetch new elevations
        try {
            setRouteElevationStats(null, null)
        } catch {
            // noop
        }

        const now = Date.now()
        if (now < elevationNextAllowedAtMs) return
        if (now - elevationLastAttemptAtMs < ELEVATION_MIN_INTERVAL_MS) return
        elevationLastAttemptAtMs = now

        const abortController = new AbortController()
        let cancelled = false

        const fetchElevations = async () => {
            try {
                // Open-Meteo elevation API (no key). Keep sample count <= 100.
                const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`
                const res = await fetch(url, { signal: abortController.signal })
                if (res.status === 429) {
                    elevationNextAllowedAtMs = Date.now() + ELEVATION_429_COOLDOWN_MS
                    return
                }
                if (!res.ok) return
                const data = await res.json().catch(() => null)
                const elevations = (data as any)?.elevation
                if (!Array.isArray(elevations) || elevations.length < 2) return
                if (cancelled) return

                const stats = computeElevationGainLoss(elevations.map((x: any) => Number(x)))
                elevationCache.set(cacheKey, stats)
                try {
                    setRouteElevationStats(stats.gain, stats.loss)
                } catch {
                    // noop
                }
            } catch (e: any) {
                if (e?.name === 'AbortError') return
            }
        }

        fetchElevations()

        return () => {
            cancelled = true
            try {
                abortController.abort()
            } catch {
                // noop
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasTwoPoints, transportMode, coordsKeyForSync, routingState.loading, setRouteElevationStats])

    useEffect(() => {
        if (!setRouteElevationStats) return
        if (transportMode !== 'car') return
        try {
            setRouteElevationStats(null, null)
        } catch {
            // noop
        }
    }, [setRouteElevationStats, transportMode])

    return null
}

export default RoutingMachine
