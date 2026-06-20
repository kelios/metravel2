import { apiClient, ApiError } from '@/api/client';
import { LONG_TIMEOUT } from '@/api/apiConfig';

/**
 * Privacy & Security API (Sprint 18 — Security & Privacy).
 *
 * ⚠️ FE-forward: на момент написания бэкенд (BE-privacy-settings / BE-data-ownership /
 * BE-security-journal / BE-contact-protection) ещё не реализован. Контракт ниже —
 * предложение фронта, продублированное в соответствующие BE-тикеты на борде.
 * Все read-вызовы делают graceful degradation: если эндпоинт ещё не существует
 * (404/501) — возвращаем безопасные дефолты, чтобы UI рендерился без падения.
 * Когда BE появится — поведение станет «живым» без изменений UI.
 *
 * NOTE: apiClient.baseURL уже содержит `/api`, поэтому пути здесь без `/api`.
 */

// ---- Privacy visibility settings (BE-privacy-settings) ----

/** Аудитории видимости — от самой открытой к самой закрытой. */
export type PrivacyAudience = 'all' | 'registered' | 'followers' | 'only_me';

/** Типы пользовательского контента, для которых настраивается видимость. */
export type PrivacyContentType =
    | 'trips'
    | 'routes'
    | 'social'
    | 'achievements'
    | 'visited_places';

export type PrivacySettingsDto = Record<PrivacyContentType, PrivacyAudience>;

export const PRIVACY_CONTENT_TYPES: PrivacyContentType[] = [
    'trips',
    'routes',
    'social',
    'achievements',
    'visited_places',
];

export const PRIVACY_AUDIENCES: PrivacyAudience[] = ['all', 'registered', 'followers', 'only_me'];

/** Дефолт: всё публично, контакты (social) — только зарегистрированным. */
export const PRIVACY_SETTINGS_DEFAULTS: PrivacySettingsDto = {
    trips: 'all',
    routes: 'all',
    social: 'registered',
    achievements: 'all',
    visited_places: 'all',
};

const isMissingEndpoint = (error: unknown): boolean =>
    error instanceof ApiError && (error.status === 404 || error.status === 501);

const normalizePrivacySettings = (raw: Partial<PrivacySettingsDto> | null | undefined): PrivacySettingsDto => {
    const result = { ...PRIVACY_SETTINGS_DEFAULTS };
    if (raw && typeof raw === 'object') {
        for (const key of PRIVACY_CONTENT_TYPES) {
            const value = raw[key];
            if (value && PRIVACY_AUDIENCES.includes(value)) {
                result[key] = value;
            }
        }
    }
    return result;
};

export const fetchPrivacySettings = async (): Promise<PrivacySettingsDto> => {
    try {
        const res = await apiClient.get<Partial<PrivacySettingsDto>>('/user/privacy-settings/', LONG_TIMEOUT);
        return normalizePrivacySettings(res);
    } catch (error) {
        if (isMissingEndpoint(error)) return { ...PRIVACY_SETTINGS_DEFAULTS };
        throw error;
    }
};

export const updatePrivacySettings = async (
    payload: Partial<PrivacySettingsDto>
): Promise<PrivacySettingsDto> => {
    const res = await apiClient.put<Partial<PrivacySettingsDto>>('/user/privacy-settings/', payload);
    return normalizePrivacySettings(res);
};

// ---- Data ownership / export & deletion (BE-data-ownership) ----

export type DataExportStatus = 'queued' | 'processing' | 'ready';

export type DataExportDto = {
    status: DataExportStatus;
    /** Готовая ссылка на архив, когда status === 'ready'. */
    download_url?: string | null;
    requested_at?: string | null;
};

export const requestDataExport = async (): Promise<DataExportDto> => {
    return apiClient.post<DataExportDto>('/user/data-export/');
};

export const deleteUserMessages = async (): Promise<null> => {
    return apiClient.delete<null>('/user/data/messages/');
};

export const deleteUserRoutes = async (): Promise<null> => {
    return apiClient.delete<null>('/user/data/routes/');
};

export const revokeUserConsents = async (): Promise<null> => {
    return apiClient.post<null>('/user/consents/revoke/');
};

// ---- Contact protection (BE-contact-protection) ----

/**
 * Уровень доступа текущего пользователя к контактам просматриваемого профиля.
 * - granted — контакты раскрыты (заявка одобрена / взаимное согласие);
 * - pending — заявка на раскрытие отправлена, ждёт одобрения;
 * - none    — контакты скрыты, заявка не отправлялась.
 */
export type ContactAccessStatus = 'granted' | 'pending' | 'none';

export const requestContactAccess = async (
    targetUserId: string | number
): Promise<{ status: ContactAccessStatus }> => {
    return apiClient.post<{ status: ContactAccessStatus }>(`/user/${targetUserId}/contact-request/`);
};

// ---- Security journal (BE-security-journal) ----

export type SecurityJournalEventType =
    | 'login'
    | 'logout'
    | 'password_change'
    | 'social_link'
    | 'badge_grant'
    | 'contact_reveal'
    | 'moderator_action'
    | 'other';

export type SecurityJournalEntryDto = {
    id: number | string;
    event_type: SecurityJournalEventType;
    created_at: string;
    ip_address?: string | null;
    user_agent?: string | null;
    device?: string | null;
    meta?: Record<string, unknown> | null;
};

export type SecurityJournalPage = {
    results: SecurityJournalEntryDto[];
    count: number;
    /** Номер следующей страницы (1-based) или null, если страниц больше нет. */
    nextPage: number | null;
};

const VALID_EVENT_TYPES: SecurityJournalEventType[] = [
    'login',
    'logout',
    'password_change',
    'social_link',
    'badge_grant',
    'contact_reveal',
    'moderator_action',
    'other',
];

type RawJournalResponse = {
    results?: SecurityJournalEntryDto[];
    count?: number;
    next?: string | null;
};

const normalizeJournalPage = (raw: RawJournalResponse | null | undefined, page: number): SecurityJournalPage => {
    const results = Array.isArray(raw?.results) ? raw!.results : [];
    return {
        results: results.map((entry) => ({
            ...entry,
            event_type: VALID_EVENT_TYPES.includes(entry.event_type) ? entry.event_type : 'other',
        })),
        count: typeof raw?.count === 'number' ? raw!.count : results.length,
        nextPage: raw?.next ? page + 1 : null,
    };
};

export const SECURITY_JOURNAL_PAGE_SIZE = 20;

export const fetchSecurityJournal = async (page = 1): Promise<SecurityJournalPage> => {
    try {
        const res = await apiClient.get<RawJournalResponse>(
            `/user/security-journal/?page=${page}&page_size=${SECURITY_JOURNAL_PAGE_SIZE}`,
            LONG_TIMEOUT
        );
        return normalizeJournalPage(res, page);
    } catch (error) {
        if (isMissingEndpoint(error)) return { results: [], count: 0, nextPage: null };
        throw error;
    }
};
