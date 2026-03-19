import { apiClient } from '@/api/client';

export type PublishTravelToInstagramPayload = {
  travelId: number;
  accountKey: string;
  caption: string;
  hashtags: string[];
  imageUrls: string[];
};

export async function publishTravelToInstagram(payload: PublishTravelToInstagramPayload) {
  return apiClient.request<{
    status?: string;
    postUrl?: string;
    account?: string;
  }>(
    '/travels/instagram-publish/',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    30000
  );
}
