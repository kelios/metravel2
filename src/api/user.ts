import { apiClient } from '@/src/api/client';

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
    avatar: string;
    user: number;
};

export type UpdateUserProfilePayload = Partial<
    Pick<
        UserProfileDto,
        'first_name' | 'last_name' | 'youtube' | 'instagram' | 'twitter' | 'vk'
    >
>;

export const fetchUserProfile = async (userId: string | number): Promise<UserProfileDto> => {
    return apiClient.get<UserProfileDto>(`/api/user/${userId}/profile/`);
};

export const updateUserProfile = async (
    userId: string | number,
    payload: UpdateUserProfilePayload
): Promise<UserProfileDto> => {
    return apiClient.put<UserProfileDto>(`/api/user/${userId}/profile/update/`, payload);
};

export const uploadUserProfileAvatar = async (
    userId: string | number,
    avatar: string
): Promise<UserProfileDto> => {
    return apiClient.put<UserProfileDto>(`/api/user/${userId}/profile/avatar-upload/`, { avatar });
};

export type UploadUserProfileAvatarFile =
    | File
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
    if (typeof File !== 'undefined' && file instanceof File) {
        formData.append('avatar', file);
    } else {
        const f = file as { uri: string; name: string; type: string };
        formData.append('avatar', {
            uri: f.uri,
            name: f.name,
            type: f.type,
        } as any);
    }

    return apiClient.uploadFormData<UserProfileDto>(
        `/api/user/${userId}/profile/avatar-upload/`,
        formData,
        'PUT'
    );
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

    const data = (payload as any).data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
        if (Array.isArray((data as any).results)) return (data as any).results;
        if (Array.isArray((data as any).data)) return (data as any).data;
    }

    if (Array.isArray((payload as any).results)) return (payload as any).results;
    return [];
};

export const fetchUserFavoriteTravels = async (userId: string | number): Promise<CardViewTravelDto[]> => {
    const res = await apiClient.get<MaybePaginated<CardViewTravelDto>>(`/api/user/${userId}/favorite-travels/`);
    return unwrapList(res);
};

export const fetchUserHistory = async (userId: string | number): Promise<CardViewTravelDto[]> => {
    const res = await apiClient.get<MaybePaginated<CardViewTravelDto>>(`/api/user/${userId}/history/`);
    return unwrapList(res);
};

export const clearUserHistory = async (userId: string | number): Promise<null> => {
    return apiClient.delete<null>(`/api/user/${userId}/clear-history/`);
};

export const clearUserFavorites = async (userId: string | number): Promise<null> => {
    return apiClient.delete<null>(`/api/user/${userId}/clear-favorite/`);
};

export const fetchUserRecommendedTravels = async (userId: string | number): Promise<CardViewTravelDto[]> => {
    const res = await apiClient.get<MaybePaginated<CardViewTravelDto>>(`/api/user/${userId}/recommended-travels/`);
    return unwrapList(res);
};
