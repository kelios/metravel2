// src/api/quests.ts
// API модуль для работы с квестами через бэкенд
import { apiClient, ApiError } from '@/api/client';
import { LONG_TIMEOUT } from '@/api/apiConfig';
import { unwrapList } from '@/api/clientResponse';
import { normalizeMediaUrl } from '@/utils/mediaUrl';
import { retry } from '@/utils/retry';
import {
    readCachedQuestBundle,
    writeCachedQuestBundle,
    readCachedQuestsList,
    writeCachedQuestsList,
} from '@/api/questBundleCache';

// ===================== ТИПЫ (соответствуют OpenAPI схеме бэкенда) =====================

type ApiQuestCoordinate = number | string;

export type ApiQuestFirstCompleter = {
    id: number;
    name: string;
    avatar: string | null;
};

type ApiQuestRatingSnapshot = {
    rating_avg: number | null;
    rating_count: number;
    user_rating: 1 | 2 | 3 | 4 | 5 | null;
    completions_count: number;
    is_completed_by_me: boolean;
    first_completer: ApiQuestFirstCompleter | null;
};

type ApiQuestOptionalRatingSnapshot = Partial<ApiQuestRatingSnapshot>;

export type ApiQuestAnswerPattern = {
    type: string;
    value: unknown;
} | string | null;

/** Город квеста (из бэкенда) */
export type ApiQuestCity = {
    id: number;
    name: string | null;
    lat: ApiQuestCoordinate;
    lng: ApiQuestCoordinate;
    country_code?: string | null;
};

/** Финал квеста (из бэкенда) */
export type ApiQuestFinale = {
    text: string;
    video_url: string | null;
    poster_url: string | null;
};

/** Шаг квеста (из бэкенда) */
export type ApiQuestStep = {
    id: number | string;
    step_id?: string | null;
    title: string;
    location: string;
    story: string;
    task: string;
    hint?: string | null;
    answer_pattern?: ApiQuestAnswerPattern;
    // Старый формат (для обратной совместимости)
    answer_type?: string;
    answer_value?: string;
    lat: ApiQuestCoordinate;
    lng: ApiQuestCoordinate;
    geo_verify?: {
        enabled?: boolean;
        radius_m?: number;
    } | null;
    maps_url: string;
    image_url?: string | null;
    input_type?: 'number' | 'text';
    order?: number;
    is_intro?: boolean;
    country_code?: string | null;
    poi_info?: {
        is_museum: boolean;
        opening_hours?: string | null;
        ticket_price?: string | null;
        website?: string | null;
    } | null;
};

/** Метаданные квеста для каталога */
export type ApiQuestMeta = {
    id: number;
    quest_id: string;
    title: string;
    points: number | string; // readOnly from backend
    city_id: string; // readOnly
    city_name: string; // readOnly
    country_id?: string | null;
    country_name?: string | null;
    country_code?: string | null;
    lat: ApiQuestCoordinate;
    lng: ApiQuestCoordinate;
    duration_min: number | null;
    difficulty: 'easy' | 'medium' | 'hard' | '' | null;
    tags: Record<string, unknown> | null;
    pet_friendly: boolean;
    cover_url: string | null;
} & ApiQuestRatingSnapshot;

/**
 * DEV-only мок прохождений (#363): бэк теперь отдаёт реальные
 * is_completed_by_me/completions_count — мок выключен, чтобы в DEV-сборке
 * на устройстве не показывались фейковые «Пройден»/«N прохождения».
 */
const QUEST_COMPLETION_MOCK = false;

function withQuestCompletionMock(meta: ApiQuestMeta): ApiQuestMeta {
    if (!__DEV__ || !QUEST_COMPLETION_MOCK) return meta;
    if (meta.is_completed_by_me || meta.completions_count > 0) return meta;
    return {
        ...meta,
        is_completed_by_me: meta.id % 2 === 0,
        completions_count: (meta.id % 7) + 1,
    };
}

/**
 * Бэкенд может не отдавать поля рейтинга/прохождений (старая схема) —
 * проставляем безопасные дефолты, чтобы UI и адаптеры не падали.
 */
export function withQuestMetaDefaults(meta: ApiQuestMeta): ApiQuestMeta {
    return withQuestCompletionMock({
        ...meta,
        rating_avg: meta.rating_avg ?? null,
        rating_count: meta.rating_count ?? 0,
        user_rating: meta.user_rating ?? null,
        completions_count: meta.completions_count ?? 0,
        is_completed_by_me: meta.is_completed_by_me ?? false,
        first_completer: meta.first_completer ?? null,
    });
}

/** Полный бандл квеста */
export type ApiQuestBundle = {
    id: number;
    quest_id: string;
    title: string;
    cover_url?: string | null;
    steps: ApiQuestStep[] | string;
    finale: ApiQuestFinale;
    intro: ApiQuestStep | string | null;
    storage_key: string;
    city: ApiQuestCity;
} & ApiQuestOptionalRatingSnapshot;

function normalizeQuestStep(step: ApiQuestStep): ApiQuestStep {
    return {
        ...step,
        image_url: step.image_url ? normalizeMediaUrl(step.image_url) : step.image_url,
    };
}

function normalizeQuestBundle(bundle: ApiQuestBundle): ApiQuestBundle {
    let normalizedSteps = bundle.steps;
    let normalizedIntro = bundle.intro;

    try {
        const parsedSteps = typeof bundle.steps === 'string' ? JSON.parse(bundle.steps) : bundle.steps;
        if (Array.isArray(parsedSteps)) {
            normalizedSteps = parsedSteps.map((step) => normalizeQuestStep(step as ApiQuestStep));
        }
    } catch {
        normalizedSteps = bundle.steps;
    }

    try {
        if (typeof bundle.intro === 'string' && bundle.intro.trim()) {
            const parsedIntro = JSON.parse(bundle.intro) as ApiQuestStep;
            normalizedIntro = normalizeQuestStep(parsedIntro);
        } else if (bundle.intro && typeof bundle.intro === 'object') {
            normalizedIntro = normalizeQuestStep(bundle.intro);
        }
    } catch {
        normalizedIntro = bundle.intro;
    }

    return {
        ...bundle,
        cover_url: bundle.cover_url ? normalizeMediaUrl(bundle.cover_url) : bundle.cover_url,
        steps: normalizedSteps,
        intro: normalizedIntro,
        finale: bundle.finale
            ? {
                ...bundle.finale,
                video_url: bundle.finale.video_url ? normalizeMediaUrl(bundle.finale.video_url) : bundle.finale.video_url,
                poster_url: bundle.finale.poster_url ? normalizeMediaUrl(bundle.finale.poster_url) : bundle.finale.poster_url,
            }
            : bundle.finale,
    };
}

/** Прогресс прохождения квеста */
export type ApiQuestProgress = {
    id: number;
    quest: number;
    user: number;
    current_index: number;
    unlocked_index: number;
    answers: Record<string, string>;
    attempts: Record<string, number>;
    hints: Record<string, boolean>;
    show_map: boolean;
    completed: boolean;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};

export type ApiQuestProgressCreate = {
    quest: number;
    current_index?: number;
    unlocked_index?: number;
    answers?: Record<string, string>;
    attempts?: Record<string, number>;
    hints?: Record<string, boolean>;
    show_map?: boolean;
    completed?: boolean;
};

/** Публичный отзыв о квесте (для читалки чужих отзывов) */
export type ApiQuestReview = {
    id: number;
    rating: number;
    liked: string;
    disliked: string;
    author_name: string | null;
    author_avatar: string | null;
    created_at: string | null;
};

/** Отзыв для UI (фронтенд формат) */
export type QuestReview = {
    id: number;
    rating: number;
    liked: string;
    disliked: string;
    authorName: string | null;
    authorAvatar: string | null;
    createdAt: string | null;
};

function adaptQuestReview(raw: ApiQuestReview): QuestReview {
    return {
        id: raw.id,
        rating: Number(raw.rating) || 0,
        liked: raw.liked ?? '',
        disliked: raw.disliked ?? '',
        authorName: raw.author_name ?? null,
        authorAvatar: raw.author_avatar ? normalizeMediaUrl(raw.author_avatar) : null,
        createdAt: raw.created_at ?? null,
    };
}

/**
 * MOCK-FALLBACK (BE-тикет: список публичных отзывов квеста, эндпоинта пока нет).
 *
 * КОНТРАКТ ОЖИДАЕМОГО ЭНДПОИНТА (для BE-тикета — снять мок после реализации):
 *   GET /api/quests/quest{questId}/reviews/
 *     где questId — строковый quest_id (напр. "minsk-cmok").
 *   Публичный (без авторизации), пагинация как у остальных списков
 *   (массив | {data|results, next}).
 *   Элемент ответа (ApiQuestReview):
 *     {
 *       id: number,
 *       rating: number,             // 1..5
 *       liked: string,              // «что понравилось»
 *       disliked: string,          // «что улучшить»
 *       author_name: string|null,  // имя автора (или null если аноним)
 *       author_avatar: string|null,// URL аватара (или null)
 *       created_at: string|null    // ISO-дата
 *     }
 *
 * Детерминированный мок строится по questId, чтобы один и тот же квест всегда
 * показывал один и тот же набор отзывов в DEV/без бэка.
 */
const QUEST_REVIEWS_MOCK: ReadonlyArray<Omit<ApiQuestReview, 'id'>> = [
    {
        rating: 5,
        liked: 'Очень атмосферный маршрут, прошли всей семьёй за пару часов. Загадки в меру сложные, дети были в восторге.',
        disliked: '',
        author_name: 'Анна К.',
        author_avatar: null,
        created_at: '2025-09-14T12:30:00Z',
    },
    {
        rating: 4,
        liked: 'Открыли для себя несколько мест в городе, мимо которых ходили годами. Здорово, что задания привязаны к деталям зданий.',
        disliked: 'Одна точка была закрыта на ремонт — пришлось додумывать ответ. В остальном супер.',
        author_name: 'Дмитрий',
        author_avatar: null,
        created_at: '2025-08-02T18:05:00Z',
    },
    {
        rating: 5,
        liked: 'Идеально для свидания! Финальная история тронула. Спасибо авторам за работу.',
        disliked: '',
        author_name: 'Марина',
        author_avatar: null,
        created_at: '2025-07-21T10:15:00Z',
    },
    {
        rating: 3,
        liked: 'Хорошая идея и приятный сюжет.',
        disliked: 'Несколько подсказок показались слишком очевидными, хотелось бы посложнее.',
        author_name: 'Сергей П.',
        author_avatar: null,
        created_at: '2025-06-30T09:40:00Z',
    },
];

function buildQuestReviewsMock(questId: string): QuestReview[] {
    let seed = 0;
    for (let i = 0; i < questId.length; i++) seed = (seed * 31 + questId.charCodeAt(i)) >>> 0;
    const count = 3 + (seed % 2); // 3 или 4 отзыва
    return QUEST_REVIEWS_MOCK.slice(0, count).map((review, index) =>
        adaptQuestReview({ ...review, id: 10_000 + (seed % 1000) + index }),
    );
}

/**
 * Получить список публичных отзывов о квесте (для читалки).
 * Пытается реальный эндпоинт; при 404 (эндпоинта пока нет) — в DEV отдаёт
 * детерминированный мок для отладки UI, на проде честно возвращает пусто
 * (показывать пользователям выдуманные отзывы как настоящие нельзя).
 */
export async function fetchQuestReviews(questId: string): Promise<QuestReview[]> {
    try {
        const list = await fetchAllPages<ApiQuestReview>(`/quests/quest${questId}/reviews/`);
        return list.map(adaptQuestReview);
    } catch (err: unknown) {
        const status = err instanceof ApiError ? err.status : undefined;
        if (status && status !== 404) throw err;
        return __DEV__ ? buildQuestReviewsMock(questId) : [];
    }
}

// ===================== API ФУНКЦИИ =====================

type PaginatedEnvelope<T> = {
    data?: T[];
    results?: T[];
    next_page_url?: string | null;
    next?: string | null;
};

/** Бэкенд перевёл списочные эндпоинты на пагинацию ({data/results, next}) — разворачиваем конверт и дочитываем все страницы. */
async function fetchAllPages<T>(path: string, maxPages = 20): Promise<T[]> {
    const out: T[] = [];
    let page = 1;
    for (let i = 0; i < maxPages; i++) {
        const url = page === 1 ? path : `${path}${path.includes('?') ? '&' : '?'}page=${page}`;
        const res = await apiClient.get<T[] | PaginatedEnvelope<T>>(url);
        if (Array.isArray(res)) {
            out.push(...res);
            break;
        }
        out.push(...unwrapList<T>(res));
        const next = res?.next_page_url ?? res?.next ?? null;
        const match = typeof next === 'string' ? next.match(/[?&]page=(\d+)/) : null;
        if (!match) break;
        page = Number(match[1]);
    }
    return out;
}

/**
 * Получить список всех квестов (метаданные).
 * При успехе кэширует сырой список в AsyncStorage (fire-and-forget) для офлайна.
 * При сетевом фейле возвращает кэш, если он есть, — иначе пробрасывает ошибку.
 */
export async function fetchQuestsList(): Promise<ApiQuestMeta[]> {
    try {
        const list = await fetchAllPages<ApiQuestMeta>('/quests/');
        const withDefaults = list.map(withQuestMetaDefaults);
        void writeCachedQuestsList(withDefaults);
        return withDefaults;
    } catch (err) {
        const cached = await readCachedQuestsList();
        if (cached) return cached;
        throw err;
    }
}

/** Параметры гео-рекомендаций (город/страна и/или координаты). */
export type NearLocationParams = {
    city?: string | null;
    country?: string | null;
    lat?: number | null;
    lng?: number | null;
    limit?: number | null;
};

/** Элемент ответа /quests/near-location/ (бэкенд считает score/distance). */
export type ApiQuestNearLocation = {
    quest: ApiQuestMeta;
    score: number;
    distance_km: number | null;
};

type NearLocationResponse<T> = {
    results: T[];
    count: number;
};

function buildNearLocationQuery(params: NearLocationParams): string {
    const search = new URLSearchParams();
    const city = params.city?.trim();
    const country = params.country?.trim();
    if (city) search.set('city', city);
    if (country) search.set('country', country);
    if (typeof params.lat === 'number' && Number.isFinite(params.lat)) {
        search.set('lat', String(params.lat));
    }
    if (typeof params.lng === 'number' && Number.isFinite(params.lng)) {
        search.set('lng', String(params.lng));
    }
    if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
        search.set('limit', String(params.limit));
    }
    return search.toString();
}

/**
 * Гео-рекомендации квестов рядом с локацией (score/distance считает бэкенд).
 * Кидает {@link ApiError} со status 404 на старом деплое без эндпоинта —
 * потребитель делает graceful fallback на клиентский расчёт.
 */
export async function fetchQuestsNearLocation(
    params: NearLocationParams,
    options?: { signal?: AbortSignal },
): Promise<ApiQuestNearLocation[]> {
    const query = buildNearLocationQuery(params);
    const res = await apiClient.get<NearLocationResponse<ApiQuestNearLocation>>(
        `/quests/near-location/${query ? `?${query}` : ''}`,
        undefined,
        options,
    );
    return (res?.results ?? []).map((item) => ({
        ...item,
        quest: withQuestMetaDefaults(item.quest),
    }));
}

/** Получить квесты по городу */
export async function fetchQuestsByCity(cityId: number): Promise<ApiQuestBundle> {
    const bundle = await apiClient.get<ApiQuestBundle>(`/quests/by-city/${cityId}/`);
    return normalizeQuestBundle(bundle);
}

/**
 * Получить полный бандл квеста по quest_id (строковый, напр. "minsk-cmok").
 * При успехе кэширует сырой бандл в AsyncStorage (fire-and-forget) для офлайна.
 * При сетевом фейле возвращает кэш, если он есть, — иначе пробрасывает ошибку.
 */
export async function fetchQuestByQuestId(questId: string): Promise<ApiQuestBundle> {
    try {
        const bundle = await retry(
            // Quest bundles include the intro, all steps and finale media. Do not
            // abort a valid cold response at the generic 10 s API deadline.
            () => apiClient.get<ApiQuestBundle>(`/quests/by-quest-id/${questId}/`, LONG_TIMEOUT),
            {
                maxAttempts: 2,
                delay: 300,
                shouldRetry: (error) =>
                    error instanceof ApiError &&
                    (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504),
            },
        );
        const normalized = normalizeQuestBundle(bundle);
        void writeCachedQuestBundle(questId, normalized);
        return normalized;
    } catch (err) {
        const cached = await readCachedQuestBundle(questId);
        if (cached) return cached;
        throw err;
    }
}

/** Получить полный бандл квеста по числовому ID */
export async function fetchQuestById(id: number): Promise<ApiQuestBundle> {
    const bundle = await apiClient.get<ApiQuestBundle>(`/quests/${id}/`);
    return normalizeQuestBundle(bundle);
}

/** Получить список городов с квестами */
export async function fetchQuestCities(): Promise<ApiQuestCity[]> {
    return fetchAllPages<ApiQuestCity>('/quests/cities/');
}

// ---- Прогресс ----

/** Получить все прогрессы текущего пользователя */
export async function fetchAllProgress(): Promise<ApiQuestProgress[]> {
    return apiClient.get<ApiQuestProgress[]>('/quest-progress/');
}

/** Получить или создать прогресс по quest_id */
export async function fetchOrCreateProgress(questId: string): Promise<ApiQuestProgress> {
    try {
        return await apiClient.get<ApiQuestProgress>(`/quest-progress/quest/${questId}/`);
    } catch (err: unknown) {
        // If progress doesn't exist yet (404), create it
        const status = err instanceof ApiError ? err.status : undefined;
        if (status === 404) {
            // Need numeric quest ID for creation — fetch the quest first
            const quest = await apiClient.get<{ id: number }>(`/quests/by-quest-id/${questId}/`);
            return apiClient.post<ApiQuestProgress>('/quest-progress/', {
                quest: quest.id,
            });
        }
        throw err;
    }
}

/** Создать прогресс */
export async function createProgress(data: ApiQuestProgressCreate): Promise<ApiQuestProgress> {
    return apiClient.post<ApiQuestProgress>('/quest-progress/', data);
}

/** Обновить прогресс (PATCH) */
export async function updateProgress(
    id: number,
    data: Partial<ApiQuestProgressCreate>
): Promise<ApiQuestProgress> {
    return apiClient.patch<ApiQuestProgress>(`/quest-progress/${id}/`, data);
}

/** Удалить прогресс */
export async function deleteProgress(id: number): Promise<void> {
    return apiClient.delete<void>(`/quest-progress/${id}/`);
}
