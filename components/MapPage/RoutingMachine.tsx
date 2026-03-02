// components/MapPage/RoutingMachine.tsx
import { useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouting } from './useRouting'
import { showRouteBuiltToast, showRouteErrorToast } from '@/utils/mapToasts'
import { useElevation } from '@/components/map-core/useElevation'

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
    const coordsKeyForSync = useMemo(() => {
        const coords = routingState.coords
        if (!Array.isArray(coords) || coords.length < 2) return ''
        const first = coords[0]
        const last = coords[coords.length - 1]
        const safeNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0)
        const fmt = (v: any) => safeNum(v).toFixed(5)
        return `${coords.length}:${fmt(first?.[0])},${fmt(first?.[1])}:${fmt(last?.[0])},${fmt(last?.[1])}`
    }, [routingState.coords])
    
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
                    showRouteErrorToast(routingState.error)
                } catch {
                    // noop
                }
            } else {
                try {
                    setErrors({ routing: false })
                } catch {
                    // noop
                }

                // Показываем toast при успешном построении маршрута
                if (!routingState.loading && routingState.distance > 0 && routingState.duration > 0) {
                    const distanceKm = routingState.distance / 1000
                    const durationMinutes = routingState.duration / 60
                    showRouteBuiltToast(distanceKm, durationMinutes)
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

    // Elevation stats (bike/foot only) — delegated to useElevation
    const handleElevationResult = useCallback((gain: number | null, loss: number | null) => {
        setRouteElevationStats?.(gain, loss)
    }, [setRouteElevationStats])

    useElevation(
        {
            coords: routingState.coords,
            transportMode,
            enabled: hasTwoPoints && !routingState.loading && Array.isArray(routingState.coords) && routingState.coords.length >= 2,
            coordsKey: coordsKeyForSync,
        },
        handleElevationResult,
    )

    return null
}

export default RoutingMachine
