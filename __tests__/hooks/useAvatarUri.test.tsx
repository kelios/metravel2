import { act, renderHook } from '@testing-library/react-native'

import { useAvatarUri, __resetFailedAvatarUrls } from '@/hooks/useAvatarUri'

describe('useAvatarUri', () => {
  beforeEach(() => {
    __resetFailedAvatarUrls()
  })

  it('appends cache busting to first-party avatar urls', async () => {
    const { result } = await renderHook(() =>
      useAvatarUri({
        userAvatar: 'https://metravel.by/media/avatar.jpg',
        profileRefreshToken: 7,
      })
    )

    expect(result.current.avatarUri).toBe('https://metravel.by/media/avatar.jpg?v=7')
  })

  it('does not append cache busting to third-party avatar urls', async () => {
    const { result } = await renderHook(() =>
      useAvatarUri({
        userAvatar: 'https://lh3.googleusercontent.com/a/example=s96-c',
        profileRefreshToken: 7,
      })
    )

    expect(result.current.avatarUri).toBe('https://lh3.googleusercontent.com/a/example=s96-c')
  })

  it('routes a private backend avatar through the configured API origin', async () => {
    const originalApiUrl = process.env.EXPO_PUBLIC_API_URL
    process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:8085'

    try {
      const { result } = await renderHook(() =>
        useAvatarUri({
          userAvatar: 'http://192.168.50.36/avatar/profile/75/avatar/example.webp',
          profileRefreshToken: 3,
        })
      )

      expect(result.current.avatarUri).toBe(
        'http://127.0.0.1:8085/avatar/profile/75/avatar/example.webp?v=3'
      )
    } finally {
      process.env.EXPO_PUBLIC_API_URL = originalApiUrl
    }
  })

  it('stops requesting an avatar after it fails, even on profileRefreshToken bump', async () => {
    const { result, rerender } = await renderHook(
      ({ token }) =>
        useAvatarUri({
          userAvatar: 'https://metravel.by/avatar/profile/82/missing.webp',
          profileRefreshToken: token,
        }),
      { initialProps: { token: 0 } }
    )

    expect(result.current.avatarUri).toBe(
      'https://metravel.by/avatar/profile/82/missing.webp?v=0'
    )

    // Image 404s -> consumer reports the error.
    await act(() => {
      result.current.setAvatarLoadError(true)
    })
    expect(result.current.avatarUri).toBeNull()

    // A cache-bust bump must NOT trigger another request for the same dead URL.
    await rerender({ token: 1 })
    expect(result.current.avatarUri).toBeNull()
  })

  it('does not request a URL that already failed in another component', async () => {
    const url = 'https://metravel.by/avatar/profile/82/missing.webp'

    const first = await renderHook(() => useAvatarUri({ userAvatar: url, profileRefreshToken: 0 }))
    await act(() => {
      first.result.current.setAvatarLoadError(true)
    })

    // A fresh hook instance (another avatar component) sees the cached failure.
    const second = await renderHook(() => useAvatarUri({ userAvatar: url, profileRefreshToken: 3 }))
    expect(second.result.current.avatarUri).toBeNull()
  })

  it('still loads a different avatar url after another one failed', async () => {
    const failed = await renderHook(() =>
      useAvatarUri({ userAvatar: 'https://metravel.by/avatar/old.webp', profileRefreshToken: 0 })
    )
    await act(() => {
      failed.result.current.setAvatarLoadError(true)
    })

    const { result } = await renderHook(() =>
      useAvatarUri({ userAvatar: 'https://metravel.by/avatar/new.webp', profileRefreshToken: 2 })
    )
    expect(result.current.avatarUri).toBe('https://metravel.by/avatar/new.webp?v=2')
  })
})
