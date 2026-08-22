import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

import { downloadPlannedTripRouteFileBlob } from '@/api/plannedTripRoutes'
import { downloadTravelRouteFileBlob } from '@/api/travelRoutes'
import { downloadBlobOnWeb } from '@/utils/downloadUrlOnWeb'
import { translate as i18nT } from '@/i18n'


type DownloadableRouteFile = {
  id: number
  ext?: string | null
  original_name?: string | null
}

type RouteFileBlobResponse = {
  text: string
  blob?: Blob
  bytes?: ArrayBuffer
  contentType?: string
  filename?: string
}

const fallbackRouteFileName = (file: DownloadableRouteFile): string => {
  const ext = String(file.ext ?? '').replace(/^\./, '') || 'gpx'
  return file.original_name || `route-${file.id}.${ext}`
}

/**
 * Сохраняет уже скачанный файл маршрута: web — Blob + программное скачивание,
 * native — запись в cache + системный share-лист (авторизованный эндпоинт не
 * уходит в системный браузер). Возвращает `true`, если действие выполнено.
 */
async function saveRouteFileResponse(
  response: RouteFileBlobResponse,
  fallbackName: string,
): Promise<boolean> {
  const filename = response.filename || fallbackName
  const mimeType = response.contentType || 'application/octet-stream'

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const blob = response.blob ?? new Blob([response.text], { type: mimeType })
    return downloadBlobOnWeb(blob, filename)
  }

  const cacheDir =
    (FileSystem as { cacheDirectory?: string }).cacheDirectory ??
    String((FileSystem as any).Paths?.cache?.uri ?? '')
  if (!cacheDir) return false

  const uri = `${cacheDir}${filename}`
  if (response.bytes) {
    const bytes = new Uint8Array(response.bytes)
    let base64 = ''
    // 24 KiB кратны трём: чанки можно base64-кодировать независимо и склеивать.
    for (let offset = 0; offset < bytes.length; offset += 24 * 1024) {
      const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + 24 * 1024))
      let binary = ''
      for (const byte of chunk) binary += String.fromCharCode(byte)
      base64 += btoa(binary)
    }
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    })
  } else {
    await FileSystem.writeAsStringAsync(uri, response.text)
  }

  if (!(await Sharing.isAvailableAsync())) return false

  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle: i18nT('shared:utils.travelRouteDownload.sohranit_fayl_marshruta_7edbd35d'),
  })
  return true
}

/**
 * Скачивает файл маршрута путешествия через авторизованный `apiClient.download`
 * (Token-заголовок) и сохраняет его нативно-безопасно.
 * Возвращает `true`, если действие выполнено, иначе `false` (caller показывает ошибку).
 */
export async function downloadTravelRouteFile(
  travelId: string | number,
  file: DownloadableRouteFile,
): Promise<boolean> {
  const response = await downloadTravelRouteFileBlob(travelId, file.id)
  return saveRouteFileResponse(response, fallbackRouteFileName(file))
}

/**
 * То же для исходного файла маршрута запланированной поездки (#1496): бэкенд
 * отдаёт ровно те байты, которые были загружены, поэтому скачанный файл
 * побайтно совпадает с оригиналом.
 */
export async function downloadPlannedTripRouteFile(
  tripId: string | number,
  file: DownloadableRouteFile,
): Promise<boolean> {
  const response = await downloadPlannedTripRouteFileBlob(tripId, file.id)
  return saveRouteFileResponse(response, fallbackRouteFileName(file))
}
