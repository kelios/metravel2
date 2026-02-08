// utils/routingHelpers.ts
// Чистые утилиты для маршрутизации, извлечённые из components/MapPage/useRouting.ts.
// Независимо тестируемы, без React-зависимостей.

// ===================== Типы =====================

export interface RouteResult {
    coords: [number, number][]
    distance: number
    duration: number
    isOptimal: boolean
}

// ===================== Профили провайдеров =====================

export const getORSProfile = (mode: 'car' | 'bike' | 'foot') => {
    switch (mode) {
        case 'bike': return 'cycling-regular'
        case 'foot': return 'foot-walking'
        default: return 'driving-car'
    }
}

export const getOSRMProfile = (mode: 'car' | 'bike' | 'foot') => {
    // Публичный OSRM сервер (router.project-osrm.org) поддерживает только 'driving'
    // Для bike/foot нужен ORS или GraphHopper
    switch (mode) {
        case 'bike': return 'cycling'  // Не поддерживается публичным OSRM
        case 'foot': return 'walking'  // Не поддерживается публичным OSRM
        default: return 'driving'
    }
}

export const getValhallaCosting = (mode: 'car' | 'bike' | 'foot') => {
    return mode === 'bike' ? 'bicycle' : mode === 'foot' ? 'pedestrian' : 'auto'
}

// ===================== Геометрия =====================

/** Расстояние между двумя точками [lng, lat] в метрах (формула Haversine) */
export const haversineMeters = (a: [number, number], b: [number, number]): number => {
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

/** Оценка длительности поездки в секундах по расстоянию и режиму */
export const estimateDurationSeconds = (meters: number, mode: 'car' | 'bike' | 'foot'): number => {
    const speedsKmh = { car: 60, bike: 20, foot: 5 }
    const speed = speedsKmh[mode] ?? 60
    if (!Number.isFinite(meters) || meters <= 0) return 0
    const hours = (meters / 1000) / speed
    const seconds = Math.round(hours * 3600)
    return Number.isFinite(seconds) ? seconds : 0
}

// ===================== Валидация =====================

/** Проверяет массив координат [lng, lat] на валидность */
export const validateRoutePoints = (points: [number, number][]): void => {
    if (!Array.isArray(points) || points.length < 2) {
        throw new Error('Недостаточно точек для построения маршрута')
    }

    for (const [lng, lat] of points) {
        if (
            !Number.isFinite(lng) || !Number.isFinite(lat) ||
            lng < -180 || lng > 180 || lat < -90 || lat > 90
        ) {
            throw new Error('Некорректные координаты маршрута')
        }
    }
}

/** Фильтрует невалидные координаты из массива */
export const filterValidCoords = (coords: [number, number][]): [number, number][] => {
    return coords.filter(([lng, lat]) =>
        Number.isFinite(lng) &&
        Number.isFinite(lat) &&
        lng >= -180 && lng <= 180 &&
        lat >= -90 && lat <= 90
    )
}

// ===================== Геометрия маршрута =====================

/**
 * Привязывает начало/конец полилинии к выбранным маркерам,
 * если routing-провайдер сместил endpoints к дорожному графу.
 */
export const ensureAnchoredGeometry = (
    points: [number, number][],
    coords: [number, number][]
): [number, number][] => {
    if (!Array.isArray(points) || points.length < 2) return coords
    if (!Array.isArray(coords) || coords.length < 2) return coords

    const start = points[0]
    const end = points[points.length - 1]
    const first = coords[0]
    const last = coords[coords.length - 1]

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
}

// ===================== Декодирование =====================

/** Декодирует Valhalla polyline6 (precision 6) в массив [lng, lat] */
export const decodePolyline6 = (encoded: string): [number, number][] => {
    const coords: [number, number][] = []
    let index = 0, lat = 0, lng = 0

    while (index < encoded.length) {
        let shift = 0, result = 0, byte: number
        do {
            byte = encoded.charCodeAt(index++) - 63
            result |= (byte & 0x1f) << shift
            shift += 5
        } while (byte >= 0x20)
        lat += (result & 1) ? ~(result >> 1) : (result >> 1)

        shift = 0
        result = 0
        do {
            byte = encoded.charCodeAt(index++) - 63
            result |= (byte & 0x1f) << shift
            shift += 5
        } while (byte >= 0x20)
        lng += (result & 1) ? ~(result >> 1) : (result >> 1)

        coords.push([lng / 1e6, lat / 1e6])
    }
    return coords
}

// ===================== Retry =====================

/** Retry с exponential backoff. Не ретраит постоянные ошибки (400, 401, 403, 404, 429). */
export const fetchWithRetry = async <T,>(
    fetchFn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<T> => {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fetchFn()
        } catch (error: any) {
            lastError = error

            // Не ретраим 400, 401, 403, 404 - это постоянные ошибки
            const isPermanentError =
                error.message?.includes('400') ||
                error.message?.includes('401') ||
                error.message?.includes('403') ||
                error.message?.includes('404') ||
                error.message?.includes('429') ||
                error.message?.includes('лимит') ||
                error.message?.includes('Некорректные координаты') ||
                error.message?.includes('Неверный API ключ')

            if (isPermanentError) {
                throw error
            }

            // Последняя попытка - выбрасываем ошибку
            if (attempt === maxRetries - 1) {
                break
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = initialDelay * Math.pow(2, attempt)
            // Retry with exponential backoff

            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }

    throw lastError || new Error('Fetch failed after retries')
}

// ===================== ORS helpers =====================

/** Парсит ошибку ORS из текста ответа */
export const parseOrsError = (raw: string): { code?: number; message?: string } => {
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

/** Извлекает индекс проблемной координаты из сообщения об ошибке ORS */
export const extractFailingIndex = (message?: string): number | null => {
    if (!message) return null
    const m = message.match(/coordinate\s+(\d+)/i)
    if (!m) return null
    const idx = Number(m[1])
    return Number.isFinite(idx) ? idx : null
}

/** Строит массив radiuses для ORS, увеличивая радиус для проблемной координаты */
export const buildRadiuses = (radius: number, len: number, idx: number | null): number[] => {
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

/** Порог предупреждения о сильном смещении endpoint'ов (метры) */
export const WARN_ENDPOINT_SNAP_METERS = 2000

/** Радиусы для последовательных попыток ORS snap */
export const ORS_RADIUSES_TO_TRY: Array<number | undefined> = [undefined, 800, 1200, 2000]
