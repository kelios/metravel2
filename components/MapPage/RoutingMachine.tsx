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

    const routePointsRef = useRef(routePoints)
    const routingCoordsRef = useRef(routingState.coords)
    useEffect(() => {
        routePointsRef.current = routePoints
    }, [routePoints])
    useEffect(() => {
        routingCoordsRef.current = routingState.coords
    }, [routingState.coords])

    const clearedNoPointsRef = useRef(false)
    const routeKey = useMemo(
        () => routePoints.length >= 2 ? `${transportMode}-${routePoints.map(p => p.join(',')).join('|')}` : '',
        [routePoints, transportMode]
    )
    const lastRouteKeyLoadingRef = useRef<string | null>(null)
    const { primary, danger } = useThemedColors()

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
        const latestCoords = routingCoordsRef.current
        const latestRoutePoints = routePointsRef.current
        const coordsToDraw = latestCoords.length >= 2
            ? latestCoords
            : (hasTwoPoints ? latestRoutePoints : [])

        console.info('[RoutingMachine] Drawing polyline:', {
            hasTwoPoints,
            latestCoordsLength: latestCoords.length,
            latestRoutePointsLength: latestRoutePoints.length,
            coordsToDrawLength: coordsToDraw.length,
            latestCoords: latestCoords.slice(0, 2),
            latestRoutePoints: latestRoutePoints.slice(0, 2),
            coordsToDraw: coordsToDraw.slice(0, 2),
        })

        const normalizeLngLat = (tuple: [number, number]): [number, number] => {
            const a = tuple?.[0]
            const b = tuple?.[1]
            if (!Number.isFinite(a) || !Number.isFinite(b)) return tuple

            // Простая логика: если первое значение явно не может быть longitude (выходит за -90..90),
            // а второе может быть longitude, то это формат [lat, lng] - меняем местами
            const aOutOfLatRange = a < -90 || a > 90;
            const bOutOfLatRange = b < -90 || b > 90;

            // Если первое значение выходит за диапазон lat, а второе нет - это [lng, lat]
            if (aOutOfLatRange && !bOutOfLatRange) {
                return tuple; // уже [lng, lat]
            }

            // Если второе значение выходит за диапазон lat, а первое нет - это [lat, lng]
            if (!aOutOfLatRange && bOutOfLatRange) {
                return [b, a]; // swap to [lng, lat]
            }

            // Оба значения в диапазоне -90..90 - неоднозначность
            // Предполагаем, что координаты уже в формате [lng, lat] (как ожидается)
            return tuple;
        }

        const normalizedCoords = coordsToDraw.map((p) => normalizeLngLat(p))
        const validCoords = normalizedCoords.filter(([lng, lat]) =>
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180
        )

        console.info('[RoutingMachine] Coordinates processing:', {
            coordsToDrawCount: coordsToDraw.length,
            normalizedCount: normalizedCoords.length,
            validCoordsCount: validCoords.length,
            first2Normalized: normalizedCoords.slice(0, 2),
            first2Valid: validCoords.slice(0, 2),
        })

        if (validCoords.length >= 2) {
            const latlngs = validCoords.map(([lng, lat]) => leaflet.latLng(lat, lng))

            // Определяем цвет линии в зависимости от статуса
            // Используем primary для оптимального маршрута, danger для fallback
            const isOptimal = routingState.error === false || routingState.error === ''
            const color = isOptimal ? primary : danger
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
                if (typeof map?.getPane === 'function') {
                    const overlayPane = map.getPane('overlayPane')
                    if (!overlayPane) {
                        if (attemptsLeft > 0) {
                            schedule(() => addLineWhenReady(attemptsLeft - 1))
                        }
                        return
                    }
                }

                const routePaneName = 'metravelRoutePane'

                // Ensure custom pane exists - create if not present
                let routePane: HTMLElement | null = null
                try {
                    routePane = typeof map.getPane === 'function' ? map.getPane(routePaneName) : null
                    if (!routePane && typeof map.createPane === 'function') {
                        routePane = map.createPane(routePaneName)
                        console.info('[RoutingMachine] Created custom pane:', routePaneName)
                    }
                    if (routePane && routePane.style) {
                        routePane.style.zIndex = '450'
                        routePane.style.pointerEvents = 'none'
                    }
                } catch (e) {
                    console.warn('[RoutingMachine] Failed to create/configure pane:', e)
                }

                const hasRoutePane = !!routePane

                // Force SVG renderer for proper CSS styling of route line
                // Canvas renderer doesn't support CSS class styling
                let renderer: any = undefined
                try {
                    if (typeof leaflet.svg === 'function') {
                        // Create SVG renderer in the overlay pane (not custom pane)
                        // This ensures proper stacking with other map elements
                        renderer = leaflet.svg({ pane: 'overlayPane' })
                    }
                } catch (e) {
                    console.warn('[RoutingMachine] Failed to create SVG renderer:', e)
                }

                console.info('[RoutingMachine] Creating polyline with pane:', {
                    hasRoutePane,
                    paneName: 'overlayPane', // Always use overlayPane for compatibility
                    hasRenderer: !!renderer,
                    rendererType: renderer ? 'svg' : 'default',
                    color,
                    weight,
                    opacity,
                })

                const line = leaflet.polyline(latlngs, {
                    color,
                    weight,
                    opacity,
                    dashArray,
                    renderer, // Use SVG renderer for CSS styling
                    pane: 'overlayPane', // Use standard overlay pane
                    interactive: false,
                    lineJoin: 'round',
                    lineCap: 'round',
                    className: 'metravel-route-line',
                })

                try {
                    line.addTo(map)
                    line.bringToFront?.()
                    polylineRef.current = line

                    // Ensure renderer flushes DOM updates (some browsers/fast-refresh sequences can delay SVG path paint).
                    try {
                        if (typeof map.invalidateSize === 'function') {
                            map.invalidateSize({ animate: false, pan: false } as any)
                        }
                    } catch {
                        // noop
                    }
                    try {
                        const maybeRedraw = (line as any)?.redraw
                        if (typeof maybeRedraw === 'function') {
                            maybeRedraw.call(line)
                        }
                    } catch {
                        // noop
                    }

                    // DOM diagnostics - check if SVG path exists
                    try {
                        if (typeof document !== 'undefined') {
                            const svgPaths = document.querySelectorAll('.metravel-route-line')
                            const overlayPane = document.querySelector('.leaflet-overlay-pane')
                            const overlayPaneSvg = overlayPane?.querySelector('svg')
                            const overlayPanePaths = overlayPane?.querySelectorAll('path')

                            console.info('[RoutingMachine] DOM diagnostics:', {
                                routeLineCount: svgPaths.length,
                                overlayPaneExists: !!overlayPane,
                                overlayPaneSvgExists: !!overlayPaneSvg,
                                overlayPanePathCount: overlayPanePaths?.length || 0,
                                overlayPaneStyle: overlayPane ? {
                                    zIndex: (overlayPane as HTMLElement).style.zIndex,
                                    position: (overlayPane as HTMLElement).style.position,
                                } : null,
                            })
                        }
                    } catch {
                        // noop
                    }
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
                        const el = (line as any)?.getElement?.() as SVGPathElement | null | undefined
                        let bbox: any = null
                        let computed: any = null
                        let totalLength: number | null = null
                        let parentInfo: any = null
                        try {
                            if (el && typeof el.getBBox === 'function') bbox = el.getBBox()
                        } catch {
                            bbox = null
                        }
                        try {
                            if (el && typeof el.getTotalLength === 'function') totalLength = Number(el.getTotalLength())
                        } catch {
                            totalLength = null
                        }
                        try {
                            if (el && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
                                const s = window.getComputedStyle(el)
                                computed = {
                                    stroke: s.stroke,
                                    strokeOpacity: (s as any).strokeOpacity,
                                    strokeWidth: s.strokeWidth,
                                    opacity: s.opacity,
                                    display: s.display,
                                    visibility: s.visibility,
                                }
                            }
                        } catch {
                            computed = null
                        }
                        try {
                            if (el) {
                                const parent = el.parentElement
                                const grandparent = parent?.parentElement
                                parentInfo = {
                                    parentTagName: parent?.tagName,
                                    parentClassName: parent?.className,
                                    grandparentTagName: grandparent?.tagName,
                                    grandparentClassName: grandparent?.className,
                                    elClassName: el.getAttribute?.('class'),
                                }
                            }
                        } catch {
                            parentInfo = null
                        }

                        console.info('[RoutingMachine] Polyline added', {
                            points: latlngs.length,
                            hasLayer: typeof map.hasLayer === 'function' ? map.hasLayer(line) : undefined,
                            color,
                            weight,
                            opacity,
                            dashArray,
                            pane: hasRoutePane ? routePaneName : 'overlayPane',
                            hasElement: !!el,
                            bbox,
                            totalLength,
                            computed,
                            parentInfo,
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
    }, [map, leafletFromProps, coordsKeyForDraw, routingState.error, fitKey, hasTwoPoints, routeKey, primary, danger])

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
