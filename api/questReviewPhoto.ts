// api/questReviewPhoto.ts
// Загрузка фото игрока к отзыву о квесте (#1579, backend-контракт #1575).
//
// КОНТРАКТ ЭНДПОИНТА (`media_assets/views.py:2403`, `media_assets/serializers.py:105`):
//
//   POST /api/upload   (multipart/form-data)
//     id         — PK записи QuestReview, а НЕ id квеста: сервер грузит фото
//                  «внутрь» уже созданного отзыва и сверяет `review.user_id`
//                  с авторизацией, отвечая 403 на чужой отзыв.
//     collection — строго 'questReviewPhoto'.
//     file       — изображение.
//     step_id    — опционально, PK шага (не строковый `step_id` квеста!).
//                  Разрешён ТОЛЬКО для этой коллекции: у остальных сервер
//                  отвечает 400.
//     client_upload_id — ключ снимка для идемпотентного повтора (#2171). Пока
//                  бэк его не поддержал, DRF неизвестное поле игнорирует; после
//                  выката повтор после потерянного ответа не создаёт дубль.
//   Ответ: { id, url }.
//
// Ограничения сервера, которые обязан повторять клиент:
//   - не больше трёх фото на отзыв (четвёртое → 400);
//   - загрузка снимает `review.moderation`, то есть отзыв снова уходит на
//     проверку — игроку это нужно объяснить, иначе задержка читается как потеря.

import { uploadImage } from '@/api/misc'
import { devError } from '@/utils/logger'
import { prepareWebImageFileForUpload } from '@/utils/webImageUpload'

/**
 * Предел сервера (`media_assets/views.py:2437`). Живёт здесь, а не в компоненте:
 * пикер и адаптер обязаны считать одинаково, иначе игрок получит отказ уже
 * после выбора файла.
 */
export const QUEST_REVIEW_PHOTO_LIMIT = 3

export const QUEST_REVIEW_PHOTO_COLLECTION = 'questReviewPhoto'

/**
 * Длинная сторона, до которой web сжимает фото отзыва перед отправкой (#2150).
 * 1920 = мастер сервера (`ImageProcessingConfig.max_width`): больше он всё равно
 * не хранит, а print-варианта 2500, ради которого редактор путешествий шлёт
 * крупнее, у отзыва нет. Native жмёт при выборе (`compressTravelPhoto`).
 */
export const QUEST_REVIEW_PHOTO_MAX_SIDE = 1920

/**
 * Файл в том виде, в каком его отдаёт пикер:
 * - web — настоящий `File` (RN-объект `{uri,name,type}` FormData сериализует в
 *   строку `"[object Object]"`, и бэкенд отвечает 400; ловушка уже описана в
 *   `hooks/useAvatarUpload.ts:188`);
 * - native — дескриптор `{uri,name,type}`, который понимает RN-реализация FormData.
 */
export type QuestReviewPhotoFile =
  | File
  | { uri: string; name: string; type: string }

export type UploadQuestReviewPhotoParams = {
  /** PK записи QuestReview из ответа `submitQuestReview`. */
  reviewId: number
  file: QuestReviewPhotoFile
  /** PK шага квеста, если фото привязано к точке. Не строковый `step_id`. */
  stepId?: number | null
  /** Ключ снимка, один на все попытки: делает повтор идемпотентным (#2171). */
  clientUploadId?: string
}

export type QuestReviewPhotoUploadPhase = 'compressing' | 'uploading'

export type UploadQuestReviewPhotoOptions = {
  /** Фаза и размер уходящего файла — для статуса снимка и аналитики. */
  onPhase?: (phase: QuestReviewPhotoUploadPhase, info: { sizeBytes: number | null }) => void
  /** Доля отправленного тела 0–1. */
  onProgress?: (fraction: number) => void
}

export type QuestReviewPhotoUploadResult = {
  id: number | null
  url: string | null
  /** Сколько байт ушло на сервер (после сжатия); null — размер неизвестен (native). */
  sizeBytes: number | null
}

const isWebFile = (file: QuestReviewPhotoFile): file is File =>
  typeof File !== 'undefined' && file instanceof File

/**
 * На web — общий конвейер web-загрузки (#1164): HEIC → JPEG и уменьшение до
 * `QUEST_REVIEW_PHOTO_MAX_SIDE`. На native файл уже уменьшен при выборе.
 */
export const prepareQuestReviewPhotoFile = async (
  file: QuestReviewPhotoFile,
): Promise<QuestReviewPhotoFile> =>
  isWebFile(file)
    ? await prepareWebImageFileForUpload(file, { maxSide: QUEST_REVIEW_PHOTO_MAX_SIDE })
    : file

/**
 * Собирает multipart ровно по контракту загрузки фото отзыва.
 * Вынесено отдельно от отправки, чтобы тело запроса можно было проверить
 * тестом, не мокая примитив загрузки.
 */
export const buildQuestReviewPhotoFormData = ({
  reviewId,
  file,
  stepId,
  clientUploadId,
}: UploadQuestReviewPhotoParams): FormData => {
  const form = new FormData()
  form.append('id', String(reviewId))
  form.append('collection', QUEST_REVIEW_PHOTO_COLLECTION)
  // На web в FormData уходит настоящий File; на native — RN-дескриптор, который
  // сериализует уже сама платформа.
  form.append('file', file as unknown as Blob)
  // Ключ добавляется только при реальной привязке к точке: сервер отличает
  // «нет поля» от «поле есть, но пустое», и пустая строка не пройдёт IntegerField.
  if (typeof stepId === 'number' && Number.isInteger(stepId) && stepId > 0) {
    form.append('step_id', String(stepId))
  }
  if (clientUploadId) form.append('client_upload_id', clientUploadId)
  return form
}

/**
 * Грузит одно фото к уже сохранённому отзыву.
 * Поверх существующего `uploadImage` (`api/misc.ts`): там уже живут
 * авторизация, refresh на 401 и валидация файла — второй клиент загрузки
 * завёл бы вторую копию этой логики. `onProgress` передаётся всегда: на web он
 * включает XHR-ветку со сторожем простоя вместо 65 с на всю попытку (#2150).
 */
export const uploadQuestReviewPhoto = async (
  params: UploadQuestReviewPhotoParams,
  { onPhase, onProgress }: UploadQuestReviewPhotoOptions = {},
): Promise<QuestReviewPhotoUploadResult> => {
  if (!Number.isInteger(params.reviewId) || params.reviewId <= 0) {
    throw new Error('uploadQuestReviewPhoto: reviewId must be a positive integer')
  }

  try {
    onPhase?.('compressing', { sizeBytes: isWebFile(params.file) ? params.file.size : null })
    const file = await prepareQuestReviewPhotoFile(params.file)
    const sizeBytes = isWebFile(file) ? file.size : null
    onPhase?.('uploading', { sizeBytes })
    const response = await uploadImage(
      buildQuestReviewPhotoFormData({ ...params, file }),
      onProgress ?? (() => {}),
    )
    const rawId = (response as { id?: unknown }).id
    const rawUrl = (response as { url?: unknown }).url
    return {
      id: typeof rawId === 'number' && Number.isFinite(rawId) ? rawId : null,
      url: typeof rawUrl === 'string' && rawUrl ? rawUrl : null,
      sizeBytes,
    }
  } catch (error) {
    devError('Error uploading quest review photo:', error)
    throw error
  }
}
