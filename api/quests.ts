// src/api/quests.ts
// API модуль для работы с квестами через бэкенд
import { apiClient, ApiError } from '@/api/client';
import { LONG_TIMEOUT } from '@/api/apiConfig';
import { unwrapList } from '@/api/clientResponse';
import type { TravelMediaGroup, TravelMediaImage } from '@/types/types';
import { normalizeMediaUrl } from '@/utils/mediaUrl';
import { indexMediaImage } from '@/utils/mediaPlaceholderIndex';
import { retry } from '@/utils/retry';
import { isUsableRouteSegment } from '@/utils/routePaths';
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
export type ApiQuestSquareVariants = {
    [name: string]: string | null | undefined;
    square_160?: string | null;
    square_320?: string | null;
};

export type ApiQuestCoverMedia = Omit<TravelMediaImage, 'variants'> & {
    /**
     * Квадратная производная для фиксированной плитки 132×132 (#1542).
     * Поля nullable: до backfill #1587 контракт уже присутствует в API, но
     * значения остаются `null`, поэтому потребитель обязан сохранить fallback.
     */
    src_square?: string | null;
    srcset_square?: string | null;
    sizes_hint_square?: string | null;
    variants?: ApiQuestSquareVariants | null;
};

export type ApiQuestMediaGroup = Omit<TravelMediaGroup, 'cover'> & {
    cover?: ApiQuestCoverMedia | null;
};

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
    /**
     * Медиа-манифест обложки (#1208): отсюда берётся `dominant_color` для заливки
     * полей letterbox. В UI не пробрасывается — прогревает общий индекс, см.
     * `utils/mediaPlaceholderIndex.ts`.
     */
    media?: ApiQuestMediaGroup | null;
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
    // Обложка квеста показывается в `contain`, поэтому её поля тоже должна
    // заливать `dominant_color` из манифеста (#1208). Карточка знает только
    // `cover_url`, поэтому цвет индексируется и под ним.
    const coverMedia = meta?.media?.cover;
    const indexedCoverMedia: TravelMediaImage | null | undefined = coverMedia
        ? {
            ...coverMedia,
            variants: coverMedia.variants
                ? Object.fromEntries(
                    Object.entries(coverMedia.variants).filter(
                        (entry): entry is [string, string] => typeof entry[1] === 'string',
                    ),
                )
                : null,
        }
        : coverMedia;
    indexMediaImage(indexedCoverMedia, [
        meta?.cover_url,
        coverMedia?.src_square,
        coverMedia?.variants?.square_160,
        coverMedia?.variants?.square_320,
    ]);
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
    /** См. `ApiQuestMeta.media`: манифест обложки для индекса заливки (#1208). */
    media?: TravelMediaGroup | null;
} & ApiQuestOptionalRatingSnapshot;

function normalizeQuestStep(step: ApiQuestStep): ApiQuestStep {
    return {
        ...step,
        image_url: step.image_url ? normalizeMediaUrl(step.image_url) : step.image_url,
    };
}

function normalizeQuestBundle(bundle: ApiQuestBundle): ApiQuestBundle {
    indexMediaImage(bundle?.media?.cover, [bundle?.cover_url]);
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
 * Публичные отзывы о квесте (читалка чужих отзывов).
 *
 * КОНТРАКТ ЭНДПОИНТА (реализован; проба 25.08.2026 → `200`):
 *   GET /api/quests/quest{questId}/reviews/
 *     где questId — строковый quest_id (напр. "minsk-cmok").
 *   Публичный (без авторизации), пагинация как у остальных списков
 *   (массив | {data|results, next}).
 *   Элемент ответа — `ApiQuestReview` (см. тип выше).
 *
 * Заглушки здесь быть не должно ни в одном окружении. До #1486 при `404`
 * подставлялся детерминированный мок с выдуманными авторами; он однажды доехал
 * до прода и показал пользователям несуществующие отзывы как настоящие. Пустой
 * ответ и `404` дают честное пустое состояние — читалка пишет «Пока нет отзывов».
 */
export async function fetchQuestReviews(questId: string): Promise<QuestReview[]> {
    try {
        const list = await fetchAllPages<ApiQuestReview>(`/quests/quest${questId}/reviews/`);
        return list.map(adaptQuestReview);
    } catch (err: unknown) {
        // Пусто — это утверждение о квесте, а не о состоянии сети, поэтому в
        // пустой список сваливаются ровно два случая: эндпоинт ответил `404` и
        // запрос отменили (анмаунт, смена экрана — показывать ошибку не за что).
        // Всё остальное поднимается в состояние ошибки читалки, у которой есть
        // «Не удалось загрузить отзывы» с повтором. Проверять статус на
        // истинность здесь нельзя: офлайн приходит как `ApiError(0)`
        // (`api/client.ts:330`), а клиентский таймаут — вообще обычным `Error`
        // с `name = 'TimeoutError'` и без статуса (`utils/fetchWithTimeout.ts`),
        // и оба когда-то читались как «у квеста нет отзывов» (#1486).
        if (err instanceof ApiError && err.status === 404) return [];
        if (err instanceof Error && err.name === 'AbortError') return [];
        throw err;
    }
}

// ===================== API ФУНКЦИИ =====================

type PaginatedEnvelope<T> = {
    data?: T[];
    results?: T[];
    next_page_url?: string | null;
    next?: string | null;
};

/**
 * Списочные эндпоинты отдают по 20 записей на страницу, а `fetchAllPages`
 * дочитывает их до конца: каталог из 139 квестов уходил семью последовательными
 * запросами (~405 КБ) на каждый экран, которому нужен список. Просим максимум,
 * который разрешает пагинация бэкенда (max_page_size = 100, проверено на проде):
 * каталог схлопывается до двух запросов.
 */
const LIST_PAGE_SIZE = 100;

function buildListPageUrl(path: string, page: number): string {
    const separator = path.includes('?') ? '&' : '?';
    const pageParam = page > 1 ? `&page=${page}` : '';
    return `${path}${separator}page_size=${LIST_PAGE_SIZE}${pageParam}`;
}

/** Бэкенд перевёл списочные эндпоинты на пагинацию ({data/results, next}) — разворачиваем конверт и дочитываем все страницы. */
async function fetchAllPages<T>(path: string, maxPages = 20, options?: { signal?: AbortSignal }): Promise<T[]> {
    const out: T[] = [];
    let page = 1;
    for (let i = 0; i < maxPages; i++) {
        const url = buildListPageUrl(path, page);
        const res = options?.signal
            ? await apiClient.get<T[] | PaginatedEnvelope<T>>(url, undefined, { signal: options.signal })
            : await apiClient.get<T[] | PaginatedEnvelope<T>>(url);
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
export async function fetchQuestsList(options?: { signal?: AbortSignal }): Promise<ApiQuestMeta[]> {
    try {
        const list = await fetchAllPages<ApiQuestMeta>('/quests/', 20, options);
        const withDefaults = list.map(withQuestMetaDefaults);
        void writeCachedQuestsList(withDefaults);
        return withDefaults;
    } catch (err) {
        const cached = await readCachedQuestsList();
        if (cached) return cached;
        throw err;
    }
}

/**
 * Первые N квестов каталога ОДНИМ запросом — для промо-блоков, которым нужна
 * пара карточек (главная показывает две). Через полный `fetchQuestsList` такой
 * блок вытягивал весь каталог: 139 квестов и ~405 КБ на страницу, где видно два.
 * Порядок совпадает с первой страницей полного списка.
 *
 * Ответ намеренно НЕ пишется в офлайн-кэш каталога: это срез, и он затёр бы
 * полный список, на который опираются экран квестов и офлайн-режим.
 */
export async function fetchQuestsPreview(
    limit: number,
    options?: { signal?: AbortSignal },
): Promise<ApiQuestMeta[]> {
    try {
        const res = await apiClient.get<ApiQuestMeta[] | PaginatedEnvelope<ApiQuestMeta>>(
            `/quests/?page_size=${limit}`,
            undefined,
            options?.signal ? { signal: options.signal } : undefined,
        );
        const list = Array.isArray(res) ? res : unwrapList<ApiQuestMeta>(res);
        return list.slice(0, limit).map(withQuestMetaDefaults);
    } catch (err) {
        // Офлайн-контракт тот же, что у полного списка: лучше показать кэш
        // каталога, чем пустой промо-блок.
        const cached = await readCachedQuestsList();
        if (cached) return cached.slice(0, limit);
        throw err;
    }
}

/**
 * Компактный каталог для петли возврата (#1484): коллекция города и подбор
 * следующего квеста. От `fetchQuestsList` отличается двумя вещами — `compact=1`
 * (одна ссылка на обложку вместо полного медиа-манифеста) и отсутствием записи
 * в офлайн-кэш: это срез по полям, и он затёр бы полный список каталога.
 *
 * `is_completed_by_me` приходит по текущему пользователю: серверный кэш
 * списка объявлен `Vary: Authorization`, поэтому чужое прохождение не
 * подставится. У гостя флаг всегда `false` — только что закрытый квест
 * докладывает вызывающий (см. `buildQuestCityCollection`).
 */
export async function fetchQuestsCompactCatalog(
    options?: { signal?: AbortSignal },
): Promise<ApiQuestMeta[]> {
    try {
        const list = await fetchAllPages<ApiQuestMeta>('/quests/?compact=1', 20, options);
        return list.map(withQuestMetaDefaults);
    } catch (err) {
        // Офлайн-контракт тот же, что у полного списка: лучше показать кэш
        // каталога, чем спрятать блок следующего шага. Полный кэш исторически
        // общий для устройства, поэтому персональный флаг из него не переносим:
        // иначе после смены аккаунта коллекция показывала чужие прохождения.
        const cached = await readCachedQuestsList();
        if (cached) return cached.map((quest) => ({ ...quest, is_completed_by_me: false }));
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

/**
 * #1185: экран квеста берёт `questId` из сегмента маршрута. Если пользователь
 * пришёл по битой ссылке `/quests/undefined/undefined`, роутер отдаёт строку
 * `"undefined"`, и запрос уходил на `/api/quests/by-quest-id/undefined/` — в
 * проде это подтверждённые 404. Отбиваем такой идентификатор до сети: ошибка
 * сразу, вместо бессмысленного запроса и записи мусора в офлайн-кэш.
 */
function assertUsableQuestId(questId: string, caller: string): void {
    if (isUsableRouteSegment(questId)) return;
    throw new ApiError(400, `${caller}: quest id is missing or invalid`);
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
    assertUsableQuestId(questId, 'fetchQuestByQuestId');
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
        // The catalog commit is the single durable quest-package write. Await
        // its best-effort wrapper so a successful online response cannot race a
        // force-stop before the offline snapshot is committed.
        await writeCachedQuestBundle(questId, normalized);
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

// ---- Прогресс ----

/** Получить все прогрессы текущего пользователя */
export async function fetchAllProgress(): Promise<ApiQuestProgress[]> {
    return apiClient.get<ApiQuestProgress[]>('/quest-progress/');
}

/** Получить или создать прогресс по quest_id */
export async function fetchOrCreateProgress(questId: string): Promise<ApiQuestProgress> {
    assertUsableQuestId(questId, 'fetchOrCreateProgress');
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

// ===================== ТЕЛЕМЕТРИЯ ПОПЫТОК ОТВЕТА (#1275/#1276) =====================

/** Одна попытка ответа. `raw_answer` не отправляется для свободных ответов. */
export type QuestAnswerAttemptPayload = {
    client_attempt_id: string;
    step_id: string;
    verdict: 'accepted' | 'rejected';
    raw_answer?: string;
    answer_length: number;
    attempt_no: number;
    hint_shown: boolean;
    elapsed_ms?: number;
    platform: string;
    locale: string;
    occurred_at: string;
};

export type QuestAnswerAttemptsBulkPayload = {
    quest_id: number;
    session_key: string;
    attempts: QuestAnswerAttemptPayload[];
};

export type QuestAnswerAttemptsBulkResult = {
    accepted: number;
    duplicates: number;
    rejected: number;
};

/**
 * Приём батча попыток ответа. Эндпоинт auth-optional: гостевое прохождение
 * пишется так же, поэтому токен прикладывается, только если он есть.
 * Повтор того же `client_attempt_id` возвращается как `duplicates`, не как 4xx.
 */
export async function sendQuestAnswerAttempts(
    payload: QuestAnswerAttemptsBulkPayload,
): Promise<QuestAnswerAttemptsBulkResult> {
    return apiClient.post<QuestAnswerAttemptsBulkResult>(
        '/quest-answer-attempts/bulk/',
        payload,
    );
}
