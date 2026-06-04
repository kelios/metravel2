import { act, renderHook } from '@testing-library/react-native'

import { useAvatarUri, __resetFailedAvatarUrls } from '@/hooks/useAvatarUri'

describe('useAvatarUri', () => {
  beforeEach(() => {
    __resetFailedAvatarUrls()
  })

  it('appends cache busting to first-party avatar urls', () => {
    const { result } = renderHook(() =>
      useAvatarUri({
        userAvatar: 'https://metravel.by/media/avatar.jpg',
        profileRefreshToken: 7,
      })
    )

    expect(result.current.avatarUri).toBe('https://metravel.by/media/avatar.jpg?v=7')
  })

  it('does not append cache busting to third-party avatar urls', () => {
    const { result } = renderHook(() =>
      useAvatarUri({
        userAvatar: 'https://lh3.googleusercontent.com/a/example=s96-c',
        profileRefreshToken: 7,
      })
    )

    expect(result.current.avatarUri).toBe('https://lh3.googleusercontent.com/a/example=s96-c')
  })

  it('stops requesting an avatar after it fails, even on profileRefreshToken bump', () => {
    const { result, rerender } = renderHook(
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
    act(() => {
      result.current.setAvatarLoadError(true)
    })
    expect(result.current.avatarUri).toBeNull()

    // A cache-bust bump must NOT trigger another request for the same dead URL.
    rerender({ token: 1 })
    expect(result.current.avatarUri).toBeNull()
  })

  it('does not request a URL that already failed in another component', () => {
    const url = 'https://metravel.by/avatar/profile/82/missing.webp'

    const first = renderHook(() => useAvatarUri({ userAvatar: url, profileRefreshToken: 0 }))
    act(() => {
      first.result.current.setAvatarLoadError(true)
    })

    // A fresh hook instance (another avatar component) sees the cached failure.
    const second = renderHook(() => useAvatarUri({ userAvatar: url, profileRefreshToken: 3 }))
    expect(second.result.current.avatarUri).toBeNull()
  })

  it('still loads a different avatar url after another one failed', () => {
    const failed = renderHook(() =>
      useAvatarUri({ userAvatar: 'https://metravel.by/avatar/old.webp', profileRefreshToken: 0 })
    )
    act(() => {
      failed.result.current.setAvatarLoadError(true)
    })

    const { result } = renderHook(() =>
      useAvatarUri({ userAvatar: 'https://metravel.by/avatar/new.webp', profileRefreshToken: 2 })
    )
    expect(result.current.avatarUri).toBe('https://metravel.by/avatar/new.webp?v=2')
  })
})
