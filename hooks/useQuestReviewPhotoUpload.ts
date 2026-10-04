// hooks/useQuestReviewPhotoUpload.ts
// Последовательная загрузка фото к уже сохранённому отзыву о квесте (#1579, #2150).
//
// Порядок «сначала подтверждённый отзыв, потом фото» — не выбор реализации, а
// следствие контракта: загрузка адресуется по PK записи QuestReview, которого до
// создания отзыва просто нет (`api/questReviewPhoto.ts`).
//
// Последовательно, а не тремя параллельными multipart-запросами: экран финала в
// этот момент догружает собственные данные, и на мобильной сети три
// одновременные загрузки конкурируют с ним, ухудшая видимый отклик.
//
// Очередь живёт в `stores/questReviewUploadStore.ts`, а прогон — здесь, вне
// React (#2150): закрытие окна отзыва не останавливает загрузку и не теряет
// статусы, любой экран с этим отзывом показывает ту же очередь.

import { useCallback, useMemo } from 'react'

import { ApiError } from '@/api/clientErrors'
import { UploadTransportError } from '@/api/clientUploadTransport'
import { uploadQuestReviewPhoto } from '@/api/questReviewPhoto'
import {
  summarizeQuestReviewUploadQueue,
  useQuestReviewUploadStore,
  type QuestReviewUploadDraft,
  type QuestReviewUploadItem,
} from '@/stores/questReviewUploadStore'
import {
  trackQuestPhotoUpload,
  trackQuestPhotoUploadFailed,
} from '@/utils/questReviewAnalytics'
import { HeicConversionError } from '@/utils/webImageUpload'

/** Причина сбоя для `quest_photo_upload_failed`. */
export const classifyQuestPhotoUploadFailure = (error: unknown): string => {
  if (error instanceof UploadTransportError) return error.reason
  if (error instanceof HeicConversionError) return 'compress_failed'
  if (error instanceof ApiError) return error.status > 0 ? `http_${error.status}` : 'network'
  return 'unknown'
}

const now = (): number => Date.now()

const running = new Set<number>()

const uploadItem = async (reviewId: number, item: QuestReviewUploadItem): Promise<void> => {
  const store = useQuestReviewUploadStore.getState()
  const queue = store.queues[reviewId]
  const attempt = item.attempts + 1
  const startedAt = now()
  let sizeBytes: number | null = null
  // Прогресс приходит десятки раз в секунду; интерфейсу нужны целые проценты.
  let shownPercent = -1

  store.patchItem(reviewId, item.key, { status: 'compressing', progress: 0, attempts: attempt })
  try {
    const result = await uploadQuestReviewPhoto(
      { reviewId, file: item.file, clientUploadId: item.clientUploadId },
      {
        onPhase: (phase, info) => {
          sizeBytes = info.sizeBytes
          useQuestReviewUploadStore.getState().patchItem(reviewId, item.key, { status: phase })
        },
        onProgress: (fraction) => {
          const percent = Math.floor(Math.min(1, Math.max(0, fraction)) * 100)
          if (percent === shownPercent) return
          shownPercent = percent
          useQuestReviewUploadStore.getState().patchItem(reviewId, item.key, { progress: percent / 100 })
        },
      },
    )
    useQuestReviewUploadStore.getState().patchItem(reviewId, item.key, { status: 'uploaded', progress: 1 })
    // Событие — строго по подтверждённой загрузке: до сюда доходит только
    // успешный ответ сервера.
    trackQuestPhotoUpload({
      questId: queue?.questId,
      cityId: queue?.cityId,
      reviewId,
      sizeBytes: result.sizeBytes ?? sizeBytes,
      durationMs: now() - startedAt,
      attempt,
    })
  } catch (error) {
    // Провал одного файла не прерывает очередь и не откатывает уже сохранённый
    // отзыв: иначе сетевой сбой на снимке заставил бы писать отзыв заново.
    useQuestReviewUploadStore.getState().patchItem(reviewId, item.key, { status: 'failed' })
    trackQuestPhotoUploadFailed({
      questId: queue?.questId,
      cityId: queue?.cityId,
      reviewId,
      sizeBytes,
      durationMs: now() - startedAt,
      attempt,
      reason: classifyQuestPhotoUploadFailure(error),
    })
  }
}

/**
 * Прогоняет очередь отзыва до конца. Один прогон на отзыв: повторный вызов во
 * время прогона ничего не запускает — снимок, возвращённый «Повторить», цикл
 * подберёт сам, потому что берёт следующий `queued` из хранилища на каждом шаге.
 */
export const runQuestReviewPhotoQueue = async (reviewId: number): Promise<void> => {
  if (running.has(reviewId)) return
  running.add(reviewId)
  try {
    while (true) {
      const queue = useQuestReviewUploadStore.getState().queues[reviewId]
      const next = queue?.order
        .map((key) => queue.items[key])
        .find((item) => item?.status === 'queued')
      if (!next) break
      await uploadItem(reviewId, next)
    }
  } finally {
    running.delete(reviewId)
  }
}

export type QuestReviewPhotoUploadState = ReturnType<typeof summarizeQuestReviewUploadQueue> & {
  /** Хоть один снимок сохранён — значит есть что ждать от модерации. */
  hasUploaded: boolean
  /** Ставит снимки в очередь отзыва и запускает прогон. */
  uploadAll: (
    reviewId: number,
    drafts: QuestReviewUploadDraft[],
    meta?: { questId?: string; cityId?: string },
  ) => void
  /** «Повторить»: возвращает недоехавший снимок в очередь, загруженные не трогает. */
  retry: (key: string) => void
}

export function useQuestReviewPhotoUpload(reviewId: number | null | undefined): QuestReviewPhotoUploadState {
  const queue = useQuestReviewUploadStore((state) =>
    reviewId ? state.queues[reviewId] : undefined,
  )
  const summary = useMemo(() => summarizeQuestReviewUploadQueue(queue), [queue])

  const uploadAll = useCallback<QuestReviewPhotoUploadState['uploadAll']>((targetReviewId, drafts, meta = {}) => {
    if (!Number.isInteger(targetReviewId) || targetReviewId <= 0 || drafts.length === 0) return
    useQuestReviewUploadStore.getState().enqueue(targetReviewId, drafts, meta)
    void runQuestReviewPhotoQueue(targetReviewId)
  }, [])

  const retry = useCallback(
    (key: string) => {
      if (!reviewId) return
      useQuestReviewUploadStore.getState().requeue(reviewId, key)
      void runQuestReviewPhotoQueue(reviewId)
    },
    [reviewId],
  )

  return { ...summary, hasUploaded: summary.uploaded > 0, uploadAll, retry }
}

export default useQuestReviewPhotoUpload
