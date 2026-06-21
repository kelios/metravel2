// src/api/quests.ts
// API модуль для работы с квестами через бэкенд
import { apiClient, ApiError } from '@/api/client';
import { normalizeMediaUrl } from '@/utils/mediaUrl';

// ===================== ТИПЫ (соответствуют OpenAPI схеме бэкенда) =====================

/** Город квеста (из бэкенда) */
export type ApiQuestCity = {
    id: number;
    name: string | null;
    lat: string; // decimal string from backend
    lng: string;
    country_code?: string | null;
};

/** Финал квеста (из бэкенда) */
export type ApiQuestFinale = {
    text: string;
    video_url: string | null;
    poster_url: string | null;
};

/** Шаг квеста (из бэкенда — JSON поле steps) */
export type ApiQuestStep = {
    id: number | string;
    step_id?: string;
    title: string;
    location: string;
    story: string;
    task: string;
    hint?: string;
    // Новый формат: answer_pattern объект
    answer_pattern?: { type: string; value: string };
    // Старый формат (для обратной совместимости)
    answer_type?: string;
    answer_value?: string;
    lat: number;
    lng: number;
    maps_url: string;
    image_url?: string | null;
    input_type?: 'number' | 'text';
    order?: number;
    is_intro?: boolean;
};

/** Метаданные квеста для каталога */
export type ApiQuestMeta = {
    id: number;
    quest_id: string;
    title: string;
    points: string; // readOnly from backend
    city_id: string; // readOnly
    city_name: string; // readOnly
    country_id?: string | null;
    country_name?: string | null;
    country_code?: string | null;
    lat: string;
    lng: string;
    duration_min: number | null;
    difficulty: 'easy' | 'medium' | 'hard' | '' | null;
    tags: Record<string, unknown> | null;
    pet_friendly: boolean;
    cover_url: string | null;
    rating_avg: number | null;
    rating_count: number;
    user_rating: 1 | 2 | 3 | 4 | 5 | null;
    completions_count: number;
    is_completed_by_me: boolean;
    first_completer: { id: number; name: string; avatar: string | null } | null;
};

/**
 * DEV-only мок прохождений (#363): пока бэк не отдаёт реальные
 * is_completed_by_me/completions_count на проде, в DEV подсовываем
 * детерминированные значения по id квеста, чтобы увидеть визуал бейджа.
 * В прод-сборке (__DEV__===false) выключен.
 */
const QUEST_COMPLETION_MOCK = true;

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
    steps: string; // JSON string — массив ApiQuestStep[]
    finale: ApiQuestFinale;
    intro: string | null; // JSON string — ApiQuestStep | null
    storage_key: string;
    city: ApiQuestCity;
};

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
            normalizedSteps = JSON.stringify(parsedSteps.map((step) => normalizeQuestStep(step as ApiQuestStep)));
        }
    } catch {
        normalizedSteps = bundle.steps;
    }

    try {
        if (typeof bundle.intro === 'string' && bundle.intro.trim()) {
            const parsedIntro = JSON.parse(bundle.intro) as ApiQuestStep;
            normalizedIntro = JSON.stringify(normalizeQuestStep(parsedIntro));
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
        out.push(...(res?.data ?? res?.results ?? []));
        const next = res?.next_page_url ?? res?.next ?? null;
        const match = typeof next === 'string' ? next.match(/[?&]page=(\d+)/) : null;
        if (!match) break;
        page = Number(match[1]);
    }
    return out;
}

/** Получить список всех квестов (метаданные) */
export async function fetchQuestsList(): Promise<ApiQuestMeta[]> {
    const list = await fetchAllPages<ApiQuestMeta>('/quests/');
    return list.map(withQuestMetaDefaults);
}

/** Получить квесты по городу */
export async function fetchQuestsByCity(cityId: number): Promise<ApiQuestBundle> {
    const bundle = await apiClient.get<ApiQuestBundle>(`/quests/by-city/${cityId}/`);
    return normalizeQuestBundle(bundle);
}

/** Получить полный бандл квеста по quest_id (строковый, напр. "minsk-cmok") */
export async function fetchQuestByQuestId(questId: string): Promise<ApiQuestBundle> {
    const bundle = await apiClient.get<ApiQuestBundle>(`/quests/by-quest-id/${questId}/`);
    return normalizeQuestBundle(bundle);
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
