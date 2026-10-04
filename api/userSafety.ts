// api/userSafety.ts
// Trust & Safety (Sprint 16, FE-430; #2133): жалоба на любой контент и блокировка.
//
// КОНТРАКТ ЭНДПОИНТОВ (BE #2129, BE-block-user #427):
//   POST   /reports/            body { content_type, object_id, reason, comment? }
//                               → 201 { id, due_at }; 409 — открытая жалоба уже есть.
//                               Профиль — тот же канал с content_type='user'
//                               (бэк считает reported_by_me по нему).
//   GET    /user/report-reasons/ → [{ key, label }]
//   POST   /user/{id}/block/    → 201 { blocked: true } (снимает взаимную подписку)
//   DELETE /user/{id}/block/    → 204
//   GET    /user/blocked/       → пагинированный список UserProfileDto
//
// Production contract verified by board #919. In-memory mocks are development-only.

import { apiClient, ApiError } from '@/api/client'
import type { UserProfileDto } from '@/api/user'
import { contentRefKey, type ContentRef } from '@/types/contentSafety'
import { resolveDevMockFlag } from '@/utils/devMockFlags'
import { devWarn } from '@/utils/logger'
import { translate as i18nT } from '@/i18n'

export type ReportReasonKey =
  | 'spam'
  | 'harassment'
  | 'scam'
  | 'inappropriate_content'
  | 'fake_account'
  | 'other'

export interface ReportReason {
  key: ReportReasonKey
  label: string
}

export interface SubmitReportInput {
  target: ContentRef
  reason: ReportReasonKey
  comment?: string
}

export interface ReportResult {
  id: number
  /** Срок ответа модерации (24 ч, #2129); null — жалоба уже была подана раньше (409). */
  due_at: string | null
}

// Дефолтный справочник причин — используется, если BE не отдаёт /report-reasons/.
export const DEFAULT_REPORT_REASONS: ReportReason[] = [
  { key: 'spam', get label() { return i18nT('sharedStatic:userSafety.reason.spam') } },
  { key: 'harassment', get label() { return i18nT('sharedStatic:userSafety.reason.harassment') } },
  { key: 'scam', get label() { return i18nT('sharedStatic:userSafety.reason.scam') } },
  { key: 'inappropriate_content', get label() { return i18nT('sharedStatic:userSafety.reason.inappropriateContent') } },
  { key: 'fake_account', get label() { return i18nT('sharedStatic:userSafety.reason.fakeAccount') } },
  { key: 'other', get label() { return i18nT('sharedStatic:userSafety.reason.other') } },
]

const USE_MOCK = resolveDevMockFlag({
  name: 'EXPO_PUBLIC_SAFETY_MOCK',
  value: process.env.EXPO_PUBLIC_SAFETY_MOCK,
})

const shouldFallbackToMock = (error: unknown): boolean => {
  if (USE_MOCK) return true
  if (!__DEV__) return false
  return error instanceof ApiError && [0, 404, 501].includes(error.status)
}

// In-memory мок-стор: видим свои жалобы/блокировки до перезагрузки страницы.
const mockReported = new Set<string>()
const mockBlocked = new Set<string>()
let mockReportSeq = 5000

const key = (userId: string | number): string => String(userId)

type MaybePaginated<T> =
  | T[]
  | { data?: T[]; results?: T[] }
  | null
  | undefined

const unwrapList = <T>(payload: MaybePaginated<T>): T[] => {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.results)) return payload.results
  return []
}

/** Справочник причин жалобы. При недоступности эндпоинта — дефолтный список. */
export async function fetchReportReasons(): Promise<ReportReason[]> {
  if (USE_MOCK) return DEFAULT_REPORT_REASONS
  try {
    const res = await apiClient.get<ReportReason[]>('/user/report-reasons/')
    const list = Array.isArray(res) ? res : []
    return list.length ? list : DEFAULT_REPORT_REASONS
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[safety] report-reasons → default fallback')
      return DEFAULT_REPORT_REASONS
    }
    throw error
  }
}

const mockReport = (target: ContentRef): ReportResult => {
  mockReported.add(contentRefKey(target))
  mockReportSeq += 1
  return { id: mockReportSeq, due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }
}

/** Подать жалобу на объект. 409 (открытая жалоба уже есть) трактуем как поданную. */
export async function reportContent(input: SubmitReportInput): Promise<ReportResult> {
  const body: { content_type: string; object_id: number; reason: ReportReasonKey; comment?: string } = {
    content_type: input.target.content_type,
    object_id: input.target.object_id,
    reason: input.reason,
  }
  const comment = input.comment?.trim()
  if (comment) body.comment = comment

  if (USE_MOCK) return mockReport(input.target)
  try {
    const res = await apiClient.post<ReportResult>('/reports/', body)
    return { id: res?.id ?? 0, due_at: res?.due_at ?? null }
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return { id: 0, due_at: null }
    }
    if (shouldFallbackToMock(error)) {
      devWarn('[safety] report → mock fallback')
      return mockReport(input.target)
    }
    throw error
  }
}

/** Заблокировать пользователя (взаимная невидимость; снимает взаимную подписку на BE). */
export async function blockUser(userId: string | number): Promise<void> {
  if (USE_MOCK) {
    mockBlocked.add(key(userId))
    return
  }
  try {
    await apiClient.post<unknown>(`/user/${userId}/block/`)
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[safety] block → mock fallback')
      mockBlocked.add(key(userId))
      return
    }
    throw error
  }
}

/** Разблокировать пользователя. */
export async function unblockUser(userId: string | number): Promise<void> {
  if (USE_MOCK) {
    mockBlocked.delete(key(userId))
    return
  }
  try {
    await apiClient.delete<unknown>(`/user/${userId}/block/`)
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[safety] unblock → mock fallback')
      mockBlocked.delete(key(userId))
      return
    }
    throw error
  }
}

/** Список заблокированных пользователей (экран настроек «Заблокированные»). */
export async function fetchBlockedUsers(): Promise<UserProfileDto[]> {
  if (USE_MOCK) return []
  try {
    const res = await apiClient.get<MaybePaginated<UserProfileDto>>('/user/blocked/')
    return unwrapList(res)
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[safety] blocked list → mock fallback')
      return []
    }
    throw error
  }
}

// DEV-хелперы: первичные флаги профиля приходят с BE (reported_by_me/is_blocked_by_me),
// но в мок-режиме их нет — даём актуальное локальное состояние оптимистичным апдейтам.
export const isMockReported = (target: Pick<ContentRef, 'content_type' | 'object_id'>): boolean =>
  (USE_MOCK || __DEV__) && mockReported.has(contentRefKey(target))

export const isMockBlocked = (userId: string | number): boolean =>
  (USE_MOCK || __DEV__) && mockBlocked.has(key(userId))
