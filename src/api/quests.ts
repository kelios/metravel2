// src/api/quests.ts
// API модуль для работы с квестами через бэкенд
import { apiClient } from '@/src/api/client';

// ===================== ТИПЫ (соответствуют OpenAPI схеме бэкенда) =====================

/** Город квеста (из бэкенда) */
export type ApiQuestCity = {
    id: number;
    name: string | null;
    lat: string; // decimal string from backend
    lng: string;
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
    lat: string;
    lng: string;
    duration_min: number | null;
    difficulty: 'easy' | 'medium' | 'hard' | '' | null;
    tags: Record<string, any> | null;
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
    return apiClient.get<ApiQuestBundle>(`/quests/by-city/${cityId}/`);
}

/** Получить полный бандл квеста по quest_id (строковый, напр. "minsk-cmok") */
export async function fetchQuestByQuestId(questId: string): Promise<ApiQuestBundle> {
    return apiClient.get<ApiQuestBundle>(`/quests/by-quest-id/${questId}/`);
}

/** Получить полный бандл квеста по числовому ID */
export async function fetchQuestById(id: number): Promise<ApiQuestBundle> {
    return apiClient.get<ApiQuestBundle>(`/quests/${id}/`);
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
    return apiClient.get<ApiQuestProgress>(`/quest-progress/quest/${questId}/`);
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
