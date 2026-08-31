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
//   Ответ: { id, url }.
//
// Ограничения сервера, которые обязан повторять клиент:
//   - не больше трёх фото на отзыв (четвёртое → 400);
//   - загрузка снимает `review.moderation`, то есть отзыв снова уходит на
//     проверку — игроку это нужно объяснить, иначе задержка читается как потеря.

import { uploadImage } from '@/api/misc'
import { devError } from '@/utils/logger'

/**
 * Предел сервера (`media_assets/views.py:2437`). Живёт здесь, а не в компоненте:
 * пикер и адаптер обязаны считать одинаково, иначе игрок получит отказ уже
 * после выбора файла.
 */
export const QUEST_REVIEW_PHOTO_LIMIT = 3

export const QUEST_REVIEW_PHOTO_COLLECTION = 'questReviewPhoto'

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
}

export type QuestReviewPhotoUploadResult = {
  id: number | null
  url: string | null
}

/**
 * Собирает multipart ровно по контракту загрузки фото отзыва.
 * Вынесено отдельно от отправки, чтобы тело запроса можно было проверить
 * тестом, не мокая примитив загрузки.
 */
export const buildQuestReviewPhotoFormData = ({
  reviewId,
  file,
  stepId,
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
  return form
}

/**
 * Грузит одно фото к уже сохранённому отзыву.
 * Поверх существующего `uploadImage` (`api/misc.ts:438`): там уже живут
 * авторизация, refresh на 401 и валидация файла — второй клиент загрузки
 * завёл бы вторую копию этой логики.
 */
export const uploadQuestReviewPhoto = async (
  params: UploadQuestReviewPhotoParams,
): Promise<QuestReviewPhotoUploadResult> => {
  if (!Number.isInteger(params.reviewId) || params.reviewId <= 0) {
    throw new Error('uploadQuestReviewPhoto: reviewId must be a positive integer')
  }

  try {
    const response = await uploadImage(buildQuestReviewPhotoFormData(params))
    const rawId = (response as { id?: unknown }).id
    const rawUrl = (response as { url?: unknown }).url
    return {
      id: typeof rawId === 'number' && Number.isFinite(rawId) ? rawId : null,
      url: typeof rawUrl === 'string' && rawUrl ? rawUrl : null,
    }
  } catch (error) {
    devError('Error uploading quest review photo:', error)
    throw error
  }
}
