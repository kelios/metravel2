// utils/printImageUrl.ts
//
// #1163: PDF-экспорт гнал КАЖДУЮ внешнюю картинку через `images.weserv.nl`
// (`w=2400&q=90&il&fit=inside` в одном месте, `w=1600&fit=inside` — ещё в трёх), а
// первопартийные отдавал вообще без параметров, то есть мастером целиком.
//
// Теперь наоборот: свои картинки идут через собственный прокси на явной ступени
// лестницы, а чужие отдаются как есть. Сторонний ресайзер из пути печати убран.

import {
  familyRouteFromPathname,
  IMAGE_QUALITY,
  IMAGE_WIDTHS,
  printWidthForRoute,
} from '@/constants/imageContract'
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

/** Миниатюра точки в карточке координат — слот 80 px, см. `IMAGE_WIDTHS.printThumb`. */
export const PRINT_IMAGE_THUMB_WIDTH = IMAGE_WIDTHS.printThumb

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
 * Ступень, которую печать имеет право попросить у конкретного семейства.
 *
 * Печатные константы — это ЖЕЛАЕМАЯ ширина, а не обещание семейства. У `routePoint`
 * (`address-image`) верх — мастер 1200, у `articleBody` — 1920, и запрос 1600/2500
 * там отвечает 400 (fail-closed чтение производных), то есть картинка в книге
 * не отрисовывается вовсе. Поэтому желаемое зажимается контрактом семейства, а на
 * путях вне семейств (`/media-resize/**`, чужие хосты) работает прежняя лестница.
 */
function resolvePrintWidth(pathname: string, desiredWidth: number): number {
  const route = familyRouteFromPathname(pathname)
  const contractWidth = route ? printWidthForRoute(route, desiredWidth) : null
  return contractWidth ?? snapProxyWidth(desiredWidth)
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
  parsed.searchParams.set('w', String(resolvePrintWidth(parsed.pathname, width)))
  parsed.searchParams.set('q', String(snapProxyQuality(PRINT_IMAGE_QUALITY)))
  parsed.searchParams.set('fit', 'contain')
  if (parsed.protocol === 'http:') parsed.protocol = 'https:'
  return parsed.toString()
}

/**
 * Тот же кадр без единого прокси-параметра — страховка печати на случай, когда
 * ступень всё-таки не обслужена.
 *
 * Голый адрес отдаёт мастер: дорого и `no-store`, поэтому основным путём он быть
 * не может (#1221). Но в книге альтернатива не «картинка полегче», а пустой серый
 * слот: разметка прячет `<img>` по `onerror`, и страница уходит в печать с дырой —
 * ровно это владелец увидел на travel 682. Один повторный запрос дешевле дыры.
 */
export function buildPrintImageFallbackUrl(url: string): string {
  const trimmed = String(url || '').trim()
  if (!trimmed) return trimmed
  if (/^(data:|blob:)/i.test(trimmed)) return trimmed

  try {
    const parsed = new URL(trimmed)
    for (const param of PROXY_QUERY_PARAMS) parsed.searchParams.delete(param)
    if (parsed.protocol === 'http:') parsed.protocol = 'https:'
    return parsed.toString()
  } catch {
    return trimmed
  }
}

/**
 * `onerror` для печатной картинки: одна попытка без прокси-параметров, затем
 * прячем. Инлайн-обработчик, потому что книга уезжает в отдельное окно как строка
 * HTML — своего скрипта у неё нет.
 */
export function buildPrintImageOnError(fallbackSrc: string): string {
  if (!fallbackSrc) return "this.style.display='none';"
  return (
    "if(this.dataset.printFallback&&this.src!==this.dataset.printFallback)" +
    "{this.src=this.dataset.printFallback;}else{this.style.display='none';}"
  )
}
