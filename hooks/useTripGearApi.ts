// hooks/useTripGearApi.ts
// React Query для чеклиста снаряжения поездки (#1839).
//
// Кэш чеклиста правится точечно ответом сервера, а не инвалидацией: чип статуса
// переключается тапом и должен отвечать мгновенно, а полный рефетч после каждого
// PATCH возвращал бы список на один кадр в прежнее состояние.

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import {
  addTripGearItem,
  applyTripGearTemplate,
  deleteTripGearItem,
  fetchTripGear,
  updateTripGearItem,
  type AddTripGearInput,
  type DeleteTripGearInput,
  type TripGearItem,
  type UpdateTripGearInput,
} from '@/api/plannedTripsGear'
import { ApiError, isTimeoutError } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'

const STALE_TIME = 60 * 1000

// 401/403 не чинятся повтором, а 404/501 означают «эндпоинта нет» — повтор
// такого запроса только задерживает показ пустого состояния.
const isFinalError = (error: unknown): boolean =>
  error instanceof ApiError && [401, 403, 404, 501].includes(error.status)

const writeList = (
  qc: QueryClient,
  tripId: number | string,
  update: (items: TripGearItem[]) => TripGearItem[],
): TripGearItem[] | undefined => {
  const key = queryKeys.plannedTripGear(tripId)
  const previous = qc.getQueryData<TripGearItem[]>(key)
  if (previous) qc.setQueryData<TripGearItem[]>(key, update(previous))
  return previous
}

export function useTripGear(tripId: number | string | null | undefined, enabled = true) {
  return useQuery<TripGearItem[]>({
    queryKey: queryKeys.plannedTripGear(tripId),
    queryFn: () => fetchTripGear(tripId as number | string),
    enabled: tripId != null && enabled,
    staleTime: STALE_TIME,
    retry: (failureCount, error) =>
      !isFinalError(error) && !isTimeoutError(error) && failureCount < 2,
  })
}

export function useAddTripGearItem() {
  const qc = useQueryClient()
  return useMutation<TripGearItem, unknown, AddTripGearInput>({
    mutationFn: addTripGearItem,
    onSuccess: (item, input) => {
      // Сервер сам решает sort_order, поэтому позиция берётся его ответом:
      // новая вещь встаёт в конец, как и в списке бэка.
      writeList(qc, input.tripId, (items) => [...items, item])
    },
  })
}

export function useApplyTripGearTemplate() {
  const qc = useQueryClient()
  return useMutation<TripGearItem[], unknown, { tripId: number | string }>({
    mutationFn: ({ tripId }) => applyTripGearTemplate(tripId),
    onSuccess: (created, { tripId }) => {
      // Повторное применение шаблона возвращает пустой массив: бэк пропускает
      // уже существующие названия, и дописывать в кэш нечего.
      if (created.length === 0) return
      writeList(qc, tripId, (items) => [...items, ...created])
    },
  })
}

export function useUpdateTripGearItem() {
  const qc = useQueryClient()
  return useMutation<
    TripGearItem,
    unknown,
    UpdateTripGearInput,
    { previous: TripGearItem[] | undefined }
  >({
    mutationFn: updateTripGearItem,
    onMutate: async (input) => {
      // Отменяем только рефетч этого списка: он вернул бы прежний статус поверх
      // оптимистичного. Список уже отрисован — гонки с первой загрузкой нет.
      await qc.cancelQueries({ queryKey: queryKeys.plannedTripGear(input.tripId) })
      const previous = writeList(qc, input.tripId, (items) =>
        items.map((item) => (item.id === input.itemId ? { ...item, status: input.status } : item)),
      )
      return { previous }
    },
    onError: (_error, input, context) => {
      if (context?.previous) {
        qc.setQueryData<TripGearItem[]>(queryKeys.plannedTripGear(input.tripId), context.previous)
      }
    },
    onSuccess: (item, input) => {
      writeList(qc, input.tripId, (items) =>
        items.map((current) => (current.id === item.id ? item : current)),
      )
    },
  })
}

export function useDeleteTripGearItem() {
  const qc = useQueryClient()
  return useMutation<
    { id: number },
    unknown,
    DeleteTripGearInput,
    { previous: TripGearItem[] | undefined }
  >({
    mutationFn: deleteTripGearItem,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.plannedTripGear(input.tripId) })
      const previous = writeList(qc, input.tripId, (items) =>
        items.filter((item) => item.id !== input.itemId),
      )
      return { previous }
    },
    onError: (_error, input, context) => {
      if (context?.previous) {
        qc.setQueryData<TripGearItem[]>(queryKeys.plannedTripGear(input.tripId), context.previous)
      }
    },
  })
}
