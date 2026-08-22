// api/routeFileMetadata.ts
// Общая нормализация метаданных route-файлов (GPX/KML). Один и тот же формат
// отдают два хранилища: `/travels/{id}/routes/` (#699) и `/trips/planned/{id}/routes/`
// (#1493, фаза 2 импорта — #1496). Дублировать разбор `id/original_name/ext/size/
// download_url/created_at` в двух клиентах смысла нет, различаются только
// надстройки: у travels — серверные preview/summary, у planned trip — `updated_at`.

export interface RouteFileMetadata {
  id: number;
  original_name: string;
  ext: string;
  size?: number;
  download_url?: string;
  created_at?: string | null;
}

export type MaybePaginated<T> =
  | T[]
  | {
      results?: T[];
      data?: T[];
      items?: T[];
    };

export const routeFileRecord = (input: unknown): Record<string, unknown> | null =>
  input && typeof input === 'object' ? (input as Record<string, unknown>) : null;

export const normalizeRouteFileMetadata = (input: unknown): RouteFileMetadata | null => {
  const rec = routeFileRecord(input);
  if (!rec) return null;
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

/** Список может прийти как массив или как пагинированная обёртка DRF. */
export const extractRouteFileList = (payload: MaybePaginated<unknown>): unknown[] => {
  if (Array.isArray(payload)) return payload;
  const rec = routeFileRecord(payload);
  if (!rec) return [];
  if (Array.isArray(rec.results)) return rec.results;
  if (Array.isArray(rec.data)) return rec.data;
  if (Array.isArray(rec.items)) return rec.items;
  return [];
};
