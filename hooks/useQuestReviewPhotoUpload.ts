// hooks/useQuestReviewPhotoUpload.ts
// Последовательная загрузка фото к уже сохранённому отзыву о квесте (#1579).
//
// Порядок «сначала подтверждённый отзыв, потом фото» — не выбор реализации, а
// следствие контракта: загрузка адресуется по PK записи QuestReview, которого до
// создания отзыва просто нет (`api/questReviewPhoto.ts`).
//
// Последовательно, а не тремя параллельными multipart-запросами: экран финала в
// этот момент догружает собственные данные, и на мобильной сети три
// одновременные загрузки конкурируют с ним, ухудшая видимый отклик.

import { useCallback, useRef, useState } from 'react'

import { uploadQuestReviewPhoto } from '@/api/questReviewPhoto'
import { trackQuestPhotoUpload } from '@/utils/questReviewAnalytics'
import type {
  QuestReviewPhotoDraft,
  QuestReviewPhotoStatus,
} from '@/components/quests/QuestReviewPhotoPicker'

type Options = {
  /** Строковый quest_id — им идентифицируется квест в аналитике. */
  questId?: string
  cityId?: string
}

export type QuestReviewPhotoUploadState = {
  statuses: Record<string, QuestReviewPhotoStatus>
  /** Имена файлов, которые не доехали: их показывают игроку поимённо. */
  failedNames: string[]
  isUploading: boolean
  /** Хоть один снимок сохранён — значит есть что ждать от модерации. */
  hasUploaded: boolean
  uploadAll: (reviewId: number, drafts: QuestReviewPhotoDraft[]) => Promise<void>
}

export function useQuestReviewPhotoUpload({
  questId,
  cityId,
}: Options): QuestReviewPhotoUploadState {
  const [statuses, setStatuses] = useState<Record<string, QuestReviewPhotoStatus>>({})
  const [failedNames, setFailedNames] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [hasUploaded, setHasUploaded] = useState(false)
  // Снимок статусов, доступный синхронно: между итерациями цикла состояние
  // React ещё не применено, а повторный прогон обязан видеть уже загруженные.
  const statusesRef = useRef<Record<string, QuestReviewPhotoStatus>>({})
  const runningRef = useRef(false)

  const setStatus = useCallback((key: string, status: QuestReviewPhotoStatus) => {
    statusesRef.current = { ...statusesRef.current, [key]: status }
    setStatuses(statusesRef.current)
  }, [])

  const uploadAll = useCallback(
    async (reviewId: number, drafts: QuestReviewPhotoDraft[]) => {
      if (runningRef.current) return
      if (!Number.isInteger(reviewId) || reviewId <= 0 || drafts.length === 0) return

      runningRef.current = true
      setIsUploading(true)
      const failed: string[] = []

      try {
        for (const draft of drafts) {
          // Повторный прогон догружает только не доехавшее: уже сохранённый
          // снимок вторая загрузка превратила бы в дубль и съела бы лимит трёх.
          if (statusesRef.current[draft.key] === 'uploaded') continue

          setStatus(draft.key, 'uploading')
          try {
            await uploadQuestReviewPhoto({ reviewId, file: draft.file })
            setStatus(draft.key, 'uploaded')
            setHasUploaded(true)
            // Событие — строго по подтверждённой загрузке: до сюда доходит
            // только успешный ответ сервера.
            trackQuestPhotoUpload({ questId, cityId, reviewId })
          } catch {
            // Провал одного файла не прерывает очередь и не откатывает уже
            // сохранённый отзыв: иначе сетевой сбой на снимке заставил бы
            // писать отзыв заново.
            setStatus(draft.key, 'failed')
            failed.push(draft.name)
          }
        }
      } finally {
        setFailedNames(failed)
        setIsUploading(false)
        runningRef.current = false
      }
    },
    [cityId, questId, setStatus],
  )

  return { statuses, failedNames, isUploading, hasUploaded, uploadAll }
}

export default useQuestReviewPhotoUpload
