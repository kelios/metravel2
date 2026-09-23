// components/trips/planning/useTripRouteOriginalDownload.ts
// Скачивание одного исходного GPX/KML поездки (#1496). Зовёт его карточка
// сохранённого оригинала `TripRouteStoredFiles` — своя у каждого файла (#2069) —
// во вкладках «Маршрут» (#2053) и «Экспорт». Байты приходят те же, что были
// загружены, — в отличие от GPX/KML, собранных из точек.
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import type { PlannedTripRouteFile } from '@/api/plannedTripRoutes';
import { translate as i18nT } from '@/i18n';
import { downloadPlannedTripRouteFile } from '@/utils/travelRouteDownload';

export type TripRouteOriginalDownload = {
  /** Скачивать есть что: у поездки есть id и сохранённый оригинал. */
  available: boolean;
  /** Web сохраняет файл, native отдаёт его в системное «Поделиться». */
  label: string;
  downloading: boolean;
  error: string | null;
  download: () => Promise<void>;
};

export function useTripRouteOriginalDownload(
  tripId: number | string | null | undefined,
  originalFile: PlannedTripRouteFile | null | undefined,
): TripRouteOriginalDownload {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async () => {
    if (tripId == null || !originalFile) return;
    setError(null);
    setDownloading(true);
    try {
      const saved = await downloadPlannedTripRouteFile(tripId, originalFile);
      if (!saved) setError(i18nT('tripsStatic:route.originalDownloadError'));
    } catch {
      setError(i18nT('tripsStatic:route.originalDownloadError'));
    } finally {
      setDownloading(false);
    }
  }, [originalFile, tripId]);

  return {
    available: tripId != null && originalFile != null,
    label: Platform.OS === 'web'
      ? i18nT('tripsStatic:route.originalDownload')
      : i18nT('tripsStatic:route.originalShare'),
    downloading,
    error,
    download,
  };
}
