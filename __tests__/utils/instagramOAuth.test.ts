describe('instagramOAuth utils', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete process.env.EXPO_PUBLIC_META_APP_ID
    delete process.env.EXPO_PUBLIC_INSTAGRAM_APP_ID
    delete process.env.EXPO_PUBLIC_INSTAGRAM_OAUTH_REDIRECT_URI
    delete process.env.EXPO_PUBLIC_INSTAGRAM_OAUTH_CALLBACK_PATH
    delete process.env.EXPO_PUBLIC_INSTAGRAM_OAUTH_SCOPES
    delete process.env.EXPO_PUBLIC_INSTAGRAM_OAUTH_VERSION
    delete process.env.EXPO_PUBLIC_API_URL
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('builds Meta OAuth URL from explicit env config', () => {
    process.env.EXPO_PUBLIC_META_APP_ID = 'meta-app-123'
    process.env.EXPO_PUBLIC_INSTAGRAM_OAUTH_REDIRECT_URI = 'https://api.metravel.by/auth/instagram/callback'

    const { buildInstagramOAuthUrl, getInstagramOAuthResolution } = require('@/utils/instagramOAuth')

    const resolution = getInstagramOAuthResolution()
    expect(resolution.isConfigured).toBe(true)
    if (!resolution.isConfigured) {
      throw new Error('Expected configured Instagram OAuth resolution')
    }

    const oauthUrl = buildInstagramOAuthUrl('connect-settings')
    expect(oauthUrl).toBe(
      'https://www.facebook.com/v19.0/dialog/oauth?client_id=meta-app-123&redirect_uri=https%3A%2F%2Fapi.metravel.by%2Fauth%2Finstagram%2Fcallback&scope=instagram_basic%2Cinstagram_content_publish%2Cpages_read_engagement&response_type=code&state=connect-settings'
    )
  })

  it('derives backend callback url from EXPO_PUBLIC_API_URL when explicit redirect is missing', () => {
    process.env.EXPO_PUBLIC_META_APP_ID = 'meta-app-123'
    process.env.EXPO_PUBLIC_API_URL = 'https://api.metravel.by/api'

    const { getInstagramOAuthResolution } = require('@/utils/instagramOAuth')

    const resolution = getInstagramOAuthResolution()
    expect(resolution).toEqual({
      isConfigured: true,
      reason: '',
      config: {
        appId: 'meta-app-123',
        authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
        redirectUri: 'https://api.metravel.by/auth/instagram/callback',
        scopes: ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement'],
      },
    })
  })

  it('returns not configured state when Meta app id is missing', () => {
    const { buildInstagramOAuthUrl, getInstagramOAuthResolution } = require('@/utils/instagramOAuth')

    const resolution = getInstagramOAuthResolution()
    expect(resolution.isConfigured).toBe(false)
    if (resolution.isConfigured) {
      throw new Error('Expected unresolved Instagram OAuth config')
    }

    expect(resolution.reason).toContain('EXPO_PUBLIC_META_APP_ID')
    expect(buildInstagramOAuthUrl()).toBeNull()
  })
})
