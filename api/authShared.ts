// api/authShared.ts
// Лист-модуль слоя auth: общая форма ответа login-эндпоинтов и её разбор.
// Живёт отдельно от тяжёлого `api/auth.ts` (Alert, AsyncStorage, валидация,
// весь набор эндпоинтов), чтобы модуль отдельного провайдера — `api/appleAuth.ts` —
// не тянул за собой весь auth-файл ради одного парсера. Base URL и таймаут сюда
// НЕ дублируются: их канонический источник — `api/apiConfig.ts`.

/** Общая форма ответа login-эндпоинтов: сессия либо описание ошибки. */
export type SocialAuthResponse = {
    token?: string;
    refresh?: string;
    name?: string;
    email?: string;
    id?: string | number;
    is_superuser?: boolean;
    detail?: string;
    error?: string;
    message?: string;
    non_field_errors?: string[];
    id_token?: string[];
};

/** Сессия, которую сервер возвращает для любого провайдера. */
export type SocialSessionPayload = {
    token: string;
    refresh?: string;
    name: string;
    email: string;
    id: string | number;
    is_superuser: boolean;
};

/** Без токена и id ответ сессией не считается — это защищает от «полувхода». */
export const parseSocialSession = (payload: SocialAuthResponse): SocialSessionPayload | null => {
    if (!payload.token || payload.id === undefined || payload.id === null) return null;
    return {
        token: payload.token,
        refresh: payload.refresh,
        name: String(payload.name || ''),
        email: String(payload.email || ''),
        id: payload.id,
        is_superuser: Boolean(payload.is_superuser),
    };
};
