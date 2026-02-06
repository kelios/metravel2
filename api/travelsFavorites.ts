import { apiClient } from '@/api/client';

// apiClient already prefixes /api, so use relative paths without the extra segment
export const markTravelAsFavorite = async (travelId: string | number): Promise<unknown> => {
    return apiClient.patch<unknown>(`/travels/${travelId}/mark-as-favorite/`);
};

export const unmarkTravelAsFavorite = async (travelId: string | number): Promise<unknown> => {
    return apiClient.patch<unknown>(`/travels/${travelId}/unmark-as-favorite/`);
};
