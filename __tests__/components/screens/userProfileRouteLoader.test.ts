import type { ImmutableRequest } from 'expo-server'
import { loadUserProfileRoute } from '@/components/screens/profile/userProfileRouteLoader'
import { buildPublicUserPersonJsonLd, parsePublicUserId, projectPublicUserProfile } from '@/utils/publicUserProfile'

// #3237: серверный профиль автора /user/<id> — из анонимного GET /api/user/<id>/profile/.
jest.mock('expo-server', () => ({ setResponseHeaders: jest.fn() }))

const request = () => ({ signal: new AbortController().signal } as ImmutableRequest)
// Ответ прода 11.11.2026 (сокращён): `id` — профиль, `user` — пользователь из пути.
const PROFILE = { id: 82, user: 1, first_name: 'Юля', last_name: 'Sauran', is_verified: true,
  avatar: 'https://metravel.by/avatar/profile/82/avatar/f9b9.webp', external_avatar: null,
  youtube: 'https://www.youtube.com/@metravelby', instagram: '', facebook: null, telegram: 't.me/x', twitter: 'javascript:alert(1)', vk: null,
  email_notify_comments: false, contacts_hidden: true }

describe('public user profile projection', () => {
  it.each([['1', 1], [['7'], 7], ['0', null], ['01', null], ['1a', null], ['../2', null], [undefined, null]])(
    'path id %j → %s', (value, expected) => expect(parsePublicUserId(value)).toBe(expected))

  it('keeps only whitelisted fields and real social URLs', () => {
    expect(projectPublicUserProfile(PROFILE, 1)).toEqual({
      userId: 1, name: 'Юля Sauran', avatar: 'https://metravel.by/avatar/profile/82/avatar/f9b9.webp', isVerified: true,
      sameAs: ['https://www.youtube.com/@metravelby'],
    })
    expect(projectPublicUserProfile(PROFILE, 2)).toBeNull()
    expect(projectPublicUserProfile({ ...PROFILE, first_name: '', last_name: '' }, 1)).toBeNull()
  })

  it('builds a ProfilePage/Person without empty sameAs', () => {
    const data = buildPublicUserPersonJsonLd({ userId: 1, name: 'Юля', avatar: null, isVerified: false, sameAs: [] })
    expect(data.mainEntity).toEqual({ '@type': 'Person', '@id': 'https://metravel.by/user/1#person', name: 'Юля', url: 'https://metravel.by/user/1' })
  })
})

describe('user profile route loader', () => {
  const oldEnv = { api: process.env.EXPO_PUBLIC_API_URL, ssr: process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR }
  const oldFetch = global.fetch
  const fetchMock = jest.fn()

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000'
    process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = 'true'
    global.fetch = fetchMock
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => PROFILE })
  })
  afterAll(() => {
    global.fetch = oldFetch
    process.env.EXPO_PUBLIC_API_URL = oldEnv.api
    if (oldEnv.ssr === undefined) delete process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR
    else process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = oldEnv.ssr
  })

  it('reads only the id from the path and fetches the profile anonymously', async () => {
    await expect(loadUserProfileRoute(request(), { id: '1' })).resolves.toMatchObject({ profile: { userId: 1, name: 'Юля Sauran' } })
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/api/user/1/profile/', expect.objectContaining({ credentials: 'omit' }))
  })

  it('answers 404 for a bad id or a missing profile and 503 for an API failure', async () => {
    await expect(loadUserProfileRoute(request(), { id: 'abc' })).rejects.toMatchObject({ httpStatus: 404 })
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
    await expect(loadUserProfileRoute(request(), { id: '5' })).rejects.toMatchObject({ httpStatus: 404 })
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    await expect(loadUserProfileRoute(request(), { id: '6' })).rejects.toMatchObject({ httpStatus: 503 })
  })

  it('stays out of the way without the SSR runtime (static /user/[id].html)', async () => {
    process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = 'false'
    await expect(loadUserProfileRoute(request(), { id: '1' })).resolves.toBeNull()
    await expect(loadUserProfileRoute(undefined, { id: '1' })).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
