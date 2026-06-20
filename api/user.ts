import { LONG_TIMEOUT } from '@/api/apiConfig';
import { apiClient } from '@/api/client';

export type CardViewTravelDto = {
    id: number;
    name: string | null;
    url: string;
    slug: string;
    countryName: string;
    travel_image_thumb_small_url: string;
    travel_image_thumb_url: string;
    updated_at: string | null;
};

export type UserProfileDto = {
    id: number;
    first_name: string;
    last_name: string;
    youtube: string;
    instagram: string;
    twitter: string;
    vk: string;
    email_notify_comments: boolean;
    email_notify_messages: boolean;
    avatar: string | null;
    user: number;
    // Серверный premium-флаг для PDF-paywall: (опубликовано ≥ N путешествий) ИЛИ ручной флаг (BE #293).
    // Читаем только это поле; premium_manually_enabled бэк отдаёт публично, на него не завязываемся.
    is_premium?: boolean;
    // Sprint 18 / BE-contact-protection: бэк помечает профиль, чьи контакты скрыты до одобрения,
    // и уровень доступа текущего зрителя. Поля опциональны — пока BE не выставит contacts_hidden=true,
    // FE-гейт неактивен и контакты показываются как раньше (graceful degradation).
    contacts_hidden?: boolean;
    contact_access?: 'granted' | 'pending' | 'none';
};

export type UpdateUserProfilePayload = Partial<
    Pick<
        UserProfileDto,
        | 'first_name'
        | 'last_name'
        | 'youtube'
        | 'instagram'
        | 'twitter'
        | 'vk'
        | 'email_notify_comments'
        | 'email_notify_messages'
    >
>;

export type UserTravelStatusKind = 'visited' | 'planned' | 'wishlist';

export type UserTravelStatusPayload = {
    travel_id: number;
    status: UserTravelStatusKind;
    planned_date?: string | null;
    visited_date?: string | null;
};

export type UserTravelStatusDto = {
    travel_id: number;
    status: UserTravelStatusKind;
    planned_date: string | null;
    visited_date: string | null;
    added_at: string;
    updated_at: string | null;
    travel?: {
        id: number;
        name: string | null;
        slug: string;
        url: string;
        travel_image_thumb_url: string;
        countryName: string;
    } | null;
};

export type UserTravelStatusesQuery = {
    status?: UserTravelStatusKind;
    year?: number;
    month?: number;
    page?: number;
    perPage?: number;
};

/**
 * Normalizes an avatar string from the API.
 * Returns `null` for empty, "null", or "undefined" values.
 */
export const normalizeAvatar = (raw: unknown): string | null => {
    const str = String(raw ?? '').trim();
    if (!str) return null;
    const lower = str.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return null;
    return str;
};

const normalizeProfile = (profile: UserProfileDto): UserProfileDto => ({
    ...profile,
    avatar: normalizeAvatar(profile.avatar),
});

// NOTE: apiClient.baseURL already includes `/api`, so endpoints here must be without it
export const fetchUserProfile = async (userId: string | number): Promise<UserProfileDto> => {
    const res = await apiClient.get<UserProfileDto>(`/user/${userId}/profile/`, LONG_TIMEOUT);
    return normalizeProfile(res);
};

export const updateUserProfile = async (
    userId: string | number,
    payload: UpdateUserProfilePayload
): Promise<UserProfileDto> => {
    const res = await apiClient.put<UserProfileDto>(`/user/${userId}/profile/update/`, payload);
    return normalizeProfile(res);
};

export const deleteCurrentUserAccount = async (): Promise<null> => {
    return apiClient.delete<null>('/user/delete-account/');
};

export const uploadUserProfileAvatar = async (
    userId: string | number,
    avatar: string
): Promise<UserProfileDto> => {
    const res = await apiClient.put<UserProfileDto>(`/user/${userId}/profile/avatar-upload/`, { avatar });
    return normalizeProfile(res);
};

export type UploadUserProfileAvatarFile =
    | Blob
    | {
          uri: string;
          name: string;
          type: string;
      };

export const uploadUserProfileAvatarFile = async (
    userId: string | number,
    file: UploadUserProfileAvatarFile
): Promise<UserProfileDto> => {
    const formData = new FormData();
    if (typeof Blob !== 'undefined' && file instanceof Blob) {
        const filename = file instanceof File ? file.name : 'avatar.jpg';
        formData.append('avatar', file, filename);
    } else if (file && typeof (file as { uri?: unknown }).uri === 'string') {
        const f = file as { uri: string; name: string; type: string };
        formData.append('avatar', {
            uri: f.uri,
            name: f.name,
            type: f.type,
        } as unknown as Blob);
    } else {
        throw new Error('uploadUserProfileAvatarFile: unsupported file payload');
    }

    // apiClient.baseURL уже содержит /api, поэтому здесь без /api в начале
    const res = await apiClient.uploadFormData<UserProfileDto>(
        `/user/${userId}/profile/avatar-upload/`,
        formData,
        'PUT'
    );
    return normalizeProfile(res);
};

type MaybePaginated<T> =
    | T[]
    | {
          data?: T[] | { data?: T[]; results?: T[] } | null;
          results?: T[];
      }
    | null
    | undefined;

const unwrapList = <T>(payload: MaybePaginated<T>): T[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;

    const rec = payload as Record<string, unknown>;
    const data = rec.data;
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === 'object') {
        const dataRec = data as Record<string, unknown>;
        if (Array.isArray(dataRec.results)) return dataRec.results as T[];
        if (Array.isArray(dataRec.data)) return dataRec.data as T[];
    }

    if (Array.isArray(rec.results)) return rec.results as T[];

    if (__DEV__) {
        console.warn('[unwrapList] non-empty payload did not match any known list shape', {
            keys: Object.keys(rec),
        });
    }
    return [];
};

const buildQueryString = (query: Record<string, string | number | undefined>): string => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            params.set(key, String(value));
        }
    });
    const result = params.toString();
    return result ? `?${result}` : '';
};

export const fetchUserFavoriteTravels = async (userId: string | number): Promise<CardViewTravelDto[]> => {
    // apiClient.baseURL уже содержит /api
    const res = await apiClient.get<MaybePaginated<CardViewTravelDto>>(`/user/${userId}/favorite-travels/`);
    return unwrapList(res);
};

export const fetchUserHistory = async (userId: string | number): Promise<CardViewTravelDto[]> => {
    // apiClient.baseURL уже содержит /api
    const res = await apiClient.get<MaybePaginated<CardViewTravelDto>>(`/user/${userId}/history/`);
    return unwrapList(res);
};

export const clearUserHistory = async (userId: string | number): Promise<null> => {
    // apiClient.baseURL уже содержит /api
    return apiClient.delete<null>(`/user/${userId}/clear-history/`);
};

export const clearUserFavorites = async (userId: string | number): Promise<null> => {
    // apiClient.baseURL уже содержит /api
    return apiClient.delete<null>(`/user/${userId}/clear-favorite/`);
};

export const fetchUserRecommendedTravels = async (userId: string | number): Promise<CardViewTravelDto[]> => {
    // apiClient.baseURL уже содержит /api
    const res = await apiClient.get<MaybePaginated<CardViewTravelDto>>(`/user/${userId}/recommended-travels/`);
    return unwrapList(res);
};

// ---- Travel statuses / planning ----

export const fetchUserTravelStatuses = async (
    userId: string | number,
    query: UserTravelStatusesQuery = {}
): Promise<UserTravelStatusDto[]> => {
    const queryString = buildQueryString(query);
    const res = await apiClient.get<MaybePaginated<UserTravelStatusDto>>(
        `/user/${userId}/travel-statuses/${queryString}`
    );
    return unwrapList(res);
};

export const upsertUserTravelStatus = async (
    userId: string | number,
    payload: UserTravelStatusPayload
): Promise<UserTravelStatusDto> => {
    return apiClient.post<UserTravelStatusDto>(`/user/${userId}/travel-statuses/`, payload);
};

export const deleteUserTravelStatus = async (
    userId: string | number,
    travelId: string | number
): Promise<UserTravelStatusDto | null> => {
    return apiClient.delete<UserTravelStatusDto | null>(`/user/${userId}/travel-statuses/${travelId}/`);
};

// ---- Subscriptions ----

export const subscribeToUser = async (userId: string | number): Promise<null> => {
    return apiClient.post<null>(`/user/${userId}/subscribe/`);
};

export const unsubscribeFromUser = async (userId: string | number): Promise<null> => {
    return apiClient.delete<null>(`/user/${userId}/unsubscribe/`);
};

export const fetchMySubscriptions = async (): Promise<UserProfileDto[]> => {
    const res = await apiClient.get<MaybePaginated<UserProfileDto>>('/user/subscriptions/');
    return unwrapList(res);
};

export const fetchMySubscribers = async (): Promise<UserProfileDto[]> => {
    const res = await apiClient.get<MaybePaginated<UserProfileDto>>('/user/subscribers/');
    return unwrapList(res);
};
