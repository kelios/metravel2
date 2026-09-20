/**
 * scripts/lib/readerMediaUrl.js
 * Адрес кадра, который РЕАЛЬНО уходит из браузера читателя (#1854).
 *
 * ЗАЧЕМ. Между `src` в теле статьи и запросом браузера стоит переписывание
 * роута: `components/travel/stableContent/htmlTransform.ts` прогоняет каждый
 * `<img>` через `toFirstPartyArticleImageUrl` → `toLegacyResizePath`
 * (`utils/mediaUrl.ts`), и два класса меняют адрес:
 *   - прямая ссылка на бакет `…amazonaws.com/uploads/<key>` → `/media-resize/uploads/<key>`;
 *   - прямая ссылка на бакет с conversion-ключом → `/media-resize/legacy/<key>`.
 * Conversion-ключ ЗА family-роутом (`/address-image/<id>/conversions/<file>`)
 * с #1204 остаётся собой: family-роут отдаёт ту же производную побайтно и с
 * #1920 так же кэшируется nginx.
 * Замер прода 07.09.2026, travel 290, вкладка network: страница запрашивает
 * `GET /media-resize/uploads/1614096729IMG_6960.JPG?w=800&q=80&fit=contain` и НИ
 * ОДНОГО запроса к `metravelprod.s3.eu-north-1.amazonaws.com` не делает.
 *
 * Гейт, щупающий адрес из `src`, меряет доступность не того файла: его «зелено»
 * ничего не гарантирует (сломается прокси-роут при живом объекте в бакете — гейт
 * молчит, читатель видит пустую рамку), а «красно» бывает выдуманным (перенос
 * бакетного пути на `SITE` уже дал 7 ложных битых кадров в статьях 116/171/220/290).
 *
 * ПОЧЕМУ КОПИЯ, А НЕ ИМПОРТ. Скрипты — CommonJS и TS-утилиты не импортируют.
 * Копия здесь ОДНА на все гейты, и её расхождение с TS-источником валит
 * `__tests__/scripts/reader-media-url.test.ts`: тот же набор входов гоняется
 * через `toLegacyResizePath` из `utils/mediaUrl.ts` и сравнивается посимвольно.
 * До этого модуля правило было размножено по трём местам
 * (`post-deploy-media-check.js`, `audit-article-body-media.js`,
 * `generate-seo-pages.js`) и уже разъехалось.
 */

/** Origin по умолчанию — и «свой хост», и база для разбора относительного пути. */
const DEFAULT_SITE = 'https://metravel.by'

// --- зеркало utils/weservImageUrl.ts ---------------------------------------

const WESERV_HOST = 'images.weserv.nl'

/**
 * Предел раскрутки — ровно `MAX_WESERV_UNWRAP_DEPTH` из `utils/weservImageUrl.ts`.
 *
 * Второй копии числа быть не должно: раньше `migrate-description-images.js` вёл
 * свой предел (сначала 8 — недокручивал ровно на слой и терял 15 фотографий
 * статьи 175, где обёртки вложены ДЕВЯТЬ раз, потом 24). Пока предел один и он
 * заведомо выше корпусного максимума, недокрут невозможен ни у одного гейта.
 */
const MAX_WESERV_UNWRAP_DEPTH = 16

const normalizeNestedSource = (value) => {
  const trimmed = String(value || '').trim().replace(/&amp;/gi, '&')
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed.replace(/^\/+/, '')}`
}

/**
 * Исходный адрес за одной или несколькими обёртками `images.weserv.nl/?url=…`.
 *
 * Повторная санитизация legacy-HTML заворачивала уже завёрнутый URL, поэтому в
 * телах лежат цепочки weserv → weserv → … → S3. `URLSearchParams` снимает один
 * слой за проход, и цикл идёт до неподвижной точки.
 *
 * `decodeURIComponent` поверх `searchParams.get` намеренно НЕ делается: get уже
 * раскодировал слой, второй проход портит ключи с литеральным `%25`.
 */
function unwrapWeservUrl(value) {
  const initial = String(value || '').trim().replace(/&amp;/gi, '&')
  if (!initial) return initial

  let current = initial
  const seen = new Set()

  for (let depth = 0; depth < MAX_WESERV_UNWRAP_DEPTH; depth += 1) {
    let parsed
    try {
      parsed = new URL(current)
    } catch {
      return current
    }

    if (parsed.hostname.toLowerCase() !== WESERV_HOST) return current

    const nested = parsed.searchParams.get('url')
    if (!nested) return current

    const next = normalizeNestedSource(nested)
    if (!next || next === current || seen.has(next)) return current

    seen.add(current)
    current = next
  }

  return current
}

// --- зеркало utils/mediaUrl.ts ---------------------------------------------

const LEGACY_STORAGE_BUCKET = 'metravelprod'
const S3_VIRTUAL_HOST = /^([a-z0-9.-]+)\.s3(?:[.-][a-z0-9-]+)*\.amazonaws\.com$/i
const S3_PATH_STYLE_HOST = /^s3(?:[.-][a-z0-9-]+)*\.amazonaws\.com$/i
const LEGACY_IMAGE_EXTENSIONS = new Set(['gif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'webp'])
const LEGACY_SIGNATURE_QUERY_PARAM =
  /^(?:x-amz-.+|awsaccesskeyid|signature|expires|policy|key-pair-id)$/i

/**
 * Family-роуты, чей путь после имени роута и есть storage key.
 *
 * Набор УЖЕ, чем `WIDTHS_BY_FAMILY` в `post-deploy-media-check.js`, и это не
 * упущение: переписывает адрес фронт, а он знает ровно эти четыре роута. Цель,
 * построенная из `quest-cover/<id>/conversions/…`, была бы адресом, которого
 * читатель не запрашивает, — ровно тот дефект, ради которого заведён модуль.
 */
const FIRST_PARTY_MEDIA_ROUTE =
  /^\/(?:gallery|travel-image|travel-description-image|address-image)\/(.+)$/i

const isPrivateOrLocalHost = (host) => {
  const normalized = String(host || '').trim().toLowerCase()
  if (!normalized) return false
  if (normalized === 'localhost' || normalized === '127.0.0.1') return true
  if (/^10\./.test(normalized)) return true
  if (/^192\.168\./.test(normalized)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true
  return false
}

/**
 * База для разбора корне-относительных путей: хост-sentinel, который
 * `isFirstPartyMediaHost` знает как «наш». В результат не течёт — возвращаем путь.
 */
const RELATIVE_URL_SENTINEL_HOST = 'relative.first-party.invalid'
const RELATIVE_URL_BASE = `https://${RELATIVE_URL_SENTINEL_HOST}`

/** Хост нашего backend'а: прод, проверяемый origin прогона, dev-LAN. */
const isFirstPartyMediaHost = (hostname, site) => {
  const host = String(hostname || '').trim().toLowerCase()
  if (!host) return true
  if (host === RELATIVE_URL_SENTINEL_HOST) return true
  if (host === 'metravel.by' || host.endsWith('.metravel.by')) return true
  if (isPrivateOrLocalHost(host)) return true

  // В браузере эту роль играет `window.location.hostname`: страница и её кадры
  // на одном origin. У прогона роль страницы исполняет проверяемый `--url`.
  try {
    return host === String(new URL(site).hostname || '').trim().toLowerCase()
  } catch {
    return false
  }
}

/**
 * Сведение адреса к разбираемому виду: `&amp;`, протокол-относительная форма и
 * склеенный двойной хост (`https://host/https://host/key` — след старых обёрток).
 *
 * Апгрейд `http:` → `https:` из TS-версии здесь не делается: на разбор ключа и
 * хоста протокол не влияет, а наружу он уходит ровно в одной ветке —
 * `toReaderMediaUrl` для ссылки в наш бакет, — и там же и апгрейдится.
 */
const normalizeAbsoluteMediaUrl = (url) => {
  let result = String(url || '').trim().replace(/&amp;/gi, '&')
  if (result.startsWith('//')) result = `https:${result}`

  const lower = result.toLowerCase()
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return result

  const secondProtocolIndex = ['http://', 'https://']
    .map((protocol) => lower.indexOf(protocol, 1))
    .filter((index) => index > 0)
    .sort((a, b) => a - b)[0]
  if (typeof secondProtocolIndex !== 'number') return result

  const protocolEnd = lower.indexOf('://') + 3
  const firstSlashAfterHost = lower.indexOf('/', protocolEnd)
  if (firstSlashAfterHost === -1 || secondProtocolIndex < firstSlashAfterHost) {
    return result.slice(secondProtocolIndex)
  }
  return result
}

/**
 * Исходный адрес кадра: `&amp;`, `//`, склеенный двойной хост сведены, обёртки
 * weserv сняты.
 *
 * Отдельная функция, потому что этот шаг нужен ДО любого решения о классе, и
 * порядок в нём неочевиден: развернуть weserv, не сведя `//`, значит не
 * развернуть протокол-относительную обёртку вовсе — `new URL('//host/…')`
 * бросает, и цепочка молча остаётся завёрнутой.
 */
function toSourceMediaUrl(url) {
  return unwrapWeservUrl(normalizeAbsoluteMediaUrl(url))
}

/**
 * Ключ объекта в НАШЕМ бакете, если URL ведёт прямо туда (обе формы адресации).
 *
 * Отдельная функция, потому что «наш бакет» спрашивают двое: разбор ключа и
 * ветка `toReaderMediaUrl`, где такой адрес щупается как есть. Второе выражение
 * того же правила разошлось бы на краях — например, корень бакета
 * (`s3.<region>.amazonaws.com/metravelprod`) ключа не даёт и целью пробы быть
 * не может.
 */
const extractOwnBucketKey = (parsed) => {
  const host = parsed.hostname.toLowerCase()
  const path = parsed.pathname.replace(/^\/+/, '')
  if (!path) return null

  const virtualHost = host.match(S3_VIRTUAL_HOST)
  if (virtualHost) return virtualHost[1].toLowerCase() === LEGACY_STORAGE_BUCKET ? path : null

  if (!S3_PATH_STYLE_HOST.test(host)) return null
  const [bucket, ...rest] = path.split('/')
  return bucket.toLowerCase() === LEGACY_STORAGE_BUCKET && rest.length ? rest.join('/') : null
}

/**
 * Ключ объекта в нашем бакете — прямой ссылкой или за первопартийным роутом,
 * вместе с признаком источника: `{ key, viaFirstPartyRoute }`.
 *
 * Зеркало `LegacyStorageKey` из `utils/mediaUrl.ts`: различие источников несущее,
 * потому что conversion-ключ за family-роутом больше не переписывается (#1204).
 */
const extractLegacyStorageKey = (parsed, site) => {
  const ownBucketKey = extractOwnBucketKey(parsed)
  if (ownBucketKey) return { key: ownBucketKey, viaFirstPartyRoute: false }

  const firstParty = FIRST_PARTY_MEDIA_ROUTE.exec(parsed.pathname)
  if (firstParty && isFirstPartyMediaHost(parsed.hostname.toLowerCase(), site))
    return { key: firstParty[1], viaFirstPartyRoute: true }

  return null
}

const parseSupportedLegacyImageKey = (key) => {
  let decodedKey
  try {
    decodedKey = decodeURIComponent(key)
  } catch {
    return null
  }
  if (!decodedKey || decodedKey.includes('\\') || decodedKey.includes('\0')) return null

  const parts = decodedKey.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..')) return null

  const extension = String(parts[parts.length - 1].split('.').pop() || '').toLowerCase()
  return LEGACY_IMAGE_EXTENSIONS.has(extension) ? parts : null
}

const isLegacyUploadKey = (parts) => parts[0] === 'uploads' && parts.length > 1

const isLegacyConversionKey = (parts) => {
  const conversionIndex = parts.indexOf('conversions')
  return (
    conversionIndex > 0 &&
    conversionIndex === parts.lastIndexOf('conversions') &&
    conversionIndex < parts.length - 1 &&
    !parts.includes('responsive-images') &&
    !parts[0].includes(':')
  )
}

/**
 * Путь legacy-роута для адреса, который фронт переписывает; иначе `null`.
 *
 * Зеркало `toLegacyResizePath` из `utils/mediaUrl.ts` — вплоть до сохранения
 * query и вычистки параметров подписи S3 (после переписывания подпись
 * бессмысленна и только плодит cache-key).
 */
function toLegacyResizePath(url, options = {}) {
  const site = options.site || DEFAULT_SITE
  const value = String(url || '').trim()
  if (!value || /^(data:|blob:)/i.test(value)) return null

  let parsed
  try {
    const normalized = normalizeAbsoluteMediaUrl(toSourceMediaUrl(value))
    parsed = normalized.startsWith('/')
      ? new URL(normalized, RELATIVE_URL_BASE)
      : new URL(normalized)
  } catch {
    return null
  }

  const storageKey = extractLegacyStorageKey(parsed, site)
  if (!storageKey) return null
  const { key, viaFirstPartyRoute } = storageKey
  const keyParts = parseSupportedLegacyImageKey(key)
  if (!keyParts) return null

  const search = new URLSearchParams(parsed.search)
  Array.from(search.keys())
    .filter((param) => LEGACY_SIGNATURE_QUERY_PARAM.test(param))
    .forEach((param) => search.delete(param))
  const query = search.toString()
  const suffix = query ? `?${query}` : ''

  if (isLegacyUploadKey(keyParts)) return `/media-resize/${key}${suffix}`
  // Conversion-ключ переписывается только прямой ссылкой на бакет: за
  // family-роутом он адресован штатно (#1204).
  if (!viaFirstPartyRoute && isLegacyConversionKey(keyParts))
    return `/media-resize/legacy/${key}${suffix}`

  return null
}

/**
 * Путь, который запрашивает браузер читателя, либо `null`.
 *
 * Три исхода повторяют `buildExternalImageUrl` из `htmlTransform.ts`:
 *   1. адрес класса с legacy-роутом → путь `/media-resize/…`;
 *   2. прочий первопартийный адрес → его собственный путь, без изменений;
 *   3. чужой хост, `data:`/`blob:`, мусор → `null`. Внешнюю картинку читатель
 *      грузит как есть (weserv снят в #1163), и её доступность — не наш контракт.
 *
 * Возвращается ПУТЬ, а не абсолютный URL: origin у вызывающих разный
 * (`--url` прогона), и склеивание его здесь ломало бы проверку дева и стаба.
 *
 * Query переносится как есть (минус параметры подписи S3 — после переписывания
 * они бессмысленны). Снимать `w`/`q`/`fit`, как это делает фронт перед сборкой
 * srcset, здесь НЕЛЬЗЯ: гейты щупают по одному адресу на кадр, и после
 * схлопывания ширин две ступени одного ключа в теле статьи слились бы в одну
 * цель — покрытие молча просело бы. Ступени отдельными пробами обходит
 * `collectArticleBodyRungs` в пост-деплойном гейте.
 */
function toReaderMediaPath(url, options = {}) {
  const site = options.site || DEFAULT_SITE
  const value = String(url || '').trim()
  if (!value || /^(data:|blob:)/i.test(value)) return null

  const legacyPath = toLegacyResizePath(value, { site })
  if (legacyPath) return legacyPath

  const source = toSourceMediaUrl(value)
  // Битая weserv-обёртка без разбираемого `url=`: разворачивать нечего, а сам
  // weserv — чужой хост.
  let parsed
  try {
    parsed = source.startsWith('/') ? new URL(source, RELATIVE_URL_BASE) : new URL(source)
  } catch {
    return null
  }
  if (!/^https?:$/.test(parsed.protocol)) return null
  if (!isFirstPartyMediaHost(parsed.hostname, site)) return null

  return `${parsed.pathname}${parsed.search}`
}

/**
 * Полный адрес, который запрашивает браузер, либо `null`.
 *
 * Обычно это путь на проверяемом origin. Исключение — ключ НАШЕГО бакета,
 * который фронт не переписывает (`toLegacyResizePath` знает только `uploads/**`
 * и conversion-ключи; `uploads/x.svg` мимо них): `buildExternalImageUrl` отдаёт
 * такой адрес как есть, и читатель идёт прямо в S3. Вернуть тут `null` значило
 * бы молча перестать щупать живой класс кадров — ровно то «ложное зелено»,
 * против которого заведён модуль.
 *
 * Протокол апгрейдим ровно как фронт (`htmlTransform.ts`): страница отдаётся по
 * https, и `http://`-кадр браузер заблокировал бы как mixed content, поэтому по
 * такой ссылке он ходит уже по https. Параметры трансформации, наоборот,
 * оставляем — по той же причине, что и на первопартийной ветке (см.
 * `toReaderMediaPath`): политика в модуле одна на обе ветки.
 *
 * Чужой бакет сюда не попадает: его доступность не наш контракт.
 */
function toReaderMediaUrl(url, site = DEFAULT_SITE) {
  const path = toReaderMediaPath(url, { site })
  if (path) return `${String(site).replace(/\/+$/, '')}${path}`

  const value = String(url || '').trim()
  if (!value || /^(data:|blob:)/i.test(value)) return null
  try {
    const source = toSourceMediaUrl(value)
    if (source.startsWith('/')) return null
    const parsed = new URL(source)
    if (!/^https?:$/.test(parsed.protocol)) return null
    if (!extractOwnBucketKey(parsed)) return null
    if (parsed.protocol === 'http:') parsed.protocol = 'https:'
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Ширина, под которой кадр тела статьи реально уходит в сеть.
 *
 * Зеркало `RESPONSIVE_FALLBACK_WIDTH` из
 * `components/travel/stableContent/htmlTransform.ts`: `<img src>` тела строится
 * по ней, она же лежит в обеих лестницах слота (`IMAGE_WIDTHS.articleBodyMobile`
 * = [480, 800]) и совпадает с `LEGACY_UPLOAD_FIXED_WIDTH` для класса
 * `uploads/**`. Клэмп по потолку семейства (`clampLadderToFamily`) её не
 * трогает: самый низкий потолок в контракте — 960 у `routePoint`. Сверку с
 * `constants/imageContract.ts` держит `__tests__/scripts/auditArticleBodyMedia.test.ts`.
 */
const ARTICLE_BODY_PROBE_WIDTH = 800

/** `IMAGE_QUALITY.large` — то же значение, что фронт ставит ступени тела. */
const ARTICLE_BODY_PROBE_QUALITY = 80

/**
 * Адрес кадра тела для ПРОБЫ: читательский адрес плюс ступень `?w=`.
 *
 * Зачем ступень. `toReaderMediaUrl` отдаёт ключ как он лежит в манифесте, и у
 * `variants.original` это голый family-роут без параметров. Читатель такой
 * адрес не запрашивает НИКОГДА: тело статьи рендерится лестницей ступеней
 * (`buildMetravelResponsiveImage`), поэтому голый ключ не лежит в кэше nginx —
 * каждая проба превращается в GET в Django с полной выборкой мастера
 * (замер прода 20.09.2026: 195 из 393 проб за прогон — `MISS`, 0,45–1 МБ
 * каждая, и это сдвигало счётчик `--max-requests` воркера к ротации, #2004).
 * Со ступенью проба идёт туда же, куда ходит читатель, и обслуживается кэшем.
 *
 * Адрес со своей ступенью (`src`/`srcset` манифеста, `?w=1280`) остаётся как
 * есть: это ровно то, что запрашивает браузер, и оно уже в кэше — подменять
 * такую ступень своей значило бы щупать чужой адрес и заводить лишний ключ кэша.
 *
 * `q`/`fit` добавляются только legacy-роуту: durable-семейства их игнорируют, а
 * каждый набор параметров — отдельная запись в кэше (то же правило, что у
 * `buildMetravelSizedUrl`).
 */
function toReaderProbeUrl(url, site = DEFAULT_SITE) {
  const path = toReaderMediaPath(url, { site })
  // Ключ нашего бакета фронт не переписывает и ступеней ему не строит —
  // читатель идёт по нему как есть.
  if (!path) return toReaderMediaUrl(url, site)

  const origin = String(site).replace(/\/+$/, '')
  let parsed
  try {
    parsed = new URL(`${origin}${path}`)
  } catch {
    return `${origin}${path}`
  }

  if (parsed.searchParams.has('w')) return parsed.toString()

  parsed.searchParams.set('w', String(ARTICLE_BODY_PROBE_WIDTH))
  if (isLegacyResizeRoutePath(parsed.pathname)) {
    parsed.searchParams.set('q', String(ARTICLE_BODY_PROBE_QUALITY))
    parsed.searchParams.set('fit', 'contain')
  }
  return parsed.toString()
}

/**
 * Зеркало `isLegacyResizeRouteUrl` из `utils/mediaUrl.ts`: адрес обслуживает
 * legacy-роут прокси, то есть режется в момент запроса и понимает `q`/`fit`.
 * У durable-семейств эти параметры бэкенд игнорирует, а каждый их набор — лишняя
 * запись в кэше nginx и в браузерном.
 */
function isLegacyResizeRoutePath(url) {
  const value = String(url || '').trim()
  if (!value) return false
  try {
    return /^\/media-resize\//i.test(new URL(value, RELATIVE_URL_BASE).pathname)
  } catch {
    return false
  }
}

module.exports = {
  ARTICLE_BODY_PROBE_QUALITY,
  ARTICLE_BODY_PROBE_WIDTH,
  isLegacyResizeRoutePath,
  toLegacyResizePath,
  toReaderMediaPath,
  toReaderMediaUrl,
  toReaderProbeUrl,
  toSourceMediaUrl,
  unwrapWeservUrl,
}
