/**
 * scripts/lib/readerMediaUrl.js
 * Адрес кадра, который РЕАЛЬНО уходит из браузера читателя (#1854).
 *
 * ЗАЧЕМ. Между `src` в теле статьи и запросом браузера стоит переписывание
 * роута: `components/travel/stableContent/htmlTransform.ts` прогоняет каждый
 * `<img>` через `toFirstPartyArticleImageUrl` → `toLegacyResizePath`
 * (`utils/mediaUrl.ts`), и два класса меняют адрес:
 *   - прямая ссылка на бакет `…amazonaws.com/uploads/<key>` → `/media-resize/uploads/<key>`;
 *   - conversion-ключ любого family-роута (`/address-image/<id>/conversions/<file>`)
 *     → `/media-resize/legacy/<key>`.
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
 * Апгрейд `http:` → `https:` из TS-версии здесь не нужен: наружу уходит путь,
 * протокол в него не попадает, а на разбор ключа и хоста он не влияет.
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

/** Ключ объекта в нашем бакете, если URL ведёт именно туда. */
const extractLegacyStorageKey = (parsed, site) => {
  const host = parsed.hostname.toLowerCase()
  const path = parsed.pathname.replace(/^\/+/, '')
  if (!path) return null

  const virtualHost = host.match(S3_VIRTUAL_HOST)
  if (virtualHost && virtualHost[1].toLowerCase() === LEGACY_STORAGE_BUCKET) return path

  if (S3_PATH_STYLE_HOST.test(host)) {
    const [bucket, ...rest] = path.split('/')
    if (bucket.toLowerCase() === LEGACY_STORAGE_BUCKET && rest.length) return rest.join('/')
  }

  const firstParty = FIRST_PARTY_MEDIA_ROUTE.exec(parsed.pathname)
  if (firstParty && isFirstPartyMediaHost(host, site)) return firstParty[1]

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

  const key = extractLegacyStorageKey(parsed, site)
  if (!key) return null
  const keyParts = parseSupportedLegacyImageKey(key)
  if (!keyParts) return null

  const search = new URLSearchParams(parsed.search)
  Array.from(search.keys())
    .filter((param) => LEGACY_SIGNATURE_QUERY_PARAM.test(param))
    .forEach((param) => search.delete(param))
  const query = search.toString()
  const suffix = query ? `?${query}` : ''

  if (isLegacyUploadKey(keyParts)) return `/media-resize/${key}${suffix}`
  if (isLegacyConversionKey(keyParts)) return `/media-resize/legacy/${key}${suffix}`

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

/** Ссылка ведёт в НАШ legacy-бакет (виртуальный хост или path-style). */
const isOwnStorageBucketUrl = (parsed) => {
  const host = parsed.hostname.toLowerCase()
  const virtualHost = host.match(S3_VIRTUAL_HOST)
  if (virtualHost) return virtualHost[1].toLowerCase() === LEGACY_STORAGE_BUCKET
  if (!S3_PATH_STYLE_HOST.test(host)) return false
  return parsed.pathname.replace(/^\/+/, '').split('/')[0].toLowerCase() === LEGACY_STORAGE_BUCKET
}

/**
 * Полный адрес, который запрашивает браузер, либо `null`.
 *
 * Обычно это путь на проверяемом origin. Исключение — ключ НАШЕГО бакета,
 * который фронт не переписывает (`toLegacyResizePath` знает только `uploads/**`
 * и conversion-ключи; `uploads/x.svg` или плоский корень бакета мимо них):
 * `buildExternalImageUrl` отдаёт такой адрес как есть, и читатель идёт прямо в
 * S3. Вернуть тут `null` значило бы перестать щупать живой класс кадров молча —
 * ровно то «ложное зелено», против которого заведён модуль.
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
    return isOwnStorageBucketUrl(parsed) ? parsed.toString() : null
  } catch {
    return null
  }
}

module.exports = {
  toLegacyResizePath,
  toReaderMediaPath,
  toReaderMediaUrl,
  toSourceMediaUrl,
  unwrapWeservUrl,
}
