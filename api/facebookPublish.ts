import { apiClient } from '@/api/client'

export type FacebookPublishCapability = {
  configured: boolean
  connected: boolean
  pageName?: string
  canPublish: boolean
}

type FacebookPublishCapabilityResponse = FacebookPublishCapability & {
  pageId: string
}

export type FacebookPublishResult = {
  status: 'published' | 'already_published'
  account?: 'facebook'
  travelId?: number
  pageId?: string
  postId?: string
  postUrl?: string
  duplicate?: boolean
}

export async function fetchFacebookPublishStatus(): Promise<FacebookPublishCapability> {
  const response = await apiClient.get<FacebookPublishCapabilityResponse>(
    '/travels/facebook-publish/status/',
    30000,
  )
  return {
    configured: response.configured,
    connected: response.connected,
    pageName: response.pageName,
    canPublish: response.canPublish,
  }
}

export async function fetchFacebookOAuthStartUrl(returnTo?: string): Promise<string> {
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''
  const response = await apiClient.get<{ authUrl?: string }>(
    `/travels/facebook-oauth/start/${query}`,
    30000,
  )
  return String(response?.authUrl || '')
}

export const publishTravelToFacebook = (
  travelId: number,
  message: string,
): Promise<FacebookPublishResult> =>
  apiClient.request<FacebookPublishResult>(
    '/travels/facebook-publish/',
    {
      method: 'POST',
      body: JSON.stringify({ travelId, message }),
    },
    30000,
  )
