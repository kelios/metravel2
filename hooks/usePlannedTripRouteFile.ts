// hooks/usePlannedTripRouteFile.ts
// Исходный файл маршрута поездки и распарсенная из него неупрощённая геометрия
// (#1496 поверх backend-контракта #1493). Серверный стейт — только React Query.
//
// Хранилище доступно ровно владельцу поездки: чужому пользователю бэкенд отвечает
// 403 ещё до обращения к метаданным, анониму — 401. Такой ответ здесь не ошибка,
// а «оригинала нет» — иначе карта планировщика показывала бы участнику красную
// ошибку вместо обычного маршрута.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';
import {
  deletePlannedTripRouteFile,
  downloadPlannedTripRouteFileBlob,
  fetchPlannedTripRouteFile,
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

const isMissingStorage = (error: unknown): boolean =>
  error instanceof ApiError && [401, 403, 404, 501].includes(error.status);

/** Ноль-или-один primary-файл поездки. `null` — файла нет или доступ закрыт. */
export function usePlannedTripRouteFile(
  tripId: number | string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery<PlannedTripRouteFile | null>({
    queryKey: queryKeys.plannedTripRouteFile(tripId ?? ''),
    queryFn: async () => {
      try {
        return await fetchPlannedTripRouteFile(String(tripId));
      } catch (error) {
        if (isMissingStorage(error)) return null;
        throw error;
      }
    },
    enabled: (options.enabled ?? true) && tripId != null && String(tripId).trim().length > 0,
    staleTime: STALE_TIME,
    retry: false,
  });
}

/**
 * Скачивает исходник и разбирает его тем же парсером, что и фаза 1, — бэкенд
 * хранит только байты файла и геометрию не считает. Ключ кэша включает ревизию
 * файла: замена исходника сохраняет тот же id, и без неё на карте осталась бы
 * геометрия предыдущего трека.
 */
export function usePlannedTripOriginalTrack(
  tripId: number | string | null | undefined,
  file: PlannedTripRouteFile | null | undefined,
  options: { enabled?: boolean } = {},
) {
  const revision = file?.updated_at ?? file?.created_at ?? null;

  return useQuery<OriginalTrackGeometry | null>({
    queryKey: queryKeys.plannedTripRouteTrack(tripId ?? '', file?.id ?? '', revision),
    queryFn: async () => {
      const downloaded = await downloadPlannedTripRouteFileBlob(String(tripId), file!.id);
      const previews = parseRouteFilePreviews(downloaded.text, routeFileExtension(file!))
        .map(sanitizeRoutePreview);
      return buildOriginalTrackGeometry(previews);
    },
    enabled:
      (options.enabled ?? true) &&
      tripId != null &&
      String(tripId).trim().length > 0 &&
      Number.isFinite(Number(file?.id)),
    staleTime: STALE_TIME,
    retry: false,
  });
}

export function useUploadPlannedTripRouteFile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, file }: { tripId: number | string; file: PlannedTripRouteUpload }) =>
      uploadPlannedTripRouteFile(tripId, file),
    onSuccess: (uploaded, { tripId }) => {
      qc.setQueryData(queryKeys.plannedTripRouteFile(tripId), uploaded ?? null);
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripRouteFile(tripId) });
    },
  });
}

export function useDeletePlannedTripRouteFile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, routeId }: { tripId: number | string; routeId: number | string }) =>
      deletePlannedTripRouteFile(tripId, routeId),
    onSuccess: (_result, { tripId }) => {
      qc.setQueryData(queryKeys.plannedTripRouteFile(tripId), null);
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripRouteFile(tripId) });
    },
  });
}
