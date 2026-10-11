/**
 * scripts/lib/questLocalePackage.js
 * Builder side of the immutable v1 quest SEO package (#2365 B).
 *
 * Lifecycle (interface-v1 «Private builder revision receipt»):
 *   1. `generate-seo-pages.js --quest-seo-candidate <file>` takes receipt R1
 *      (full published set, no selector) before any content read, checks the
 *      catalog against it, builds RU pages with the three slots, fetches every
 *      published+complete translation with exact `?lang=`, measures each
 *      language cohort and writes prefixed member HTML, localized error pages
 *      and a private candidate file OUTSIDE dist.
 *   2. Post-processing touches HTML bytes (cache-bust meta, charset), so
 *      checksums can only be taken afterwards: `finalize-quest-seo-package.js`
 *      takes R2, requires R1 ≡ R2, hashes the stored bytes, verifies the whole
 *      package and only then writes the manifest — the last file, written once.
 *
 * Fail-closed: a failed/timeboxed receipt, a failed or partial bundle read, a
 * catalog/receipt identity drift or R1 ≠ R2 throws. Nothing here interprets a
 * transport failure as "translation absent", so a smaller release can never
 * replace a complete one; the previous activated package simply stays.
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const {
  BUILD_SOURCE_NAME,
  LIMITS,
  LOCALES,
  LOCALE_META,
  MANIFEST_NAME,
  SHA,
  TRANSLATED_LOCALES,
  assertReceiptsMatch,
  buildManifest,
  canonicalPath,
  errorHtmlPath,
  escapeHtml,
  insertQuestLocaleSlots,
  memberHtmlPath,
  parseRevisionReceipt,
  parseStrictJson,
  sha256,
  validateManifest,
  SLOTS,
} = require('./questSeoContract')
const { scoreDetailCohort } = require('./questDetailCohort')
const { readRegularPackageFile, verifyQuestSeoPackage } = require('./questSeoPackageVerify')
const { selectPluralCategory } = require('../../i18n/pluralRules')

const CANDIDATE_SCHEMA = 'quest-seo-candidate'
const RECEIPT_TIMEOUT_MS = 120000

// ---------------------------------------------------------------------------
// Translation for build-time pages (runtime catalogs + SSG-only `ssg/` catalogs, see loadSsgCatalogs)
// ---------------------------------------------------------------------------

function interpolate(template, params = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => (params[key] == null ? '' : String(params[key])))
}

/** A missing key fails the build: a localized page never silently shows RU. */
function createSsgTranslator(catalogs, locale) {
  const catalog = catalogs && catalogs.get(locale)
  if (!catalog || !LOCALE_META[locale]) throw new Error(`No i18n catalog for quest SSG locale ${locale}`)
  const read = (key) => {
    const value = catalog.get(key)
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`Missing ${locale} translation: ${key}`)
    return value
  }
  const t = (key, params) => interpolate(read(key.includes(':') ? key : `seo:${key}`), params)
  const tp = (key, count, params = {}) => {
    const full = key.includes(':') ? key : `seo:${key}`
    const category = selectPluralCategory(count, LOCALE_META[locale].languageTag)
    const value = catalog.get(`${full}_${category}`) ?? catalog.get(full)
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${locale} plural translation: ${full}_${category}`)
    return interpolate(value, { ...params, count })
  }
  return { locale, languageTag: LOCALE_META[locale].languageTag, ogLocale: LOCALE_META[locale].ogLocale, t, tp }
}

function languageLabels(translator) {
  return Object.fromEntries(LOCALES.map((code) => [code, translator.t(`common:language.${code}`)]))
}

// ---------------------------------------------------------------------------
// Receipt C transport
// ---------------------------------------------------------------------------

/**
 * Run the configured private receipt command (E owns the production
 * transport). Nonzero exit, signal, timeout or unreadable output rejects.
 */
function runRevisionReceiptCommand(command, { timeoutMs = RECEIPT_TIMEOUT_MS, spawn = spawnSync } = {}) {
  if (typeof command !== 'string' || !command.trim()) throw new Error('quest SEO package: receipt command is not configured')
  const result = spawn('/bin/sh', ['-c', command], {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: LIMITS.receiptBytes + 64 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) throw new Error(`quest SEO receipt command failed: ${result.error.message}`)
  if (result.signal || result.status !== 0) {
    throw new Error(`quest SEO receipt command exited with ${result.signal || result.status} — candidate rejected`)
  }
  return parseRevisionReceipt(result.stdout)
}

/** Catalog and receipt must name exactly the same published detail identities. */
function assertCatalogMatchesReceipt(quests, receipt, questRouteKey) {
  const byIdentity = new Map(receipt.quests.map((record) => [`${record.city_id}/${record.quest_slug}`, record]))
  const catalog = new Set()
  for (const quest of quests) {
    const route = questRouteKey(quest)
    if (!route) continue
    catalog.add(`${Number(route.cityId)}/${route.questId}`)
  }
  const missing = [...catalog].filter((key) => !byIdentity.has(key))
  const extra = [...byIdentity.keys()].filter((key) => !catalog.has(key))
  if (missing.length || extra.length) {
    throw new Error(
      `quest catalog ≠ revision receipt (catalog-only: ${missing.slice(0, 10).join(', ') || '—'}; ` +
      `receipt-only: ${extra.slice(0, 10).join(', ') || '—'}) — candidate rejected`,
    )
  }
  return byIdentity
}

function publishedTranslatedLocales(record) {
  return TRANSLATED_LOCALES.filter((locale) => record.locales[locale].published && record.locales[locale].complete)
}

/** A body without its gameplay skeleton is a partial read, not an ineligible translation. */
function assertCompleteBundle(bundle, questSlug, locale) {
  const ok = bundle && typeof bundle === 'object' && !Array.isArray(bundle)
    && typeof bundle.title === 'string' && bundle.title.trim() !== ''
    && Array.isArray(bundle.steps) && (bundle.quest_id === undefined || bundle.quest_id === questSlug)
  if (!ok) throw new Error(`quest ${questSlug} [${locale}]: partial or unreadable bundle — candidate rejected`)
}

/** Why an exact-lang read cannot become a member; null = eligible. */
function localizedBundleIneligibility(bundle, locale) {
  const contentLocale = bundle.content_locale || 'ru'
  if (contentLocale !== locale) return `content_locale ${contentLocale} ≠ ${locale} (API fallback)`
  const available = Array.isArray(bundle.available_locales) ? bundle.available_locales : []
  if (!available.includes(locale)) return `${locale} is not in available_locales`
  return null
}

// ---------------------------------------------------------------------------
// Candidate
// ---------------------------------------------------------------------------

function buildLocaleErrorPageHtml(translator) {
  const title = translator.t('quests:localeServing.unavailableTitle')
  const description = translator.t('quests:localeServing.unavailableDescription')
  const catalogLabel = translator.t('quests:app.tabs.quests.city.questId.k_spisku_kvestov_27c3b0f7')
  const style = "body{margin:0;font:16px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#22332c;background:#f6faf7}" +
    'main{box-sizing:border-box;max-width:640px;margin:48px auto;padding:24px 18px;background:#fff;border:1px solid #dbe7df;border-radius:8px}' +
    'h1{margin:0 0 12px;font-size:24px;line-height:1.25}p{margin:0 0 14px}a{color:#1f6f50;font-weight:700}' +
    '@media(prefers-color-scheme:dark){body{color:#e4eee8;background:#111a16}main{background:#18231e;border-color:#2c3b34}a{color:#7fd3ae}}'
  return [
    '<!DOCTYPE html>',
    `<html lang="${translator.locale}">`,
    '<head>',
    '<meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
    '<meta name="robots" content="noindex"/>',
    `<title>${escapeHtml(title)} | Metravel</title>`,
    `<style>${style}</style>`,
    '</head>',
    '<body>',
    '<main>',
    `<h1>${escapeHtml(title)}</h1>`,
    `<p>${escapeHtml(description)}</p>`,
    `<p>${SLOTS.error}</p>`,
    `<p><a href="/quests" hreflang="ru">${escapeHtml(catalogLabel)}</a></p>`,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

function memberEntry({ cluster, locale, translator, record, quality }) {
  return {
    locale,
    canonical_path: canonicalPath(cluster.city_id, cluster.quest_slug, locale),
    html_path: memberHtmlPath(cluster.city_id, cluster.quest_slug, locale),
    content_revision: record.locales[locale].content_revision,
    complete: record.locales[locale].complete,
    quality,
    released_status: 200,
    version_nav_label: translator.t('quests:localeServing.versions'),
    language_labels: languageLabels(translator),
  }
}

/**
 * Translated members + candidate model. RU pages are already built (with slots)
 * by the caller; this adds every eligible translation and the error pages.
 *
 * @param {object} input
 * @param {object[]} input.ruPages `{ quest, route, path, html }` per catalog quest, slotted
 * @param {Map<string, object>} input.ruQuality canonical RU path → manifest quality
 * @param {(questId: string, locale: string) => Promise<object>} input.fetchLocalizedBundle
 * @param {(args: object) => string} input.buildLocalizedPage
 * @param {(html: string, bundle: object) => string[]} input.findSpoilers
 * @param {(relativePath: string, html: string) => void} input.writeDistFile
 * @param {(items: any[], fn: Function) => Promise<any[]>} input.mapBounded
 */
async function buildQuestLocaleCandidate(input) {
  const {
    ruPages, ruQuality, receipt, receiptIndex, catalogs, fetchLocalizedBundle, buildLocalizedPage,
    findSpoilers, writeDistFile, mapBounded, log = () => {}, publicationMode = 'translations',
  } = input
  if (!['ru-only', 'translations'].includes(publicationMode)) throw new Error('Unknown quest SEO publication mode')
  const translators = new Map(LOCALES.map((locale) => [locale, createSsgTranslator(catalogs, locale)]))

  const tasks = []
  for (const page of ruPages) {
    const record = receiptIndex.get(`${Number(page.route.cityId)}/${page.route.questId}`)
    if (!record) throw new Error(`quest ${page.route.path}: missing from revision receipt — candidate rejected`)
    if (publicationMode === 'translations') {
      for (const locale of publishedTranslatedLocales(record)) tasks.push({ page, record, locale })
    }
  }
  log(`  🌐 Exact-lang reads: ${tasks.length} published+complete translations`)
  // Any rejection propagates: a failed read is never "absent".
  const bundles = await mapBounded(tasks, (task) => fetchLocalizedBundle(task.page.route.questId, task.locale))

  const cohorts = new Map(TRANSLATED_LOCALES.map((locale) => [locale, []]))
  const skipped = []
  tasks.forEach((task, index) => {
    const bundle = bundles[index]
    assertCompleteBundle(bundle, task.page.route.questId, task.locale)
    const reason = localizedBundleIneligibility(bundle, task.locale)
    if (reason) {
      skipped.push(`${task.page.route.path} [${task.locale}]: ${reason}`)
      return
    }
    const translator = translators.get(task.locale)
    const html = buildLocalizedPage({ quest: task.page.quest, route: task.page.route, bundle, locale: task.locale, translator })
    const spoilers = findSpoilers(html, bundle)
    if (spoilers.length) {
      skipped.push(`${task.page.route.path} [${task.locale}]: game content leak — ${spoilers.join('; ')}`)
      return
    }
    const pathname = canonicalPath(Number(task.page.route.cityId), task.page.route.questId, task.locale)
    cohorts.get(task.locale).push({ ...task, path: pathname, html })
  })

  const translatedMembers = new Map()
  for (const [locale, entries] of cohorts) {
    if (!entries.length) continue
    const scored = scoreDetailCohort(entries)
    let accepted = 0
    for (const entry of entries) {
      const verdict = scored.get(entry.path)
      const anchor = ruQuality.get(entry.page.route.path)
      if (!verdict.indexable) {
        skipped.push(`${entry.path}: ${verdict.issues.join('; ') || 'below the depth floors'}`)
        continue
      }
      if (!anchor || !anchor.indexable) {
        skipped.push(`${entry.path}: RU anchor ${entry.page.route.path} is not indexable`)
        continue
      }
      const stored = insertQuestLocaleSlots(entry.html)
      if (Buffer.byteLength(stored, 'utf8') > LIMITS.htmlBytes) throw new Error(`${entry.path}: HTML exceeds ${LIMITS.htmlBytes} B`)
      writeDistFile(memberHtmlPath(Number(entry.page.route.cityId), entry.page.route.questId, locale), stored)
      const key = entry.page.route.path
      if (!translatedMembers.has(key)) translatedMembers.set(key, {})
      translatedMembers.get(key)[locale] = {
        record: entry.record,
        quality: { indexable: true, word_count: verdict.words, own_fivegram_ratio: verdict.ratio },
      }
      accepted += 1
    }
    log(`  🌐 ${locale}: ${accepted}/${entries.length} translated detail pages clear the ${locale} cohort floors`)
  }
  if (skipped.length) log(`  ⚠️  ${skipped.length} translations stay without a static page: ${skipped.join(', ')}`)

  const clusters = ruPages.map((page) => {
    const record = receiptIndex.get(`${Number(page.route.cityId)}/${page.route.questId}`)
    const cluster = { quest_pk: record.quest_pk, city_id: record.city_id, quest_slug: record.quest_slug, source_revision: record.source_revision, members: {} }
    const ruMemberQuality = ruQuality.get(page.route.path)
    if (!ruMemberQuality) throw new Error(`${page.route.path}: RU quality verdict missing`)
    cluster.members.ru = memberEntry({ cluster, locale: 'ru', translator: translators.get('ru'), record, quality: ruMemberQuality })
    const translated = translatedMembers.get(page.route.path) || {}
    for (const locale of TRANSLATED_LOCALES) {
      if (!translated[locale]) continue
      cluster.members[locale] = memberEntry({ cluster, locale, translator: translators.get(locale), record, quality: translated[locale].quality })
    }
    return cluster
  })
  if (clusters.length > LIMITS.clusters) throw new Error(`${clusters.length} quest clusters exceed the v1 bound ${LIMITS.clusters}`)

  const errors = {}
  for (const locale of LOCALES) {
    const translator = translators.get(locale)
    writeDistFile(errorHtmlPath(locale), buildLocaleErrorPageHtml(translator))
    errors[locale] = { html_path: errorHtmlPath(locale), ru_link_label: translator.t('quests:localeServing.ruSource') }
  }

  return { schema: CANDIDATE_SCHEMA, schema_version: 1, receipt_before: receipt, clusters, errors }
}

function assertCandidateOutsideDist(candidatePath, distDir) {
  const relative = path.relative(path.resolve(distDir), path.resolve(candidatePath))
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    throw new Error('quest SEO candidate file must live outside dist (it carries the private receipt)')
  }
}

function writeCandidateFile(candidatePath, candidate, distDir, fileSystem = fs) {
  assertCandidateOutsideDist(candidatePath, distDir)
  fileSystem.mkdirSync(path.dirname(candidatePath), { recursive: true })
  fileSystem.writeFileSync(candidatePath, `${JSON.stringify(candidate)}\n`, { mode: 0o600 })
}

// ---------------------------------------------------------------------------
// Finalization
// ---------------------------------------------------------------------------

function utcSeconds(date) {
  return `${date.toISOString().slice(0, 19)}Z`
}

function defaultReleaseId(date, sha) {
  return `qs-${date.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z-${sha.slice(0, 12)}`
}

/**
 * R2 + checksums + full verification, then the manifest. Throws with no
 * manifest written on any failure; never overwrites an existing manifest.
 */
function finalizeQuestSeoPackage({
  distDir, candidatePath, takeReceipt, releaseId, now = new Date(), fileSystem = fs, log = () => {},
}) {
  assertCandidateOutsideDist(candidatePath, distDir)
  const manifestPath = path.join(distDir, MANIFEST_NAME)
  if (fileSystem.existsSync(manifestPath)) throw new Error(`${MANIFEST_NAME} already exists — a sealed package is never rewritten`)
  const candidate = parseStrictJson(fileSystem.readFileSync(candidatePath, 'utf8'), 'quest SEO candidate')
  if (!candidate || candidate.schema !== CANDIDATE_SCHEMA || candidate.schema_version !== 1) throw new Error('quest SEO candidate: unknown schema')
  const before = parseRevisionReceipt(JSON.stringify(candidate.receipt_before))
  const after = takeReceipt()
  assertReceiptsMatch(before, after)

  const source = parseStrictJson(readRegularPackageFile(distDir, BUILD_SOURCE_NAME, 4096, fileSystem).toString('utf8'), BUILD_SOURCE_NAME)
  if (!source || !SHA.test(source.sha || '')) throw new Error(`${BUILD_SOURCE_NAME}: full lowercase 40-hex sha expected`)
  const id = releaseId || defaultReleaseId(now, source.sha)

  const hashOf = (htmlPath) => sha256(readRegularPackageFile(distDir, htmlPath, LIMITS.htmlBytes, fileSystem))
  const clusters = candidate.clusters.map((cluster) => ({
    ...cluster,
    members: Object.fromEntries(Object.entries(cluster.members).map(([locale, member]) => [locale, {
      locale: member.locale,
      canonical_path: member.canonical_path,
      html_path: member.html_path,
      html_sha256: hashOf(member.html_path),
      content_revision: member.content_revision,
      complete: member.complete,
      quality: member.quality,
      released_status: member.released_status,
      version_nav_label: member.version_nav_label,
      language_labels: member.language_labels,
    }])),
  }))
  const errors = Object.fromEntries(LOCALES.map((locale) => {
    const error = candidate.errors[locale]
    return [locale, { html_path: error.html_path, html_sha256: hashOf(error.html_path), ru_link_label: error.ru_link_label }]
  }))
  const manifest = validateManifest(buildManifest({
    releaseId: id,
    frontendSha: source.sha,
    generatedAt: utcSeconds(now),
    beforeDigest: before.receipt_digest,
    afterDigest: after.receipt_digest,
    clusters,
    errors,
  }))
  const body = `${JSON.stringify(manifest, null, 2)}\n`
  if (Buffer.byteLength(body, 'utf8') > LIMITS.manifestBytes) throw new Error(`manifest exceeds ${LIMITS.manifestBytes} B`)

  const { failures } = verifyQuestSeoPackage(distDir, { manifest, fileSystem })
  if (failures.length) {
    throw new Error(`quest SEO package verification failed (${failures.length}):\n  - ${failures.slice(0, 40).join('\n  - ')}`)
  }

  // Complete bytes first, then a hard link: atomic like rename, but EEXIST
  // instead of silently replacing a manifest sealed after the check above.
  const temporary = path.join(distDir, `.${MANIFEST_NAME}.${process.pid}.tmp`)
  fileSystem.writeFileSync(temporary, body, { flag: 'wx' })
  try {
    fileSystem.linkSync(temporary, manifestPath)
  } finally {
    fileSystem.rmSync(temporary, { force: true })
  }
  fileSystem.rmSync(candidatePath, { force: true })
  const members = clusters.reduce((total, cluster) => total + Object.keys(cluster.members).length, 0)
  log(`✅ quest SEO package ${id}: ${clusters.length} clusters, ${members} members, manifest sha256 ${sha256(body)}`)
  return { releaseId: id, manifestSha256: sha256(body), clusters: clusters.length, members }
}

module.exports = {
  CANDIDATE_SCHEMA,
  assertCatalogMatchesReceipt,
  assertCompleteBundle,
  buildLocaleErrorPageHtml,
  buildQuestLocaleCandidate,
  createSsgTranslator,
  defaultReleaseId,
  finalizeQuestSeoPackage,
  languageLabels,
  localizedBundleIneligibility,
  publishedTranslatedLocales,
  runRevisionReceiptCommand,
  writeCandidateFile,
}
