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
