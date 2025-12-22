// components/MapPage/RoutingMachine.tsx
import { useEffect, useRef, useMemo } from 'react'
import { useRouting } from './useRouting'

interface RoutingMachineProps {
    map: any
    routePoints: [number, number][]
    transportMode: 'car' | 'bike' | 'foot'
    setRoutingLoading: (loading: boolean) => void
    setErrors: (errors: any) => void
    setRouteDistance: (distance: number) => void
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
    map,
    routePoints,
    transportMode,
    setRoutingLoading,
    setErrors,
    setRouteDistance,
    setFullRouteCoords,
    ORS_API_KEY,
}) => {
    const polylineRef = useRef<any>(null)
    const lastFitKeyRef = useRef<string | null>(null)
    const prevStateRef = useRef<{
        loading: boolean
        error: string | boolean
        distance: number
        coords: string
    } | null>(null)
    const lastSentRef = useRef<{
        loading: boolean
        error: string | boolean
        distance: number
        coords: string
    } | null>(null)

    // Use custom hook for routing logic
    const routingState = useRouting(routePoints, transportMode, ORS_API_KEY)
    const hasTwoPoints = routePoints.length >= 2
    const clearedNoPointsRef = useRef(false)

    // Sync routing state to parent callbacks (only when changed)
    // Use coordsKey to prevent infinite loops from array reference changes
    const coordsKeyForSync = JSON.stringify(routingState.coords)
    
    // Если точек меньше двух — сбрасываем состояние и выходим (без лишних setState на каждом рендере)
    useEffect(() => {
        if (!hasTwoPoints) {
            clearedNoPointsRef.current = false
            return
        }

        if (clearedNoPointsRef.current) return
        clearedNoPointsRef.current = true

        setErrors({ routing: false })
        setRouteDistance(0)
        setFullRouteCoords([])

        // Удаляем линию, если была
        if (polylineRef.current && map) {
            try { map.removeLayer(polylineRef.current) } catch (_error) { /* noop */ }
            polylineRef.current = null
        }
    }, [hasTwoPoints, map, setErrors, setFullRouteCoords, setRouteDistance])

    useEffect(() => {
        if (!hasTwoPoints) return

        const currentState = {
            loading: routingState.loading,
            error: routingState.error,
            distance: routingState.distance,
            coords: coordsKeyForSync,
        }

        const prevState = prevStateRef.current
        const hasChanged = !prevState ||
            prevState.loading !== currentState.loading ||
            prevState.error !== currentState.error ||
            prevState.distance !== currentState.distance ||
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
                lastSent.coords !== currentState.coords

            if (!isNew) return

            lastSentRef.current = currentState

            setRoutingLoading(routingState.loading)
            
            // Передаем ошибку только если она есть
            if (typeof routingState.error === 'string' && routingState.error) {
                setErrors({ routing: routingState.error })
            } else {
                setErrors({ routing: false })
            }
            
            setRouteDistance(routingState.distance)
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

    // Draw polyline on map (separate effect)
    // Use coordsKey to avoid infinite loops from array reference changes
    const coordsKeyForDraw = JSON.stringify(routingState.coords)
    // ✅ ИСПРАВЛЕНИЕ: Мемоизируем fitKey чтобы избежать пересоздания на каждом рендере
    const fitKey = useMemo(
        () => `${transportMode}-${routePoints.map((p) => p.join(',')).join('|')}`,
        [transportMode, routePoints]
    )
    
    useEffect(() => {
        if (!hasTwoPoints) return
        if (!map || typeof window === 'undefined') return

        const L = (window as any).L
        if (!L) return

        // Remove old polyline
        if (polylineRef.current) {
            try {
                map.removeLayer(polylineRef.current)
            } catch (_error) {
                if (__DEV__) {
                    const { devWarn } = require('@/src/utils/logger')
                    devWarn('Ошибка удаления полилинии:', _error)
                }
            }
            polylineRef.current = null
        }

        // Draw new polyline if we have coordinates
        if (routingState.coords.length >= 2) {
            const latlngs = routingState.coords.map(([lng, lat]) => L.latLng(lat, lng))
            
            // Определяем цвет линии в зависимости от статуса
            const isOptimal = routingState.error === false || routingState.error === ''
            const color = isOptimal ? '#3388ff' : '#ff9800'
            const weight = isOptimal ? 5 : 4
            const opacity = isOptimal ? 0.85 : 0.65
            const dashArray = isOptimal ? null : '10, 10' // Пунктирная линия для неоптимального маршрута

            const line = L.polyline(latlngs, { 
                color, 
                weight, 
                opacity,
                dashArray,
                lineJoin: 'round',
                lineCap: 'round'
            })
            line.addTo(map)
            polylineRef.current = line
            
            // Центрируем карту на маршруте только при изменении старт/финиш.
            // Иначе при каждом обновлении coords (или store sync) карта будет "дергаться",
            // создавая ощущение бесконечной перестройки.
            if (lastFitKeyRef.current !== fitKey) {
                lastFitKeyRef.current = fitKey
                try {
                    const bounds = line.getBounds()
                    if (bounds.isValid()) {
                        map.fitBounds(bounds.pad(0.1), { 
                            animate: true,
                            duration: 0.5,
                            maxZoom: 14
                        })
                    }
                } catch (_error) {
                    if (__DEV__) {
                        const { devWarn } = require('@/src/utils/logger')
                        devWarn('Ошибка центрирования на маршруте:', _error)
                    }
                }
            }
        }
    }, [map, coordsKeyForDraw, routingState.error, fitKey, hasTwoPoints, routingState.coords])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (polylineRef.current && map) {
                try {
                    map.removeLayer(polylineRef.current)
                } catch (_error) {
                    // Игнорируем ошибки при очистке
                }
                polylineRef.current = null
            }
            lastFitKeyRef.current = null
        }
    }, [map])

    return null
}

export default RoutingMachine
