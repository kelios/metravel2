import { apiClient } from '@/api/client';
import type { TravelRouteFile } from '@/types/travelRoutes';

const LONG_TIMEOUT = 30000;

type MaybePaginated<T> =
  | T[]
  | {
      results?: T[];
      data?: T[];
      items?: T[];
    };

const normalizeRouteFile = (input: unknown): TravelRouteFile | null => {
  if (!input || typeof input !== 'object') return null;
  const rec = input as Record<string, unknown>;
  const id = Number(rec.id);
  if (!Number.isFinite(id)) return null;

  return {
    id,
    original_name: String(rec.original_name ?? rec.originalName ?? ''),
    ext: String(rec.ext ?? '').toLowerCase(),
    size: Number.isFinite(Number(rec.size)) ? Number(rec.size) : undefined,
    download_url:
      typeof rec.download_url === 'string'
        ? rec.download_url
        : typeof rec.downloadUrl === 'string'
          ? rec.downloadUrl
          : undefined,
    created_at: typeof rec.created_at === 'string' ? rec.created_at : null,
  };
};

const extractRouteFiles = (payload: MaybePaginated<unknown>): TravelRouteFile[] => {
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as any)?.results)
      ? (payload as any).results
      : Array.isArray((payload as any)?.data)
        ? (payload as any).data
        : Array.isArray((payload as any)?.items)
          ? (payload as any).items
          : [];

  return raw.map(normalizeRouteFile).filter((item): item is TravelRouteFile => Boolean(item));
};

export const listTravelRouteFiles = async (travelId: string | number): Promise<TravelRouteFile[]> => {
  const payload = await apiClient.get<MaybePaginated<unknown>>(
    `/travels/${encodeURIComponent(String(travelId))}/routes/`,
    LONG_TIMEOUT,
  );
  return extractRouteFiles(payload);
};

export const uploadTravelRouteFile = async (
  travelId: string | number,
  file: File | { uri: string; name: string; type?: string },
): Promise<TravelRouteFile | null> => {
  const formData = new FormData();
  formData.append('file', file as any);

  const payload = await apiClient.uploadFormData<unknown>(
    `/travels/${encodeURIComponent(String(travelId))}/routes/`,
    formData,
    'POST',
    LONG_TIMEOUT,
  );

  return normalizeRouteFile(payload);
};

export const deleteTravelRouteFile = async (
  travelId: string | number,
  routeId: string | number,
): Promise<void> => {
  await apiClient.delete(
    `/travels/${encodeURIComponent(String(travelId))}/routes/${encodeURIComponent(String(routeId))}/`,
    LONG_TIMEOUT,
  );
};

export const downloadTravelRouteFileBlob = async (
  travelId: string | number,
  routeId: string | number,
): Promise<{ text: string; contentType?: string; filename?: string }> => {
  const response = await apiClient.download(
    `/travels/${encodeURIComponent(String(travelId))}/routes/${encodeURIComponent(String(routeId))}/download/`,
    { method: 'GET' },
    LONG_TIMEOUT,
  );

  const text = await response.blob.text();
  return {
    text,
    contentType: response.contentType,
    filename: response.filename,
  };
};

export const buildTravelRouteDownloadPath = (
  travelId: string | number,
  routeId: string | number,
): string =>
  `/api/travels/${encodeURIComponent(String(travelId))}/routes/${encodeURIComponent(String(routeId))}/download/`;
