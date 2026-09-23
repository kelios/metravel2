// hooks/usePlannedTripRouteFile.ts
// Исходные файлы маршрута поездки и распарсенная из них неупрощённая геометрия
// (#1496 поверх backend-контракта #1493/#1840). Серверный стейт — только React Query.
//
// Файлов у поездки ноль или несколько (#2069): бэкенд хранит до десяти, и каждый
// POST добавляет новый, а не заменяет прежний. Поэтому хуки читают и рисуют
// весь список — взять один «главный» файл значило бы молча потерять остальные.
//
// Хранилище доступно ровно владельцу поездки: чужому пользователю бэкенд отвечает
// 403 ещё до обращения к метаданным, анониму — 401. Такой ответ здесь не ошибка,
// а «оригиналов нет» — иначе карта планировщика показывала бы участнику красную
// ошибку вместо обычного маршрута.
import { useMutation, useQueries, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { ApiError } from '@/api/client';
import type { RouteGeometry } from '@/api/plannedTrips';
import {
  deletePlannedTripRouteFile,
  downloadPlannedTripRouteFileBlob,
  listPlannedTripRouteFiles,
  uploadPlannedTripRouteFile,
  type PlannedTripRouteFile,
  type PlannedTripRouteUpload,
} from '@/api/plannedTripRoutes';
import { queryKeys } from '@/api/queryKeys';
import {
  buildOriginalTrackGeometry,
  routeFileExtension,
  type OriginalTrackGeometry,
} from '@/components/trips/planning/tripOriginalTrack';
import { parseRouteFilePreviews, sanitizeRoutePreview } from '@/utils/routeFileParser';

const STALE_TIME = 5 * 60 * 1000;
const NO_SEGMENTS: RouteGeometry[] = [];

const isMissingStorage = (error: unknown): boolean =>
  error instanceof ApiError && [401, 403, 404, 501].includes(error.status);

const hasTripId = (tripId: number | string | null | undefined): boolean =>
  tripId != null && String(tripId).trim().length > 0;

/** Все исходные файлы поездки в порядке бэкенда. `[]` — файлов нет или доступ закрыт. */
export function usePlannedTripRouteFiles(
  tripId: number | string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery<PlannedTripRouteFile[]>({
    queryKey: queryKeys.plannedTripRouteFiles(tripId ?? ''),
    queryFn: async () => {
      try {
        return await listPlannedTripRouteFiles(String(tripId));
      } catch (error) {
        if (isMissingStorage(error)) return [];
        throw error;
      }
    },
    enabled: (options.enabled ?? true) && hasTripId(tripId),
    staleTime: STALE_TIME,
    retry: false,
  });
}

// Линии всех файлов подряд, в порядке списка. Сегменты файла не склеиваются ни
// между собой (#1847), ни с сегментами соседних файлов: каждый остаётся своей
// полилинией. Файл, который ещё качается или не скачался, просто не добавляет
// линий — остальные треки от него не зависят.
const combineTrackSegments = (
  results: Array<UseQueryResult<OriginalTrackGeometry | null>>,
): RouteGeometry[] => {
  const segments = results.flatMap((result) => result.data?.segments ?? []);
  return segments.length ? segments : NO_SEGMENTS;
};

/**
 * Скачивает каждый исходник и разбирает его тем же парсером, что и фаза 1, —
 * бэкенд хранит только байты файла и геометрию не считает. Возвращает линии всех
 * файлов одним списком для слоя оригинального трека карты. Трек кэшируется на
 * файл (id + ревизия), поэтому добавление или удаление одного файла не
 * перекачивает остальные.
 */
export function usePlannedTripOriginalTracks(
  tripId: number | string | null | undefined,
  files: readonly PlannedTripRouteFile[],
  options: { enabled?: boolean } = {},
): RouteGeometry[] {
  const enabled = (options.enabled ?? true) && hasTripId(tripId);

  return useQueries({
    queries: files.map((file) => ({
      queryKey: queryKeys.plannedTripRouteTrack(
        tripId ?? '',
        file.id,
        file.updated_at ?? file.created_at ?? null,
      ),
      queryFn: async (): Promise<OriginalTrackGeometry | null> => {
        const downloaded = await downloadPlannedTripRouteFileBlob(String(tripId), file.id);
        const previews = parseRouteFilePreviews(downloaded.text, routeFileExtension(file))
          .map(sanitizeRoutePreview);
        return buildOriginalTrackGeometry(previews);
      },
      enabled,
      staleTime: STALE_TIME,
      retry: false,
    })),
    combine: combineTrackSegments,
  });
}

export function useUploadPlannedTripRouteFile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, file }: { tripId: number | string; file: PlannedTripRouteUpload }) =>
      uploadPlannedTripRouteFile(tripId, file),
    onSuccess: (uploaded, { tripId }) => {
      // POST добавляет файл в конец списка (#1840): прежние остаются на месте.
      if (uploaded) {
        qc.setQueryData<PlannedTripRouteFile[]>(
          queryKeys.plannedTripRouteFiles(tripId),
          (files) => [...(files ?? []).filter((file) => file.id !== uploaded.id), uploaded],
        );
      }
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripRouteFiles(tripId) });
    },
  });
}

export function useDeletePlannedTripRouteFile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, routeId }: { tripId: number | string; routeId: number | string }) =>
      deletePlannedTripRouteFile(tripId, routeId),
    onSuccess: (_result, { tripId, routeId }) => {
      // Уходит ровно удалённый файл — соседние остаются и на карте, и в списке.
      qc.setQueryData<PlannedTripRouteFile[]>(
        queryKeys.plannedTripRouteFiles(tripId),
        (files) => files?.filter((file) => String(file.id) !== String(routeId)),
      );
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripRouteFiles(tripId) });
    },
  });
}
