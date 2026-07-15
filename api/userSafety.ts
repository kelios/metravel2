// api/userSafety.ts
// Trust & Safety (Sprint 16, FE-430): жалоба на пользователя и блокировка.
//
// КОНТРАКТ ЭНДПОИНТОВ (BE-report-user #426, BE-block-user #427):
//   POST   /user/{id}/report/   body { reason, comment? } → 201 { id, status }
//   GET    /user/report-reasons/ → [{ key, label }]
//   POST   /user/{id}/block/    → 201 { blocked: true } (снимает взаимную подписку)
//   DELETE /user/{id}/block/    → 204
//   GET    /user/blocked/       → пагинированный список UserProfileDto
//
// Production contract verified by board #919. In-memory mocks are development-only.

import { apiClient, ApiError } from '@/api/client'
import type { UserProfileDto } from '@/api/user'
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
  userId: string | number
  reason: ReportReasonKey
  comment?: string
}

export interface ReportResult {
  id: number
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed'
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

/** Подать жалобу на пользователя. 409 (повторная жалоба) трактуем как уже поданную. */
export async function reportUser(input: SubmitReportInput): Promise<ReportResult> {
  const body: { reason: ReportReasonKey; comment?: string } = { reason: input.reason }
  const comment = input.comment?.trim()
  if (comment) body.comment = comment

  if (USE_MOCK) {
    mockReported.add(key(input.userId))
    mockReportSeq += 1
    return { id: mockReportSeq, status: 'pending' }
  }
  try {
    const res = await apiClient.post<ReportResult>(`/user/${input.userId}/report/`, body)
    return res ?? { id: 0, status: 'pending' }
  } catch (error) {
    // 409 — жалоба этого reporter на этого target уже существует (идемпотентно).
    if (error instanceof ApiError && error.status === 409) {
      return { id: 0, status: 'pending' }
    }
    if (shouldFallbackToMock(error)) {
      devWarn('[safety] report → mock fallback')
      mockReported.add(key(input.userId))
      mockReportSeq += 1
      return { id: mockReportSeq, status: 'pending' }
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
export const isMockReported = (userId: string | number): boolean =>
  (USE_MOCK || __DEV__) && mockReported.has(key(userId))

export const isMockBlocked = (userId: string | number): boolean =>
  (USE_MOCK || __DEV__) && mockBlocked.has(key(userId))
