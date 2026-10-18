/**
 * scripts/lib/questSeoContract.js
 * Shared v1 quest SEO package contract (#2365 B ↔ backend C/D).
 *
 * Source of truth: `../metravel-backend:openspec/changes/serve-live-quest-locale-pages/interface-v1.md`
 * and fixtures `docs/contracts/quest-seo-v1/`. The backend reader
 * (`quests/services/seo_package.py`) refuses anything this module would not
 * produce, so every rule here mirrors that reader: the builder must never emit
 * a package the gateway cannot serve, and the static verifier must reject what
 * the gateway would reject.
 *
 * Pure functions only — no network, no process spawning. The builder lives in
 * `questLocalePackage.js`, the gate in `verify-static-quest-seo.js`.
 */

const crypto = require('crypto')
const { buildQuestLocalePath } = require('../../utils/questLocaleRouting')
const { appShellState } = require('./expoStaticShell')

const LOCALES = Object.freeze(['ru', 'be', 'uk', 'pl', 'en'])
const TRANSLATED_LOCALES = Object.freeze(LOCALES.slice(1))
// Parity with `i18n/config.ts` is pinned by a test; the SSG runs in plain node.
const LOCALE_META = Object.freeze({
  ru: { languageTag: 'ru-RU', ogLocale: 'ru_RU' },
  be: { languageTag: 'be-BY', ogLocale: 'be_BY' },
  uk: { languageTag: 'uk-UA', ogLocale: 'uk_UA' },
  pl: { languageTag: 'pl-PL', ogLocale: 'pl_PL' },
  en: { languageTag: 'en-US', ogLocale: 'en_US' },
})

// Latin-script locales: Cyrillic in their app-owned wording is a Russian leak (#2467).
const LATIN_SCRIPT_LOCALES = Object.freeze(['pl', 'en'])
const PUBLIC_ORIGIN = 'https://metravel.by'
const MANIFEST_NAME = 'quest-seo-manifest.v1.json'
const BUILD_SOURCE_NAME = '.build-source.json'
const ERROR_DIR = 'quest-seo-errors'
const SLOTS = Object.freeze({
  head: '<!--QUEST_LOCALE_HEAD_V1-->',
  links: '<!--QUEST_LOCALE_LINKS_V1-->',
  bootstrap: '<!--QUEST_LOCALE_BOOTSTRAP_V1-->',
  error: '<!--QUEST_RU_SOURCE_LINK_V1-->',
})
const LIMITS = Object.freeze({
  receiptBytes: 8 * 1024 * 1024,
  manifestBytes: 8 * 1024 * 1024,
  htmlBytes: 2 * 1024 * 1024,
  assetBytes: 16 * 1024 * 1024,
  projectionBytes: 16 * 1024,
  clusters: 500,
  members: 2500,
})
const MIN_TRANSLATED_WORDS = 300
const MIN_TRANSLATED_OWN_RATIO = 0.3

const RELEASE_ID = /^[A-Za-z0-9_-]{1,100}$/
const SLUG = /^[A-Za-z0-9_-]{1,100}$/
const HASH = /^[0-9a-f]{64}$/
const SHA = /^[0-9a-f]{40}$/
const FENCE = /^[1-9][0-9]*$/

class QuestSeoContractError extends Error {
  constructor(message) {
    super(message)
    this.name = 'QuestSeoContractError'
  }
}

function fail(message) {
  throw new QuestSeoContractError(message)
}

function require_(condition, message) {
  if (!condition) fail(message)
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/** Python `json.dumps(sort_keys=True, ensure_ascii=False, separators=(',', ':'))` for JSON-safe values. */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  if (typeof value === 'number' && !Number.isFinite(value)) fail('non-finite number in canonical JSON')
  return JSON.stringify(value)
}

/**
 * JSON.parse silently keeps the last duplicate key; the backend reader rejects
 * duplicates. Walk the text once and refuse them before trusting JSON.parse.
 */
function parseStrictJson(text, label) {
  const source = String(text)
  let index = 0
  const ws = () => { while (/[\s]/.test(source[index] || '')) index += 1 }
  const str = () => {
    const start = index
    index += 1
    while (index < source.length && source[index] !== '"') index += source[index] === '\\' ? 2 : 1
    require_(source[index] === '"', `${label}: unterminated string`)
    index += 1
    return JSON.parse(source.slice(start, index))
  }
  const value = (depth) => {
    require_(depth < 64, `${label}: nesting too deep`)
    ws()
    const char = source[index]
    if (char === '{') {
      index += 1
      const keys = new Set()
      ws()
      if (source[index] === '}') { index += 1; return }
      for (;;) {
        ws()
        require_(source[index] === '"', `${label}: object key expected`)
        const key = str()
        require_(!keys.has(key), `${label}: duplicate key ${JSON.stringify(key)}`)
        keys.add(key)
        ws()
        require_(source[index] === ':', `${label}: colon expected`)
        index += 1
        value(depth + 1)
        ws()
        if (source[index] === ',') { index += 1; continue }
        require_(source[index] === '}', `${label}: object end expected`)
        index += 1
        return
      }
    }
    if (char === '[') {
      index += 1
      ws()
      if (source[index] === ']') { index += 1; return }
      for (;;) {
        value(depth + 1)
        ws()
        if (source[index] === ',') { index += 1; continue }
        require_(source[index] === ']', `${label}: array end expected`)
        index += 1
        return
      }
    }
    if (char === '"') { str(); return }
    const match = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(source.slice(index))
    require_(match, `${label}: invalid JSON token`)
    index += match[0].length
  }
  value(0)
  ws()
  require_(index === source.length, `${label}: trailing data`)
  try {
    return JSON.parse(source)
  } catch (error) {
    return fail(`${label}: ${error.message}`)
  }
}

function exactKeys(value, keys, label) {
  require_(value && typeof value === 'object' && !Array.isArray(value), `${label}: object expected`)
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  require_(actual.length === expected.length && actual.every((key, i) => key === expected[i]),
    `${label}: keys ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`)
}

function positiveInt(value, label, minimum = 1) {
  require_(Number.isSafeInteger(value) && value >= minimum, `${label}: integer ≥ ${minimum} expected`)
}

function matches(pattern, value, label) {
  require_(typeof value === 'string' && pattern.test(value), `${label}: ${JSON.stringify(value)} is not ${pattern}`)
}

function boundedText(value, maximum, label) {
  require_(typeof value === 'string' && value.trim() !== '' && value.length <= maximum
    // eslint-disable-next-line no-control-regex
    && !/[\u0000-\u001f]/.test(value), `${label}: nonempty text ≤ ${maximum} without control characters expected`)
}

function canonicalPath(cityId, slug, locale = 'ru') {
  // One builder for the prefixed-URL contract (#2208): the runtime router uses the same function.
  const path = buildQuestLocalePath(Number(cityId), slug, locale)
  if (!path) fail(`invalid quest locale path: ${cityId}/${slug} (${locale})`)
  return path
}

function memberHtmlPath(cityId, slug, locale) {
  return `${locale === 'ru' ? '' : `${locale}/`}quests/${cityId}/${slug}.html`
}

function errorHtmlPath(locale) {
  return `${ERROR_DIR}/${locale}/unavailable.html`
}

function safeRelativePath(value, label) {
  require_(typeof value === 'string' && value.length > 0 && value.length <= 4096 && !value.includes('\\')
    // eslint-disable-next-line no-control-regex
    && !/[\u0000-\u001f]/.test(value) && !value.startsWith('/') && !value.includes('?') && !value.includes('#'),
  `${label}: unsafe relative path ${JSON.stringify(value)}`)
  const parts = value.split('/')
  require_(parts.every((part) => part && part !== '.' && part !== '..'), `${label}: unsafe relative path ${JSON.stringify(value)}`)
  return parts
}

// ---------------------------------------------------------------------------
// Private builder receipt C (`quest_seo_revision_receipt`)
// ---------------------------------------------------------------------------

/** Strict parse; a partial, padded or digest-mismatched output never means "empty". */
function parseRevisionReceipt(text) {
  const raw = typeof text === 'string' ? text : Buffer.from(text || '').toString('utf8')
  require_(Buffer.byteLength(raw, 'utf8') <= LIMITS.receiptBytes, 'receipt exceeds the v1 byte bound')
  const receipt = parseStrictJson(raw.trim(), 'receipt')
  exactKeys(receipt, ['schema_version', 'receipt_digest', 'quests'], 'receipt')
  require_(receipt.schema_version === 1, 'receipt: schema_version must be 1')
  matches(HASH, receipt.receipt_digest, 'receipt.receipt_digest')
  require_(Array.isArray(receipt.quests) && receipt.quests.length <= LIMITS.clusters, 'receipt.quests: bounded list expected')
  require_(sha256(canonicalJson(receipt.quests)) === receipt.receipt_digest, 'receipt: digest does not match its records (partial or altered output)')
  const pks = new Set()
  const identities = new Set()
  let previousPk = 0
  for (const record of receipt.quests) {
    const label = `receipt quest ${record && record.quest_pk}`
    exactKeys(record, ['quest_pk', 'city_id', 'quest_slug', 'source_revision', 'locales'], label)
    positiveInt(record.quest_pk, `${label}.quest_pk`)
    positiveInt(record.city_id, `${label}.city_id`)
    matches(SLUG, record.quest_slug, `${label}.quest_slug`)
    matches(HASH, record.source_revision, `${label}.source_revision`)
    require_(record.quest_pk > previousPk, `${label}: records must be sorted by quest_pk`)
    previousPk = record.quest_pk
    const identity = `${record.city_id}/${record.quest_slug}`
    require_(!pks.has(record.quest_pk) && !identities.has(identity), `${label}: duplicate identity`)
    pks.add(record.quest_pk)
    identities.add(identity)
    exactKeys(record.locales, LOCALES, `${label}.locales`)
    for (const locale of LOCALES) {
      const entry = record.locales[locale]
      exactKeys(entry, ['content_revision', 'fence_revision', 'published', 'complete'], `${label}.${locale}`)
      matches(HASH, entry.content_revision, `${label}.${locale}.content_revision`)
      matches(FENCE, entry.fence_revision, `${label}.${locale}.fence_revision`)
      require_(typeof entry.published === 'boolean' && typeof entry.complete === 'boolean', `${label}.${locale}: boolean flags expected`)
    }
    require_(record.locales.ru.content_revision === record.source_revision, `${label}: RU content revision must equal source revision`)
  }
  return receipt
}

/** R1/R2 fence: any write between the two reads rejects the whole candidate. */
function assertReceiptsMatch(before, after) {
  require_(before && after, 'both receipts are required')
  require_(before.receipt_digest === after.receipt_digest
    && canonicalJson(before.quests) === canonicalJson(after.quests),
  'source revisions changed during the build (receipt R1 ≠ R2) — candidate rejected')
}

// ---------------------------------------------------------------------------
// Bounded HTML slots
// ---------------------------------------------------------------------------

/**
 * Insert the three v1 markers into a finished detail page. Links sit right
 * under the crawlable `<h1>` so no-JS readers meet the language versions where
 * the page names itself; bootstrap closes the body.
 */
function insertQuestLocaleSlots(html) {
  const source = String(html)
  require_(!/<!--QUEST_/.test(source), 'page already carries quest locale markers')
  require_(!/id="quest-serving-v1"/.test(source), 'page already carries a serving bootstrap')
  const headClose = source.indexOf('</head>')
  const bodyClose = source.lastIndexOf('</body>')
  require_(headClose !== -1 && bodyClose > headClose, 'page needs one head and one body')
  let result = `${source.slice(0, headClose)}${SLOTS.head}${source.slice(headClose, bodyClose)}${SLOTS.bootstrap}${source.slice(bodyClose)}`
  const section = /<section[^>]*\bdata-ssg-quest-intro="true"[^>]*>/i.exec(result)
  const h1Close = section ? result.indexOf('</h1>', section.index) : -1
  if (h1Close !== -1) {
    const at = h1Close + '</h1>'.length
    result = `${result.slice(0, at)}${SLOTS.links}${result.slice(at)}`
  } else {
    const body = /<body[^>]*>/i.exec(result)
    require_(body, 'page has no body')
    const at = body.index + body[0].length
    result = `${result.slice(0, at)}${SLOTS.links}${result.slice(at)}`
  }
  return result
}

/** Python `html.escape(value, quote=True)`. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g')
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g')

/** Inert JSON inside `<script>`: nothing can close the container. */
function scriptJson(value) {
  return JSON.stringify(value)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(LINE_SEPARATOR, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR, '\\u2029')
}

function servingProjection(cluster, locale, releaseId, effectiveLocales) {
  return {
    schema_version: 1,
    release_id: releaseId,
    city_id: cluster.city_id,
    quest_slug: cluster.quest_slug,
    locale,
    state: 'available',
    canonical_path: cluster.members[locale].canonical_path,
    ru_source_path: canonicalPath(cluster.city_id, cluster.quest_slug, 'ru'),
    versions: effectiveLocales.map((code) => ({ locale: code, path: cluster.members[code].canonical_path })),
  }
}

/** Effective cluster when every built member is still live (static verification view of E). */
function fullEffectiveLocales(cluster) {
  const translated = TRANSLATED_LOCALES.filter((locale) => cluster.members[locale])
  if (!translated.length || !cluster.members.ru.quality.indexable) return []
  return ['ru', ...translated]
}

/** Mirror of the backend `render_slots`: the final served projection. */
function renderQuestLocaleSlots(html, member, payload) {
  let head = ''
  let links = ''
  if (payload.versions.length) {
    head = payload.versions
      .map((version) => `<link rel="alternate" hreflang="${version.locale}" href="${escapeHtml(PUBLIC_ORIGIN + version.path)}">`)
      .join('')
    head += `<link rel="alternate" hreflang="x-default" href="${escapeHtml(PUBLIC_ORIGIN + payload.ru_source_path)}">`
    const anchors = payload.versions.map((version) => {
      const current = version.locale === payload.locale ? ' aria-current="page"' : ''
      return `<a href="${escapeHtml(version.path)}" hreflang="${version.locale}" lang="${version.locale}"${current}>${escapeHtml(member.language_labels[version.locale])}</a>`
    })
    links = `<nav aria-label="${escapeHtml(member.version_nav_label)}">${anchors.join(' ')}</nav>`
  }
  const bootstrap = `<script type="application/json" id="quest-serving-v1">${scriptJson(payload)}</script>`
  const projectionBytes = Buffer.byteLength(head + links + bootstrap, 'utf8')
  require_(projectionBytes <= LIMITS.projectionBytes, `slot projection ${projectionBytes} B exceeds ${LIMITS.projectionBytes} B`)
  return String(html).split(SLOTS.head).join(head).split(SLOTS.links).join(links).split(SLOTS.bootstrap).join(bootstrap)
}

function renderErrorLink(html, label, ruSourcePath) {
  const link = ruSourcePath ? `<a href="${escapeHtml(ruSourcePath)}" lang="ru">${escapeHtml(label)}</a>` : ''
  return String(html).split(SLOTS.error).join(link)
}

// ---------------------------------------------------------------------------
// Document scan (mirror of the backend HTMLParser-based `_Document`)
// ---------------------------------------------------------------------------

function decodeEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function parseAttributes(raw) {
  const attrs = []
  const pattern = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match
  while ((match = pattern.exec(raw)) !== null) {
    const value = match[2] ?? match[3] ?? match[4]
    attrs.push([match[1].toLowerCase(), value === undefined ? null : decodeEntities(value)])
  }
  return attrs
}

function scanHtmlDocument(html) {
  const source = String(html)
  const doc = {
    heads: 0, bodies: 0, languages: [], canonicals: [], alternates: [], noindex: false,
    markers: [], ldJson: [], ldJsonErrors: [], localAssets: [], servingScripts: [], anchors: [],
    duplicateAttributes: false,
  }
  let container = null
  const tag = /<!--([\s\S]*?)-->|<(\/?)([A-Za-z][A-Za-z0-9:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g
  let match
  while ((match = tag.exec(source)) !== null) {
    if (match[1] !== undefined) {
      if (match[1].startsWith('QUEST_')) doc.markers.push({ marker: `<!--${match[1]}-->`, container })
      continue
    }
    const closing = match[2] === '/'
    const name = match[3].toLowerCase()
    if (closing) {
      if (name === container) container = null
      continue
    }
    const attrList = parseAttributes(match[4] || '')
    if (new Set(attrList.map(([key]) => key)).size !== attrList.length) doc.duplicateAttributes = true
    const attrs = Object.fromEntries(attrList)
    if (name === 'head' || name === 'body') {
      container = name
      if (name === 'head') doc.heads += 1
      else doc.bodies += 1
    }
    if (name === 'html') doc.languages.push(attrs.lang ?? null)
    if (name === 'link') {
      const rel = String(attrs.rel || '').toLowerCase().split(/\s+/)
      if (rel.includes('canonical')) doc.canonicals.push({ href: attrs.href ?? null, container })
      if (rel.includes('alternate') && 'hreflang' in attrs) doc.alternates.push(attrs)
    }
    if (name === 'meta' && String(attrs.name || '').toLowerCase() === 'robots') {
      if (String(attrs.content || '').toLowerCase().split(/[\s,]+/).includes('noindex')) doc.noindex = true
    }
    if (name === 'a') doc.anchors.push({ ...attrs, container })
    for (const key of ['src', 'href']) {
      const value = attrs[key]
      if (typeof value === 'string' && !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('//')) {
        const pathname = value.split(/[?#]/, 1)[0]
        if (pathname.startsWith('/_expo/') || pathname.startsWith('/assets/')) doc.localAssets.push(pathname.slice(1))
      }
    }
    if (name === 'script' || name === 'style') {
      // Case-insensitive search without lowercasing the whole source: toLowerCase
      // changes the length of some letters («İ» → «i̇») and would shift offsets.
      const closer = new RegExp(`</${name}`, 'ig')
      closer.lastIndex = tag.lastIndex
      const found = closer.exec(source)
      const end = found ? found.index : -1
      const body = source.slice(tag.lastIndex, end === -1 ? source.length : end)
      if (name === 'script') {
        if (attrs.id === 'quest-serving-v1') doc.servingScripts.push({ type: attrs.type ?? null, body, container })
        if (attrs.type === 'application/ld+json') {
          try {
            doc.ldJson.push(parseStrictJson(body, 'ld+json'))
          } catch (error) {
            doc.ldJsonErrors.push(error.message)
          }
        }
      }
      tag.lastIndex = end === -1 ? source.length : end
    }
  }
  return doc
}

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const CYRILLIC_WORD = /[^\s]*[\u0400-\u04FF][^\s]*/

/**
 * Body text a reader gets in the page language (#2467): comments, script,
 * style and every `lang="ru"` subtree removed. Russian pages linked under D1
 * (#2208) stay Russian inside such subtrees and nowhere else.
 */
function textOutsideRussianMarkup(html) {
  const source = String(html)
  const start = source.search(/<body\b/i)
  const body = (start === -1 ? source : source.slice(start))
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
  const tag = /<(\/?)([A-Za-z][A-Za-z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g
  let text = ''
  let last = 0
  let ruName = null
  let ruDepth = 0
  let match
  while ((match = tag.exec(body)) !== null) {
    if (!ruName) text += `${body.slice(last, match.index)} `
    last = tag.lastIndex
    const name = match[2].toLowerCase()
    const closing = match[1] === '/'
    const opensSubtree = !closing && !VOID_ELEMENTS.has(name) && !/\/\s*$/.test(match[3])
    if (ruName) {
      if (name === ruName && (closing || opensSubtree)) ruDepth += closing ? -1 : 1
      if (ruDepth === 0) ruName = null
      continue
    }
    const lang = parseAttributes(match[3] || '').find(([key]) => key === 'lang')
    if (opensSubtree && lang && String(lang[1]).toLowerCase() === 'ru') {
      ruName = name
      ruDepth = 1
    }
  }
  if (!ruName) text += body.slice(last)
  return decodeEntities(text).replace(/\s+/g, ' ').trim()
}

/** The «where next» block of a detail page; it nests no `<div>` of its own. */
function questLinksBlock(html) {
  const match = /<div data-ssg-quest-links="true">[\s\S]*?<\/div>/.exec(String(html))
  return match ? match[0] : null
}

function touristTrips(value, found = []) {
  if (Array.isArray(value)) {
    for (const child of value) touristTrips(child, found)
  } else if (value && typeof value === 'object') {
    if (value['@type'] === 'TouristTrip') found.push(value)
    if ('@graph' in value) touristTrips(value['@graph'], found)
  }
  return found
}

/**
 * Stored member HTML, exactly as the backend `validate_document` reads it,
 * plus the frontend-only app-shell rule for translated members (#2449).
 */
function memberDocumentIssues(html, { locale, canonicalPath: pathname, indexable }) {
  const issues = []
  const doc = scanHtmlDocument(html)
  const canonical = PUBLIC_ORIGIN + pathname
  if (doc.duplicateAttributes) issues.push('duplicate attribute on a tag')
  if (doc.heads !== 1 || doc.bodies !== 1) issues.push(`expected one head/body, got ${doc.heads}/${doc.bodies}`)
  if (doc.languages.length !== 1 || doc.languages[0] !== locale) issues.push(`html lang ${JSON.stringify(doc.languages)} ≠ ${locale}`)
  if (doc.alternates.length) issues.push('stored HTML must not carry hreflang alternates (they belong to the head slot)')
  if (doc.servingScripts.length) issues.push('stored HTML must not carry quest-serving-v1 (it belongs to the bootstrap slot)')
  const expected = [[SLOTS.head, 'head'], [SLOTS.links, 'body'], [SLOTS.bootstrap, 'body']]
  const got = doc.markers.map((entry) => `${entry.marker}@${entry.container}`).sort()
  const want = expected.map(([marker, where]) => `${marker}@${where}`).sort()
  if (got.length !== want.length || got.some((value, i) => value !== want[i])) issues.push(`slot markers ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`)
  for (const [marker] of expected) {
    if (String(html).split(marker).length - 1 !== 1) issues.push(`${marker} must occur exactly once`)
  }
  if (doc.canonicals.length !== 1 || doc.canonicals[0].href !== canonical || doc.canonicals[0].container !== 'head') {
    issues.push(`canonical ${JSON.stringify(doc.canonicals.map((c) => c.href))} ≠ [${canonical}] in head`)
  }
  if (doc.noindex !== !indexable) issues.push(`noindex=${doc.noindex} but quality.indexable=${indexable}`)
  if (doc.ldJsonErrors.length) issues.push(`invalid JSON-LD: ${doc.ldJsonErrors.join('; ')}`)
  const trips = doc.ldJson.flatMap((payload) => touristTrips(payload))
  if (trips.length !== 1 || trips[0].url !== canonical || trips[0].mainEntityOfPage !== canonical || trips[0].inLanguage !== locale) {
    issues.push(`expected one TouristTrip with url/mainEntityOfPage ${canonical} and inLanguage ${locale}`)
  }
  if (LATIN_SCRIPT_LOCALES.includes(locale)) {
    // The block's own wording is app-owned; quest prose may quote a Cyrillic
    // sign verbatim and is translation content, not this contract (#2467).
    const block = questLinksBlock(html)
    const stray = block && CYRILLIC_WORD.exec(textOutsideRussianMarkup(`<body>${block}`))
    if (stray) issues.push(`Cyrillic text outside lang="ru" in the quest links block: «${stray[0]}»`)
  }
  if (locale !== 'ru') {
    // #2467: a link to a Russian page says so; translated links are checked
    // against the manifest members by the package verifier.
    const unmarked = doc.anchors.find((anchor) => anchor.container === 'body' && typeof anchor.href === 'string'
      && anchor.href.startsWith('/') && !/^\/(?:be|uk|pl|en)\//.test(anchor.href) && anchor.hreflang !== 'ru')
    if (unmarked) issues.push(`link to Russian page ${unmarked.href} lacks hreflang="ru"`)
    // #2449: the RU export's `#root` renders another route in Russian; a
    // translated member that hydrates it fails with React #418.
    const shell = appShellState(html)
    if (shell.hydrates) issues.push('translated member must not request Expo hydration')
    if (shell.emptyRoots !== shell.roots) issues.push('translated member must ship an empty #root')
  }
  return { issues, doc }
}

function errorDocumentIssues(html, locale) {
  const issues = []
  const doc = scanHtmlDocument(html)
  if (doc.duplicateAttributes) issues.push('duplicate attribute on a tag')
  if (doc.heads !== 1 || doc.bodies !== 1) issues.push(`expected one head/body, got ${doc.heads}/${doc.bodies}`)
  if (doc.languages.length !== 1 || doc.languages[0] !== locale) issues.push(`html lang ${JSON.stringify(doc.languages)} ≠ ${locale}`)
  if (doc.alternates.length) issues.push('error page must not carry alternates')
  if (doc.markers.length !== 1 || doc.markers[0].marker !== SLOTS.error || doc.markers[0].container !== 'body'
    || String(html).split(SLOTS.error).length - 1 !== 1) issues.push('error page needs exactly one RU source marker in body')
  if (doc.canonicals.length) issues.push('error page must not declare a canonical')
  if (!doc.noindex) issues.push('error page must be noindex')
  if (doc.ldJson.length || doc.ldJsonErrors.length) issues.push('error page must not carry JSON-LD')
  if (doc.servingScripts.length) issues.push('error page must not carry a serving bootstrap')
  return { issues, doc }
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

function buildManifest({ releaseId, frontendSha, generatedAt, beforeDigest, afterDigest, clusters, errors }) {
  return {
    schema_version: 1,
    release_id: releaseId,
    frontend_sha: frontendSha,
    generated_at: generatedAt,
    source_snapshot: { receipt_schema_version: 1, before_digest: beforeDigest, after_digest: afterDigest },
    relative_root: '.',
    clusters,
    errors,
  }
}

/** Mirror of the backend `_validate_manifest`; throws on the first violation. */
function validateManifest(manifest, { releaseId } = {}) {
  exactKeys(manifest, ['schema_version', 'release_id', 'frontend_sha', 'generated_at', 'source_snapshot',
    'relative_root', 'clusters', 'errors'], 'manifest')
  require_(manifest.schema_version === 1, 'manifest: schema_version must be 1')
  matches(RELEASE_ID, manifest.release_id, 'manifest.release_id')
  if (releaseId !== undefined) require_(manifest.release_id === releaseId, 'manifest: release_id mismatch')
  require_(manifest.relative_root === '.', 'manifest: relative_root must be "."')
  matches(SHA, manifest.frontend_sha, 'manifest.frontend_sha')
  require_(typeof manifest.generated_at === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(manifest.generated_at)
    && !Number.isNaN(Date.parse(manifest.generated_at)), 'manifest.generated_at: UTC ISO 8601 expected')
  const snapshot = manifest.source_snapshot
  exactKeys(snapshot, ['receipt_schema_version', 'before_digest', 'after_digest'], 'manifest.source_snapshot')
  require_(snapshot.receipt_schema_version === 1, 'manifest.source_snapshot: receipt_schema_version must be 1')
  matches(HASH, snapshot.before_digest, 'manifest.source_snapshot.before_digest')
  require_(snapshot.before_digest === snapshot.after_digest, 'manifest.source_snapshot: before/after digests differ')
  require_(Array.isArray(manifest.clusters) && manifest.clusters.length <= LIMITS.clusters, 'manifest.clusters: bounded list expected')
  const identities = new Set()
  const pks = new Set()
  const paths = new Set()
  let memberCount = 0
  for (const cluster of manifest.clusters) {
    const label = `cluster ${cluster && cluster.quest_slug}`
    exactKeys(cluster, ['quest_pk', 'city_id', 'quest_slug', 'source_revision', 'members'], label)
    positiveInt(cluster.quest_pk, `${label}.quest_pk`)
    positiveInt(cluster.city_id, `${label}.city_id`)
    matches(SLUG, cluster.quest_slug, `${label}.quest_slug`)
    matches(HASH, cluster.source_revision, `${label}.source_revision`)
    const identity = `${cluster.city_id}/${cluster.quest_slug}`
    require_(!identities.has(identity) && !pks.has(cluster.quest_pk), `${label}: duplicate identity`)
    identities.add(identity)
    pks.add(cluster.quest_pk)
    const members = cluster.members
    require_(members && typeof members === 'object' && !Array.isArray(members) && members.ru
      && Object.keys(members).every((locale) => LOCALES.includes(locale)), `${label}: members need RU and allowlisted locales`)
    for (const [locale, member] of Object.entries(members)) {
      const where = `${label}.${locale}`
      memberCount += 1
      exactKeys(member, ['locale', 'canonical_path', 'html_path', 'html_sha256', 'content_revision', 'complete',
        'quality', 'released_status', 'version_nav_label', 'language_labels'], where)
      require_(member.locale === locale, `${where}: locale mismatch`)
      require_(member.canonical_path === canonicalPath(cluster.city_id, cluster.quest_slug, locale), `${where}: canonical_path mismatch`)
      require_(member.released_status === 200, `${where}: released_status must be 200`)
      require_(typeof member.complete === 'boolean', `${where}: complete must be boolean`)
      safeRelativePath(member.html_path, `${where}.html_path`)
      require_(!paths.has(member.html_path), `${where}: html_path reused`)
      paths.add(member.html_path)
      matches(HASH, member.html_sha256, `${where}.html_sha256`)
      matches(HASH, member.content_revision, `${where}.content_revision`)
      boundedText(member.version_nav_label, 200, `${where}.version_nav_label`)
      exactKeys(member.language_labels, LOCALES, `${where}.language_labels`)
      for (const code of LOCALES) boundedText(member.language_labels[code], 100, `${where}.language_labels.${code}`)
      exactKeys(member.quality, ['indexable', 'word_count', 'own_fivegram_ratio'], `${where}.quality`)
      require_(typeof member.quality.indexable === 'boolean', `${where}.quality.indexable: boolean expected`)
      positiveInt(member.quality.word_count, `${where}.quality.word_count`, 0)
      const ratio = member.quality.own_fivegram_ratio
      require_(typeof ratio === 'number' && Number.isFinite(ratio) && ratio >= 0 && ratio <= 1, `${where}.quality.own_fivegram_ratio: 0..1 expected`)
      if (locale === 'ru') require_(member.content_revision === cluster.source_revision, `${where}: RU content_revision must equal source_revision`)
    }
    for (const [locale, member] of Object.entries(members)) {
      if (locale === 'ru') continue
      const quality = member.quality
      require_(member.complete && quality.indexable && quality.word_count >= MIN_TRANSLATED_WORDS
        && quality.own_fivegram_ratio >= MIN_TRANSLATED_OWN_RATIO && members.ru.quality.indexable && members.ru.complete,
      `${label}.${locale}: translated member must be complete, indexable, ≥${MIN_TRANSLATED_WORDS} words, ≥${MIN_TRANSLATED_OWN_RATIO} own 5-grams, with an indexable RU anchor`)
    }
  }
  require_(memberCount <= LIMITS.members, `manifest: ${memberCount} members exceed ${LIMITS.members}`)
  exactKeys(manifest.errors, LOCALES, 'manifest.errors')
  for (const locale of LOCALES) {
    const error = manifest.errors[locale]
    exactKeys(error, ['html_path', 'html_sha256', 'ru_link_label'], `manifest.errors.${locale}`)
    safeRelativePath(error.html_path, `manifest.errors.${locale}.html_path`)
    require_(!paths.has(error.html_path), `manifest.errors.${locale}: html_path reused`)
    paths.add(error.html_path)
    matches(HASH, error.html_sha256, `manifest.errors.${locale}.html_sha256`)
    boundedText(error.ru_link_label, 200, `manifest.errors.${locale}.ru_link_label`)
  }
  return manifest
}

module.exports = {
  BUILD_SOURCE_NAME,
  ERROR_DIR,
  FENCE,
  HASH,
  LIMITS,
  LOCALES,
  LOCALE_META,
  MANIFEST_NAME,
  MIN_TRANSLATED_OWN_RATIO,
  MIN_TRANSLATED_WORDS,
  PUBLIC_ORIGIN,
  QuestSeoContractError,
  RELEASE_ID,
  SHA,
  SLOTS,
  SLUG,
  TRANSLATED_LOCALES,
  assertReceiptsMatch,
  buildManifest,
  canonicalJson,
  canonicalPath,
  errorDocumentIssues,
  errorHtmlPath,
  escapeHtml,
  questLinksBlock,
  textOutsideRussianMarkup,
  fullEffectiveLocales,
  insertQuestLocaleSlots,
  memberDocumentIssues,
  memberHtmlPath,
  parseRevisionReceipt,
  parseStrictJson,
  renderErrorLink,
  renderQuestLocaleSlots,
  safeRelativePath,
  scanHtmlDocument,
  scriptJson,
  servingProjection,
  sha256,
  touristTrips,
  validateManifest,
}
