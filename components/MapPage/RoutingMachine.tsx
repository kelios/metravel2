// components/MapPage/RoutingMachine.tsx
import { useEffect, useMemo, useRef } from 'react'

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

const getORSProfile = (mode: 'car' | 'bike' | 'foot') => {
    switch (mode) {
        case 'bike': return 'cycling-regular'
        case 'foot': return 'foot-walking'
        default: return 'driving-car'
    }
}

const getOSRMProfile = (mode: 'car' | 'bike' | 'foot') => {
    switch (mode) {
        case 'bike': return 'bike'
        case 'foot': return 'foot'
        default: return 'driving'
    }
}

/**
 * Роутинг без leaflet-routing-machine:
 * 1) Если есть ключ ORS — используем OpenRouteService.
 * 2) Если ключа нет — фоллбэк на публичный OSRM (без ключа).
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
    const abortRef = useRef<AbortController | null>(null)

    const hasTwoPoints = Array.isArray(routePoints) && routePoints.length >= 2

    useEffect(() => {
        const L = (window as any).L
        if (!map || !L) return
        const avoidAutoFit = typeof window !== 'undefined'
            ? window.matchMedia('(max-width: 768px)').matches
            : false

        // если точек недостаточно — убираем линию и выходим
        if (!hasTwoPoints) {
            if (polylineRef.current) {
                try { 
                    map.removeLayer(polylineRef.current); 
                } catch (error) {
                    // ✅ FIX-009: Логируем ошибки удаления слоя (не критично, но полезно для отладки)
                    if (__DEV__) {
                        const { devWarn } = require('@/src/utils/logger');
                        devWarn('Error removing polyline layer:', error);
                    }
                }
                polylineRef.current = null
            }
            setErrors((prev: any) => ({ ...prev, routing: false }))
            setRouteDistance(0)
            return
        }

        // отменяем предыдущий запрос, если был
        if (abortRef.current) {
            abortRef.current.abort()
            abortRef.current = null
        }
        const abort = new AbortController()
        abortRef.current = abort

        const fetchORS = async () => {
            const res = await fetch(
                `https://api.openrouteservice.org/v2/directions/${getORSProfile(transportMode)}/geojson`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: String(ORS_API_KEY),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ coordinates: routePoints }),
                    signal: abort.signal,
                }
            )
            if (!res.ok) throw new Error(`ORS error: ${res.status}`)
            const data = await res.json()
            const feature = data.features?.[0]
            const geometry = feature?.geometry
            const summary = feature?.properties?.summary
            if (!geometry?.coordinates?.length) throw new Error('Empty route from ORS')
            const coordsLngLat: [number, number][] = geometry.coordinates
            const distance = summary?.distance as number | undefined
            return { coordsLngLat, distance }
        }

        const fetchOSRM = async () => {
            const profile = getOSRMProfile(transportMode)
            const coordsStr = routePoints.map(([lng, lat]) => `${lng},${lat}`).join(';')
            const url = `https://router.project-osrm.org/route/v1/${profile}/${coordsStr}?overview=full&geometries=geojson`
            const res = await fetch(url, { signal: abort.signal })
            if (!res.ok) throw new Error(`OSRM error: ${res.status}`)
            const data = await res.json()
            const route = data.routes?.[0]
            if (!route?.geometry?.coordinates?.length) throw new Error('Empty route from OSRM')
            const coordsLngLat: [number, number][] = route.geometry.coordinates
            const distance = route.distance as number | undefined
            return { coordsLngLat, distance }
        }

        // ✅ FIX-006: Флаг для отслеживания монтирования компонента
        let isMounted = true;

        const run = async () => {
            try {
                if (!isMounted) return;
                setRoutingLoading(true)
                setErrors((prev: any) => ({ ...prev, routing: false }))

                // 1) пробуем ORS, если есть ключ; иначе — OSRM
                const result = ORS_API_KEY ? await fetchORS() : await fetchOSRM()

                // ✅ FIX-006: Проверяем монтирование перед обновлением состояния
                if (!isMounted) return;

                // обновляем состояния
                setFullRouteCoords(result.coordsLngLat)

                const latlngs = result.coordsLngLat.map(([lng, lat]) => L.latLng(lat, lng))

                if (polylineRef.current) {
                    try { 
                        map.removeLayer(polylineRef.current); 
                    } catch (error) {
                        // ✅ FIX-009: Логируем ошибки удаления слоя
                        if (__DEV__) {
                            const { devWarn } = require('@/src/utils/logger');
                            devWarn('Error removing polyline layer:', error);
                        }
                    }
                    polylineRef.current = null
                }
                const line = L.polyline(latlngs, { color: '#3388ff', weight: 5, opacity: 0.85 })
                line.addTo(map)
                polylineRef.current = line

                // расстояние
                if (typeof result.distance === 'number') {
                    setRouteDistance(result.distance)
                } else {
                    const dist = latlngs.reduce((acc: number, cur: any, i: number, arr: any[]) => {
                        if (i === 0) return 0
                        return acc + arr[i - 1].distanceTo(cur)
                    }, 0)
                    setRouteDistance(dist)
                }

                // ✅ ИСПРАВЛЕНИЕ: Убираем автоматический зум при построении маршрута
                // Пользователь сам контролирует масштаб карты при клике на старт/финиш
                // map.fitBounds(line.getBounds().pad(0.2))
                ;(window as any).disableFitBounds = false
            } catch (e: any) {
                if (e?.name === 'AbortError' || !isMounted) return
                setErrors((prev: any) => ({ ...prev, routing: e?.message || true }))
                // если ORS с ключом упал — пробуем OSRM разово
                if (ORS_API_KEY && isMounted) {
                    try {
                        const result = await fetchOSRM()
                        if (!isMounted) return;
                        setFullRouteCoords(result.coordsLngLat)
                        const latlngs = result.coordsLngLat.map(([lng, lat]) => L.latLng(lat, lng))
                        if (polylineRef.current) {
                            try {
                                map.removeLayer(polylineRef.current)
                            } catch (error) {
                                console.warn('Failed to remove existing routing layer', error)
                            }
                            polylineRef.current = null
                        }
                        const line = L.polyline(latlngs, { color: '#3388ff', weight: 5, opacity: 0.85 })
                        line.addTo(map)
                        polylineRef.current = line
                        if (typeof result.distance === 'number') setRouteDistance(result.distance)
                        else setRouteDistance(0)
                        // ✅ ИСПРАВЛЕНИЕ: Убираем автоматический зум при построении маршрута
                        // if (!(window as any).disableFitBounds && !avoidAutoFit) map.fitBounds(line.getBounds().pad(0.2))
                        ;(window as any).disableFitBounds = false
                        setErrors((prev: any) => ({ ...prev, routing: false }))
                    } catch (error) {
                        // ✅ FIX-009: Логируем ошибки fallback маршрутизации
                        if (__DEV__) {
                            const { devError } = require('@/src/utils/logger');
                            devError('Error in OSRM fallback routing:', error);
                        }
                    }
                }
            } finally {
                if (isMounted) {
                    setRoutingLoading(false)
                }
            }
        }

        run()

        return () => {
            // ✅ FIX-006: Устанавливаем флаг размонтирования
            isMounted = false;
            if (abortRef.current) {
                abortRef.current.abort()
                abortRef.current = null
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, transportMode, ORS_API_KEY, JSON.stringify(routePoints)])

    // cleanup полилинии при размонтировании
    useEffect(() => {
        const L = (window as any).L
        return () => {
            if (!map || !L) return
            if (polylineRef.current) {
                try {
                    map.removeLayer(polylineRef.current)
                } catch (error) {
                    console.warn('Failed to remove routing layer during cleanup', error)
                }
                polylineRef.current = null
            }
        }
    }, [map])

    return null
}

export default RoutingMachine
