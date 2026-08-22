// api/plannedTripRoutes.ts
// Исходный (неупрощённый) файл маршрута запланированной поездки — фаза 2 импорта
// (#1496) поверх backend-контракта #1493 `/api/trips/planned/{id}/routes/`.
//
// Контракт бэкенда (docs/features/trips.md в backend-репозитории):
//  - у поездки ноль или один primary-файл, поэтому список никогда не длиннее одного;
//  - POST создаёт (201) или атомарно заменяет (200) файл, сохраняя тот же id;
//  - операции доступны только владельцу поездки (иначе 403), анонимам — 401.
//
// Мок-фолбэка здесь нет намеренно: Fallback/mock policy #1496 запрещает подменять
// отсутствующее хранилище фиктивным успехом — иначе «оригинал сохранён» врало бы.
import { apiClient } from '@/api/client';
import {
  extractRouteFileList,
  normalizeRouteFileMetadata,
  routeFileRecord,
  type MaybePaginated,
  type RouteFileMetadata,
} from '@/api/routeFileMetadata';

const LONG_TIMEOUT = 30000;

export interface PlannedTripRouteFile extends RouteFileMetadata {
  /** Меняется при замене исходника — служит частью ключа кэша распарсенного трека. */
  updated_at?: string | null;
}

/** Файл для загрузки: web отдаёт `File`, native — RN-часть `{ uri, name, type }`. */
export type PlannedTripRouteUpload = File | { uri: string; name: string; type?: string };

const normalizePlannedTripRouteFile = (input: unknown): PlannedTripRouteFile | null => {
  const base = normalizeRouteFileMetadata(input);
  if (!base) return null;
  const rec = routeFileRecord(input)!;
  return {
    ...base,
    updated_at: typeof rec.updated_at === 'string' ? rec.updated_at : null,
  };
};

const routesPath = (tripId: string | number): string =>
  `/trips/planned/${encodeURIComponent(String(tripId))}/routes/`;

const routePath = (tripId: string | number, routeId: string | number): string =>
  `${routesPath(tripId)}${encodeURIComponent(String(routeId))}/`;

export const listPlannedTripRouteFiles = async (
  tripId: string | number,
): Promise<PlannedTripRouteFile[]> => {
  const payload = await apiClient.get<MaybePaginated<unknown>>(routesPath(tripId), LONG_TIMEOUT);
  return extractRouteFileList(payload)
    .map(normalizePlannedTripRouteFile)
    .filter((item): item is PlannedTripRouteFile => Boolean(item));
};

/** Список из нуля-одного элемента сводится к самому файлу — так его читает UI. */
export const fetchPlannedTripRouteFile = async (
  tripId: string | number,
): Promise<PlannedTripRouteFile | null> => {
  const files = await listPlannedTripRouteFiles(tripId);
  return files[0] ?? null;
};

export const uploadPlannedTripRouteFile = async (
  tripId: string | number,
  file: PlannedTripRouteUpload,
): Promise<PlannedTripRouteFile | null> => {
  const formData = new FormData();
  formData.append('file', file as unknown as Blob);

  const payload = await apiClient.uploadFormData<unknown>(
    routesPath(tripId),
    formData,
    'POST',
    LONG_TIMEOUT,
  );

  return normalizePlannedTripRouteFile(payload);
};

export const deletePlannedTripRouteFile = async (
  tripId: string | number,
  routeId: string | number,
): Promise<void> => {
  await apiClient.delete(routePath(tripId, routeId), LONG_TIMEOUT);
};

export const downloadPlannedTripRouteFileBlob = async (
  tripId: string | number,
  routeId: string | number,
): Promise<{ text: string; blob: Blob; bytes?: ArrayBuffer; contentType?: string; filename?: string }> => {
  const response = await apiClient.download(
    `${routePath(tripId, routeId)}download/`,
    { method: 'GET' },
    LONG_TIMEOUT,
  );

  const text = await response.blob.text();
  return {
    text,
    blob: response.blob,
    bytes: response.bytes,
    contentType: response.contentType,
    filename: response.filename,
  };
};
