// stores/questReviewUploadStore.ts
// Очередь загрузки фото к отзыву о квесте вне дерева компонентов (#2150).
//
// Раньше статусы жили в состоянии `QuestReviewSection`: закрыл окно отзыва —
// очередь пропала, вернулся — ни статусов, ни «Повторить» (остаток #1579).
// Ключ — PK отзыва: загрузка адресуется им, и любой экран, где показан этот
// отзыв (окно на странице квеста, финал), видит одну и ту же очередь.
//
// Хранилище только в памяти вкладки: `File` не сериализуется, поэтому
// перезагрузка страницы очередь теряет, а закрытие окна — нет.

import { create } from 'zustand'

import type { QuestReviewPhotoFile } from '@/api/questReviewPhoto'

export type QuestReviewPhotoUploadStatus =
  | 'queued'
  | 'compressing'
  | 'uploading'
  | 'uploaded'
  | 'failed'

export type QuestReviewUploadItem = {
  key: string
  name: string
  previewUri: string
  file: QuestReviewPhotoFile
  /** Один на все попытки снимка: идемпотентность повтора на бэке (#2171). */
  clientUploadId: string
  status: QuestReviewPhotoUploadStatus
  /** Доля отправленного тела 0–1; осмысленна в `uploading`. */
  progress: number
  attempts: number
}

export type QuestReviewUploadQueue = {
  reviewId: number
  questId?: string
  cityId?: string
  order: string[]
  items: Record<string, QuestReviewUploadItem>
}

export type QuestReviewUploadDraft = Pick<QuestReviewUploadItem, 'key' | 'name' | 'previewUri' | 'file'>

type QuestReviewUploadState = {
  queues: Record<number, QuestReviewUploadQueue>
  /** Добавляет новые снимки в очередь отзыва; уже известные ключи не дублирует. */
  enqueue: (
    reviewId: number,
    drafts: QuestReviewUploadDraft[],
    meta: { questId?: string; cityId?: string },
  ) => void
  patchItem: (reviewId: number, key: string, patch: Partial<QuestReviewUploadItem>) => void
  /** Возвращает недоехавший снимок в очередь; загруженный не трогает. */
  requeue: (reviewId: number, key: string) => void
}

let clientUploadCounter = 0
const nextClientUploadId = (): string => {
  clientUploadCounter += 1
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${clientUploadCounter}`
}

export const useQuestReviewUploadStore = create<QuestReviewUploadState>()((set) => ({
  queues: {},
  enqueue: (reviewId, drafts, meta) =>
    set((state) => {
      const current = state.queues[reviewId]
      const order = current ? [...current.order] : []
      const items = current ? { ...current.items } : {}
      let added = false
      for (const draft of drafts) {
        if (items[draft.key]) continue
        items[draft.key] = {
          ...draft,
          clientUploadId: nextClientUploadId(),
          status: 'queued',
          progress: 0,
          attempts: 0,
        }
        order.push(draft.key)
        added = true
      }
      if (!added && current) return state
      return {
        queues: {
          ...state.queues,
          [reviewId]: { reviewId, questId: meta.questId, cityId: meta.cityId, order, items },
        },
      }
    }),
  patchItem: (reviewId, key, patch) =>
    set((state) => {
      const queue = state.queues[reviewId]
      const item = queue?.items[key]
      if (!queue || !item) return state
      return {
        queues: {
          ...state.queues,
          [reviewId]: { ...queue, items: { ...queue.items, [key]: { ...item, ...patch } } },
        },
      }
    }),
  requeue: (reviewId, key) =>
    set((state) => {
      const queue = state.queues[reviewId]
      const item = queue?.items[key]
      if (!queue || !item || item.status !== 'failed') return state
      return {
        queues: {
          ...state.queues,
          [reviewId]: {
            ...queue,
            items: { ...queue.items, [key]: { ...item, status: 'queued', progress: 0 } },
          },
        },
      }
    }),
}))

/** Сводка очереди для интерфейса: итоговая строка и признаки «идёт» / «есть сбой». */
export const summarizeQuestReviewUploadQueue = (queue: QuestReviewUploadQueue | undefined) => {
  const items = queue ? queue.order.map((key) => queue.items[key]).filter(Boolean) : []
  const uploaded = items.filter((item) => item.status === 'uploaded').length
  const failed = items.filter((item) => item.status === 'failed').length
  return {
    items,
    total: items.length,
    uploaded,
    failed,
    isActive: items.some(
      (item) => item.status === 'queued' || item.status === 'compressing' || item.status === 'uploading',
    ),
  }
}
