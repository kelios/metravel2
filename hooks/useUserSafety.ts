// hooks/useUserSafety.ts
// React Query хуки Trust & Safety (Sprint 16, FE-430): причины жалоб, подача жалобы
// на любой контент (#2133), блокировка/разблокировка. Блок (#2134) — слой кэша, а не две инвалидации:
// onMutate мгновенно вырезает контент автора из всех лент реестра
// (`api/blockSensitiveQueries.ts`), onError откатывает снимок, onSettled
// перезапрашивает реестр, профиль и список заблокированных.

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import {
  blockUser,
  fetchBlockedUsers,
  fetchReportReasons,
  reportContent,
  unblockUser,
  type ReportReason,
  type ReportResult,
  type SubmitReportInput,
} from '@/api/userSafety'
import type { UserProfileDto } from '@/api/user'
import { ApiError, isTimeoutError } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import {
  applyAuthorBlock,
  cancelBlockSensitiveQueries,
  invalidateBlockSensitiveQueries,
  isUserProfileOf,
  notifyAuthorUnblocked,
  patchProfileBlocked,
  releaseAuthorBlock,
  restoreBlockSnapshot,
  snapshotBlockSensitiveQueries,
  toAuthorId,
  type BlockSnapshot,
} from '@/api/blockSensitiveQueries'
import { useAuthStore } from '@/stores/authStore'
import { useQueryOwner } from '@/hooks/useQueryOwner'
import { showToast } from '@/utils/toast'
import { translate as i18nT } from '@/i18n'

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
  const owner = useQueryOwner()
  const authReady = useAuthStore((state) => state.authReady)
  return useQuery<UserProfileDto[]>({
    queryKey: queryKeys.myBlockedUsers(owner),
    queryFn: fetchBlockedUsers,
    enabled: enabled && authReady && owner !== null,
    staleTime: STALE_TIME,
    retry,
  })
}

const invalidateProfileOf = (qc: QueryClient, userId: string | number) =>
  qc.invalidateQueries({ predicate: (query) => isUserProfileOf(query.queryKey, userId) })

/**
 * Жалоба на объект любого типа (#2133). Подтверждение — один тост на все экраны:
 * Apple 1.2 требует, чтобы человек видел срок реакции модерации (24 ч, #2129).
 */
export function useReportContent() {
  const qc = useQueryClient()
  return useMutation<ReportResult, unknown, SubmitReportInput>({
    mutationFn: reportContent,
    onSuccess: (res, input) => {
      if (input.target.content_type === 'user') {
        void invalidateProfileOf(qc, input.target.object_id)
      }
      showToast({
        type: 'success',
        text1: i18nT(res.due_at ? 'sharedStatic:contentSafety.reportSent' : 'sharedStatic:contentSafety.reportAlreadySent'),
        text2: i18nT('sharedStatic:contentSafety.reportSla'),
      })
    },
  })
}

type BlockContext = { authorId: number | null; snapshot: BlockSnapshot }

export function useBlockUser() {
  const qc = useQueryClient()
  const owner = useQueryOwner()
  return useMutation<void, unknown, string | number, BlockContext>({
    mutationFn: blockUser,
    onMutate: async (userId) => {
      const authorId = toAuthorId(userId)
      if (authorId === null) return { authorId, snapshot: [] }
      // Отменяем полёты, чтобы ответ, ушедший до блока, не вернул автора поверх выреза.
      await cancelBlockSensitiveQueries(qc)
      const snapshot = snapshotBlockSensitiveQueries(qc, authorId)
      applyAuthorBlock(qc, authorId)
      return { authorId, snapshot }
    },
    onError: (_error, _userId, context) => {
      if (context?.authorId == null) return
      // Сначала снимаем id из набора: иначе guard вырезал бы восстановленный снимок заново.
      releaseAuthorBlock(context.authorId)
      restoreBlockSnapshot(qc, context.snapshot)
      showToast({ type: 'error', text1: i18nT('profile:components.profile.UserSafetyMenu.blockFailed') })
    },
    onSettled: (_res, error, userId) => {
      invalidateBlockSensitiveQueries(qc, error ? 'rollback' : 'block')
      void invalidateProfileOf(qc, userId)
      void qc.invalidateQueries({ queryKey: queryKeys.myBlockedUsers(owner) })
    },
  })
}

type UnblockContext = { authorId: number | null; previousBlocked: UserProfileDto[] | undefined }

export function useUnblockUser() {
  const qc = useQueryClient()
  const owner = useQueryOwner()
  return useMutation<void, unknown, string | number, UnblockContext>({
    mutationFn: unblockUser,
    onMutate: async (userId) => {
      const authorId = toAuthorId(userId)
      const blockedKey = queryKeys.myBlockedUsers(owner)
      await qc.cancelQueries({ queryKey: blockedKey })
      const previousBlocked = qc.getQueryData<UserProfileDto[]>(blockedKey)
      if (authorId === null) return { authorId, previousBlocked }
      // Список «Заблокированные» обновляется сразу, и guard перестаёт резать автора.
      qc.setQueryData<UserProfileDto[]>(blockedKey, (old) =>
        Array.isArray(old) ? old.filter((profile) => toAuthorId(profile.user) !== authorId) : old,
      )
      releaseAuthorBlock(authorId, false)
      patchProfileBlocked(qc, authorId, false)
      return { authorId, previousBlocked }
    },
    onError: (_error, _userId, context) => {
      if (context?.authorId == null) return
      // Сервер автора не разблокировал: возвращаем список и блок тем же путём, что при блоке.
      if (context.previousBlocked) qc.setQueryData(queryKeys.myBlockedUsers(owner), context.previousBlocked)
      applyAuthorBlock(qc, context.authorId)
      showToast({ type: 'error', text1: i18nT('profile:components.profile.UserSafetyMenu.unblockFailed') })
    },
    onSuccess: (_res, _userId, context) => {
      invalidateBlockSensitiveQueries(qc, 'unblock')
      if (context?.authorId != null) notifyAuthorUnblocked(context.authorId)
    },
    onSettled: (_res, _error, userId) => {
      void invalidateProfileOf(qc, userId)
      void qc.invalidateQueries({ queryKey: queryKeys.myBlockedUsers(owner) })
    },
  })
}
