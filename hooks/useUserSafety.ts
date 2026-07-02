// hooks/useUserSafety.ts
// React Query хуки Trust & Safety (Sprint 16, FE-430): причины жалоб, подача жалобы,
// блокировка/разблокировка. Мутации инвалидируют профиль, чтобы обновились флаги
// reported_by_me / is_blocked_by_me и серверная фильтрация контента.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  blockUser,
  fetchBlockedUsers,
  fetchReportReasons,
  reportUser,
  unblockUser,
  type ReportReason,
  type ReportResult,
  type SubmitReportInput,
} from '@/api/userSafety'
import type { UserProfileDto } from '@/api/user'
import { ApiError, isTimeoutError } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'

const STALE_TIME = 5 * 60 * 1000

const isAuthError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403)

const retry = (failureCount: number, error: unknown): boolean =>
  !isAuthError(error) && !isTimeoutError(error) && failureCount < 2

export function useReportReasons() {
  return useQuery<ReportReason[]>({
    queryKey: queryKeys.userReportReasons(),
    queryFn: fetchReportReasons,
    staleTime: 60 * 60 * 1000,
    retry,
  })
}

export function useBlockedUsers(enabled = true) {
  return useQuery<UserProfileDto[]>({
    queryKey: queryKeys.myBlockedUsers(),
    queryFn: fetchBlockedUsers,
    enabled,
    staleTime: STALE_TIME,
    retry,
  })
}

export function useReportUser() {
  const qc = useQueryClient()
  return useMutation<ReportResult, unknown, SubmitReportInput>({
    mutationFn: reportUser,
    onSuccess: (_res, input) => {
      void qc.invalidateQueries({ queryKey: queryKeys.userProfile(input.userId) })
    },
  })
}

export function useBlockUser() {
  const qc = useQueryClient()
  return useMutation<void, unknown, string | number>({
    mutationFn: blockUser,
    onSuccess: (_res, userId) => {
      void qc.invalidateQueries({ queryKey: queryKeys.userProfile(userId) })
      void qc.invalidateQueries({ queryKey: queryKeys.myBlockedUsers() })
    },
  })
}

export function useUnblockUser() {
  const qc = useQueryClient()
  return useMutation<void, unknown, string | number>({
    mutationFn: unblockUser,
    onSuccess: (_res, userId) => {
      void qc.invalidateQueries({ queryKey: queryKeys.userProfile(userId) })
      void qc.invalidateQueries({ queryKey: queryKeys.myBlockedUsers() })
    },
  })
}
