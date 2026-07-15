import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

import { downloadTravelRouteFileBlob } from '@/api/travelRoutes'
import { downloadBlobOnWeb } from '@/utils/downloadUrlOnWeb'
import { translate as i18nT } from '@/i18n'


type DownloadableRouteFile = {
  id: number
  ext?: string | null
  original_name?: string | null
}

/**
 * Скачивает файл маршрута через авторизованный `apiClient.download` (Token-заголовок)
 * и сохраняет нативно-безопасно:
 *  - web: Blob + программное скачивание;
 *  - native: запись в cache + системный share-лист (без Blob и без открытия
 *    авторизованного эндпоинта в системном браузере).
 * Возвращает `true`, если действие выполнено, иначе `false` (caller показывает ошибку).
 */
export async function downloadTravelRouteFile(
  travelId: string | number,
  file: DownloadableRouteFile,
): Promise<boolean> {
  const ext = String(file.ext ?? '').replace(/^\./, '') || 'gpx'
  const fallbackName = file.original_name || `route-${file.id}.${ext}`

  const response = await downloadTravelRouteFileBlob(travelId, file.id)
  const filename = response.filename || fallbackName
  const mimeType = response.contentType || 'application/octet-stream'

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const blob = new Blob([response.text], { type: mimeType })
    return downloadBlobOnWeb(blob, filename)
  }

  const cacheDir =
    (FileSystem as { cacheDirectory?: string }).cacheDirectory ??
    String((FileSystem as any).Paths?.cache?.uri ?? '')
  if (!cacheDir) return false

  const uri = `${cacheDir}${filename}`
  await FileSystem.writeAsStringAsync(uri, response.text)

  if (!(await Sharing.isAvailableAsync())) return false

  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle: i18nT('shared:utils.travelRouteDownload.sohranit_fayl_marshruta_7edbd35d'),
  })
  return true
}
