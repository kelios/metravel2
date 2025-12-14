import { apiClient } from '@/src/api/client';

export const markTravelAsFavorite = async (travelId: string | number): Promise<unknown> => {
    return apiClient.patch<unknown>(`/api/travels/${travelId}/mark-as-favorite/`);
};

export const unmarkTravelAsFavorite = async (travelId: string | number): Promise<unknown> => {
    return apiClient.patch<unknown>(`/api/travels/${travelId}/unmark-as-favorite/`);
};
