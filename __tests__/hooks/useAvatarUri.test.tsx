import { renderHook } from '@testing-library/react-native'

import { useAvatarUri } from '@/hooks/useAvatarUri'

describe('useAvatarUri', () => {
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
})
