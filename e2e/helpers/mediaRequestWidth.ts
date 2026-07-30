/**
 * #1161: детектор «медиа-запрос ушёл без ширины».
 *
 * Прокси на запрос без `w` не отвечает ошибкой — он молча отдаёт мастер целиком.
 * Замер прода 2026-07-30 на `travel-image/682/conversions/10f0a8f2….webp`:
 * без параметров 132 344 B, `?w=320` 17 738 B, `?w=96` 2 582 B. То есть плитка
 * 132×132 без ширины стоит в 51 раз дороже нужного, и заметно это только по трафику.
 *
 * Модуль намеренно без зависимостей: его импортируют и Playwright-спеки, и jest
 * (`__tests__/e2e-helpers/media-request-width.test.ts`, где соответствие набора путей
 * реальному `optimizeImageUrl` проверяется прогоном самой утилиты).
 */

/** Пути, которые обслуживает image-proxy: `MEDIA_FILE_PATH` + `PROXY_MEDIA_PREFIX` в `utils/imageProxy.ts`. */
const PROXY_MEDIA_PATH =
  /^\/(gallery|travel-image|travel-description-image|address-image|quest-cover|avatar)\//i

export function isMediaRequestWithoutWidth(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!PROXY_MEDIA_PATH.test(parsed.pathname)) return false
    const width = parsed.searchParams.get('w')
    return !width || !Number.isFinite(Number(width)) || Number(width) <= 0
  } catch {
    return false
  }
}
