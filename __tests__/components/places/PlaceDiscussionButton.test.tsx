import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import { applyAuthorBlock, resetBlockedAuthorStateForTests } from '@/api/blockSensitiveQueries'
import { deletePlaceComment, getPlaceComments, postPlaceComment, type PlaceComment } from '@/api/placeComments'
import { queryKeys } from '@/api/queryKeys'
import PlaceDiscussionButton from '@/components/places/PlaceDiscussionButton'
import { useAuthStore } from '@/stores/authStore'
import { useHiddenContentStore } from '@/stores/hiddenContentStore'
import { createTestQueryClient } from '@/__tests__/helpers/testQueryClient'

const mockRequireAuth = jest.fn(() => false)
jest.mock('@/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ requireAuth: mockRequireAuth }) }))
jest.mock('@/utils/confirmAction', () => ({ confirmAction: jest.fn(async () => true) }))
jest.mock('@/api/placeComments', () => ({
  PLACE_COMMENT_MAX_LENGTH: 10_000,
  getPlaceComments: jest.fn(),
  postPlaceComment: jest.fn(),
  deletePlaceComment: jest.fn(),
}))

const get = jest.mocked(getPlaceComments)
const post = jest.mocked(postPlaceComment)
const remove = jest.mocked(deletePlaceComment)
const entry = (id: number, text: string, user = 8): PlaceComment => ({
  id, text, user, created_at: '2026-11-06T10:00:00Z', user_name: `Автор ${user}`, user_avatar: null,
})

const renderDiscussions = async () => {
  const client = createTestQueryClient()
  const view = await render(
    <QueryClientProvider client={client}>
      <PlaceDiscussionButton pointId={101} placeTitle="Замок" />
      <PlaceDiscussionButton pointId={202} placeTitle="Парк" />
    </QueryClientProvider>,
  )
  return { ...view, client, open: () => fireEvent.press(view.getByTestId('place-discussion-101')) }
}

beforeEach(() => {
  jest.clearAllMocks()
  get.mockReset()
  post.mockReset()
  remove.mockReset()
  useAuthStore.setState({ authReady: true, isAuthenticated: false, userId: null })
  useHiddenContentStore.setState({ byOwner: {} })
  resetBlockedAuthorStateForTests()
})

it('queries only the opened place for a guest, dedupes its cursor pages and offers sign-in', async () => {
  const first = entry(1, 'Первая заметка')
  get.mockResolvedValueOnce({ results: [first], next: 'after-first' })
    .mockResolvedValueOnce({ results: [first, entry(2, 'Вторая заметка')], next: 'after-first' })
  const view = await renderDiscussions()
  expect(get).not.toHaveBeenCalled()

  await view.open()
  await waitFor(() => expect(view.getByText(first.text)).toBeTruthy())
  expect(view.getByText('Комментарии · Замок')).toBeTruthy()
  expect(view.queryByLabelText('Поле ввода комментария')).toBeNull()
  await fireEvent.press(view.getByLabelText('Показать ещё комментарии'))
  await waitFor(() => expect(view.getByText('Вторая заметка')).toBeTruthy())
  expect(view.getAllByText(first.text)).toHaveLength(1)
  expect(view.queryByLabelText('Показать ещё комментарии')).toBeNull()
  expect(get.mock.calls.map(([point, cursor]) => [point, cursor])).toEqual([[101, null], [101, 'after-first']])

  await fireEvent.press(view.getByLabelText('Войти, чтобы оставить комментарий'))
  expect(mockRequireAuth).toHaveBeenCalledTimes(1)
  expect(view.queryByTestId('place-comments-list')).toBeNull()
  expect(post).not.toHaveBeenCalled()
})

it('offers an explicit retry for an unavailable discussion before showing an empty list', async () => {
  get.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }))
    .mockResolvedValueOnce({ results: [], next: null })
  const view = await renderDiscussions()
  await view.open()
  await waitFor(() => expect(view.getByLabelText('Повторить')).toBeTruthy())
  expect(view.queryByText('Пока нет комментариев')).toBeNull()
  await fireEvent.press(view.getByLabelText('Повторить'))
  await waitFor(() => expect(view.getByText('Пока нет комментариев')).toBeTruthy())
  expect(get).toHaveBeenCalledTimes(2)
})

it('stops rendering cached comments and the composer when a refresh denies access to the place', async () => {
  useAuthStore.setState({ isAuthenticated: true, userId: '7' })
  get.mockResolvedValueOnce({ results: [entry(1, 'Раньше видно')], next: null })
    .mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }))
  const view = await renderDiscussions()
  await view.open()
  await waitFor(() => expect(view.getByText('Раньше видно')).toBeTruthy())
  expect(view.getByLabelText('Поле ввода комментария')).toBeTruthy()

  await act(() => view.client.invalidateQueries({ queryKey: queryKeys.placeComments('7', 101) }))
  await waitFor(() => expect(view.getByLabelText('Повторить')).toBeTruthy())
  expect(view.queryByText('Раньше видно')).toBeNull()
  expect(view.queryByLabelText('Поле ввода комментария')).toBeNull()
})

it('preserves the draft after failure, then shows the published reply from the list and deletes only own content', async () => {
  useAuthStore.setState({ isAuthenticated: true, userId: '7' })
  const other = entry(2, 'Чужая заметка')
  const own = entry(3, '<b>Моя заметка</b>', 7)
  get.mockResolvedValueOnce({ results: [other], next: null })
    .mockResolvedValueOnce({ results: [own, other], next: null })
    .mockResolvedValueOnce({ results: [other], next: null })
  post.mockRejectedValueOnce(new Error('disconnected')).mockResolvedValueOnce({ heldForModeration: false })
  remove.mockResolvedValueOnce(undefined)
  const view = await renderDiscussions()
  await view.open()
  const input = 'Поле ввода комментария'
  const submit = 'Отправить комментарий'
  await waitFor(() => expect(view.getByLabelText(input)).toBeTruthy())
  expect(view.queryByTestId('place-comment-delete-2')).toBeNull()
  expect(view.getByTestId('place-comment-safety-2-menu')).toBeTruthy()
  await fireEvent.changeText(view.getByLabelText(input), ` ${own.text} `)
  await fireEvent.press(view.getByLabelText(submit))
  await waitFor(() => expect(view.getByText('Не удалось отправить комментарий. Попробуйте ещё раз.')).toBeTruthy())
  expect(view.getByLabelText(input).props.value).toBe(` ${own.text} `)

  await fireEvent.press(view.getByLabelText(submit))
  await waitFor(() => expect(view.getByText(own.text)).toBeTruthy())
  expect(post).toHaveBeenLastCalledWith(101, own.text, expect.any(Function))
  expect(view.getByLabelText(input).props.value).toBe('')
  expect(view.queryByTestId('place-comment-safety-3-menu')).toBeNull()
  await fireEvent.press(view.getByTestId('place-comment-delete-3'))
  await waitFor(() => expect(view.queryByText(own.text)).toBeNull())
  expect(remove).toHaveBeenCalledWith(101, 3, expect.any(Function))
  expect(view.getByText(other.text)).toBeTruthy()
})

it('does not expose a POST response that the moderated list leaves out', async () => {
  useAuthStore.setState({ isAuthenticated: true, userId: '7' })
  get.mockResolvedValue({ results: [], next: null })
  post.mockResolvedValueOnce({ heldForModeration: true })
  const view = await renderDiscussions()
  await view.open()
  const input = 'Поле ввода комментария'
  await waitFor(() => expect(view.getByLabelText(input)).toBeTruthy())
  await fireEvent.changeText(view.getByLabelText(input), 'На модерации')
  await fireEvent.press(view.getByLabelText('Отправить комментарий'))
  await waitFor(() => expect(view.getByLabelText(input).props.value).toBe(''))
  expect(get).toHaveBeenCalledTimes(2)
  expect(view.queryByText('На модерации')).toBeNull()
  expect(view.getByText('Пока нет комментариев')).toBeTruthy()
  expect(view.getByText('Комментарий отправлен на проверку. Он появится после одобрения.')).toBeTruthy()
})

it('uses the common block registry to immediately remove foreign content from the visible discussion', async () => {
  useAuthStore.setState({ isAuthenticated: true, userId: '7' })
  get.mockResolvedValueOnce({ results: [entry(5, 'Заблокированный автор'), entry(6, 'Оставшийся комментарий', 9)], next: null })
  const view = await renderDiscussions()
  await view.open()
  await waitFor(() => expect(view.getByText('Заблокированный автор')).toBeTruthy())
  await act(() => applyAuthorBlock(view.client, 8))
  await waitFor(() => expect(view.queryByText('Заблокированный автор')).toBeNull())
  expect(view.getByText('Оставшийся комментарий')).toBeTruthy()
})
