// utils/printImageUrl.ts
//
// #1163: PDF-экспорт гнал КАЖДУЮ внешнюю картинку через `images.weserv.nl`
// (`w=2400&q=90&il&fit=inside` в одном месте, `w=1600&fit=inside` — ещё в трёх), а
// первопартийные отдавал вообще без параметров, то есть мастером целиком.
//
// Теперь наоборот: свои картинки идут через собственный прокси на явной ступени
// лестницы, а чужие отдаются как есть. Сторонний ресайзер из пути печати убран.

import { IMAGE_QUALITY, IMAGE_WIDTHS } from '@/constants/imageContract'
import { PROXY_QUERY_PARAMS, snapProxyQuality, snapProxyWidth } from '@/utils/imageProxy'

/**
 * Ступени печати. Обе входят в `ALLOWED_IMAGE_WIDTHS` бэкенда, поэтому прокси
 * обслуживает их без округления вверх:
 * - 2500 — верх лестницы и текущий `PRINT_IMAGE_MAX_SIZE`, для обложек и
 *   полностраничных фото;
 * - 1600 — фото в потоке текста, где 2500 не даёт видимой разницы на 300 DPI.
 */
export const PRINT_IMAGE_FULL_WIDTH = IMAGE_WIDTHS.printFull
export const PRINT_IMAGE_INLINE_WIDTH = IMAGE_WIDTHS.printInline

/**
 * Качество печати. q85 — явная ступень backend proxy-contract и
 * quality upload/master encoder. Это позволяет PDF переиспользовать
 * канонический q85-вариант, а не порождать отдельный q90.
 */
export const PRINT_IMAGE_QUALITY = IMAGE_QUALITY.print

const FIRST_PARTY_HOSTS = new Set(['metravel.by', 'cdn.metravel.by', 'api.metravel.by'])

export function isFirstPartyMetravelHost(host: string, hostWithPort?: string): boolean {
  const normalizedHost = String(host || '').toLowerCase()
  if (FIRST_PARTY_HOSTS.has(normalizedHost)) return true

  // Dev/preprod обслуживают приложение и медиа с одного хоста.
  try {
    const current = typeof window !== 'undefined' ? window.location?.host?.toLowerCase() : ''
    return Boolean(current) && Boolean(hostWithPort) && hostWithPort!.toLowerCase() === current
  } catch {
    return false
  }
}

/**
 * Первопартийный URL → тот же URL на нужной ступени прокси.
 * Чужой (или неразбираемый) URL → без изменений: ресайз чужих картинок больше не
 * делается, см. #1163.
 *
 * Параметры собираются здесь, а не через `optimizeImageUrl`, намеренно. У того своя
 * проверка «свой домен» — по совпадению origin с `EXPO_PUBLIC_API_URL`, и на
 * dev/preprod (где API проксируется с другого хоста) продовый `https://metravel.by/...`
 * из базы под неё не попадает: вызов молча возвращал бы URL без единого параметра,
 * то есть мастер целиком. Список первопартийных хостов печати шире, поэтому решение
 * принимается тут, а лестница и квантование quality берутся из общего источника.
 */
export function buildPrintImageUrl(url: string, width: number): string {
  const trimmed = String(url || '').trim()
  if (!trimmed) return trimmed
  if (/^(data:|blob:)/i.test(trimmed)) return trimmed

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return trimmed
  }

  if (!isFirstPartyMetravelHost(parsed.hostname, parsed.host)) return trimmed

  for (const param of PROXY_QUERY_PARAMS) parsed.searchParams.delete(param)
  parsed.searchParams.set('w', String(snapProxyWidth(width)))
  parsed.searchParams.set('q', String(snapProxyQuality(PRINT_IMAGE_QUALITY)))
  parsed.searchParams.set('fit', 'contain')
  if (parsed.protocol === 'http:') parsed.protocol = 'https:'
  return parsed.toString()
}
