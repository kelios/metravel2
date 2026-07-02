// hooks/useContactRequestsApi.ts
// React Query хуки заявок на раскрытие контактов (Sprint 15 / FE-424).
// Серверный стейт — только через React Query. Мутация (grant/decline/revoke)
// инвалидирует все списки заявок и профили (раскрытие меняет contact_access).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchContactRequests,
  updateContactRequest,
  type ContactAccessRequest,
  type ContactRequestDecision,
  type ContactRequestDirection,
  type ContactRequestStatus,
} from '@/api/contactRequests';
import { ApiError, isTimeoutError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/stores/authStore';

const STALE_TIME = 60 * 1000;

const isAuthError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

const retry = (failureCount: number, error: unknown): boolean =>
  !isAuthError(error) && !isTimeoutError(error) && failureCount < 2;

/** Список заявок текущего пользователя в заданном направлении/статусе (#419). */
export function useContactRequests(
  direction: ContactRequestDirection,
  status?: ContactRequestStatus,
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<ContactAccessRequest[]>({
    queryKey: queryKeys.contactRequests(direction, status),
    queryFn: () => fetchContactRequests(direction, status),
    enabled: isAuthenticated,
    staleTime: STALE_TIME,
    retry,
  });
}

export interface UpdateContactRequestInput {
  id: number;
  status: ContactRequestDecision;
}

/** Решение по заявке: target → grant/decline, requester → revoke (#419). */
export function useUpdateContactRequest() {
  const qc = useQueryClient();
  return useMutation<ContactAccessRequest, unknown, UpdateContactRequestInput>({
    mutationFn: ({ id, status }) => updateContactRequest(id, status),
    onSuccess: (result) => {
      // Любой список заявок мог измениться (статус ушёл из pending).
      void qc.invalidateQueries({ queryKey: queryKeys.contactRequestsAll() });
      // Раскрытие/отзыв меняет contact_access в профилях обеих сторон.
      void qc.invalidateQueries({ queryKey: queryKeys.userProfile(result.requester.id) });
      void qc.invalidateQueries({ queryKey: queryKeys.userProfile(result.target.id) });
    },
  });
}
