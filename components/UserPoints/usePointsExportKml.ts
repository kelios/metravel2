import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { userPointsApi } from '@/api/userPoints';

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
        const blob = payload.blob as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }

      const blob = payload.blob as Blob;
      const text = await blob.text();
      const cacheDir = (FileSystem as { cacheDirectory?: string }).cacheDirectory ?? String((FileSystem as any).Paths?.cache?.uri ?? '');
      const uri = `${cacheDir}${filename}`;
      await FileSystem.writeAsStringAsync(uri, text);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: contentType, dialogTitle: 'Экспорт точек' });
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Ошибка экспорта');
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { isExporting, exportError, handleExportKml };
};
