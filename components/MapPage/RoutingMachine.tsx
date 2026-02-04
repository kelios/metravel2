// components/MapPage/RoutingMachine.tsx
import { useEffect, useMemo, useRef } from 'react'
import { useRouting } from './useRouting'

interface RoutingMachineProps {
    routePoints: [number, number][]
    transportMode: 'car' | 'bike' | 'foot'
    setRoutingLoading: (loading: boolean) => void
    setErrors: (errors: any) => void
    setRouteDistance: (distance: number) => void
    setRouteDuration?: (durationSeconds: number) => void
    setFullRouteCoords: (coords: [number, number][]) => void
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
    ORS_API_KEY,
}) => {
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
        try {
            setRoutingLoading(false)
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
            setFullRouteCoords(routingState.coords)
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

    return null
}

export default RoutingMachine
