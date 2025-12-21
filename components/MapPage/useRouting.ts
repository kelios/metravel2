import { useState, useEffect, useRef, useCallback } from 'react'
import { routeCache } from '@/src/utils/routeCache'

interface RouteResult {
    coords: [number, number][]
    distance: number
    isOptimal: boolean
}

interface RoutingState {
    loading: boolean
    error: string | boolean
    distance: number
    coords: [number, number][]
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

export const useRouting = (
    routePoints: [number, number][],
    transportMode: 'car' | 'bike' | 'foot',
    ORS_API_KEY: string | undefined
) => {
    const [state, setState] = useState<RoutingState>({
        loading: false,
        error: false,
        distance: 0,
        coords: [],
    })

    const abortRef = useRef<AbortController | null>(null)
    const lastRouteKeyRef = useRef<string | null>(null)
    const isProcessingRef = useRef(false)

    const hasTwoPoints = Array.isArray(routePoints) && routePoints.length >= 2
    const routeKey = hasTwoPoints 
        ? `${transportMode}-${routePoints.map(p => p.join(',')).join('|')}`
        : null

    const fetchORS = useCallback(async (
        points: [number, number][],
        mode: 'car' | 'bike' | 'foot',
        signal: AbortSignal
    ): Promise<RouteResult> => {
        // ORS API expects coordinates in [lng, lat] format
        const coordinates = points.map(([lng, lat]) => [lng, lat])
        
        const res = await fetch(
            `https://api.openrouteservice.org/v2/directions/${getORSProfile(mode)}/geojson`,
            {
                method: 'POST',
                headers: {
                    Authorization: String(ORS_API_KEY),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ coordinates }),
                signal,
            }
        )
        
        if (!res.ok) {
            const errorText = await res.text().catch(() => '')
            if (res.status === 429) throw new Error('Превышен лимит запросов. Подождите немного.')
            if (res.status === 403) throw new Error('Неверный API ключ или доступ запрещен.')
            if (res.status === 400) throw new Error('Некорректные координаты маршрута.')
            throw new Error(`Ошибка ORS: ${res.status}${errorText ? ` - ${errorText}` : ''}`)
        }
        
        const data = await res.json()
        const feature = data.features?.[0]
        const geometry = feature?.geometry
        const summary = feature?.properties?.summary
        
        if (!geometry?.coordinates?.length) throw new Error('Пустой маршрут от ORS')
        
        return {
            coords: geometry.coordinates as [number, number][],
            distance: summary?.distance || 0,
            isOptimal: true,
        }
    }, [ORS_API_KEY])

    const fetchOSRM = useCallback(async (
        points: [number, number][],
        mode: 'car' | 'bike' | 'foot',
        signal: AbortSignal
    ): Promise<RouteResult> => {
        const profile = getOSRMProfile(mode)
        // OSRM expects coordinates in lng,lat format
        const coordsStr = points.map(([lng, lat]) => `${lng},${lat}`).join(';')
        const url = `https://router.project-osrm.org/route/v1/${profile}/${coordsStr}?overview=full&geometries=geojson`
        
        const res = await fetch(url, { signal })
        
        if (!res.ok) {
            const errorText = await res.text().catch(() => '')
            if (res.status === 429) throw new Error('Превышен лимит запросов. Подождите немного.')
            if (res.status === 400) throw new Error('Некорректные координаты маршрута.')
            throw new Error(`Ошибка OSRM: ${res.status}${errorText ? ` - ${errorText}` : ''}`)
        }
        
        const data = await res.json()
        const route = data.routes?.[0]
        
        if (!route?.geometry?.coordinates?.length) throw new Error('Пустой маршрут от OSRM')
        
        return {
            coords: route.geometry.coordinates as [number, number][],
            distance: route.distance || 0,
            isOptimal: true,
        }
    }, [])

    const calculateDirectDistance = useCallback((points: [number, number][]): number => {
        if (typeof window === 'undefined' || !(window as any).L) return 0
        
        const L = (window as any).L
        let totalDistance = 0
        
        for (let i = 1; i < points.length; i++) {
            const [lng1, lat1] = points[i - 1]
            const [lng2, lat2] = points[i]
            const point1 = L.latLng(lat1, lng1)
            const point2 = L.latLng(lat2, lng2)
            totalDistance += point1.distanceTo(point2)
        }
        
        return totalDistance
    }, [])

    useEffect(() => {
        if (!hasTwoPoints || !routeKey) {
            setState({
                loading: false,
                error: false,
                distance: 0,
                coords: [],
            })
            lastRouteKeyRef.current = null
            isProcessingRef.current = false
            return
        }

        // Skip if already processing this exact route
        if (lastRouteKeyRef.current === routeKey) {
            return
        }

        // Check cache first
        const cachedRoute = routeCache.get(routePoints, transportMode)
        if (cachedRoute) {
            setState({
                loading: false,
                error: false,
                distance: cachedRoute.distance,
                coords: cachedRoute.coords,
            })
            lastRouteKeyRef.current = routeKey
            isProcessingRef.current = false
            return
        }

        // Check rate limit
        if (!routeCache.canMakeRequest()) {
            const waitTime = routeCache.getTimeUntilNextRequest()
            setState(prev => ({
                ...prev,
                error: `Слишком много запросов. Подождите ${Math.ceil(waitTime / 1000)}с`,
            }))
            return
        }

        // Abort previous request
        if (abortRef.current) {
            abortRef.current.abort()
            isProcessingRef.current = false
        }

        const abortController = new AbortController()
        abortRef.current = abortController
        isProcessingRef.current = true
        lastRouteKeyRef.current = routeKey

        const fetchRoute = async () => {
            try {
                setState(prev => ({ ...prev, loading: true, error: false }))
                routeCache.recordRequest()

                let result: RouteResult

                try {
                    result = ORS_API_KEY 
                        ? await fetchORS(routePoints, transportMode, abortController.signal)
                        : await fetchOSRM(routePoints, transportMode, abortController.signal)
                } catch (primaryError: any) {
                    if (primaryError?.name === 'AbortError') throw primaryError

                    // Try fallback
                    if (ORS_API_KEY) {
                        try {
                            result = await fetchOSRM(routePoints, transportMode, abortController.signal)
                        } catch (fallbackError: any) {
                            if (fallbackError?.name === 'AbortError') throw fallbackError
                            
                            // Use direct line as last resort
                            const distance = calculateDirectDistance(routePoints)
                            result = {
                                coords: routePoints,
                                distance,
                                isOptimal: false,
                            }
                            
                            setState({
                                loading: false,
                                error: 'Используется прямая линия (сервисы маршрутизации недоступны)',
                                distance,
                                coords: routePoints,
                            })
                            isProcessingRef.current = false
                            return
                        }
                    } else {
                        throw primaryError
                    }
                }

                // Cache successful result
                routeCache.set(routePoints, transportMode, result.coords, result.distance)

                setState({
                    loading: false,
                    error: false,
                    distance: result.distance,
                    coords: result.coords,
                })
            } catch (error: any) {
                if (error?.name === 'AbortError') return

                const distance = calculateDirectDistance(routePoints)
                const errorMessage = error?.message || 'Не удалось построить маршрут'
                setState({
                    loading: false,
                    error: errorMessage,
                    distance,
                    coords: routePoints,
                })
            } finally {
                isProcessingRef.current = false
            }
        }

        fetchRoute()

        return () => {
            abortController.abort()
        }
    }, [routeKey, hasTwoPoints, routePoints, transportMode, ORS_API_KEY, fetchORS, fetchOSRM, calculateDirectDistance])

    return state
}
