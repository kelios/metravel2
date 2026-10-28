import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { userPointsApi } from '@/api/userPoints';
import { downloadBlobOnWeb } from '@/utils/downloadUrlOnWeb';
import {
  isShareAvailable,
  resolveCacheDirectory,
  shareAsync,
  writeAsStringAsync,
} from '@/utils/fileTransfer';
import { translate as i18nT } from '@/i18n'


export const usePointsExportKml = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportKml = useCallback(async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      const result = await userPointsApi.exportKml();

      const fallbackName = `user-points-${new Date().toISOString().slice(0, 10)}.kml`;
      const payload = (result ?? {}) as Record<string, unknown>;
      const filename = String(payload.filename ?? '').trim() || fallbackName;
      const contentType = String(payload.contentType ?? '').trim() || 'application/vnd.google-earth.kml+xml';

      if (Platform.OS === 'web') {
        downloadBlobOnWeb(payload.blob as Blob, filename);
        return;
      }

      const blob = payload.blob as Blob;
      const text = await blob.text();
      const cacheDir = resolveCacheDirectory(true);
      const uri = `${cacheDir}${filename}`;
      await writeAsStringAsync(uri, text);
      if (await isShareAvailable()) {
        await shareAsync(uri, { mimeType: contentType, dialogTitle: i18nT('map:components.UserPoints.usePointsExportKml.eksport_tochek_51ae90a3') });
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : i18nT('map:components.UserPoints.usePointsExportKml.oshibka_eksporta_62cbb480'));
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { isExporting, exportError, handleExportKml };
};
