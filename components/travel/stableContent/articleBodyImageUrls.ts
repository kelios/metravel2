// #3408: адреса картинок тела статьи — один построитель на полный рендер
// (`htmlTransform.normalizeImgTags`) и на серверный остров
// (`TravelDescription` → `toInertHtml`). Вынесен из `htmlTransform.ts`, чтобы
// eager-путь страницы статьи не тянул санитайз и трансформацию HTML: здесь только
// лестницы, клэмп семейства, манифест и сборка URL.

import { Dimensions, Platform } from 'react-native'

import {
  resolveArticleBodyRungs,
  type ArticleBodyMediaIndex,
} from '@/components/travel/stableContent/articleBodyMedia'
import {
  ARTICLE_BODY_MOBILE_VIEWPORT_MAX,
  ARTICLE_BODY_SIZES,
  ARTICLE_BODY_SLOTS,
  isArticleBodyMobileViewport,
} from '@/components/travel/stableContent/articleBodySlots'
import {
  familyDerivativeCeiling,
  IMAGE_QUALITY,
  IMAGE_WIDTHS,
  LEGACY_UPLOAD_FIXED_WIDTH,
  UNKNOWN_FAMILY_DERIVATIVE_CEILING,
} from '@/constants/imageContract'
import {
  familyRouteOfMediaUrl,
  isLegacyResizeRouteUrl,
  isLegacyUploadResizeUrl,
  isPrivateOrLocalHost,
  toLegacyResizePath,
} from '@/utils/mediaUrl'
import type { DeferredImageSources } from '@/utils/inertHtmlDeferredImages'
import { pickWidthCandidate } from '@/utils/travelMediaVariants'
import { isWeservImageUrl, unwrapWeservImageUrl } from '@/utils/weservImageUrl'
import { isMetravelMediaHostname } from '@/utils/webResourceHints'

const OPTIMIZATION_PARAMS = ['w', 'h', 'q', 'f', 'fit', 'auto', 'output', 'blur', 'dpr']

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
    if (!isMetravelMediaHostname(host)) {
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
      if (isMetravelMediaHostname(host)) {
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
//   desktop 1920vw, DPR 2 → нужно 1840 → кандидат 1600 (потолок производных, ×1.15 — см. articleBodyDesktop)
// Мобильный набор намеренно оставлен с потолком 800: там слот 100vw, картинки тела
// ленивые, и поднятие потолка бьёт по мобильному трафику ради невидимой на 390 CSS
// резкости.
// #1167: сами числа живут в `constants/imageContract.ts` — единственном месте, где
// перечислено, что фронт вообще имеет право запросить.
const RESPONSIVE_WIDTHS_MOBILE = IMAGE_WIDTHS.articleBodyMobile
const RESPONSIVE_WIDTHS_DESKTOP = IMAGE_WIDTHS.articleBodyDesktop
const RESPONSIVE_FALLBACK_WIDTH = 800

const RESPONSIVE_SIZES = ARTICLE_BODY_SIZES
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

const isMobileSlotViewport = (): boolean => isArticleBodyMobileViewport(currentSlotViewportWidth())

/**
 * Набор ширин слота для текущего вьюпорта.
 *
 * Разметка и префетч обязаны спрашивать ОДИН набор: если они разойдутся, префетч
 * прогреет ступень, которой нет в `srcset`, и слот скачается дважды (#1213).
 */
export const currentSlotWidths = (): readonly number[] =>
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
    viewportWidth <= ARTICLE_BODY_MOBILE_VIEWPORT_MAX ? RESPONSIVE_WIDTHS_MOBILE : RESPONSIVE_WIDTHS_DESKTOP
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
 * ссылка в бакет) раньше не клэмпилось вовсе — держалось это на том, что набор сам
 * обрывался на 1600, а у `route_point`-конверсий за тем же роутом уже ступень 1600
 * отвечает 400. Потолок берётся всегда, для неопознанного адреса — консервативный
 * (`UNKNOWN_FAMILY_DERIVATIVE_CEILING`, #1373): защита читателя не должна зависеть
 * от того, каким набор слота случайно оказался сегодня.
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

/**
 * `q`/`fit` понимает только legacy-роут — он один режет в момент запроса.
 *
 * Правило то же, что у `optimizeImageUrl` (`servedFromDurableFamily` в
 * `utils/imageProxy.ts`), и здесь оно появилось с #1204: пока conversion-ключи
 * уходили на `/media-resize/legacy/`, расхождение двух построителей не
 * проявлялось, а после снятия rewrite тело статьи стало бы просить у семейства
 * тот же файл под лишними параметрами. Бэкенд их игнорирует (замер прода
 * 2026-08-09, `travel-description-image/247b89ab….webp`: `?w=640`, `?w=640&q=70`,
 * `?w=640&q=70&fit=contain`, `?w=640&fit=cover` — все отдают 157 952 B
 * байт-в-байт), но каждый набор — ОТДЕЛЬНАЯ запись в кэше nginx и в браузерном.
 */
const buildMetravelSizedUrl = (base: URL, width: number): string => {
  const url = new URL(base.toString())
  url.searchParams.set('w', String(width))
  if (isLegacyResizeRouteUrl(url.toString())) {
    url.searchParams.set('q', String(RESPONSIVE_QUALITY))
    url.searchParams.set('fit', 'contain')
  }
  // #1753: `f=jpeg` для класса `uploads/**` (обход #1233) снят. В
  // proxy-contract v16 этот формат объявлен у `legacy_upload` как
  // `unsupported_format`, и запрос отвечает 400 — на живой опубликованной
  // странице это были 17 из 17 обращений и три невидимых фото (access-log
  // прода за 72 часа, 2026-09-04). Без `f` тот же URL отдаёт 200
  // `stored-master-fallback` по политике `v1_then_master_no_transform`.
  return url.toString()
}

export type ResponsiveImage = { src: string; srcSet: string; sizes: string }

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
    if (!isMetravelMediaHostname(parsed.hostname)) return null
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
  slotWidths: readonly number[],
): ResponsiveImage | null => {
  const rungs = resolveArticleBodyRungs(src, media, slotWidths)
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

/**
 * Адреса картинки тела под лестницу слота `slotWidths`, либо `null` — картинка не
 * первопартийная и не из манифеста. Лестницу передаёт вызывающий: полный рендер
 * берёт её по вьюпорту (`currentSlotWidths`), серверный остров — обе сразу
 * (`buildArticleBodyIslandImageSources`), потому что вьюпорта у него нет.
 */
export const buildArticleBodyResponsiveImage = (
  src: string,
  media: ArticleBodyMediaIndex | null,
  slotWidths: readonly number[],
): ResponsiveImage | null => {
  const fromManifest = buildManifestResponsiveImage(src, media, slotWidths)
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
  const widths = clampLadderToFamily(familyRouteOfMediaUrl(src), slotWidths)
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

/**
 * #3408: адреса картинки серверного острова тела статьи (`TravelDescription`).
 *
 * Остров рисуется до полного рендера и сохранял адрес оригинала без `w`: бэкенд
 * отдаёт на него мастер с `no-store` мимо кэша, а полный рендер потом качал тот
 * же кадр второй раз — уже ступенью. Теперь слот получает те же URL, что выдаст
 * полный рендер на этом вьюпорте, и качается один раз.
 *
 * Разметка острова обязана совпасть на сервере и в первом клиентском проходе,
 * поэтому вьюпорт здесь не читается: остров несёт обе лестницы. Десктопная —
 * в `srcset` (ей же достаётся `noscript`), мобильная — в `mobileSrcSet`, её
 * подставляет выпуск отложенных картинок на мобильном вьюпорте. Без этого
 * телефон с DPR 3 взял бы 1600 (#1213, `articleBodyMobile`). `null` — наборы
 * совпали; пустая строка — на мобиле лестницы нет (одна ступень манифеста), и
 * картинка остаётся на `src`, как у полного рендера.
 */
export const buildArticleBodyIslandImageSources = (
  src: string,
  media: ArticleBodyMediaIndex | null,
): DeferredImageSources | null => {
  const desktop = buildArticleBodyResponsiveImage(src, media, RESPONSIVE_WIDTHS_DESKTOP)
  if (!desktop) return null
  const mobileSrcSet = buildArticleBodyResponsiveImage(src, media, RESPONSIVE_WIDTHS_MOBILE)?.srcSet ?? ''
  return { ...desktop, mobileSrcSet: mobileSrcSet === desktop.srcSet ? null : mobileSrcSet }
}
