import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { routeCache } from '@/utils/routeCache'
import {
    type RouteResult,
    getORSProfile,
    getOSRMProfile,
    getValhallaCosting,
    haversineMeters,
    estimateDurationSeconds,
    validateRoutePoints,
    filterValidCoords,
    ensureAnchoredGeometry,
    decodePolyline6,
    fetchWithRetry,
    parseOrsError,
    extractFailingIndex,
    buildRadiuses,
    WARN_ENDPOINT_SNAP_METERS,
    ORS_RADIUSES_TO_TRY,
} from '@/utils/routingHelpers'

// Глобальный кеш успешно/аварийно обработанных routeKey, чтобы избегать повторных запросов в сессию
const resolvedRouteKeys = new Set<string>()

// Helper for tests to reset memoized route keys
export const clearResolvedRouteKeys = () => resolvedRouteKeys.clear()

interface RoutingState {
    loading: boolean
    error: string | boolean
    distance: number
    duration: number
    coords: [number, number][]
}


export const useRouting = (
    routePoints: [number, number][],
    transportMode: 'car' | 'bike' | 'foot',
    ORS_API_KEY: string | undefined
) => {
    const isTestEnv = typeof process !== 'undefined' && (process.env as any)?.NODE_ENV === 'test'
    const [state, setState] = useState<RoutingState>({
        loading: false,
        error: false,
        distance: 0,
        duration: 0,
        coords: [],
    })

    const abortRef = useRef<AbortController | null>(null)
    const lastRouteKeyRef = useRef<string | null>(null)
    const isProcessingRef = useRef(false)
    const rateLimitKeyRef = useRef<string | null>(null)
    const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const resetDoneRef = useRef(false)
    const activeRequestIdRef = useRef(0)
    // ✅ ИСПРАВЛЕНИЕ: Храним routePoints в ref чтобы избежать бесконечных ререндеров
    const routePointsRef = useRef<[number, number][]>(routePoints)
    
    // Обновляем ref только при реальном изменении координат
    const routePointsKey = useMemo(() => {
        if (!Array.isArray(routePoints) || routePoints.length < 2) return null
        return routePoints.map(p => p.join(',')).join('|')
    }, [routePoints])
    
    useEffect(() => {
        routePointsRef.current = routePoints
    }, [routePoints, routePointsKey]) // routePointsKey ensures semantic change; include routePoints to satisfy hooks lint

    const hasTwoPoints = Array.isArray(routePoints) && routePoints.length >= 2
    const routeKey = hasTwoPoints 
        ? `${transportMode}-${routePointsKey}`
        : null
    const hasTwoPointsRef = useRef(hasTwoPoints)
    useEffect(() => {
        hasTwoPointsRef.current = hasTwoPoints
    }, [hasTwoPoints])

    const forceOsrm = useMemo(() => {
        // В dev можно включить форс-OSRM (в основном для driving), чтобы не зависеть от ORS.
        if (typeof process !== 'undefined') {
            const envFlag = (process.env as any)?.EXPO_PUBLIC_FORCE_OSRM;
            if (envFlag === '1' || envFlag === 'true') return true;
        }
        return false;
    }, []);

    const fetchORS = useCallback(async (
        points: [number, number][],
        mode: 'car' | 'bike' | 'foot',
        signal: AbortSignal
    ): Promise<RouteResult> => {
        validateRoutePoints(points)

        const apiKey = String(ORS_API_KEY ?? '').trim()

        if (!apiKey || apiKey.length < 10) {
            throw new Error('Неверный API ключ или доступ запрещен.');
        }

        let lastError: any = null
        let failingIndex: number | null = null

        for (const radius of ORS_RADIUSES_TO_TRY) {
            try {
                // ✅ УЛУЧШЕНИЕ: Используем retry для устойчивости к временным ошибкам
                return await fetchWithRetry(async () => {
                    // ORS API expects coordinates in [lng, lat] format
                    const coordinates = points.map(([lng, lat]) => [lng, lat])
                    const body: any = { coordinates }
                    if (typeof radius === 'number') {
                        body.radiuses = buildRadiuses(radius, coordinates.length, failingIndex)
                    }

                    const res = await fetch(
                        `https://api.openrouteservice.org/v2/directions/${getORSProfile(mode)}/geojson`,
                        {
                            method: 'POST',
                            headers: {
                                Authorization: apiKey,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(body),
                            signal,
                        }
                    )

                    if (!res.ok) {
                        const errorText = await res.text().catch(() => '')
                        const { code: orsCode, message: orsMessage } = parseOrsError(errorText)

                        if (res.status === 429) throw new Error('Превышен лимит запросов. Подождите немного.')
                        if (res.status === 403) throw new Error('Неверный API ключ или доступ запрещен.')
                        if (res.status === 400) throw new Error('Некорректные координаты маршрута.')

                        const err: any = new Error(
                            `Ошибка ORS: ${res.status}${errorText ? ` - ${errorText}` : ''}`
                        )
                        err.httpStatus = res.status
                        err.responseText = errorText
                        err.orsCode = orsCode
                        err.orsMessage = orsMessage
                        throw err
                    }

                    const data = await res.json()
                    const feature = data.features?.[0]
                    const geometry = feature?.geometry
                    const summary = feature?.properties?.summary

                    if (!geometry?.coordinates?.length) throw new Error('Пустой маршрут от ORS')

                    {
                        const first = geometry.coordinates?.[0] as any
                        const last = geometry.coordinates?.[geometry.coordinates.length - 1] as any
                        const start = points[0]
                        const end = points[points.length - 1]
                        if (
                            Array.isArray(first) &&
                            Array.isArray(last) &&
                            first.length === 2 &&
                            last.length === 2 &&
                            Array.isArray(start) &&
                            Array.isArray(end)
                        ) {
                            const startSnap = haversineMeters(start, [Number(first[0]), Number(first[1])])
                            const endSnap = haversineMeters(end, [Number(last[0]), Number(last[1])])
                            if (startSnap > WARN_ENDPOINT_SNAP_METERS || endSnap > WARN_ENDPOINT_SNAP_METERS) {
                                console.warn('[useRouting] ORS сильно сместил точки к дороге:', {
                                    startSnapM: Math.round(startSnap),
                                    endSnapM: Math.round(endSnap),
                                })
                            }
                        }
                    }

                    return {
                        coords: geometry.coordinates as [number, number][],
                        distance: summary?.distance || 0,
                        duration: summary?.duration || 0,
                        isOptimal: true,
                    }
                }, 3, 1000) // 3 попытки с начальной задержкой 1с
            } catch (e: any) {
                lastError = e
                const orsCode = e?.orsCode
                const maybeIndex = extractFailingIndex(String(e?.orsMessage || e?.responseText || e?.message || ''))
                if (typeof maybeIndex === 'number') failingIndex = maybeIndex
                if (orsCode === 2010 && radius !== ORS_RADIUSES_TO_TRY[ORS_RADIUSES_TO_TRY.length - 1]) {
                    continue
                }
                throw e
            }
        }

        throw lastError || new Error('Ошибка ORS')
    }, [ORS_API_KEY])

    const fetchOSRM = useCallback(async (
        points: [number, number][],
        mode: 'car' | 'bike' | 'foot',
        signal: AbortSignal
    ): Promise<RouteResult> => {
        validateRoutePoints(points)

        const profile = getOSRMProfile(mode)
        // В dev можно замокать OSRM, чтобы не зависеть от сети/CORS (только при явном флаге)
        const mockOsrm =
            typeof process !== 'undefined' &&
            !isTestEnv &&
            (
                (process.env as any)?.EXPO_PUBLIC_OSRM_MOCK === '1' ||
                (process.env as any)?.EXPO_PUBLIC_OSRM_MOCK === 'true'
            )

        if (mockOsrm) {
            // Прямая линия через все точки (lng,lat)
            const coords = points.map(([lng, lat]) => [lng, lat] as [number, number])
            let distance = 0
            for (let i = 1; i < coords.length; i++) {
                distance += haversineMeters(coords[i - 1], coords[i])
            }
            // Кэшируем мок, чтобы повторные вызовы не давали новые ссылки массива
            routeCache.set(points, transportMode, coords, distance, estimateDurationSeconds(distance, mode))
            if (routeKey) resolvedRouteKeys.add(routeKey)
            return {
                coords,
                distance,
                duration: estimateDurationSeconds(distance, mode),
                isOptimal: true,
            }
        }

        // ✅ БЕЗОПАСНОСТЬ: Санитизация координат для URL (защита от инъекций)
        const coordsStr = points
            .map(([lng, lat]) => `${Number(lng).toFixed(6)},${Number(lat).toFixed(6)}`)
            .join(';')

        // ✅ БЕЗОПАСНОСТЬ: Валидация профиля (только разрешенные значения)
        // getOSRMProfile returns OSRM service profile names.
        const allowedProfiles = ['driving', 'walking', 'cycling'];
        if (!allowedProfiles.includes(profile)) {
            throw new Error('Некорректный профиль транспорта');
        }

        const url = `https://router.project-osrm.org/route/v1/${profile}/${coordsStr}?overview=full&geometries=geojson`
        
        let res: Response
        try {
            res = await fetch(url, { signal })
        } catch (e: any) {
            throw new Error(e?.message || 'OSRM недоступен (network)')
        }
        
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
            duration: route.duration || 0,
            isOptimal: true,
        }
    }, [isTestEnv, routeKey, transportMode])

    // Бесплатный routing через Valhalla (Mapzen/Mapbox альтернатива)
    // Используем публичный инстанс valhalla.openstreetmap.de
    const fetchValhalla = useCallback(async (
        points: [number, number][],
        mode: 'car' | 'bike' | 'foot',
        signal: AbortSignal
    ): Promise<RouteResult> => {
        validateRoutePoints(points)

        const costingMode = getValhallaCosting(mode)
        const locations = points.map(([lng, lat]) => ({ lon: lng, lat }));

        const requestBody = {
            locations,
            costing: costingMode,
            directions_options: { units: 'kilometers' }
        };

        const url = `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(requestBody))}`;

        let res: Response;
        try {
            res = await fetch(url, { signal });
        } catch (e: any) {
            throw new Error(e?.message || 'Valhalla недоступен (network)');
        }

        if (!res.ok) {
            const errorText = await res.text().catch(() => '');
            if (res.status === 429) throw new Error('Превышен лимит запросов. Подождите немного.');
            if (res.status === 400) throw new Error('Некорректные координаты маршрута.');
            throw new Error(`Ошибка Valhalla: ${res.status}${errorText ? ` - ${errorText}` : ''}`);
        }

        const data = await res.json();
        const trip = data.trip;

        if (!trip?.legs?.length) throw new Error('Пустой маршрут от Valhalla');

        // Собираем координаты из всех legs
        const allCoords: [number, number][] = [];
        for (const leg of trip.legs) {
            if (leg.shape) {
                const decoded = decodePolyline6(leg.shape);
                allCoords.push(...filterValidCoords(decoded));
            }
        }

        if (allCoords.length === 0) throw new Error('Пустой маршрут от Valhalla');

        // distance в kilometers, конвертируем в метры
        const distanceKm = trip.summary?.length || 0;
        // time in seconds (Valhalla)
        const duration = Number(trip.summary?.time) || 0;

        return {
            coords: allCoords,
            distance: distanceKm * 1000,
            duration,
            isOptimal: true,
        };
    }, []);

    const calculateDirectDistance = useCallback((points: [number, number][]): number => {
        const validPoints = filterValidCoords(points)
        if (validPoints.length < 2) return 0

        let totalDistance = 0
        for (let i = 1; i < validPoints.length; i++) {
            totalDistance += haversineMeters(validPoints[i - 1], validPoints[i])
        }
        return totalDistance
    }, [])

    const supportsPublicOsrmProfile = useMemo(() => {
        // Теперь поддерживаем все режимы: OSRM для car, Valhalla для bike/foot
        return true
    }, [])

    useEffect(() => {
        // Если точек меньше двух — не строим маршрут
        if (!hasTwoPoints) {
            // Отменяем любой текущий запрос, чтобы не оставлять loading=true
            if (abortRef.current) {
                abortRef.current.abort()
                abortRef.current = null
            }
            setState({
                loading: false,
                error: false,
                distance: 0,
                duration: 0,
                coords: [],
            })
            return
        }
    }, [hasTwoPoints, setState])

    useEffect(() => {
        if (!hasTwoPoints || !routeKey) return

        if (!supportsPublicOsrmProfile) {
            const directDistance = calculateDirectDistance(routePointsRef.current)
            setState({
                loading: false,
                error:
                    'Для пешего/веломаршрута нужен ключ OpenRouteService (EXPO_PUBLIC_ORS_API_KEY или EXPO_PUBLIC_ROUTE_SERVICE_KEY)',
                distance: directDistance,
                duration: estimateDurationSeconds(directDistance, transportMode),
                coords: routePointsRef.current,
            })
            return
        }

        // Сбрасываем флаг только при новом routeKey
        if (lastRouteKeyRef.current !== routeKey) {
            resetDoneRef.current = false
            // При смене routeKey (включая смену транспорта) сбрасываем isProcessing
            isProcessingRef.current = false
        }

        // Проверяем кэш - но только routeCache, не resolvedRouteKeys (для возможности перестроения)
        const cached = routeCache.get(routePointsRef.current, transportMode)
        if (cached && lastRouteKeyRef.current === routeKey) {
            // Используем кэш только если это тот же самый routeKey (не новый запрос)
            setState({
                loading: false,
                error: false,
                distance: cached.distance,
                duration: cached.duration || estimateDurationSeconds(cached.distance, transportMode),
                coords: cached.coords,
            })
            // routeKey уже включает transportMode, поэтому безопасно не перестраивать маршрут повторно.
            return
        }

        // Skip if already processing this exact route
        if (lastRouteKeyRef.current === routeKey && isProcessingRef.current) {
            return
        }

        const currentPoints = routePointsRef.current

        // Debounce + abort previous routing request
        if (abortRef.current) {
            abortRef.current.abort()
        }
        const abortController = new AbortController()
        abortRef.current = abortController

        // Rate limiting (avoid spamming free endpoints)
        if (!isTestEnv && !routeCache.canMakeRequest()) {
            const waitTime = routeCache.getTimeUntilNextRequest()
            if (rateLimitKeyRef.current !== routeKey) {
                rateLimitKeyRef.current = routeKey
                const directDistance = calculateDirectDistance(currentPoints)
                setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: `Слишком много запросов. Подождите ${Math.ceil(waitTime / 1000)}с`,
                    distance: directDistance,
                    duration: estimateDurationSeconds(directDistance, transportMode),
                    coords: currentPoints,
                }))
            }
            return
        }

        // schedule route build
        if (rateLimitTimerRef.current) {
            clearTimeout(rateLimitTimerRef.current)
            rateLimitTimerRef.current = null
        }

        const fetchRoute = async () => {
            const requestId = ++activeRequestIdRef.current
            isProcessingRef.current = true
            lastRouteKeyRef.current = routeKey

            const isStale = () =>
                activeRequestIdRef.current !== requestId ||
                lastRouteKeyRef.current !== routeKey ||
                abortController.signal.aborted

            const commitIfCurrent = (fn: () => void) => {
                if (isStale()) return
                fn()
            }

            try {
                commitIfCurrent(() => {
                    setState((prev) => ({ ...prev, loading: true, error: false }))
                })
                // Record request even if stale-check would skip UI updates; it still counts towards rate limiting.
                routeCache.recordRequest()

                // `EXPO_PUBLIC_FORCE_OSRM` historically existed to force OSRM for driving in dev.
                // For bike/foot the public OSRM profile isn't reliable; if we have an ORS key,
                // prefer ORS regardless of this flag.
                const normalizedApiKey = String(ORS_API_KEY ?? '').trim()
                const shouldUseORS =
                    !!normalizedApiKey && (transportMode !== 'car' || !forceOsrm)

                const isWeb =
                    typeof window !== 'undefined' && typeof document !== 'undefined'

                let lastError: any = null

                const attempt = async (label: string, fn: () => Promise<RouteResult>) => {
                    try {
                        return await fn()
                    } catch (e: any) {
                        lastError = e
                        const msg = e?.message || String(e)
                        console.warn(`[useRouting] ${label} failed, trying fallback...`, msg)
                        return null
                    }
                }

                let result: RouteResult | null = null

                // 1) Primary: ORS if we have a key (best for all transport modes).
                if (shouldUseORS) {
                    result = await attempt('ORS', () =>
                        fetchORS(currentPoints, transportMode, abortController.signal)
                    )
                }

                // 2) Fallback: Valhalla for bike/foot (mode-aware).
                // On web it might fail due to CORS; in that case we still fall back further.
                if (!result && transportMode !== 'car') {
                    result = await attempt('Valhalla', () =>
                        fetchValhalla(currentPoints, transportMode, abortController.signal)
                    )
                }

                // 3) Fallback: OSRM driving (CORS-friendly). Last resort for bike/foot on web.
                if (!result && (transportMode === 'car' || isWeb)) {
                    result = await attempt('OSRM', () =>
                        fetchOSRM(currentPoints, 'car', abortController.signal)
                    )
                }

                if (!result) {
                    throw lastError || new Error('Не удалось построить маршрут')
                }

                // Ensure the polyline visually starts/ends at the selected markers
                // even when the routing provider snaps endpoints to the road graph.
                result = {
                    ...result,
                    coords: ensureAnchoredGeometry(currentPoints, result.coords),
                }

                const duration = result.duration || estimateDurationSeconds(result.distance, transportMode)
                if (isStale()) return

                routeCache.set(currentPoints, transportMode, result.coords, result.distance, duration)
                resolvedRouteKeys.add(routeKey)

                commitIfCurrent(() => {
                    setState({
                        loading: false,
                        error: false,
                        distance: result.distance,
                        duration,
                        coords: result.coords,
                    })
                })
            } catch (primaryError: any) {
                if (primaryError?.name === 'AbortError') return

                // Fallback: direct line
                const directDistance = calculateDirectDistance(currentPoints)
                const duration = estimateDurationSeconds(directDistance, transportMode)
                const msg = primaryError?.message || 'Не удалось построить маршрут'

                console.warn('[useRouting] ⚠️ Route building failed, using direct line:', {
                    error: msg,
                    distance: directDistance,
                    duration,
                    coordsCount: currentPoints?.length,
                    firstCoords: currentPoints?.slice(0, 2),
                })

                commitIfCurrent(() => {
                    setState({
                        loading: false,
                        error: msg,
                        distance: directDistance,
                        duration,
                        coords: currentPoints,
                    })
                })
                if (isStale()) return
                resolvedRouteKeys.add(routeKey)
                routeCache.set(currentPoints, transportMode, currentPoints, directDistance, duration)
            } finally {
                // Prevent older in-flight requests from clearing the "processing" flag for newer ones.
                if (activeRequestIdRef.current === requestId) {
                    isProcessingRef.current = false
                }
            }
        }

        // Slight debounce to coalesce quick successive changes (clicks, swap, etc.)
        rateLimitTimerRef.current = setTimeout(fetchRoute, isTestEnv ? 0 : 80)

        return () => {
            if (rateLimitTimerRef.current) {
                clearTimeout(rateLimitTimerRef.current)
                rateLimitTimerRef.current = null
            }
            try {
                abortController.abort()
            } catch {
                // noop
            }
        }
    }, [hasTwoPoints, routePointsKey, routeKey, transportMode, ORS_API_KEY, calculateDirectDistance, fetchORS, fetchOSRM, fetchValhalla, forceOsrm, isTestEnv, supportsPublicOsrmProfile])

    useEffect(() => {
        return () => {
            if (rateLimitTimerRef.current) {
                clearTimeout(rateLimitTimerRef.current)
                rateLimitTimerRef.current = null
            }
            if (abortRef.current) {
                abortRef.current.abort()
                abortRef.current = null
            }
        }
    }, [])

    return state
}
