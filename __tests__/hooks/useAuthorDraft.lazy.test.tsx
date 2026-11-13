import { act, renderHook, waitFor } from '@testing-library/react-native'

import { useAuthorDraft } from '@/components/travel/upsert/useAuthorDraft'

const mockLoaded = jest.fn()
const mockRequest = jest.fn()
jest.mock('@/api/aiAssist/authorDraft', () => {
  mockLoaded()
  return {
    requestAuthorDraft: (...args: unknown[]) => mockRequest(...args),
    isAuthorDraftError: (error: { kind?: string }) => error?.kind === 'limit',
  }
})
jest.mock('@/utils/aiPicksConfig', () => ({ getAiPicksBaseUrl: () => 'https://assist.test' }))
jest.mock('@/i18n', () => ({ getActiveLocale: () => 'pl' }))

const originalFlag = process.env.EXPO_PUBLIC_AI_ASSISTANT
beforeEach(() => {
  mockRequest.mockReset()
  process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
})
afterAll(() => {
  if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_AI_ASSISTANT
  else process.env.EXPO_PUBLIC_AI_ASSISTANT = originalFlag
})

it('does not load the author API or send a request with the flag disabled', async () => {
  delete process.env.EXPO_PUBLIC_AI_ASSISTANT
  const { result } = await renderHook(() => useAuthorDraft('description'))
  await act(async () => { await result.current.suggest('title') })
  expect(mockLoaded).not.toHaveBeenCalled()
  expect(mockRequest).not.toHaveBeenCalled()
  expect(result.current.state).toEqual({ status: 'idle' })
})

it('cancels a superseded action before its module resolves and starts only the latest request', async () => {
  mockRequest.mockResolvedValueOnce({ variants: ['latest'], remaining: 3 })
  const { result } = await renderHook(() => useAuthorDraft('description'))
  let first: Promise<void> | undefined
  let second: Promise<void> | undefined
  await act(async () => {
    first = result.current.suggest('title')
    second = result.current.suggest('meta')
    await Promise.all([first, second])
  })
  expect(mockLoaded).toHaveBeenCalledTimes(1)
  expect(mockRequest).toHaveBeenCalledTimes(1)
  expect(mockRequest.mock.calls[0][0].kind).toBe('meta')
})

it('keeps the latest result when an older request resolves after replacement', async () => {
  let finishOld: (value: unknown) => void = () => {}
  mockRequest.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve }))
  mockRequest.mockResolvedValueOnce({ variants: ['latest'], remaining: 3 })
  const { result } = await renderHook(() => useAuthorDraft('description'))
  let old: Promise<void> | undefined
  await act(async () => { old = result.current.suggest('title') })
  await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
  const oldSignal = mockRequest.mock.calls[0][0].signal as AbortSignal
  await act(async () => { await result.current.suggest('meta') })
  expect(oldSignal.aborted).toBe(true)
  expect(result.current.state).toEqual({ status: 'variants', kind: 'meta', variants: ['latest'], remaining: 3 })
  await act(async () => { finishOld({ variants: ['obsolete'], remaining: 4 }); await old })
  expect(result.current.state).toMatchObject({ kind: 'meta', variants: ['latest'] })
})

it('aborts an active request on unmount', async () => {
  let finish: (value: unknown) => void = () => {}
  mockRequest.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const { result, unmount } = await renderHook(() => useAuthorDraft('description'))
  let pending: Promise<void> | undefined
  await act(async () => { pending = result.current.suggest('trip') })
  await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
  const signal = mockRequest.mock.calls[0][0].signal as AbortSignal
  await unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => { finish({ variants: ['late'], remaining: 2 }); await pending })
})
