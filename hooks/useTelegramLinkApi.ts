// hooks/useTelegramLinkApi.ts
// React Query хуки привязки Telegram к профилю (Sprint 15 / блок 6, FE-421).
// Серверный стейт — только через React Query. Все мутации инвалидируют
// queryKeys.myTelegramLink(owner), чтобы статус верификации/мессенджера переподтянулся.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  confirmTelegramAuth,
  fetchMyTelegramLink,
  startTelegramAuth,
  updateTelegramLink,
  type TelegramAuthStart,
  type TelegramLink,
  type UpdateTelegramLinkInput,
} from '@/api/telegramLink';
import { ApiError, isTimeoutError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { useQueryOwner } from '@/hooks/useQueryOwner';

const STALE_TIME = 5 * 60 * 1000;

const isAuthError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

const retry = (failureCount: number, error: unknown): boolean =>
  !isAuthError(error) && !isTimeoutError(error) && failureCount < 2;

/** Текущая привязка Telegram (только для авторизованного). */
export function useMyTelegramLink() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const owner = useQueryOwner();
  return useQuery<TelegramLink>({
    queryKey: queryKeys.myTelegramLink(owner),
    queryFn: fetchMyTelegramLink,
    enabled: isAuthenticated,
    staleTime: STALE_TIME,
    retry,
  });
}

/** Обновление username/предпочитаемого мессенджера. */
export function useUpdateTelegramLink() {
  const qc = useQueryClient();
  const owner = useQueryOwner();
  return useMutation<TelegramLink, unknown, UpdateTelegramLinkInput>({
    mutationFn: updateTelegramLink,
    onSuccess: (link) => {
      qc.setQueryData<TelegramLink>(queryKeys.myTelegramLink(owner), link);
      void qc.invalidateQueries({ queryKey: queryKeys.myTelegramLink(owner) });
    },
  });
}

/** Старт авторизации: BE отдаёт deeplink на t.me-бота. */
export function useStartTelegramAuth() {
  return useMutation<TelegramAuthStart, unknown, void>({
    mutationFn: startTelegramAuth,
  });
}

/** Подтверждение авторизации по токену из deeplink. */
export function useConfirmTelegramAuth() {
  const qc = useQueryClient();
  const owner = useQueryOwner();
  return useMutation<{ telegramVerified: true }, unknown, string>({
    mutationFn: confirmTelegramAuth,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.myTelegramLink(owner) });
    },
  });
}
