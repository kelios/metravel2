import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { RouteExportResult } from './types';
import { downloadTextFileWeb } from './download';

export async function saveRouteExportFile(
  file: RouteExportResult,
  dialogTitle = 'Сохранить файл маршрута',
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return downloadTextFileWeb(file);
  }

  const cacheDir =
    (FileSystem as { cacheDirectory?: string }).cacheDirectory ??
    String((FileSystem as any).Paths?.cache?.uri ?? '');
  if (!cacheDir) return false;

  const uri = `${cacheDir}${file.filename}`;
  await FileSystem.writeAsStringAsync(uri, file.content);

  if (!(await Sharing.isAvailableAsync())) return false;

  await Sharing.shareAsync(uri, {
    mimeType: file.mimeType,
    dialogTitle,
  });
  return true;
}
