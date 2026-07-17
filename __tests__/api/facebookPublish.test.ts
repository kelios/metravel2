import { apiClient } from '@/api/client'
import {
  FACEBOOK_PUBLISH_PHOTO_MAX_COUNT,
  fetchFacebookOAuthStartUrl,
  fetchFacebookPublishStatus,
  publishTravelToFacebook,
} from '@/api/facebookPublish'

jest.mock('@/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    request: jest.fn(),
  },
}))

describe('facebookPublish API adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads server-owned Facebook Page capability', async () => {
    const capability = {
      configured: true,
      connected: true,
      pageId: 'server-page-id',
      pageName: 'MeTravel',
      canPublish: true,
    }
    ;(apiClient.get as jest.Mock).mockResolvedValueOnce(capability)

    await expect(fetchFacebookPublishStatus()).resolves.toEqual({
      configured: true,
      connected: true,
      pageName: 'MeTravel',
      canPublish: true,
    })
    expect(apiClient.get).toHaveBeenCalledWith('/travels/facebook-publish/status/', 30000)
  })

  it('asks the backend for a signed OAuth URL', async () => {
    ;(apiClient.get as jest.Mock).mockResolvedValueOnce({ authUrl: 'https://facebook.example/oauth' })

    await expect(fetchFacebookOAuthStartUrl('/travels/test/edit')).resolves.toBe(
      'https://facebook.example/oauth',
    )
    expect(apiClient.get).toHaveBeenCalledWith(
      '/travels/facebook-oauth/start/?returnTo=%2Ftravels%2Ftest%2Fedit',
      30000,
    )
  })

  it('publishes the travel id and editable message when no photos are selected', async () => {
    ;(apiClient.request as jest.Mock).mockResolvedValueOnce({ status: 'published' })

    await publishTravelToFacebook(640, 'Facebook message')

    expect(apiClient.request).toHaveBeenCalledWith(
      '/travels/facebook-publish/',
      {
        method: 'POST',
        body: JSON.stringify({ travelId: 640, message: 'Facebook message' }),
      },
      30000,
    )
    const requestBody = JSON.parse((apiClient.request as jest.Mock).mock.calls[0][1].body)
    expect(requestBody).not.toHaveProperty('pageId')
    expect(requestBody).not.toHaveProperty('link')
    expect(requestBody).not.toHaveProperty('token')
  })

  it('includes selected gallery photos without client-owned Facebook credentials', async () => {
    ;(apiClient.request as jest.Mock).mockResolvedValueOnce({ status: 'published' })

    await publishTravelToFacebook(640, 'Facebook message', [
      { id: 12, url: '/media/gallery/12.jpg', caption: 'Viewpoint' },
      { id: 'draft-photo', url: '  https://cdn.example.com/gallery/13.jpg  ' },
      { id: 14, url: '' },
    ])

    expect(apiClient.request).toHaveBeenCalledWith(
      '/travels/facebook-publish/',
      {
        method: 'POST',
        body: JSON.stringify({
          travelId: 640,
          message: 'Facebook message',
          photos: [
            { id: 12, url: '/media/gallery/12.jpg', caption: 'Viewpoint' },
            { id: 'draft-photo', url: 'https://cdn.example.com/gallery/13.jpg' },
          ],
        }),
      },
      30000,
    )
    const requestBody = JSON.parse((apiClient.request as jest.Mock).mock.calls[0][1].body)
    expect(requestBody).not.toHaveProperty('pageId')
    expect(requestBody).not.toHaveProperty('link')
    expect(requestBody).not.toHaveProperty('token')
  })

  it('refuses to build a Facebook request with more than ten photos', async () => {
    const photos = Array.from({ length: FACEBOOK_PUBLISH_PHOTO_MAX_COUNT + 1 }, (_, index) => ({
      id: index + 1,
      url: `https://cdn.example.com/gallery/${index + 1}.jpg`,
    }))

    await expect(publishTravelToFacebook(640, 'Facebook message', photos)).rejects.toThrow(
      `at most ${FACEBOOK_PUBLISH_PHOTO_MAX_COUNT} photos`,
    )
    expect(apiClient.request).not.toHaveBeenCalled()
  })
})
