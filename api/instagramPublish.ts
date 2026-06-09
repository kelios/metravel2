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

// Ask the backend for the Meta OAuth authorize URL. The backend owns the redirect URI
// (its own /instagram-oauth/callback/) and the signed state, so the FE must NOT build
// the URL itself — that previously pointed at a non-existent /auth/instagram/callback.
export async function fetchInstagramOAuthStartUrl(returnTo?: string): Promise<string> {
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
  const res = await apiClient.get<{ authUrl?: string }>(
    `/travels/instagram-oauth/start/${query}`,
    30000
  );
  return String(res?.authUrl || '');
}
