// utils/mediaPlaceholderIndex.ts
//
// Единый индекс «картинка → заливка полей letterbox».
//
// Почему он существует. Решение владельца 2026-08-02 (#1208) убрало с web вторую
// растровую подложку: у `contain`-слота остаётся ровно одно фото, а поля вокруг
// него заливает `dominant_color` из медиа-манифеста. Цвет при этом раздавался
// пропсом `placeholderColor`, и каждый экран доставал его из манифеста сам —
// своей строчкой, из своей формы пейлоада (`media.cover`, `media.gallery`,
// `media.address_images`, `media.article_body`). Экраны той волны (каталог,
// hero, точки, галерея профиля) получили заливку, а все остальные — карта,
// попап места, квесты, поездки, тело статьи — молча остались с прозрачными
// полями: замер прода 2026-08-05 на `/map`, 7 карточек списка,
// `object-fit: contain` в боксе 360×173, `[data-hero-data-placeholder]` — 0 штук,
// фон медиа-бокса `rgba(0, 0, 0, 0)`.
//
// Заливка — свойство САМОЙ картинки, а не экрана, поэтому она и живёт здесь:
// data-слой один раз индексирует манифест, `ImageCardMedia` находит цвет по URL
// сам, и «забыть проп» на новом экране больше нельзя. Явный `placeholderColor`
// по-прежнему главнее индекса.
//
// Ступеней ровно две, и обе здесь:
//   1) `dominant_color` из манифеста — бесплатный и доступен ДО декода;
//   2) `sampleDominantColor` — усреднение уже загруженного кадра, для семейств,
//      которым бэкенд манифеста не отдаёт (тело статьи #1266, шаги квестов,
//      обложки поездок, фото точек пользователя #1267).
// Результат второй ступени ложится в тот же индекс, поэтому «манифест или сэмпл»
// разбирается один раз и в одном месте. Менять поведение заливки — здесь.

import type { TravelMedia, TravelMediaGroup, TravelMediaImage } from '@/types/types'
import { getMediaPlaceholderData, type MediaPlaceholderData } from '@/utils/travelMediaVariants'

/**
 * Один и тот же файл адресуется разными роутами: манифест отдаёт
 * `/address-image/355/conversions/x.webp`, а в разметку после
 * `toLegacyResizePath` уходит `/media-resize/legacy/355/conversions/x.webp`
 * (замер прода 2026-08-05, точка 355). Ключ индекса — storage key, то есть путь
 * без роут-префикса и без query, поэтому обе формы и все ступени `?w=` сходятся
 * в одну запись. Список префиксов тот же, что у первопартийных media-роутов в
 * `utils/mediaUrl.ts`.
 */
const MEDIA_ROUTE_PREFIX =
  /^\/(?:media-resize\/legacy|media-resize|address-image|travel-image|travel-description-image|gallery|quest-cover|avatar)\//i

/** Хост-заглушка для разбора корне-относительных путей; в ключ не попадает. */
const KEY_BASE = 'https://metravel.by'

/**
 * Потолок индекса. Карта отдаёт до нескольких сотен точек за запрос, у травела
 * галерея на десятки кадров — за сессию с прокруткой каталога набегает много
 * записей, а сама запись весит два коротких стринга. Вытеснение FIFO: самая
 * старая запись уходит первой, повторная индексация освежает позицию.
 */
const MAX_ENTRIES = 2000

const index = new Map<string, MediaPlaceholderData>()

const decodeSafe = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Storage key картинки: без origin, без роут-префикса, без query. */
export function resolveMediaPlaceholderKey(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  if (/^(data:|blob:|file:)/i.test(raw)) return null

  let pathname: string
  try {
    pathname = new URL(raw, KEY_BASE).pathname
  } catch {
    pathname = raw.split('?')[0] ?? ''
  }

  const key = pathname.replace(MEDIA_ROUTE_PREFIX, '').replace(/^\/+/, '')
  return key ? decodeSafe(key).toLowerCase() : null
}

const remember = (url: string | null | undefined, data: MediaPlaceholderData): void => {
  const key = resolveMediaPlaceholderKey(url)
  if (!key) return
  // Повторная запись переносит ключ в конец очереди вытеснения.
  if (index.has(key)) index.delete(key)
  index.set(key, data)
  while (index.size > MAX_ENTRIES) {
    const oldest = index.keys().next()
    if (oldest.done) break
    index.delete(oldest.value)
  }
}

/** Все адреса, под которыми запись манифеста может прийти в рендер. */
const collectEntryUrls = (entry: TravelMediaImage): string[] => {
  const urls: (string | null | undefined)[] = [
    entry.src,
    entry.src_cover,
    entry.src_contain,
    entry.src_print,
  ]

  if (entry.variants) urls.push(...Object.values(entry.variants))

  // #1203: у части записей готовых `src*` нет, есть только `srcset*`.
  for (const srcSet of [entry.srcset, entry.srcset_cover, entry.srcset_contain, entry.srcset_print]) {
    if (typeof srcSet !== 'string' || !srcSet.trim()) continue
    for (const candidate of srcSet.split(',')) {
      urls.push(candidate.trim().split(/\s+/)[0])
    }
  }

  return urls.filter((url): url is string => typeof url === 'string' && !!url.trim())
}

/**
 * Индексирует одну запись манифеста.
 *
 * `aliasUrls` — адреса, под которыми ту же картинку показывает UI, когда они не
 * совпадают с манифестом. Так устроена карта: карточка рисует
 * `travelImageThumbUrl` (legacy-конверсия `462e31db…`), а манифест точки описывает
 * `e4dc7a17…` — разные производные одного снимка, цвет у них общий.
 */
export function indexMediaImage(
  entry: TravelMediaImage | null | undefined,
  aliasUrls: (string | null | undefined)[] = [],
): void {
  if (!entry) return
  const data = getMediaPlaceholderData(entry)
  if (!data.dominantColor && !data.blurhash) return

  for (const url of collectEntryUrls(entry)) remember(url, data)
  for (const url of aliasUrls) remember(url, data)
}

const indexMediaGroup = (group: TravelMediaGroup | null | undefined): void => {
  if (!group) return
  indexMediaImage(group.cover)
  if (Array.isArray(group.gallery)) {
    for (const entry of group.gallery) indexMediaImage(entry)
  }
}

/** Индексирует весь манифест травела: обложка, галерея, точки, тело статьи. */
export function indexTravelMedia(media: TravelMedia | null | undefined): void {
  if (!media || typeof media !== 'object') return
  indexMediaImage(media.cover)
  if (Array.isArray(media.gallery)) {
    for (const entry of media.gallery) indexMediaImage(entry)
  }
  if (media.address_images && typeof media.address_images === 'object') {
    for (const entry of Object.values(media.address_images)) indexMediaImage(entry)
  }
  indexMediaGroup(media.article_body)
}

/** Заливка для конкретного адреса картинки или `null`, если её никто не индексировал. */
export function lookupMediaPlaceholder(
  url: string | null | undefined,
): MediaPlaceholderData | null {
  const key = resolveMediaPlaceholderKey(url)
  if (!key) return null
  return index.get(key) ?? null
}

/**
 * Сплошной цвет читается как второй фон и спорит с поверхностью карточки, поэтому
 * заливка кладётся полупрозрачной: под ней остаётся сама карточка.
 */
export const LETTERBOX_FILL_ALPHA = 0.75

/** `#rrggbb` → `rgba(r, g, b, α)` для заливки полей. Готовую альфу не трогаем. */
export function toLetterboxFill(hexColor: string): string {
  const value = hexColor.replace('#', '')
  if (value.length === 8) return hexColor
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return hexColor
  return `rgba(${r}, ${g}, ${b}, ${LETTERBOX_FILL_ALPHA})`
}

const toHexChannel = (value: number): string => value.toString(16).padStart(2, '0')

/**
 * Цвет кадра там, где манифеста нет: усреднение УЖЕ загруженной картинки в канву
 * 1×1 силами GPU (#1233). Второго сетевого запроса не возникает — именно из-за него
 * в #1208/#1213 убрали размытую подложку.
 *
 * Это ВТОРАЯ ступень одного механизма, а не отдельный путь: результат ложится в тот
 * же индекс, поэтому соседние слоты с тем же файлом берут его уже готовым, а разбор
 * «манифест или сэмпл» остаётся здесь и больше нигде.
 *
 * `null` — цвета нет и не будет: чужой origin тейнтит канву и `getImageData` бросает
 * SecurityError. Такой исход тоже запоминается, иначе каждая перерисовка повторяла бы
 * бесполезную попытку.
 */
export function sampleDominantColor(img: HTMLImageElement | null | undefined): string | null {
  if (!img) return null
  const key = resolveMediaPlaceholderKey(img.currentSrc || img.src)
  if (!key) return null

  const known = index.get(key)
  if (known) return known.dominantColor

  let color: string | null = null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    if (ctx) {
      ctx.drawImage(img, 0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      // Полностью прозрачный кадр усредняется в чёрный — это не его цвет.
      if (a > 0) color = `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`
    }
  } catch {
    color = null
  }

  remember(img.currentSrc || img.src, { blurhash: null, dominantColor: color })
  return color
}

/** Только для тестов: индекс живёт весь сеанс и между кейсами не сбрасывается сам. */
export function resetMediaPlaceholderIndex(): void {
  index.clear()
}
