// hooks/useTripChatApi.ts
// React Query хуки чата участников поездки (Sprint 15 / блок 6, #422).
// Серверный стейт — только через React Query. Отправка дизейблится, когда
// can_post=false (архив завершённой поездки). Мок-режим до готовности BE.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchTripChat,
  fetchTripChatMessages,
  markTripChatRead,
  sendTripMessage,
  type MarkTripChatReadResult,
  type SendTripMessageInput,
  type TripChatMessage,
  type TripChatThread,
} from '@/api/tripChat'
import { ApiError, isTimeoutError } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useAuthStore } from '@/stores/authStore'

const STALE_TIME = 60 * 1000

const isAuthError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403)

const retry = (failureCount: number, error: unknown): boolean =>
  !isAuthError(error) && !isTimeoutError(error) && failureCount < 2

/** Тред чата поездки + статус/can_post (#418). */
export function useTripChat(tripId: string | number | null | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery<TripChatThread>({
    queryKey: queryKeys.tripChat(tripId),
    queryFn: () => fetchTripChat(tripId as string | number),
    enabled: isAuthenticated && tripId != null && tripId !== '',
    staleTime: STALE_TIME,
    retry,
  })
}

/** Сообщения треда (#422). */
export function useTripChatMessages(threadId: string | number | null | undefined) {
  return useQuery<TripChatMessage[]>({
    queryKey: queryKeys.tripChatMessages(threadId),
    queryFn: () => fetchTripChatMessages(threadId as string | number),
    enabled: threadId != null && threadId !== '',
    staleTime: STALE_TIME,
    retry,
  })
}

/** Отправка сообщения в тред. */
export function useSendTripMessage(threadId: string | number | null | undefined) {
  const qc = useQueryClient()
  return useMutation<TripChatMessage, unknown, string>({
    mutationFn: (text: string) => {
      const input: SendTripMessageInput = { threadId: Number(threadId), text }
      return sendTripMessage(input)
    },
    onSuccess: (message) => {
      // Дописать сообщение в кэш сразу, затем синхронизироваться с сервером.
      qc.setQueryData<TripChatMessage[]>(
        queryKeys.tripChatMessages(threadId),
        (old) => {
          const list = old ?? []
          if (list.some((m) => m.id === message.id)) return list
          return [...list, message]
        },
      )
      void qc.invalidateQueries({ queryKey: queryKeys.tripChatMessages(threadId) })
    },
  })
}

/** Пометить тред прочитанным. Сбрасывает unread_count в кэше треда. */
export function useMarkTripChatRead(threadId: string | number | null | undefined) {
  const qc = useQueryClient()
  return useMutation<MarkTripChatReadResult, unknown, number | undefined>({
    mutationFn: (lastReadMessageId?: number) =>
      markTripChatRead(Number(threadId), lastReadMessageId),
    onSuccess: (result) => {
      // Тред чата кэшируется по tripId (а не threadId), поэтому обновляем
      // unread_count во всех trip-chat кэшах, чей thread совпал с прочитанным.
      qc.setQueriesData<TripChatThread>(
        { queryKey: queryKeys.tripChatAll(), exact: false },
        (old) =>
          old && old.threadId === result.threadId
            ? { ...old, unreadCount: result.unreadCount }
            : old,
      )
    },
  })
}
