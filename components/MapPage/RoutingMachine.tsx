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

        // ORS/OSRM возвращают координаты в формате GeoJSON: [lng, lat]
        // routePoints тоже приходят как [lng, lat]
        // Leaflet.latLng() ожидает (lat, lng) - поэтому меняем порядок
        
        // Валидация координат
        const validCoords = coordsToDraw.filter(([lng, lat]) =>
            Number.isFinite(lng) &&
            Number.isFinite(lat) &&
            lng >= -180 && lng <= 180 &&
            lat >= -90 && lat <= 90
        )

        console.info('[RoutingMachine] Coordinates processing:', {
            coordsToDrawCount: coordsToDraw.length,
            validCoordsCount: validCoords.length,
            coordsToDraw: coordsToDraw.slice(0, 2),
            validCoords: validCoords.slice(0, 2),
        })

        if (validCoords.length >= 2) {
            // ВАЖНО: координаты в формате [lng, lat], Leaflet ожидает latLng(lat, lng)
            const latlngs = validCoords.map(([lng, lat]) => leaflet.latLng(lat, lng))

            const paneName = 'metravelRoutePane'
            let hasRoutePane = false
            try {
                const existingPane = typeof map.getPane === 'function' ? map.getPane(paneName) : null
                const pane = existingPane || (typeof map.createPane === 'function' ? map.createPane(paneName) : null)
                if (pane && pane.style) {
                    pane.style.zIndex = '650'
                    pane.style.pointerEvents = 'none'
                    hasRoutePane = true
                }
            } catch {
                hasRoutePane = false
            }

            const renderer = typeof leaflet.svg === 'function'
                ? leaflet.svg(hasRoutePane ? { pane: paneName } : undefined)
                : undefined

            const firstLatLng = latlngs[0] ? { lat: latlngs[0].lat, lng: latlngs[0].lng } : null
            const lastLatLng = latlngs[latlngs.length - 1] ? { 
                lat: latlngs[latlngs.length - 1].lat, 
                lng: latlngs[latlngs.length - 1].lng 
            } : null
            
            console.info('[RoutingMachine] ✅ LatLng objects:', 
                `count=${latlngs.length}`,
                `first=${JSON.stringify(firstLatLng)}`,
                `last=${JSON.stringify(lastLatLng)}`
            )

            // Проверяем текущую позицию карты
            const mapCenter = map.getCenter?.()
            const mapZoom = map.getZoom?.()
            console.info('[RoutingMachine] Map state:', 
                `center=${JSON.stringify(mapCenter ? { lat: mapCenter.lat, lng: mapCenter.lng } : null)}`,
                `zoom=${mapZoom}`
            )

            // Определяем цвет линии в зависимости от статуса
            const isOptimal = routingState.error === false || routingState.error === ''
            const color = isOptimal ? primary : danger
            const weight = isOptimal ? 6 : 5
            const opacity = isOptimal ? 0.9 : 0.7
            const dashArray = isOptimal ? null : '10, 10'

            // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Если линия уже существует с теми же координатами,
            // просто обновляем стили вместо пересоздания
            const existingLine = polylineRef.current
            if (existingLine && typeof existingLine.setStyle === 'function' && coordsToDraw === latestCoords) {
                try {
                    existingLine.setStyle({
                        color,
                        weight,
                        opacity,
                        dashArray: dashArray || undefined,
                    })
                    console.info('[RoutingMachine] ✅ Updated existing line styles (no recreate)')
                    return // Не пересоздаем линию!
                } catch (error) {
                    console.warn('[RoutingMachine] Failed to update line styles, will recreate:', error)
                }
            }

            // Удаляем старую линию перед созданием новой
            if (polylineRef.current) {
                try {
                    map.removeLayer(polylineRef.current)
                    console.info('[RoutingMachine] Removed old polyline')
                } catch (error) {
                    console.warn('[RoutingMachine] Failed to remove old polyline:', error)
                }
                polylineRef.current = null
            }

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

                console.info('[RoutingMachine] Creating polyline:', {
                    pointsCount: latlngs.length,
                    firstPoint: latlngs[0],
                    lastPoint: latlngs[latlngs.length - 1],
                    color,
                    weight,
                    opacity,
                    isOptimal,
                })

                const line = leaflet.polyline(latlngs, {
                    color,
                    weight,
                    opacity,
                    dashArray,
                    interactive: false,
                    lineJoin: 'round',
                    lineCap: 'round',
                    className: 'metravel-route-line',
                    pane: hasRoutePane ? paneName : 'overlayPane',
                    renderer,
                })

                try {
                    line.addTo(map)
                    polylineRef.current = line

                    try {
                        line.bringToFront?.()
                    } catch {
                        // noop
                    }
                    
                    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Сразу центрируем карту на маршруте
                    const bounds = line.getBounds?.()
                    if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
                        try {
                            map.fitBounds(bounds.pad(0.1), {
                                animate: false,
                                duration: 0,
                                maxZoom: 14,
                            })
                            console.info('[RoutingMachine] 🎯 Map centered on route bounds')
                        } catch (e) {
                            console.warn('[RoutingMachine] Failed to fitBounds:', e)
                        }
                    }
                    
                    // Принудительно перерисовываем карту
                    setTimeout(() => {
                        if (cancelled) return
                        try {
                            if (typeof map.invalidateSize === 'function') {
                                map.invalidateSize({ animate: false, pan: false } as any)
                                console.info('[RoutingMachine] Map invalidated')
                            }
                        } catch (e) {
                            console.warn('[RoutingMachine] Failed to invalidate:', e)
                        }
                    }, 100)
                    
                    const boundsInfo = bounds ? {
                        north: bounds.getNorth?.(),
                        south: bounds.getSouth?.(),
                        east: bounds.getEast?.(),
                        west: bounds.getWest?.(),
                    } : null
                    
                    console.info('[RoutingMachine] ✅ Polyline added to map', 
                        `bounds=${JSON.stringify(boundsInfo)}`
                    )
                    
                    // Проверяем элемент path в DOM
                    setTimeout(() => {
                        if (cancelled) return
                        const pathEl = line.getElement?.()
                        if (pathEl) {
                            const d = pathEl.getAttribute('d')
                            const rect = pathEl.getBoundingClientRect()
                            console.info('[RoutingMachine] 🔍 Path element in DOM:',
                                `d.length=${d?.length || 0}`,
                                `rect=${JSON.stringify({ 
                                    top: rect.top, 
                                    left: rect.left, 
                                    width: rect.width, 
                                    height: rect.height 
                                })}`
                            )
                        }
                    }, 200)

                    // Force bring to front AND set z-index on path element
                    setTimeout(() => {
                        if (cancelled) return
                        try {
                            if (typeof line.bringToFront === 'function') {
                                line.bringToFront()
                            }
                            
                            // Force visibility on path element
                            const pathEl = line.getElement?.()
                            if (pathEl) {
                                pathEl.style.display = 'inline'
                                pathEl.style.visibility = 'visible'
                                pathEl.style.pointerEvents = 'auto'
                            }
                            
                            // Ensure parent containers don't hide the line
                            const parent = pathEl?.parentElement
                            if (parent) {
                                parent.style.overflow = 'visible'
                            }
                        } catch (e) {
                            console.warn('[RoutingMachine] Failed to bring line to front:', e)
                        }
                    }, 10)

                    // Force map redraw to ensure polyline renders
                    setTimeout(() => {
                        if (cancelled) return
                        try {
                            if (typeof map.invalidateSize === 'function') {
                                map.invalidateSize({ animate: false, pan: false } as any)
                            }
                            if (typeof line.redraw === 'function') {
                                line.redraw()
                            }
                        } catch (e) {
                            console.warn('[RoutingMachine] Failed to redraw:', e)
                        }
                    }, 50)

                    // DOM diagnostics - check if SVG path exists
                    try {
                        if (typeof document !== 'undefined') {
                            const svgPaths = document.querySelectorAll('.metravel-route-line')
                            const overlayPane = document.querySelector('.leaflet-overlay-pane')
                            const overlayPaneSvg = overlayPane?.querySelector('svg')
                            const overlayPanePaths = overlayPane?.querySelectorAll('path')

                            // Get SVG dimensions and path details
                            let svgInfo: any = null
                            let pathInfo: any = null

                            if (overlayPaneSvg) {
                                const svgRect = overlayPaneSvg.getBoundingClientRect()
                                const svgStyle = window.getComputedStyle(overlayPaneSvg)
                                svgInfo = {
                                    width: svgRect.width,
                                    height: svgRect.height,
                                    top: svgRect.top,
                                    left: svgRect.left,
                                    display: svgStyle.display,
                                    visibility: svgStyle.visibility,
                                    overflow: svgStyle.overflow,
                                }
                            }

                            if (overlayPanePaths && overlayPanePaths.length > 0) {
                                const firstPath = overlayPanePaths[0]
                                const pathStyle = window.getComputedStyle(firstPath)
                                const pathRect = firstPath.getBoundingClientRect()
                                let pathLength = 0
                                try {
                                    pathLength = (firstPath as SVGPathElement).getTotalLength?.() || 0
                                } catch { /* noop */ }

                                pathInfo = {
                                    d: firstPath.getAttribute('d')?.slice(0, 100) + '...',
                                    stroke: pathStyle.stroke,
                                    strokeWidth: pathStyle.strokeWidth,
                                    strokeOpacity: (pathStyle as any).strokeOpacity,
                                    fill: pathStyle.fill,
                                    display: pathStyle.display,
                                    visibility: pathStyle.visibility,
                                    width: pathRect.width,
                                    height: pathRect.height,
                                    pathLength,
                                    className: firstPath.getAttribute('class'),
                                }
                            }

                            console.info('[RoutingMachine] DOM diagnostics:', {
                                routeLineCount: svgPaths.length,
                                overlayPaneExists: !!overlayPane,
                                overlayPaneSvgExists: !!overlayPaneSvg,
                                overlayPanePathCount: overlayPanePaths?.length || 0,
                                overlayPaneStyle: overlayPane ? {
                                    zIndex: (overlayPane as HTMLElement).style.zIndex,
                                    position: (overlayPane as HTMLElement).style.position,
                                } : null,
                                svgInfo,
                                pathInfo,
                            })
                        }
                    } catch (e) {
                        console.warn('[RoutingMachine] DOM diagnostics error:', e)
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
                            pane: 'overlayPane',
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

                // fitBounds теперь выполняется сразу после addTo (см. выше)
                // Сохраняем ключ чтобы не центрировать повторно
                lastFitKeyRef.current = fitKey
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
    }, [map, leafletFromProps, coordsKeyForDraw, routingState.error, hasTwoPoints, routeKey])

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
