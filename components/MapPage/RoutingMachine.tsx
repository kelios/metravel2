// components/MapPage/RoutingMachine.tsx
import { useEffect, useMemo, useRef } from 'react'
import { useRouting } from './useRouting'
import { useThemedColors } from '@/hooks/useTheme'

interface RoutingMachineProps {
    map: any
    L?: any
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
    map,
    L: leafletFromProps,
    routePoints,
    transportMode,
    setRoutingLoading,
    setErrors,
    setRouteDistance,
    setRouteDuration,
    setFullRouteCoords,
    ORS_API_KEY,
}) => {
    const polylineRef = useRef<any>(null)
    const lastFitKeyRef = useRef<string | null>(null)
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
    const { info, warning } = useThemedColors()

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

        // Удаляем линию, если была
        if (polylineRef.current && map) {
            try { map.removeLayer(polylineRef.current) } catch { /* noop */ }
            polylineRef.current = null
        }
    }, [hasTwoPoints, map, setErrors, setFullRouteCoords, setRouteDistance])

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

        const leaflet = leafletFromProps ?? (window as any).L
        if (!leaflet) return

        let cancelled = false
        // Remove old polyline
        if (polylineRef.current) {
            try {
                map.removeLayer(polylineRef.current)
            } catch (error) {
                if (__DEV__) {
                    const { devWarn } = require('@/src/utils/logger')
                    devWarn('Ошибка удаления полилинии:', error)
                }
            }
            polylineRef.current = null
        }

        // Draw new polyline if we have coordinates
        const coordsToDraw = routingState.coords.length >= 2
            ? routingState.coords
            : (hasTwoPoints ? routePoints : [])

        const normalizeLngLat = (tuple: [number, number]): [number, number] => {
            const a = tuple?.[0]
            const b = tuple?.[1]
            if (!Number.isFinite(a) || !Number.isFinite(b)) return tuple

            const aIsLatOnly = a >= -90 && a <= 90
            const bIsLatOnly = b >= -90 && b <= 90
            const aIsLngOnly = a >= -180 && a <= 180
            const bIsLngOnly = b >= -180 && b <= 180

            // If it looks like [lat, lng] (non-ambiguous), swap to [lng, lat].
            // Ambiguous pairs like [27,53] should keep the current order, since app state uses [lng, lat].
            const looksLikeLatLngNonAmbiguous = aIsLatOnly && bIsLngOnly && !(aIsLngOnly && bIsLatOnly)
            if (looksLikeLatLngNonAmbiguous) return [b, a]

            return tuple
        }

        const validCoords = coordsToDraw
            .map((p) => normalizeLngLat(p))
            .filter(([lng, lat]) =>
                Number.isFinite(lat) &&
                Number.isFinite(lng) &&
                lat >= -90 && lat <= 90 &&
                lng >= -180 && lng <= 180
            )

        if (validCoords.length >= 2) {
            const latlngs = validCoords.map(([lng, lat]) => leaflet.latLng(lat, lng))

            // Определяем цвет линии в зависимости от статуса
            const isOptimal = routingState.error === false || routingState.error === ''
            const color = isOptimal ? info : warning
            const weight = isOptimal ? 5 : 4
            const opacity = isOptimal ? 0.85 : 0.65
            const dashArray = isOptimal ? null : '10, 10' // Пунктирная линия для неоптимального маршрута

            const schedule = (fn: () => void) => {
                if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(fn)
                } else {
                    setTimeout(fn, 0)
                }
            }

            const addLineWhenReady = (attemptsLeft: number) => {
                if (cancelled) return
                // Во время fast-refresh/unmount карта может быть в промежуточном состоянии.
                // Ранее мы просто возвращались, если overlayPane ещё не готов, и линия могла
                // вообще никогда не появиться. Теперь делаем несколько ретраев.
                if (typeof map.getPane === 'function') {
                    const overlayPane = map.getPane('overlayPane')
                    if (!overlayPane) {
                        if (attemptsLeft > 0) {
                            schedule(() => addLineWhenReady(attemptsLeft - 1))
                        }
                        return
                    }
                }

                const line = leaflet.polyline(latlngs, {
                    color,
                    weight,
                    opacity,
                    dashArray,
                    renderer: typeof leaflet.svg === 'function' ? leaflet.svg() : undefined,
                    pane: 'overlayPane',
                    interactive: false,
                    lineJoin: 'round',
                    lineCap: 'round',
                    className: 'metravel-route-line',
                })

                try {
                    line.addTo(map)
                    try {
                        line.bringToFront?.()
                    } catch {
                        // noop
                    }
                    polylineRef.current = line
                } catch (error) {
                    // Если карта была уничтожена между whenReady и addTo
                    try {
                        line.remove?.()
                    } catch {
                        // noop
                    }
                    if (__DEV__) {
                        const { devWarn } = require('@/src/utils/logger')
                        devWarn('Ошибка добавления полилинии на карту:', error)
                    }
                    return
                }

                if (__DEV__) {
                    try {
                        console.info('[RoutingMachine] Polyline added', {
                            points: latlngs.length,
                            hasLayer: typeof map.hasLayer === 'function' ? map.hasLayer(line) : undefined,
                            color,
                            weight,
                            opacity,
                            dashArray,
                        })
                    } catch {
                        // noop
                    }
                }

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
                                maxZoom: 14,
                            })
                        }
                    } catch (error) {
                        if (__DEV__) {
                            const { devWarn } = require('@/src/utils/logger')
                            devWarn('Ошибка центрирования на маршруте:', error)
                        }
                    }
                }
            }

            // Leaflet гарантирует, что whenReady вызовется когда готовы panes/renderer.
            // Но при гонках (error boundary, hot reload) дополнительно проверяем overlayPane.
            if (typeof map.whenReady === 'function') {
                map.whenReady(() => addLineWhenReady(12))
            } else {
                addLineWhenReady(12)
            }
        }

        return () => {
            cancelled = true
        }
    }, [map, leafletFromProps, coordsKeyForDraw, routingState.error, fitKey, hasTwoPoints, routeKey, info, warning])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (polylineRef.current && map) {
                try {
                    map.removeLayer(polylineRef.current)
                } catch {
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
