/**
 * Очередь загрузки фото отзыва (#1579, #2150): последовательный прогон, статусы
 * по фото, «Повторить» догружает только недоехавшее, очередь переживает
 * размонтирование, события `quest_photo_upload` / `quest_photo_upload_failed`.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native'

import {
  classifyQuestPhotoUploadFailure,
  useQuestReviewPhotoUpload,
} from '@/hooks/useQuestReviewPhotoUpload'
import { useQuestReviewUploadStore } from '@/stores/questReviewUploadStore'
import { ApiError } from '@/api/clientErrors'
import { UploadTransportError } from '@/api/clientUploadTransport'
import type { QuestReviewPhotoDraft } from '@/components/quests/QuestReviewPhotoPicker'

const mockUpload = jest.fn()
const mockTrackPhotoUpload = jest.fn()
const mockTrackPhotoUploadFailed = jest.fn()

jest.mock('@/api/questReviewPhoto', () => ({
  uploadQuestReviewPhoto: (...args: unknown[]) => mockUpload(...args),
  QUEST_REVIEW_PHOTO_LIMIT: 3,
}))

jest.mock('@/utils/questReviewAnalytics', () => ({
  trackQuestPhotoUpload: (...args: unknown[]) => mockTrackPhotoUpload(...args),
  trackQuestPhotoUploadFailed: (...args: unknown[]) => mockTrackPhotoUploadFailed(...args),
}))

const draft = (key: string): QuestReviewPhotoDraft => ({
  key,
  previewUri: `file:///${key}.jpg`,
  name: `${key}.jpg`,
  file: { uri: `file:///${key}.jpg`, name: `${key}.jpg`, type: 'image/jpeg' },
})

type UploadOptions = {
  onPhase?: (phase: string, info: { sizeBytes: number | null }) => void
  onProgress?: (fraction: number) => void
}

const statusesOf = (reviewId: number) => {
  const queue = useQuestReviewUploadStore.getState().queues[reviewId]
  return Object.fromEntries(queue.order.map((key) => [key, queue.items[key].status]))
}

describe('useQuestReviewPhotoUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useQuestReviewUploadStore.setState({ queues: {} })
    mockUpload.mockResolvedValue({ id: 1, url: 'https://cdn/x.jpg', sizeBytes: 1000 })
  })

  it('uploads sequentially and reports one analytics event per confirmed photo', async () => {
    const order: string[] = []
    let inFlight = 0
    mockUpload.mockImplementation(async ({ file }: { file: { name: string } }) => {
      inFlight += 1
      // #1579: строго по одному запросу.
      expect(inFlight).toBe(1)
      order.push(file.name)
      await Promise.resolve()
      inFlight -= 1
      return { id: 1, url: 'https://cdn/x.jpg', sizeBytes: 1000 }
    })

    const { result } = renderHook(() => useQuestReviewPhotoUpload(77))

    act(() => {
      result.current.uploadAll(77, [draft('a'), draft('b')], { questId: 'minsk-cmok', cityId: '3' })
    })

    await waitFor(() => expect(result.current.uploaded).toBe(2))
    expect(order).toEqual(['a.jpg', 'b.jpg'])
    expect(mockTrackPhotoUpload).toHaveBeenCalledTimes(2)
    expect(mockTrackPhotoUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        questId: 'minsk-cmok',
        cityId: '3',
        reviewId: 77,
        sizeBytes: 1000,
        attempt: 1,
        durationMs: expect.any(Number),
      }),
    )
    expect(statusesOf(77)).toEqual({ a: 'uploaded', b: 'uploaded' })
    expect(result.current.hasUploaded).toBe(true)
    expect(result.current.isActive).toBe(false)
  })

  it('marks a rejected photo failed, keeps the queue going and reports the reason', async () => {
    mockUpload.mockRejectedValueOnce(new UploadTransportError('idle_timeout'))

    const { result } = renderHook(() => useQuestReviewPhotoUpload(77))
    act(() => {
      result.current.uploadAll(77, [draft('a'), draft('b')], { questId: 'q' })
    })

    await waitFor(() => expect(result.current.isActive).toBe(false))
    // Провал первого файла не обрывает очередь: второй всё равно уходит.
    expect(mockUpload).toHaveBeenCalledTimes(2)
    expect(statusesOf(77)).toEqual({ a: 'failed', b: 'uploaded' })
    expect(result.current.failed).toBe(1)
    expect(mockTrackPhotoUpload).toHaveBeenCalledTimes(1)
    expect(mockTrackPhotoUploadFailed).toHaveBeenCalledWith(
      expect.objectContaining({ reviewId: 77, reason: 'idle_timeout', attempt: 1 }),
    )
  })

  it('retry re-uploads only the failed photo with the same client upload id', async () => {
    mockUpload.mockRejectedValueOnce(new UploadTransportError('network'))

    const { result } = renderHook(() => useQuestReviewPhotoUpload(77))
    act(() => {
      result.current.uploadAll(77, [draft('a'), draft('b'), draft('c')])
    })
    await waitFor(() => expect(result.current.isActive).toBe(false))
    expect(statusesOf(77)).toEqual({ a: 'failed', b: 'uploaded', c: 'uploaded' })
    const firstClientId = mockUpload.mock.calls[0][0].clientUploadId
    expect(firstClientId).toEqual(expect.any(String))

    act(() => {
      result.current.retry('a')
    })
    await waitFor(() => expect(result.current.uploaded).toBe(3))

    // Первая попытка a, затем b, c и повтор только a — без дублей b и c.
    expect(mockUpload.mock.calls.map(([params]) => params.file.name)).toEqual([
      'a.jpg',
      'b.jpg',
      'c.jpg',
      'a.jpg',
    ])
    expect(mockUpload.mock.calls[3][0].clientUploadId).toBe(firstClientId)
    expect(mockTrackPhotoUpload).toHaveBeenLastCalledWith(expect.objectContaining({ attempt: 2 }))
  })

  it('shows per-photo phases and whole-percent progress', async () => {
    let finish: () => void = () => {}
    mockUpload.mockImplementation(
      (_params: unknown, { onPhase, onProgress }: UploadOptions) =>
        new Promise((resolve) => {
          onPhase?.('compressing', { sizeBytes: 5_000_000 })
          onPhase?.('uploading', { sizeBytes: 600_000 })
          onProgress?.(0.634)
          onProgress?.(0.6349)
          finish = () => resolve({ id: 1, url: null, sizeBytes: 600_000 })
        }),
    )

    const { result } = renderHook(() => useQuestReviewPhotoUpload(5))
    act(() => {
      result.current.uploadAll(5, [draft('a')])
    })

    await waitFor(() => expect(result.current.items[0]?.status).toBe('uploading'))
    expect(result.current.items[0].progress).toBe(0.63)

    await act(async () => {
      finish()
    })
    await waitFor(() => expect(result.current.items[0].status).toBe('uploaded'))
  })

  it('keeps the queue when the screen unmounts mid-upload and shows it on return', async () => {
    let finish: () => void = () => {}
    mockUpload.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ id: 1, url: null, sizeBytes: 10 })
        }),
    )

    const first = renderHook(() => useQuestReviewPhotoUpload(9))
    act(() => {
      first.result.current.uploadAll(9, [draft('a'), draft('b')])
    })
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1))
    first.unmount()

    await act(async () => {
      finish()
    })

    const second = renderHook(() => useQuestReviewPhotoUpload(9))
    await waitFor(() => expect(second.result.current.uploaded).toBe(2))
    expect(second.result.current.total).toBe(2)
  })

  it('does not duplicate drafts that are already queued', async () => {
    const { result } = renderHook(() => useQuestReviewPhotoUpload(77))
    act(() => {
      result.current.uploadAll(77, [draft('a')])
      result.current.uploadAll(77, [draft('a')])
    })
    await waitFor(() => expect(result.current.uploaded).toBe(1))
    expect(mockUpload).toHaveBeenCalledTimes(1)
  })

  it('ignores an empty draft list and an invalid review id', () => {
    const { result } = renderHook(() => useQuestReviewPhotoUpload(77))
    act(() => {
      result.current.uploadAll(77, [])
      result.current.uploadAll(0, [draft('a')])
    })
    expect(mockUpload).not.toHaveBeenCalled()
    expect(result.current.total).toBe(0)
  })
})

describe('classifyQuestPhotoUploadFailure', () => {
  it('names transport, http and unknown failures', () => {
    expect(classifyQuestPhotoUploadFailure(new UploadTransportError('response_timeout'))).toBe(
      'response_timeout',
    )
    expect(classifyQuestPhotoUploadFailure(new ApiError(400, 'bad'))).toBe('http_400')
    expect(classifyQuestPhotoUploadFailure(new ApiError(0, 'offline'))).toBe('network')
    expect(classifyQuestPhotoUploadFailure(new Error('x'))).toBe('unknown')
  })
})
