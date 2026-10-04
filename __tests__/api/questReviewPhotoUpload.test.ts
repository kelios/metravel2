/**
 * Сериализация загрузки фото отзыва (#1579) и web-сжатие перед отправкой (#2150).
 *
 * Проверяется реальное тело запроса, а не факт вызова примитива: расхождение с
 * контрактом (`media_assets/serializers.py:105`) даёт 400 уже на устройстве, и
 * мок `uploadImage` такой дефект не увидел бы.
 */

import {
  QUEST_REVIEW_PHOTO_COLLECTION,
  QUEST_REVIEW_PHOTO_LIMIT,
  QUEST_REVIEW_PHOTO_MAX_SIDE,
  buildQuestReviewPhotoFormData,
  uploadQuestReviewPhoto,
} from '@/api/questReviewPhoto'

const mockUploadImage = jest.fn()
jest.mock('@/api/misc', () => ({
  uploadImage: (...args: unknown[]) => mockUploadImage(...args),
}))

const mockPrepareWebImage = jest.fn()
jest.mock('@/utils/webImageUpload', () => ({
  prepareWebImageFileForUpload: (...args: unknown[]) => mockPrepareWebImage(...args),
}))

const file = { uri: 'file:///photo.jpg', name: 'photo.jpg', type: 'image/jpeg' }

describe('quest review photo upload contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUploadImage.mockResolvedValue({ ok: true, id: 42, url: 'https://cdn/photo.jpg' })
    mockPrepareWebImage.mockImplementation(async (input: File) => input)
  })

  it('serializes id, collection and file for an unattached photo', () => {
    const form = buildQuestReviewPhotoFormData({ reviewId: 17, file })

    expect(form.get('id')).toBe('17')
    expect(form.get('collection')).toBe(QUEST_REVIEW_PHOTO_COLLECTION)
    expect(form.get('collection')).toBe('questReviewPhoto')
    expect(form.getAll('file')).toHaveLength(1)
    // Ключа быть не должно вовсе: сервер отличает «поля нет» от пустого
    // значения, а пустая строка не пройдёт IntegerField.
    expect(form.has('step_id')).toBe(false)
  })

  it('adds step_id only when the photo is attached to a point', () => {
    const form = buildQuestReviewPhotoFormData({ reviewId: 17, file, stepId: 903 })
    expect(form.get('step_id')).toBe('903')
  })

  it('drops a non-positive or non-integer step_id instead of sending a broken value', () => {
    expect(buildQuestReviewPhotoFormData({ reviewId: 17, file, stepId: 0 }).has('step_id')).toBe(false)
    expect(buildQuestReviewPhotoFormData({ reviewId: 17, file, stepId: null }).has('step_id')).toBe(false)
    expect(
      buildQuestReviewPhotoFormData({ reviewId: 17, file, stepId: 1.5 }).has('step_id'),
    ).toBe(false)
  })

  it('keeps the client limit equal to the server one', () => {
    expect(QUEST_REVIEW_PHOTO_LIMIT).toBe(3)
  })

  it('passes the built form to the shared uploader and normalizes the response', async () => {
    const result = await uploadQuestReviewPhoto({ reviewId: 17, file })

    expect(mockUploadImage).toHaveBeenCalledTimes(1)
    const sent = mockUploadImage.mock.calls[0][0] as FormData
    expect(sent).toBeInstanceOf(FormData)
    expect(sent.get('id')).toBe('17')
    // onProgress передаётся всегда: на web он включает XHR со сторожем простоя.
    expect(mockUploadImage.mock.calls[0][1]).toEqual(expect.any(Function))
    // Native-дескриптор уже уменьшен при выборе и web-конвейер не проходит.
    expect(mockPrepareWebImage).not.toHaveBeenCalled()
    expect(result).toEqual({ id: 42, url: 'https://cdn/photo.jpg', sizeBytes: null })
  })

  it('sends the web-compressed file, not the original File', async () => {
    const original = new File([new Uint8Array(5_000_000)], 'IMG_0001.HEIC', { type: 'image/heic' })
    const compressed = new File([new Uint8Array(600_000)], 'IMG_0001.jpg', { type: 'image/jpeg' })
    mockPrepareWebImage.mockResolvedValueOnce(compressed)
    const phases: Array<[string, number | null]> = []
    const onProgress = jest.fn()

    const result = await uploadQuestReviewPhoto(
      { reviewId: 17, file: original, clientUploadId: 'k-1' },
      { onPhase: (phase, info) => phases.push([phase, info.sizeBytes]), onProgress },
    )

    expect(mockPrepareWebImage).toHaveBeenCalledWith(original, { maxSide: QUEST_REVIEW_PHOTO_MAX_SIDE })
    expect(QUEST_REVIEW_PHOTO_MAX_SIDE).toBe(1920)
    const sent = mockUploadImage.mock.calls[0][0] as FormData
    const sentFile = sent.get('file') as File
    expect(sentFile.name).toBe('IMG_0001.jpg')
    expect(sentFile.size).toBe(600_000)
    expect(sent.get('client_upload_id')).toBe('k-1')
    expect(mockUploadImage.mock.calls[0][1]).toBe(onProgress)
    expect(phases).toEqual([
      ['compressing', 5_000_000],
      ['uploading', 600_000],
    ])
    expect(result.sizeBytes).toBe(600_000)
  })

  it('refuses a review id that cannot address an upload', async () => {
    await expect(uploadQuestReviewPhoto({ reviewId: 0, file })).rejects.toThrow()
    expect(mockUploadImage).not.toHaveBeenCalled()
  })
})
