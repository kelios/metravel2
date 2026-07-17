import { apiClient } from '@/api/client'

export const FACEBOOK_PUBLISH_PHOTO_MAX_COUNT = 10

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

export type FacebookPublishPhoto = {
  id?: number | string
  url: string
  caption?: string
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

export const publishTravelToFacebook = async (
  travelId: number,
  message: string,
  photos: FacebookPublishPhoto[] = [],
): Promise<FacebookPublishResult> => {
  const selectedPhotos = photos
    .map((photo) => ({
      id: photo.id,
      url: String(photo.url || '').trim(),
      caption: photo.caption?.trim() || undefined,
    }))
    .filter((photo) => photo.url)

  if (selectedPhotos.length > FACEBOOK_PUBLISH_PHOTO_MAX_COUNT) {
    throw new RangeError(
      `Facebook publication accepts at most ${FACEBOOK_PUBLISH_PHOTO_MAX_COUNT} photos`,
    )
  }

  return apiClient.request<FacebookPublishResult>(
    '/travels/facebook-publish/',
    {
      method: 'POST',
      body: JSON.stringify({
        travelId,
        message,
        ...(selectedPhotos.length > 0 ? { photos: selectedPhotos } : null),
      }),
    },
    30000,
  )
}
