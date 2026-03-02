// api/travelsMutations.ts
// Travel mutation operations extracted from travelsApi.ts (task A2)

import { apiClient } from '@/api/client';

export const deleteTravel = async (travelId: string | number): Promise<null> => {
    return apiClient.delete<null>(`/travels/${travelId}/`);
};

