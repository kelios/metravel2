import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { routeCache } from '@/src/utils/routeCache'

// Глобальный кеш успешно/аварийно обработанных routeKey, чтобы избегать повторных запросов в сессию
const resolvedRouteKeys = new Set<string>()

// Helper for tests to reset memoized route keys
export const clearResolvedRouteKeys = () => resolvedRouteKeys.clear()

interface RouteResult {
    coords: [number, number][]
    distance: number
    duration: number
    isOptimal: boolean
}

interface RoutingState {
    loading: boolean
    error: string | boolean
    distance: number
    duration: number
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
    // Публичный OSRM сервер (router.project-osrm.org) поддерживает только 'driving'
    // Для bike/foot нужен ORS или GraphHopper
    switch (mode) {
        case 'bike': return 'cycling'  // Не поддерживается публичным OSRM
        case 'foot': return 'walking'  // Не поддерживается публичным OSRM
        default: return 'driving'
    }
}


export const useRouting = (
    routePoints: [number, number][],
    transportMode: 'car' | 'bike' | 'foot',
    ORS_API_KEY: string | undefined
) => {
    const isTestEnv = typeof process !== 'undefined' && (process.env as any)?.NODE_ENV === 'test'
    const debugRouting = useMemo(() => {
        if (isTestEnv) return false
        if (typeof process === 'undefined') return false
        const flag = (process.env as any)?.EXPO_PUBLIC_DEBUG_ROUTING
        return flag === '1' || flag === 'true'
    }, [isTestEnv])
    const [state, setState] = useState<RoutingState>({
        loading: false,
        error: false,
        distance: 0,
        duration: 0,
        coords: [],
    })

    // 🔍 ДИАГНОСТИКА: Логируем входные параметры
    useEffect(() => {
        console.info('[useRouting] Hook called with:', {
            routePointsCount: routePoints?.length,
            routePoints: routePoints?.slice(0, 2),
            transportMode,
            hasORS_API_KEY: !!ORS_API_KEY,
        })
    }, [routePoints, transportMode, ORS_API_KEY])

    const estimateDurationSeconds = useCallback((meters: number, mode: 'car' | 'bike' | 'foot') => {
        const speedsKmh = { car: 60, bike: 20, foot: 5 }
        const speed = speedsKmh[mode] ?? 60
        if (!Number.isFinite(meters) || meters <= 0) return 0
        const hours = (meters / 1000) / speed
        const seconds = Math.round(hours * 3600)
        return Number.isFinite(seconds) ? seconds : 0
    }, [])

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

    // ✅ УЛУЧШЕНИЕ: Retry с exponential backoff для устойчивости к временным ошибкам
    const fetchWithRetry = useCallback(async <T,>(
        fetchFn: () => Promise<T>,
        maxRetries: number = 3,
        initialDelay: number = 1000
    ): Promise<T> => {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await fetchFn();
            } catch (error: any) {
                lastError = error;

                // Не ретраим 400, 401, 403, 404 - это постоянные ошибки
                const isPermanentError =
                    error.message?.includes('400') ||
                    error.message?.includes('401') ||
                    error.message?.includes('403') ||
                    error.message?.includes('404') ||
                    error.message?.includes('429') ||
                    error.message?.includes('лимит') ||
                    error.message?.includes('Некорректные координаты') ||
                    error.message?.includes('Неверный API ключ');

                if (isPermanentError) {
                    throw error;
                }

                // Последняя попытка - выбрасываем ошибку
                if (attempt === maxRetries - 1) {
                    break;
                }

                // Exponential backoff: 1s, 2s, 4s
                const delay = initialDelay * Math.pow(2, attempt);
                console.info(`[useRouting] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError || new Error('Fetch failed after retries');
    }, []);

    const fetchORS = useCallback(async (
        points: [number, number][],
        mode: 'car' | 'bike' | 'foot',
        signal: AbortSignal
    ): Promise<RouteResult> => {
        // ✅ БЕЗОПАСНОСТЬ: Валидация координат перед отправкой
        if (!Array.isArray(points) || points.length < 2) {
            throw new Error('Недостаточно точек для построения маршрута');
        }

        for (const [lng, lat] of points) {
            if (
                !Number.isFinite(lng) || !Number.isFinite(lat) ||
                lng < -180 || lng > 180 || lat < -90 || lat > 90
            ) {
                throw new Error('Некорректные координаты маршрута');
            }
        }

        const apiKey = String(ORS_API_KEY ?? '').trim()

        // ✅ БЕЗОПАСНОСТЬ: Валидация API ключа
        if (!apiKey || apiKey.length < 10) {
            throw new Error('Неверный API ключ или доступ запрещен.');
        }

        // ✅ УЛУЧШЕНИЕ: Используем retry для устойчивости к временным ошибкам
        const parseOrsError = (raw: string): { code?: number; message?: string } => {
            if (!raw) return {}
            try {
                const parsed = JSON.parse(raw)
                const code = Number(parsed?.error?.code)
                const message = typeof parsed?.error?.message === 'string' ? parsed.error.message : undefined
                return {
                    code: Number.isFinite(code) ? code : undefined,
                    message,
                }
            } catch {
                return {}
            }
        }

        // ORS по умолчанию "снэпает" точки к графу в радиусе 350м; иногда точка может быть дальше (поле/лес/река).
        // В этом случае ORS возвращает 404 с error.code=2010. Тогда пробуем увеличить radiuses.
        const radiusesToTry: Array<number | undefined> = [undefined, 800, 1200, 2000]
        let lastError: any = null
        let failingIndex: number | null = null

        const extractFailingIndex = (message?: string) => {
            if (!message) return null
            const m = message.match(/coordinate\s+(\d+)/i)
            if (!m) return null
            const idx = Number(m[1])
            return Number.isFinite(idx) ? idx : null
        }

        const buildRadiuses = (radius: number, len: number, idx: number | null) => {
            const base = 350
            const arr = new Array(len).fill(base)
            if (typeof idx === 'number' && idx >= 0 && idx < len) {
                arr[idx] = radius
            } else {
                // Fallback: bump endpoints (usually start/end are the only meaningful snap points).
                arr[0] = radius
                arr[len - 1] = radius
            }
            return arr
        }

        const haversineMeters = (a: [number, number], b: [number, number]) => {
            const toRad = (deg: number) => (deg * Math.PI) / 180
            const R = 6371000
            const lng1 = a[0], lat1 = a[1]
            const lng2 = b[0], lat2 = b[1]
            const dLat = toRad(lat2 - lat1)
            const dLng = toRad(lng2 - lng1)
            const s1 = Math.sin(dLat / 2)
            const s2 = Math.sin(dLng / 2)
            const aa =
                s1 * s1 +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2
            const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
            return R * c
        }
        // Guardrail: don't accept routes whose snapped endpoints are слишком далеко от выбранных точек.
        // (We don't hard-fail; we log and we'll visually anchor the polyline to the user points later.)
        const WARN_ENDPOINT_SNAP_METERS = 2000

        for (const radius of radiusesToTry) {
            try {
                // ✅ УЛУЧШЕНИЕ: Используем retry для устойчивости к временным ошибкам
                return await fetchWithRetry(async () => {
                    // ORS API expects coordinates in [lng, lat] format
                    const coordinates = points.map(([lng, lat]) => [lng, lat])
                    const body: any = { coordinates }
                    if (typeof radius === 'number') {
                        body.radiuses = buildRadiuses(radius, coordinates.length, failingIndex)
                    }

                    if (debugRouting) {
                        console.info('[useRouting] ORS request payload (no key):', {
                            profile: getORSProfile(mode),
                            body,
                        })
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

                    try {
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
                    } catch (e) {
                        // If this throws, treat as ORS failure so we can fallback to Valhalla/OSRM/direct line.
                        throw e
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
                if (orsCode === 2010 && radius !== radiusesToTry[radiusesToTry.length - 1]) {
                    const currentRadius = typeof radius === 'number' ? radius : 350
                    console.info(
                        `[useRouting] ORS: no routable point within ${currentRadius}m (coord idx ${failingIndex ?? 'unknown'}), retrying with larger radius...`
                    )
                    continue
                }
                throw e
            }
        }

        throw lastError || new Error('Ошибка ORS')
    }, [ORS_API_KEY, debugRouting, fetchWithRetry])

    const fetchOSRM = useCallback(async (
        points: [number, number][],
        mode: 'car' | 'bike' | 'foot',
        signal: AbortSignal
    ): Promise<RouteResult> => {
        // ✅ БЕЗОПАСНОСТЬ: Валидация координат перед отправкой
        if (!Array.isArray(points) || points.length < 2) {
            throw new Error('Недостаточно точек для построения маршрута');
        }

        for (const [lng, lat] of points) {
            if (
                !Number.isFinite(lng) || !Number.isFinite(lat) ||
                lng < -180 || lng > 180 || lat < -90 || lat > 90
            ) {
                throw new Error('Некорректные координаты маршрута');
            }
        }

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
            const distance = (() => {
                const toRad = (deg: number) => (deg * Math.PI) / 180
                let total = 0
                for (let i = 1; i < coords.length; i++) {
                    const [lng1, lat1] = coords[i - 1]
                    const [lng2, lat2] = coords[i]
                    const R = 6371000
                    const dLat = toRad(lat2 - lat1)
                    const dLng = toRad(lng2 - lng1)
                    const a =
                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
                    total += R * c
                }
                return total
            })()
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
    }, [estimateDurationSeconds, isTestEnv, routeKey, transportMode])

    // Бесплатный routing через Valhalla (Mapzen/Mapbox альтернатива)
    // Используем публичный инстанс valhalla.openstreetmap.de
    const fetchValhalla = useCallback(async (
        points: [number, number][],
        mode: 'car' | 'bike' | 'foot',
        signal: AbortSignal
    ): Promise<RouteResult> => {
        // Валидация координат
        if (!Array.isArray(points) || points.length < 2) {
            throw new Error('Недостаточно точек для построения маршрута');
        }

        for (const [lng, lat] of points) {
            if (
                !Number.isFinite(lng) || !Number.isFinite(lat) ||
                lng < -180 || lng > 180 || lat < -90 || lat > 90
            ) {
                throw new Error('Некорректные координаты маршрута');
            }
        }

        // Valhalla costing modes
        const costingMode = mode === 'bike' ? 'bicycle' : mode === 'foot' ? 'pedestrian' : 'auto';

        // Формируем locations для Valhalla
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

        // Декодируем polyline6 (Valhalla использует precision 6)
        const decodePolyline6 = (encoded: string): [number, number][] => {
            const coords: [number, number][] = [];
            let index = 0, lat = 0, lng = 0;

            while (index < encoded.length) {
                let shift = 0, result = 0, byte: number;
                do {
                    byte = encoded.charCodeAt(index++) - 63;
                    result |= (byte & 0x1f) << shift;
                    shift += 5;
                } while (byte >= 0x20);
                lat += (result & 1) ? ~(result >> 1) : (result >> 1);

                shift = 0;
                result = 0;
                do {
                    byte = encoded.charCodeAt(index++) - 63;
                    result |= (byte & 0x1f) << shift;
                    shift += 5;
                } while (byte >= 0x20);
                lng += (result & 1) ? ~(result >> 1) : (result >> 1);

                coords.push([lng / 1e6, lat / 1e6]);
            }
            return coords;
        };

        // Собираем координаты из всех legs
        const allCoords: [number, number][] = [];
        for (const leg of trip.legs) {
            if (leg.shape) {
                const decoded = decodePolyline6(leg.shape);
                // Фильтруем невалидные координаты
                const validCoords = decoded.filter(([lng, lat]) =>
                    Number.isFinite(lng) &&
                    Number.isFinite(lat) &&
                    lng >= -180 && lng <= 180 &&
                    lat >= -90 && lat <= 90
                );
                allCoords.push(...validCoords);
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
        if (typeof window === 'undefined' || !(window as any).L) return 0
        
        // Фильтруем невалидные координаты
        const validPoints = points.filter(([lng, lat]) =>
            Number.isFinite(lng) &&
            Number.isFinite(lat) &&
            lng >= -180 && lng <= 180 &&
            lat >= -90 && lat <= 90
        )

        if (validPoints.length < 2) return 0

        const L = (window as any).L
        let totalDistance = 0
        
        for (let i = 1; i < validPoints.length; i++) {
            const [lng1, lat1] = validPoints[i - 1]
            const [lng2, lat2] = validPoints[i]
            const point1 = L.latLng(lat1, lng1)
            const point2 = L.latLng(lat2, lng2)
            totalDistance += point1.distanceTo(point2)
        }
        
        return totalDistance
    }, [])

    const ensureAnchoredGeometry = useCallback(
        (points: [number, number][], coords: [number, number][]) => {
            if (!Array.isArray(points) || points.length < 2) return coords
            if (!Array.isArray(coords) || coords.length < 2) return coords

            const start = points[0]
            const end = points[points.length - 1]
            const first = coords[0]
            const last = coords[coords.length - 1]

            const haversineMeters = (a: [number, number], b: [number, number]) => {
                const toRad = (deg: number) => (deg * Math.PI) / 180
                const R = 6371000
                const lng1 = a[0], lat1 = a[1]
                const lng2 = b[0], lat2 = b[1]
                const dLat = toRad(lat2 - lat1)
                const dLng = toRad(lng2 - lng1)
                const s1 = Math.sin(dLat / 2)
                const s2 = Math.sin(dLng / 2)
                const aa =
                    s1 * s1 +
                    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2
                const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
                return R * c
            }

            const out = coords.slice()
            const thresholdM = 25
            try {
                const ds = haversineMeters(start, first)
                if (ds > thresholdM) out.unshift(start)
            } catch {
                // noop
            }
            try {
                const de = haversineMeters(end, last)
                if (de > thresholdM) out.push(end)
            } catch {
                // noop
            }
            return out
        },
        []
    )

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
            console.info('[useRouting] Less than 2 points, resetting state')
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
                error: 'Для пешего/веломаршрута нужен ключ OpenRouteService (EXPO_PUBLIC_ORS_API_KEY)',
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

                console.info('[useRouting] ✅ Route built successfully:', {
                    distance: result.distance,
                    duration,
                    coordsCount: result.coords?.length,
                    firstCoords: result.coords?.slice(0, 2),
                    isOptimal: result.isOptimal,
                })

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
    }, [hasTwoPoints, routePointsKey, routeKey, transportMode, ORS_API_KEY, calculateDirectDistance, estimateDurationSeconds, fetchORS, fetchOSRM, fetchValhalla, forceOsrm, isTestEnv, supportsPublicOsrmProfile])

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

    // 🔍 ДИАГНОСТИКА: Логируем текущее состояние при каждом изменении
    useEffect(() => {
        console.info('[useRouting] State updated:', {
            loading: state.loading,
            hasError: !!state.error,
            error: state.error,
            distance: state.distance,
            duration: state.duration,
            coordsCount: state.coords?.length,
            firstCoords: state.coords?.slice(0, 2),
        })
    }, [state])

    return state
}
