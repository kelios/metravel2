import { apiClient } from '@/api/client'
import { deletePlaceComment, getPlaceComments, postPlaceComment } from '@/api/placeComments'

jest.mock('@/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), request: jest.fn() } }))

const get = jest.mocked(apiClient.get)
const post = jest.mocked(apiClient.post)
const request = jest.mocked(apiClient.request)

const comment = { id: 21, text: '<b>Текст</b>', created_at: '2026-11-06T10:00:00Z', user: 7, user_name: 'Имя', user_avatar: null }

beforeEach(() => jest.resetAllMocks())

it('follows only the cursor from a next link on the original place path', async () => {
  get.mockResolvedValueOnce({ results: [comment], next: 'https://untrusted.invalid/other/?cursor=a%2B%2Fb%3D' })
    .mockResolvedValueOnce({ results: [], next: null })
  const controller = new AbortController()
  const page = await getPlaceComments(101, null, controller.signal)
  expect(page).toEqual({ results: [comment], next: 'a+/b=' })
  expect(get).toHaveBeenNthCalledWith(1, '/places/101/comments/', undefined, { signal: controller.signal })

  await getPlaceComments(101, page.next, controller.signal)
  expect(get).toHaveBeenNthCalledWith(2, '/places/101/comments/?cursor=a%2B%2Fb%3D', undefined, { signal: controller.signal })
})

it('does not turn a missing endpoint or malformed response into an empty discussion', async () => {
  const unavailable = new Error('404')
  get.mockRejectedValueOnce(unavailable).mockResolvedValueOnce({ results: [] })
  await expect(getPlaceComments(101, null)).rejects.toBe(unavailable)
  await expect(getPlaceComments(101, null)).rejects.toThrow('Invalid place comments response')
})

it('writes trimmed plain text and deletes through the requested point', async () => {
  const guard = jest.fn()
  post.mockResolvedValueOnce({ ...comment, is_hidden: true })
  expect(await postPlaceComment(101, '  <b>Текст</b>\n', guard)).toEqual({ heldForModeration: true })
  expect(post).toHaveBeenCalledWith('/places/101/comments/', { text: '<b>Текст</b>' }, undefined, { expectedStatus: 201, beforeFetch: guard })

  await deletePlaceComment(101, comment.id, guard)
  expect(request).toHaveBeenCalledWith('/places/101/comments/21/', { method: 'DELETE', expectedStatus: 204, beforeFetch: guard })
})

it('requires a comment and moderation decision before acknowledging a submission', async () => {
  post.mockResolvedValueOnce(null).mockResolvedValueOnce(comment).mockResolvedValueOnce({ ...comment, is_hidden: false })
  const guard = jest.fn()
  await expect(postPlaceComment(101, comment.text, guard)).rejects.toThrow('Invalid place comment submission response')
  await expect(postPlaceComment(101, comment.text, guard)).rejects.toThrow('Invalid place comment submission response')
  await expect(postPlaceComment(101, comment.text, guard)).resolves.toEqual({ heldForModeration: false })
})

it('rejects empty and overlong writes before requesting the endpoint', async () => {
  await expect(postPlaceComment(101, '\n  ', jest.fn())).rejects.toThrow('Invalid place comment length')
  await expect(postPlaceComment(101, 'x'.repeat(10_001), jest.fn())).rejects.toThrow('Invalid place comment length')
  expect(post).not.toHaveBeenCalled()
})
