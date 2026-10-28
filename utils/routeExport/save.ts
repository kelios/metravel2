import { Platform } from 'react-native';

import type { RouteExportResult } from './types';
import { downloadTextFileWeb } from './download';
import {
  isShareAvailable,
  resolveCacheDirectory,
  shareAsync,
  writeAsStringAsync,
} from '@/utils/fileTransfer';
import { translate as i18nT } from '@/i18n'


export async function saveRouteExportFile(
  file: RouteExportResult,
  dialogTitle = i18nT('export:utils.routeExport.save.sohranit_fayl_marshruta_39cdf9d4'),
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return downloadTextFileWeb(file);
  }

  const cacheDir = resolveCacheDirectory(true);
  if (!cacheDir) return false;

  const uri = `${cacheDir}${file.filename}`;
  await writeAsStringAsync(uri, file.content);

  if (!(await isShareAvailable())) return false;

  await shareAsync(uri, {
    mimeType: file.mimeType,
    dialogTitle,
  });
  return true;
}
