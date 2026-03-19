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
};

/** Полный бандл квеста */
export type ApiQuestBundle = {
    id: number;
    quest_id: string;
    title: string;
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

/** Получить список всех квестов (метаданные) */
export async function fetchQuestsList(): Promise<ApiQuestMeta[]> {
    return apiClient.get<ApiQuestMeta[]>('/quests/');
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
    return apiClient.get<ApiQuestCity[]>('/quests/cities/');
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
