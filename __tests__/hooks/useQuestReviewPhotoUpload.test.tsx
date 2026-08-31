/**
 * Очередь загрузки фото отзыва и событие `quest_photo_upload` (#1579).
 */

import { renderHook, act, waitFor } from '@testing-library/react-native'

import { useQuestReviewPhotoUpload } from '@/hooks/useQuestReviewPhotoUpload'
import type { QuestReviewPhotoDraft } from '@/components/quests/QuestReviewPhotoPicker'

const mockUpload = jest.fn()
const mockTrackPhotoUpload = jest.fn()

jest.mock('@/api/questReviewPhoto', () => ({
  uploadQuestReviewPhoto: (...args: unknown[]) => mockUpload(...args),
  QUEST_REVIEW_PHOTO_LIMIT: 3,
}))

jest.mock('@/utils/questReviewAnalytics', () => ({
  trackQuestPhotoUpload: (...args: unknown[]) => mockTrackPhotoUpload(...args),
}))

const draft = (key: string): QuestReviewPhotoDraft => ({
  key,
  previewUri: `file:///${key}.jpg`,
  name: `${key}.jpg`,
  file: { uri: `file:///${key}.jpg`, name: `${key}.jpg`, type: 'image/jpeg' },
})

describe('useQuestReviewPhotoUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpload.mockResolvedValue({ id: 1, url: 'https://cdn/x.jpg' })
  })

  it('uploads sequentially and reports one analytics event per confirmed photo', async () => {
    const order: string[] = []
    mockUpload.mockImplementation(async ({ file }: { file: { name: string } }) => {
      order.push(file.name)
      return { id: 1, url: 'https://cdn/x.jpg' }
    })

    const { result } = renderHook(() =>
      useQuestReviewPhotoUpload({ questId: 'minsk-cmok', cityId: '3' }),
    )

    await act(async () => {
      await result.current.uploadAll(77, [draft('a'), draft('b')])
    })

    expect(order).toEqual(['a.jpg', 'b.jpg'])
    expect(mockTrackPhotoUpload).toHaveBeenCalledTimes(2)
    expect(mockTrackPhotoUpload).toHaveBeenCalledWith({
      questId: 'minsk-cmok',
      cityId: '3',
      reviewId: 77,
    })
    expect(result.current.statuses).toEqual({ a: 'uploaded', b: 'uploaded' })
    expect(result.current.failedNames).toEqual([])
    expect(result.current.hasUploaded).toBe(true)
  })

  it('does not emit the event for a photo the server rejected', async () => {
    mockUpload.mockRejectedValueOnce(new Error('network'))

    const { result } = renderHook(() => useQuestReviewPhotoUpload({ questId: 'q' }))

    await act(async () => {
      await result.current.uploadAll(77, [draft('a'), draft('b')])
    })

    // Провал первого файла не обрывает очередь: второй всё равно уходит.
    expect(mockUpload).toHaveBeenCalledTimes(2)
    expect(mockTrackPhotoUpload).toHaveBeenCalledTimes(1)
    expect(result.current.statuses).toEqual({ a: 'failed', b: 'uploaded' })
    // Файл назван поимённо — иначе игрок не знает, что именно потерялось.
    expect(result.current.failedNames).toEqual(['a.jpg'])
  })

  it('emits nothing when the player attached no photos', async () => {
    const { result } = renderHook(() => useQuestReviewPhotoUpload({ questId: 'q' }))

    await act(async () => {
      await result.current.uploadAll(77, [])
    })

    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockTrackPhotoUpload).not.toHaveBeenCalled()
  })

  it('never re-uploads an already saved photo on a repeated run', async () => {
    mockUpload.mockRejectedValueOnce(new Error('network'))
    const drafts = [draft('a'), draft('b')]

    const { result } = renderHook(() => useQuestReviewPhotoUpload({ questId: 'q' }))

    await act(async () => {
      await result.current.uploadAll(77, drafts)
    })
    await waitFor(() => expect(result.current.isUploading).toBe(false))

    mockUpload.mockClear()
    mockTrackPhotoUpload.mockClear()

    await act(async () => {
      await result.current.uploadAll(77, drafts)
    })

    // Второй прогон трогает только не доехавший файл: повтор успешного создал
    // бы дубль и съел бы серверный лимит трёх снимков.
    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(mockUpload.mock.calls[0][0].file.name).toBe('a.jpg')
    expect(mockTrackPhotoUpload).toHaveBeenCalledTimes(1)
    expect(result.current.failedNames).toEqual([])
  })

  it('refuses to upload without a saved review id', async () => {
    const { result } = renderHook(() => useQuestReviewPhotoUpload({ questId: 'q' }))

    await act(async () => {
      await result.current.uploadAll(0, [draft('a')])
    })

    expect(mockUpload).not.toHaveBeenCalled()
  })
})
