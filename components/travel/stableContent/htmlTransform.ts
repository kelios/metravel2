import { Dimensions, Platform } from 'react-native'

import { normalizeArticleEditorHtmlForInput } from '@/components/article/articleEditorConfig'
import {
  resolveArticleBodyRungs,
  type ArticleBodyMediaIndex,
} from '@/components/travel/stableContent/articleBodyMedia'
import {
  familyDerivativeCeiling,
  IMAGE_QUALITY,
  IMAGE_WIDTHS,
  LEGACY_UPLOAD_FIXED_WIDTH,
  LEGACY_UPLOAD_TRANSFORM_FORMAT,
  UNKNOWN_FAMILY_DERIVATIVE_CEILING,
} from '@/constants/imageContract'
import { replaceInstagramEmbedsWithCards } from '@/utils/instagramRichText'
import { normalizeRichTextListFragments } from '@/utils/richTextLists'
import { sanitizeRichText } from '@/utils/sanitizeRichText'
import { applySmartImageLayout } from '@/utils/richTextImageLayout'
import { guardServerSafeHtml } from '@/utils/serverSafeHtml'
import {
  familyRouteOfMediaUrl,
  isLegacyUploadResizeUrl,
  isPrivateOrLocalHost,
  toLegacyResizePath,
} from '@/utils/mediaUrl'
import { pickWidthCandidate } from '@/utils/travelMediaVariants'
import { isWeservImageUrl, unwrapWeservImageUrl } from '@/utils/weservImageUrl'
import { translate as i18nT } from '@/i18n'


const OPTIMIZATION_PARAMS = ['w', 'h', 'q', 'f', 'fit', 'auto', 'output', 'blur', 'dpr']

export const hasIframe = (html: string) => /<iframe[\s/>]/i.test(html)

export const isYouTubeEmbedUrl = (src: string) => /youtube\.com|youtu\.be/i.test(src)

export const isInstagramEmbedUrl = (src: string) => /instagram\.com/i.test(src)

export const extractFirstImgSrc = (html: string): string | null => {
  const match = html.match(/<img\b[^>]*\bsrc="([^"]+)"/i)
  return match?.[1] ?? null
}

const stripOptimizationParams = (urlStr: string): string => {
  try {
    const url = new URL(urlStr, 'https://metravel.by')
    let changed = false
    for (const param of OPTIMIZATION_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param)
        changed = true
      }
    }
    if (!changed) return urlStr
    const clean = url.toString()
    return clean.endsWith('?') ? clean.slice(0, -1) : clean
  } catch {
    return urlStr
  }
}

const normalizeMetravelOwnImageUrl = (urlStr: string): string => {
  try {
    const parsed = new URL(urlStr, 'https://metravel.by')
    const host = parsed.hostname.toLowerCase()
    if (host !== 'metravel.by' && host !== 'cdn.metravel.by' && host !== 'api.metravel.by') {
      return urlStr
    }
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:'
      return parsed.toString()
    }
    return urlStr
  } catch {
    return urlStr
  }
}

/**
 * #1176: тела легаси-статей до сих пор ссылаются прямо на бакет
 * (`metravelprod.s3….amazonaws.com/uploads/**`). S3 не понимает `w` и отдаёт
 * мастер: замер прода 2026-08-02 на `/travels/ourvietnam` — 59 таких ссылок,
 * первая из них 141 354 B против 7 820 B на `?w=320` через свой роут.
 *
 * Переписываем на первопартийный `/media-resize/…` ДО проверки хоста, чтобы
 * дальше отработала обычная ветка srcset по лестнице ширин — отдельного
 * построителя для легаси не заводим, иначе наборы ширин разъедутся, как это
 * уже было с копией лестницы в SSG (#1170).
 */
const toFirstPartyArticleImageUrl = (src: string): string => {
  const legacyPath = toLegacyResizePath(src)
  return legacyPath ? `https://metravel.by${legacyPath}` : src
}

/**
 * #1163: раньше эта функция называлась `buildWeservProxyUrl` и заворачивала любую
 * непервопартийную картинку тела статьи в `images.weserv.nl`. Сторонний ресайзер
 * стоял в критическом пути отрисовки статьи, регулярно отваливался под холодным
 * кэшем (из-за чего рядом жил костыль `data-weserv-fallback`) и добавлял третий
 * домен в CSP и preconnect.
 *
 * Теперь внешняя картинка отдаётся как есть, без ресайза: это дороже по байтам на
 * легаси-статьях с чужими фото, но убирает зависимость показа статьи от доступности
 * чужого сервиса. Правильное решение — забирать внешнюю картинку в наше хранилище в
 * момент вставки в редакторе; оно требует backend-эндпоинта ingest-by-URL (браузер
 * не может прочитать байты чужой картинки из-за CORS), поэтому вынесено отдельно.
 *
 * Легаси-URL, уже завёрнутые в weserv, разворачиваются до оригинала —
 * `unwrapWeservImageUrl` остаётся нужен, пока такие URL лежат в БД.
 */
export const buildExternalImageUrl = (src: string) => {
  try {
    const trimmed = String(src || '').trim()
    if (!trimmed) return null
    if (trimmed.startsWith('data:')) return trimmed

    const decoded = trimmed.replace(/&amp;/g, '&')
    const unwrapped = unwrapWeservImageUrl(decoded)
    // Битый weserv-URL без разбираемого `url=`: разворачивать нечего, отдаём как есть.
    if (isWeservImageUrl(decoded) && unwrapped === decoded) return decoded
    // Легаси-цепочка weserv → S3 разворачивается до бакета, а он уже переписывается
    // на свой роут: иначе после разворота осталась бы прямая ссылка на S3.
    const normalized = toFirstPartyArticleImageUrl(unwrapped)

    let parsedUrl: URL | null = null
    try {
      parsedUrl = new URL(normalized, 'https://metravel.by')
    } catch {
      parsedUrl = null
    }

    if (parsedUrl) {
      const host = parsedUrl.hostname.toLowerCase()
      if (isPrivateOrLocalHost(host)) {
        return decoded
      }
      if (host === 'metravel.by' || host === 'cdn.metravel.by' || host === 'api.metravel.by') {
        return normalizeMetravelOwnImageUrl(stripOptimizationParams(normalized))
      }
      // Протокол апгрейдим: раньше https появлялся сам собой, потому что обёртка
      // weserv была https. Оставить `http://` нельзя — страница отдаётся по https,
      // и браузер заблокирует такую картинку как mixed content.
      if (parsedUrl.protocol === 'http:') {
        parsedUrl.protocol = 'https:'
        return stripOptimizationParams(parsedUrl.toString())
      }
    }

    return stripOptimizationParams(normalized)
  } catch {
    return null
  }
}

// Ширины, которые СЛОТ тела статьи просит у источника.
//
// #1256: это больше не «копия лестницы бэкенда». Для картинки, у которой есть
// манифест `media.article_body`, адрес каждой ступени берётся готовым, а набор
// ниже работает как запрос: каждая ширина ложится на ближайшую ступень манифеста
// (`resolveArticleBodyRungs`). Самостоятельная сборка URL по этим ширинам осталась
// одним фолбэком — для ключей, которых в манифесте нет вовсе (legacy `uploads/**`,
// внешние картинки, старый payload без `media`).
//
// Набор нужен именно слоту: тело статьи ветвится по вьюпорту ещё на этапе
// трансформации HTML, а не через один общий srcset. Каждое значение обязано быть
// ступенью лестницы прокси; соответствие закреплено тестом «emits only widths that
// exist on the proxy ladder» в
// `__tests__/components/travel/stableContent/htmlTransform.responsiveImages.test.ts`.
// Контракт целиком — `docs/features/images.md`.
//
// #1160: до этого здесь стоял потолок 800 с обоснованием «1024 не входит в whitelist
// прокси, поэтому выше 800 он отдаёт оригинал целиком, игнорируя q». На дату замера
// (2026-07-30) это уже неверно — прокси починили в #1112/#1130: он округляет
// неподдержанную ширину ВВЕРХ по whitelist и никогда не апскейлит. Проверено на
// `travel-image/682/conversions/10f0a8f2….webp`: `?w=720` → 69 494 B, `?w=960` →
// 112 368 B, обе ступени реально обслуживаются. Из-за устаревшего обоснования слот
// тела статьи ~920 CSS на 1920vw получал 800w и апскейлился браузером: на Retina —
// ×2.3, отсюда «мыльные» фото в теле статьи.
//
// Как читать набор ниже (`sizes` — строкой ниже, слоты реальные):
//   desktop 1280vw, DPR 1 → нужно  720 → кандидат  800
//   desktop 1280vw, DPR 2 → нужно 1440 → кандидат 1600
//   desktop 1920vw, DPR 1 → нужно  920 → кандидат  960
//   desktop 1920vw, DPR 2 → нужно 1840 → кандидат 1920
// Мобильный набор намеренно оставлен с потолком 800: там слот 100vw, картинки тела
// ленивые, и поднятие потолка бьёт по мобильному трафику ради невидимой на 390 CSS
// резкости.
// #1167: сами числа живут в `constants/imageContract.ts` — единственном месте, где
// перечислено, что фронт вообще имеет право запросить.
const RESPONSIVE_WIDTHS_MOBILE = IMAGE_WIDTHS.articleBodyMobile
const RESPONSIVE_WIDTHS_DESKTOP = IMAGE_WIDTHS.articleBodyDesktop
const RESPONSIVE_FALLBACK_WIDTH = 800

// Реальные слоты тела статьи: 100vw на мобиле, ~720px на 1280, ~920px на 1920.
//
// #1213: это ЕДИНСТВЕННЫЙ источник и для атрибута `sizes`, и для выбора ступени
// префетча первой картинки. Раньше `sizes` был литералом, а префетч брал
// фиксированный `RESPONSIVE_FALLBACK_WIDTH`: на десктопе браузер грузил по srcset
// w=1920, а `<link rel=prefetch>` следом тянул w=800 — один слот двумя ступенями.
// Замер прода 2026-08-02: 29 252 B и 96 912 B выброшены на двух статьях.
const ARTICLE_BODY_SLOTS = [
  { maxViewport: 768, cssSize: '100vw', slotWidth: (viewportWidth: number) => viewportWidth },
  { maxViewport: 1439, cssSize: '720px', slotWidth: () => 720 },
  { maxViewport: Number.POSITIVE_INFINITY, cssSize: '920px', slotWidth: () => 920 },
] as const

const MOBILE_VIEWPORT_MAX = ARTICLE_BODY_SLOTS[0].maxViewport

const RESPONSIVE_SIZES = ARTICLE_BODY_SLOTS.map(({ maxViewport, cssSize }) =>
  Number.isFinite(maxViewport) ? `(max-width: ${maxViewport}px) ${cssSize}` : cssSize,
).join(', ')
// #1167: quality — на класс размера, а не на вызов. Тело статьи — крупный класс.
const RESPONSIVE_QUALITY = IMAGE_QUALITY.large

/**
 * Ширина вьюпорта, в котором стоит слот тела статьи, либо 0 — вьюпорта нет (SSR).
 *
 * #1268: раньше ширина бралась только из `window` под условием
 * `Platform.OS === 'web'`, поэтому на native она была 0 ВСЕГДА, слот считался
 * десктопным и в мобильный канал уезжал набор со ступенями до 1600. Экран
 * телефона — такой же вьюпорт слота, просто спрашивать его надо у `Dimensions`.
 */
const currentSlotViewportWidth = (): number => {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.innerWidth || 0 : 0
  }
  return Dimensions.get('window').width || 0
}

const isMobileSlotViewport = (): boolean => {
  const width = currentSlotViewportWidth()
  // Ширина 0 — это SSR: там вьюпорт неизвестен, и набор остаётся десктопным,
  // как и был (разметка уезжает в браузер, который выберет ступень сам).
  return width > 0 && width <= MOBILE_VIEWPORT_MAX
}

/**
 * Набор ширин слота для текущего вьюпорта.
 *
 * Разметка и префетч обязаны спрашивать ОДИН набор: если они разойдутся, префетч
 * прогреет ступень, которой нет в `srcset`, и слот скачается дважды (#1213).
 */
const currentSlotWidths = (): readonly number[] =>
  isMobileSlotViewport() ? RESPONSIVE_WIDTHS_MOBILE : RESPONSIVE_WIDTHS_DESKTOP

const getWebViewportWidth = (): number =>
  Platform.OS === 'web' && typeof window !== 'undefined' ? window.innerWidth || 0 : 0

const getWebDevicePixelRatio = (): number => {
  const raw = Platform.OS === 'web' && typeof window !== 'undefined' ? window.devicePixelRatio : 1
  return Number.isFinite(raw) && raw > 0 ? raw : 1
}

/**
 * Ступень, которую браузер возьмёт из нашего `srcset` для текущего вьюпорта:
 * минимальный кандидат, покрывающий слот × DPR, иначе самый широкий. Правило то
 * же, что в HTML-спеке, поэтому префетч попадает ровно в тот URL, который потом
 * запросит `<img>`, и слот остаётся с одной сетевой загрузкой (#1213).
 *
 * Без вьюпорта (SSR/native) остаётся прежняя fallback-ступень — там префетча нет.
 */
export const pickArticleBodyWidth = (
  viewportWidth: number,
  dpr: number,
  familyRoute?: string,
): number => {
  const needed = articleBodySlotNeed(viewportWidth, dpr)
  if (needed === null) {
    return clampLadderToFamily(familyRoute, [RESPONSIVE_FALLBACK_WIDTH])[0]
  }
  const slotWidths =
    viewportWidth <= MOBILE_VIEWPORT_MAX ? RESPONSIVE_WIDTHS_MOBILE : RESPONSIVE_WIDTHS_DESKTOP
  const widths = clampLadderToFamily(familyRoute, slotWidths)
  return widths.find((width) => width >= needed) ?? widths[widths.length - 1]
}

/**
 * Ширина в пикселях, которую слот тела статьи просит на текущем вьюпорте, либо
 * `null` — вьюпорта нет (SSR/native), и просить нечего.
 *
 * Вынесено из `pickArticleBodyWidth`, потому что у картинки из манифеста нет
 * промежуточной «своей» лестницы: ступень выбирается прямо по этой потребности,
 * иначе округление шло бы дважды — сначала к набору слота, потом к ступеням
 * манифеста, — и префетч мог бы промахнуться мимо кандидата из `srcset`.
 */
const articleBodySlotNeed = (viewportWidth: number, dpr: number): number | null => {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return null
  const slot =
    ARTICLE_BODY_SLOTS.find((entry) => viewportWidth <= entry.maxViewport) ??
    ARTICLE_BODY_SLOTS[ARTICLE_BODY_SLOTS.length - 1]
  return slot.slotWidth(viewportWidth) * (Number.isFinite(dpr) && dpr > 0 ? dpr : 1)
}

/**
 * Лестница слота, обрезанная по потолку СЕМЕЙСТВА источника (#1233).
 *
 * Наборы `articleBody*` описывают слот-потребитель, а не то, что у файла есть.
 * В телах статей лежат ключи чужих семейств: `gallery/**` (профиль `travelMedia`,
 * верхняя производная 1600 — влезает) и `address-image/**` (профиль `routePoint`,
 * мастер 1200, верхняя производная 960 — НЕ влезает). Замер прода 2026-08-04 на
 * `address-image/15601/conversions/…webp`: `w=800` и `w=960` → 200,
 * `w=1600` → **400**, то есть на desktop @DPR2 браузер выбирал ровно ту ступень,
 * которой у семейства нет, и фото не отрисовывалось. В статье
 * `/travels/zabroshennye-dvortsy-…` так падали 13 из 13 таких ключей, всего по
 * сайту — 30 фото в 5 статьях.
 *
 * `optimizeImageUrl` этот клэмп имеет с #1224, а трансформация тела — не имела:
 * она единственная строит `srcset` сама, мимо `imageProxy`.
 *
 * Неизвестное семейство (legacy-роут `/media-resize/legacy/…`, куда переписывается
 * ссылка в бакет) раньше не клэмпилось вовсе — набор сам обрывался на 1600, и все
 * ступени отвечали 200. Со ступенью 1920 это перестало быть правдой: проба прода
 * 2026-08-10 на `legacy/682/conversions/…webp` — `w=1600` → 200, `w=1920` → 400.
 * Поэтому потолок берётся всегда, а для неопознанного адреса он консервативный
 * (`UNKNOWN_FAMILY_DERIVATIVE_CEILING`, #1373).
 */
const clampLadderToFamily = (
  route: string | undefined,
  widths: readonly number[],
): readonly number[] => {
  const ceiling = familyDerivativeCeiling(route) ?? UNKNOWN_FAMILY_DERIVATIVE_CEILING
  const kept = widths.filter((width) => width <= ceiling)
  // Слот целиком выше семейства — берём его самую крупную производную, иначе
  // остались бы без единого кандидата.
  return kept.length ? kept : [ceiling]
}

const isFirstPartyMetravelHost = (host: string): boolean => {
  const value = String(host || '').toLowerCase()
  return value === 'metravel.by' || value === 'cdn.metravel.by' || value === 'api.metravel.by'
}

const buildMetravelSizedUrl = (base: URL, width: number): string => {
  const url = new URL(base.toString())
  url.searchParams.set('w', String(width))
  url.searchParams.set('q', String(RESPONSIVE_QUALITY))
  url.searchParams.set('fit', 'contain')
  // #1233: у legacy-класса `uploads/**` durable-производных нет, и после
  // fail-closed чтения ВСЯ лестница отвечает 404 — фото легаси-статей пропали
  // (5 044 кадра в 259 из 397 статей, обход 2026-08-04). Явный `f=jpeg` уводит
  // класс в `dynamic-transform` и возвращает лестницу в строй; обоснование и
  // условие снятия — у `LEGACY_UPLOAD_TRANSFORM_FORMAT`.
  if (isLegacyUploadResizeUrl(url.pathname)) {
    url.searchParams.set('f', LEGACY_UPLOAD_TRANSFORM_FORMAT)
  }
  return url.toString()
}

type ResponsiveImage = { src: string; srcSet: string; sizes: string }

/** База первопартийной картинки тела без параметров размера, либо `null`. */
const parseFirstPartyArticleImage = (src: string): URL | null => {
  try {
    const trimmed = String(src || '').trim()
    if (!trimmed || trimmed.startsWith('data:')) return null
    // Сначала разворачиваем legacy weserv-цепочки и переводим ключи нашего S3
    // на первопартийный resize route. Иначе normalizeImgTags строит responsive
    // вариант по исходному внешнему URL раньше, чем buildExternalImageUrl успевает
    // его нормализовать, и итоговый <img> остаётся без w/srcset (#1176).
    const normalized = buildExternalImageUrl(trimmed) ?? trimmed
    const parsed = new URL(normalized.replace(/&amp;/g, '&'), 'https://metravel.by')
    if (!isFirstPartyMetravelHost(parsed.hostname)) return null
    if (parsed.protocol === 'http:') parsed.protocol = 'https:'
    // сбрасываем ранее заданные размеры, сохраняя cache-buster `v`
    for (const param of OPTIMIZATION_PARAMS) parsed.searchParams.delete(param)
    return parsed
  } catch {
    return null
  }
}

/**
 * Готовые адреса из `media.article_body` — канонический путь (#1256).
 *
 * `sizes` остаётся нашим: `sizes_hint` манифеста описывает слот вслепую
 * (`(max-width: 768px) 100vw, 1280px`), а реальные слоты тела статьи — 720 CSS на
 * 1280vw и 920 на 1920vw. С подсказкой манифеста desktop @DPR1 выбирал бы 1600
 * вместо 800/960: замер прода 2026-08-04 на 10 кадрах статьи 544 — 1 403 792 B
 * против 946 638 B. Адресация файла — дело бэкенда, размер слота — дело вёрстки.
 */
const buildManifestResponsiveImage = (
  src: string,
  media: ArticleBodyMediaIndex | null,
): ResponsiveImage | null => {
  const rungs = resolveArticleBodyRungs(src, media, currentSlotWidths())
  if (!rungs?.length) return null

  const fallbackRung = pickWidthCandidate(rungs, RESPONSIVE_FALLBACK_WIDTH)
  if (!fallbackRung) return null

  return {
    src: fallbackRung.url,
    // Один кандидат — это не лестница: `srcset` из одного URL ничего браузеру не
    // даёт, а пустая строка в `srcset=""` в части движков гасит и `src` (#1233).
    srcSet: rungs.length > 1 ? rungs.map((rung) => `${rung.url} ${rung.width}w`).join(', ') : '',
    sizes: rungs.length > 1 ? RESPONSIVE_SIZES : '',
  }
}

const buildMetravelResponsiveImage = (
  src: string,
  media: ArticleBodyMediaIndex | null,
): ResponsiveImage | null => {
  const fromManifest = buildManifestResponsiveImage(src, media)
  if (fromManifest) return fromManifest

  const parsed = parseFirstPartyArticleImage(src)
  if (!parsed) return null
  // #1233: у legacy-класса `uploads/**` лестница бессмысленна — мастера в нём
  // 500…1000 px, поэтому ступени выше 800 отдают либо тот же файл, либо те же
  // пиксели на 40–70% тяжелее. Отдаём одну ширину без `srcset`/`sizes`: браузеру
  // не из чего выбирать, а бэкенду не надо держать шесть производных на ключ.
  // Числа и вывод для backfill — у `LEGACY_UPLOAD_FIXED_WIDTH`.
  if (isLegacyUploadResizeUrl(parsed.pathname)) {
    return { src: buildMetravelSizedUrl(parsed, LEGACY_UPLOAD_FIXED_WIDTH), srcSet: '', sizes: '' }
  }
  const widths = clampLadderToFamily(familyRouteOfMediaUrl(src), currentSlotWidths())
  const srcSet = widths.map((w) => `${buildMetravelSizedUrl(parsed, w)} ${w}w`).join(', ')
  return {
    src: buildMetravelSizedUrl(parsed, widths[widths.length - 1] >= RESPONSIVE_FALLBACK_WIDTH
      ? RESPONSIVE_FALLBACK_WIDTH
      : widths[widths.length - 1]),
    srcSet,
    sizes: RESPONSIVE_SIZES,
  }
}

/**
 * URL первой картинки тела для `<link rel=prefetch>`.
 *
 * #1213: это НЕ `src` из разметки. `src` — запасная ступень для движков без
 * `srcset`, а греть надо ровно ту ступень, которую браузер выберет по
 * `srcset`/`sizes`, иначе тот же слот скачивается дважды.
 */
export const buildStableContentPrefetchUrl = (
  src: string,
  media?: ArticleBodyMediaIndex | null,
): string => {
  // Кандидаты берутся тем же вызовом, что и для `srcset`, поэтому прогретый URL
  // гарантированно один из них — даже если ступени манифеста разойдутся с набором
  // слота. Потребность считается напрямую, без промежуточного округления.
  const rungs = resolveArticleBodyRungs(src, media ?? null, currentSlotWidths())
  if (rungs?.length) {
    const needed = articleBodySlotNeed(getWebViewportWidth(), getWebDevicePixelRatio())
    const rung = pickWidthCandidate(rungs, needed ?? RESPONSIVE_FALLBACK_WIDTH)
    if (rung) return rung.url
  }

  const parsed = parseFirstPartyArticleImage(src)
  if (!parsed) return buildExternalImageUrl(src) ?? src
  // Класс без лестницы греется своей единственной шириной: иначе префетч и `<img>`
  // разошлись бы по разным URL и слот скачался бы дважды — ровно баг #1213.
  if (isLegacyUploadResizeUrl(parsed.pathname)) {
    return buildMetravelSizedUrl(parsed, LEGACY_UPLOAD_FIXED_WIDTH)
  }
  // Клэмп по семейству обязан быть тем же, что в `srcset`, иначе префетч уходит
  // на ступень, которой у семейства нет, и греет 400 (#1213 + #1233).
  return buildMetravelSizedUrl(
    parsed,
    pickArticleBodyWidth(getWebViewportWidth(), getWebDevicePixelRatio(), familyRouteOfMediaUrl(src)),
  )
}

const stripDangerousTags = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')

const appendClass = (attrs: string, className: string) => {
  if (!attrs) return ` class="${className}"`
  if (/\bclass="/i.test(attrs)) {
    return attrs.replace(/class="([^"]*)"/i, (_, current) => `class="${`${current} ${className}`.trim()}"`)
  }
  return `${attrs} class="${className}"`
}

const appendInlineStyle = (attrs: string, declaration: string) => {
  if (!attrs) return ` style="${declaration}"`
  const styleMatch = attrs.match(/\bstyle="([^"]*)"/i)
  if (!styleMatch) {
    return `${attrs} style="${declaration}"`
  }
  const current = styleMatch[1] || ''
  if (current.includes(declaration)) {
    return attrs
  }
  const nextStyle = current.trim().replace(/;$/, '')
  const merged = nextStyle ? `${nextStyle};${declaration}` : declaration
  return attrs.replace(styleMatch[0], `style="${merged}"`)
}

const escapeHtmlAttr = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const buildRichImageAspectDeclaration = (imgMarkup: string) => {
  const width = Number(imgMarkup.match(/\bwidth="(\d+)"/i)?.[1] ?? 0)
  const height = Number(imgMarkup.match(/\bheight="(\d+)"/i)?.[1] ?? 0)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return ''
  }
  return `--travel-rich-image-aspect:${width}/${height}`
}

const normalizeImgTags = (html: string, media: ArticleBodyMediaIndex | null): string => {
  let imgIdx = 0
  return html.replace(/<img\b[^>]*?>/gi, (tag) => {
    const src = tag.match(/\bsrc="([^"]+)"/i)?.[1] ?? ''
    const responsive = src ? buildMetravelResponsiveImage(src, media) : null
    const optimizedSrc = responsive?.src ?? (src ? buildExternalImageUrl(src) || src : src)
    let width = tag.match(/\bwidth="(\d+)"/i)?.[1]
    let height = tag.match(/\bheight="(\d+)"/i)?.[1]

    if (!width || !height) {
      const wh = src.match(/[-_](\d{2,5})x(\d{2,5})\.(?:jpe?g|png|webp|avif)(?:\?|$)/i)
      if (wh) {
        width = width || wh[1]
        height = height || wh[2]
      }
    }

    // #1188: 800×450 — это РЕЗЕРВ места до загрузки, а не пропорции кадра. Редакторская
    // разметка почти никогда не несёт width/height, и без пометки оба рендерера считали
    // выдуманные 16:9 настоящими: на web фото вставало в чужой слот (портрет 374×499 в
    // 354×195 — 59% площади пусто), а на native `attrAR` вообще отменял измерение файла.
    // Маркер отличает резерв от объявленных редактором размеров: их трогать нельзя.
    const hasDeclaredSize = Boolean(width && height)
    const finalW = width || 800
    const finalH = height || 450

    const styleMatch = tag.match(/\bstyle="([^"]*)"/i)
    const style = styleMatch?.[1] ?? ''
    const aspectRule = `aspect-ratio:${finalW}/${finalH}`
    const ensured = ['display:block', 'height:auto', 'margin:0 auto', aspectRule]
      .filter(Boolean)
      .reduce((acc, rule) => (acc.includes(rule) ? acc : acc ? `${acc};${rule}` : rule), style)

    let out = tag.replace(styleMatch ? styleMatch[0] : '', '').replace(/>$/, ` style="${ensured}">`)
    out = out
      .replace(/\bsrc="[^"]*"/i, optimizedSrc ? `src="${escapeHtmlAttr(optimizedSrc)}"` : '')
      .replace(/\bsrcset="[^"]*"/i, '')
      .replace(/\bsizes="[^"]*"/i, '')
      .replace(/\bwidth="[^"]*"/i, '')
      .replace(/\bheight="[^"]*"/i, '')

    // Пустой `srcSet` — это не «забыли построить», а класс без лестницы (#1233).
    // Атрибуты в таком случае не выводим: `srcset=""` браузер трактует как
    // кандидатов нет и в части движков гасит `src`.
    if (responsive?.srcSet) {
      out = out.replace(
        />$/,
        ` srcset="${escapeHtmlAttr(responsive.srcSet)}" sizes="${escapeHtmlAttr(responsive.sizes)}">`
      )
    }

    out = out.replace(/\bdata-aspect-fallback="[^"]*"/i, '')
    out = out.replace(
      />$/,
      ` width="${finalW}" height="${finalH}"${hasDeclaredSize ? '' : ' data-aspect-fallback="1"'}>`
    )
    out = out
      .replace(/\bdecoding="[^"]*"/i, '')
      .replace(/\bfetchpriority="[^"]*"/i, '')
      .replace(/\bloading="[^"]*"/i, '')

    const fallbackAlt = i18nT('travel:components.travel.stableContent.htmlTransform.izobrazhenie_marshruta_value1_ae0fc919', { value1: imgIdx + 1 })
    const altMatch = out.match(/\balt="([^"]*)"/i)
    if (!altMatch) {
      out = out.replace(/>$/, ` alt="${fallbackAlt}">`)
    } else if (!altMatch[1].trim()) {
      out = out.replace(/\balt="[^"]*"/i, `alt="${fallbackAlt}"`)
    }

    out = out.replace(/>$/, ' loading="lazy" decoding="async" fetchpriority="low">')
    imgIdx += 1
    return out
  })
}

const replaceYouTubeIframes = (html: string): string =>
  html.replace(/<iframe\b[^>]*src="([^"]+)"[^>]*><\/iframe>/gi, (full, src: string) => {
    if (!isYouTubeEmbedUrl(src)) return full
    // Канонический вид, в который `buildYoutubeEmbedHtmlFromUrl` приводит ЛЮБОЙ
    // ролик, — `/embed/<id>` без query. Без этой ветки id не извлекался ни разу,
    // и вместо лёгкого фасада на страницу вставал живой плеер (по одному на видео).
    const id =
      src.match(/\/embed\/([a-z0-9_-]{6,})/i)?.[1] ||
      src.match(/[?&]v=([a-z0-9_-]{6,})/i)?.[1] ||
      src.match(/youtu\.be\/([a-z0-9_-]{6,})/i)?.[1]
    if (!id) return full
    return `
<div class="yt-lite" data-yt="${id}"
     style="position:relative;aspect-ratio:16/9;background:var(--color-backgroundTertiary);border-radius:12px;overflow:hidden;margin:16px 0">
  <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg"
       width="1280" height="720"
       alt="YouTube preview" loading="lazy" decoding="async"
       style="width:100%;height:100%;object-fit:cover;display:block"/>
  <div role="button" tabindex="0" aria-label="${i18nT("travel:components.travel.stableContent.htmlTransform.div_class_yt_lite_data_yt_value1_style_posit_873857b2.text01")}"
    style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:transparent;cursor:pointer">
    <span style="width:68px;height:48px;background:var(--color-overlay);clip-path:polygon(20% 10%,20% 90%,85% 50%);"></span>
  </div>
</div>`
  })

const stripTags = (value: string) => value.replace(/<[^>]+>/g, '')

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")

const encodeEntities = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const injectAutoHeadingAnchors = (html: string) => {
  if (!html) return html

  const orderedHashIds = Array.from(
    html.matchAll(/<a\b[^>]*href=(["'])#([^"'#?]+)\1[^>]*>/gi),
    (match) => String(match[2] || '').trim()
  ).filter(Boolean)
  const uniqueOrderedHashIds = orderedHashIds.filter((id, index) => orderedHashIds.indexOf(id) === index)

  return html.replace(/<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi, (full, level, rawAttrs, inner) => {
    const attrs = String(rawAttrs || '')
    if (/\bid\s*=\s*"[^"]+"/i.test(attrs)) return full

    const innerText = decodeEntities(String(inner || '').replace(/<[^>]+>/g, '').trim())
    const match = innerText.match(/^(\d{1,3})[.)]\s+/)
    if (!match) return full

    const orderedId = uniqueOrderedHashIds[Number(match[1]) - 1]
    const id = orderedId || `part${match[1]}`
    const nextAttrs = attrs ? `${attrs} id="${id}"` : ` id="${id}"`
    return `<h${level}${nextAttrs}>${inner}</h${level}>`
  })
}

const sliceText = (text: string, limit: number) => {
  const chars = Array.from(text)
  if (chars.length <= limit) {
    return { text, truncated: false }
  }
  return {
    text: chars.slice(0, limit).join('').trimEnd(),
    truncated: true,
  }
}

const truncateInstagramCaptions = (html: string) => {
  return html.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs = '', inner = '') => {
    const plain = decodeEntities(stripTags(inner)).trim()
    if (!plain.startsWith('@') || plain.length <= 100) return match

    const handleMatch = inner.match(/^(\s*@\s*(?:<a[\s\S]+?<\/a>|[\w.@]+))(.*)$/i)
    let nextInner = inner
    if (handleMatch) {
      const handleHtml = handleMatch[1]
      const restHtml = handleMatch[2] || ''
      const handlePlain = decodeEntities(stripTags(handleHtml)).trim()
      const restPlain = decodeEntities(stripTags(restHtml)).trim()
      const remaining = Math.max(0, 100 - handlePlain.length - 1)
      const { text, truncated } = sliceText(restPlain, remaining)
      const spacer = text ? '&nbsp;' : ''
      nextInner = `${handleHtml}${spacer}<span class="instagram-caption-text">${encodeEntities(text)}${truncated ? '…' : ''}</span>`
    } else {
      const { text, truncated } = sliceText(plain, 100)
      nextInner = `${encodeEntities(text)}${truncated ? '…' : ''}`
    }

    return `<p${appendClass(attrs, 'instagram-caption')}>${nextInner}</p>`
  })
}

/** Теги без закрывающей пары — они не меняют глубину вложенности при обходе. */
const VOID_HTML_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
])

/**
 * Диапазоны `<img>`, лежащих в КОРНЕ описания, а не внутри `<p>`/`<figure>`/строки
 * галереи.
 *
 * #1188: `decorateRichImageFrames` умел оборачивать только картинку внутри абзаца
 * или `<figure>`, а редакторская разметка сплошь и рядом кладёт `<img>` прямо между
 * заголовками — соседями `H2`/`H3`/`P`. Замер прода 2026-07-31 на статье о
 * заброшенных дворцах: 37 картинок тела, 0 в `.rich-image-frame`, то есть блюр-фона
 * не было ни у одной, и портрет 374×499 в зарезервированном слоте 16:9 оставлял
 * 59% площади пустой белой.
 *
 * Глубину считаем обходом тегов: обёртки (журнальные сетки и instagram-карточки)
 * поднимают её выше нуля, поэтому их содержимое сюда не попадает и раскладка не меняется.
 */
const collectRootLevelImageRanges = (html: string): Array<[number, number]> => {
  const ranges: Array<[number, number]> = []
  const tagPattern = /<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/gi
  let depth = 0
  let match: RegExpExecArray | null

  while ((match = tagPattern.exec(html)) !== null) {
    const [tag, closing, rawName, selfClosing] = match
    const name = rawName.toLowerCase()

    if (name === 'img') {
      if (!closing && depth === 0) ranges.push([match.index, match.index + tag.length])
      continue
    }
    if (VOID_HTML_TAGS.has(name) || selfClosing === '/') continue

    if (closing) depth = Math.max(0, depth - 1)
    else depth += 1
  }

  return ranges
}

/**
 * #1265: `<img>`, оставленный редактором ВНУТРИ заголовка.
 *
 * `collectRootLevelImageRanges` считает такую картинку вложенной (глубина 1), а под
 * правила `<p>`/`<figure>` она не подходит — то есть рамки не получает вовсе.
 * Замер прода 2026-08-05, `/travels/reka-isloch-…`: разметка
 * `<h2 id="…"><img src="…0164614223…"></h2>`, у кадра нет ни заливки полей
 * (`rgba(0, 0, 0, 0)`), ни принятия натуральных пропорций после загрузки, тогда как
 * соседний кадр в `<p>` получает и то, и другое.
 *
 * Картинку выносим ПОСЛЕ заголовка, а сам заголовок оставляем на месте даже пустым:
 * его `id` — цель якоря и оглавления, и удаление ломало бы навигацию по статье.
 * Дальше вынесенный `<p>` проходит обычным правилом абзаца.
 */
const liftHeadingImages = (html: string): string =>
  html.replace(
    /<(h[1-6])(\b[^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, tag: string, attrs = '', inner = '') => {
      const images = inner.match(/<img\b[^>]*>/gi)
      if (!images?.length) return match
      // Картинку-ссылку не трогаем: вынос из заголовка оторвал бы её от `<a>`, то
      // есть отнял бы переход. Такой кадр остаётся как был — без рамки, но кликабельным.
      if (/<a\b/i.test(inner)) return match
      const rest = inner.replace(/<img\b[^>]*>/gi, '')
      const lifted = images.map((img: string) => `<p>${img}</p>`).join('')
      return `<${tag}${attrs}>${rest}</${tag}>${lifted}`
    },
  )

const decorateRichImageFrames = (html: string) => {
  if (!html) return html

  const decorateAttrs = (attrs: string, imgMarkup: string) => {
    const nextClassAttrs = appendClass(attrs, 'rich-image-frame')
    // Рамка несёт только геометрию: URL фотографии в inline-CSS сделал бы из неё
    // второй растр слота и обошёл бы `loading="lazy"` у самого `<img>` (#1208/#1213).
    const frameDeclaration = buildRichImageAspectDeclaration(imgMarkup)
    return frameDeclaration
      ? appendInlineStyle(nextClassAttrs, frameDeclaration)
      : nextClassAttrs
  }

  const wrapRootLevelImages = (input: string) => {
    const ranges = collectRootLevelImageRanges(input)
    if (ranges.length === 0) return input

    let out = ''
    let cursor = 0
    for (const [start, end] of ranges) {
      const imgMarkup = input.slice(start, end)
      out += `${input.slice(cursor, start)}<p${decorateAttrs('', imgMarkup)}>${imgMarkup}</p>`
      cursor = end
    }
    return out + input.slice(cursor)
  }

  return wrapRootLevelImages(
    liftHeadingImages(html)
      .replace(
        /<p([^>]*)>(\s*<img\b[^>]*\bsrc="([^"]+)"[^>]*>\s*(?:<br\s*\/?>\s*)?)<\/p>/gi,
        (match, attrs = '', inner = '') => `<p${decorateAttrs(attrs, inner)}>${inner}</p>`
      )
      .replace(
        /<figure([^>]*)>([\s\S]*?<img\b[^>]*\bsrc="([^"]+)"[^>]*>[\s\S]*?)<\/figure>/gi,
        (match, attrs = '', inner = '') => `<figure${decorateAttrs(attrs, inner)}>${inner}</figure>`
      )
  )
}

export type PrepareStableContentHtmlOptions = {
  // true — html уже canonical rich_text.*.safe_html с бэка (#709): полный
  // normalize+sanitize pipeline не запускается, остаётся только дешёвый guard.
  serverSanitized?: boolean
  /**
   * #1256: индекс `media.article_body`. Без него картинки тела адресуются прежним
   * клиентским способом — это штатный фолбэк, а не деградация: у статей со старым
   * payload и на экранах вне travel манифеста нет вовсе.
   */
  articleBodyMedia?: ArticleBodyMediaIndex | null
}

export const prepareStableContentHtml = (html: string, options?: PrepareStableContentHtmlOptions) => {
  const serverSanitized = options?.serverSanitized === true
  const normalizedEmbeds = serverSanitized
    ? guardServerSafeHtml(html)
    : normalizeArticleEditorHtmlForInput(html)
  const isWeb = Platform.OS === 'web' || typeof document !== 'undefined'
  // На web: вместо живого iframe (каждый тянет ~целый Instagram-рантайм, ~900KB/десятки
  // запросов на статью) — лёгкий facade, настоящий iframe монтируется лениво при подходе
  // к вьюпорту (useStableContentWebEffects). На native iframe остаётся в HTML и попадает
  // в `InstagramEmbed` (WebView) через рендерер RNRH, который так же монтирует его лениво
  // и с окном — посты обязаны выглядеть одинаково на mobile web и Android.
  const instagramSafeHtml = replaceInstagramEmbedsWithCards(normalizedEmbeds, {
    iframeStrategy: isWeb ? 'facade' : 'embed',
  })
  const safe = serverSanitized ? instagramSafeHtml : sanitizeRichText(instagramSafeHtml)
  const normalized = replaceYouTubeIframes(
    normalizeImgTags(stripDangerousTags(safe), options?.articleBodyMedia ?? null),
  )
  const demoted = normalized
    .replace(/<\s*h1(\b[^>]*)>/gi, '<h2$1>')
    .replace(/<\s*\/\s*h1\s*>/gi, '</h2>')
  const truncated = truncateInstagramCaptions(demoted)
  const normalizedLists = normalizeRichTextListFragments(truncated)
  return injectAutoHeadingAnchors(decorateRichImageFrames(applySmartImageLayout(normalizedLists)))
}
