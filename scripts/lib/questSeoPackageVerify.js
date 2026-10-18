/**
 * scripts/lib/questSeoPackageVerify.js
 * Static verification of a finalized (or about-to-be-finalized) v1 quest SEO
 * package (#2365). One implementation serves two callers:
 *   - `finalize-quest-seo-package.js` checks the in-memory manifest against the
 *     stored bytes before it ever writes the manifest;
 *   - `verify-static-quest-seo.js` re-reads everything from disk afterwards.
 *
 * Checks stored bytes (checksums, slots, canonical, language, JSON-LD, local
 * assets), the final three-slot projection rendered exactly as the backend
 * gateway renders it (reciprocal identical clusters, one canonical, bootstrap
 * accepted by the frontend projection validator), declared depth against the
 * same-locale cohort recomputed by `questPageDepth`, and that no prefixed
 * artifact exists outside the manifest.
 */

const fs = require('fs')
const path = require('path')

const {
  BUILD_SOURCE_NAME,
  ERROR_DIR,
  LIMITS,
  LOCALES,
  MANIFEST_NAME,
  PUBLIC_ORIGIN,
  SHA,
  SLOTS,
  TRANSLATED_LOCALES,
  errorDocumentIssues,
  fullEffectiveLocales,
  memberDocumentIssues,
  parseStrictJson,
  renderErrorLink,
  renderQuestLocaleSlots,
  safeRelativePath,
  scanHtmlDocument,
  servingProjection,
  sha256,
  validateManifest,
} = require('./questSeoContract')
const { scoreDetailCohort } = require('./questDetailCohort')
const { bootChunkIssues } = require('./expoStaticShell')
const { validateQuestServingProjection } = require('../../utils/questLocaleRouting')

/** Read a package file refusing symlinks anywhere on the way and oversize files. */
function readRegularPackageFile(root, relativePath, maxBytes, fileSystem = fs) {
  const parts = safeRelativePath(relativePath, 'package path')
  let current = root
  for (const part of parts) {
    current = path.join(current, part)
    const info = fileSystem.lstatSync(current)
    if (info.isSymbolicLink()) throw new Error(`${relativePath}: symbolic link inside the package`)
  }
  const info = fileSystem.lstatSync(current)
  if (!info.isFile()) throw new Error(`${relativePath}: not a regular file`)
  if (info.size > maxBytes) throw new Error(`${relativePath}: ${info.size} B exceeds ${maxBytes} B`)
  return fileSystem.readFileSync(current)
}

/** Every prefixed detail and localized error artifact present in a dist. */
function listPrefixedQuestArtifacts(distDir, fileSystem = fs) {
  const found = []
  const walk = (absolute, relative) => {
    if (!fileSystem.existsSync(absolute)) return
    const info = fileSystem.lstatSync(absolute)
    if (info.isSymbolicLink() || !info.isDirectory()) {
      found.push(relative)
      return
    }
    for (const entry of fileSystem.readdirSync(absolute)) {
      walk(path.join(absolute, entry), `${relative}/${entry}`)
    }
  }
  for (const locale of TRANSLATED_LOCALES) walk(path.join(distDir, locale, 'quests'), `${locale}/quests`)
  walk(path.join(distDir, ERROR_DIR), ERROR_DIR)
  return found.sort()
}

function sameStringSet(left, right) {
  const a = [...left].sort()
  const b = [...right].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

/** Final served representation of one member under one effective cluster. */
function projectionIssues(html, member, cluster, payload) {
  const issues = []
  let rendered
  try {
    rendered = renderQuestLocaleSlots(html, member, payload)
  } catch (error) {
    return [error.message]
  }
  const doc = scanHtmlDocument(rendered)
  const canonical = PUBLIC_ORIGIN + member.canonical_path
  if (doc.canonicals.length !== 1 || doc.canonicals[0].href !== canonical) issues.push('projection: not exactly one canonical')
  const expectedAlternates = payload.versions.length
    ? [...payload.versions.map((v) => `${v.locale} ${PUBLIC_ORIGIN}${v.path}`), `x-default ${PUBLIC_ORIGIN}${payload.ru_source_path}`]
    : []
  const alternates = doc.alternates.map((attrs) => `${attrs.hreflang} ${attrs.href}`)
  if (!sameStringSet(alternates, expectedAlternates)) issues.push(`projection: alternates ${JSON.stringify(alternates)} ≠ cluster`)
  if (doc.alternates.some((attrs) => attrs.container === 'body')) issues.push('projection: alternate outside head')
  const navAnchors = doc.anchors.filter((a) => a.hreflang && payload.versions.some((v) => v.path === a.href))
  if (!sameStringSet(navAnchors.map((a) => a.href), payload.versions.map((v) => v.path))) issues.push('projection: visible version links differ from cluster')
  const current = navAnchors.filter((a) => a['aria-current'] === 'page')
  if (payload.versions.length && (current.length !== 1 || current[0].href !== member.canonical_path)) issues.push('projection: current-language link is not the page itself')
  if (doc.servingScripts.length !== 1 || doc.servingScripts[0].type !== 'application/json' || doc.servingScripts[0].container !== 'body') {
    issues.push('projection: expected one inert quest-serving-v1 JSON script in body')
  } else {
    let parsed = null
    try { parsed = JSON.parse(doc.servingScripts[0].body) } catch { parsed = null }
    const validated = validateQuestServingProjection(parsed, {
      cityId: cluster.city_id, questSlug: cluster.quest_slug, locale: member.locale,
    })
    if (!validated || JSON.stringify(validated) !== JSON.stringify(payload)) issues.push('projection: bootstrap rejected by the frontend projection validator')
  }
  return issues
}

/**
 * @returns {{ failures: string[], manifest: object|null, manifestSha256: string|null }}
 */
function verifyQuestSeoPackage(distDir, options = {}) {
  const fileSystem = options.fileSystem || fs
  const failures = []
  let manifest = options.manifest || null
  let manifestSha256 = null
  try {
    if (!manifest) {
      const raw = readRegularPackageFile(distDir, MANIFEST_NAME, LIMITS.manifestBytes, fileSystem)
      manifestSha256 = sha256(raw)
      manifest = parseStrictJson(raw.toString('utf8'), MANIFEST_NAME)
    }
    validateManifest(manifest)
  } catch (error) {
    return { failures: [`manifest: ${error.message}`], manifest: null, manifestSha256 }
  }

  try {
    const source = parseStrictJson(readRegularPackageFile(distDir, BUILD_SOURCE_NAME, 4096, fileSystem).toString('utf8'), BUILD_SOURCE_NAME)
    if (!source || typeof source !== 'object' || !SHA.test(source.sha || '') || source.sha !== manifest.frontend_sha) {
      failures.push(`${BUILD_SOURCE_NAME}: sha does not equal manifest frontend_sha`)
    }
  } catch (error) {
    failures.push(`${BUILD_SOURCE_NAME}: ${error.message}`)
  }

  const assetCache = new Map()
  const checkAssets = (label, doc) => {
    for (const asset of new Set(doc.localAssets)) {
      if (!assetCache.has(asset)) {
        try {
          readRegularPackageFile(distDir, asset, LIMITS.assetBytes, fileSystem)
          assetCache.set(asset, null)
        } catch (error) {
          assetCache.set(asset, error.message)
        }
      }
      const problem = assetCache.get(asset)
      if (problem) failures.push(`${label}: local asset ${problem}`)
    }
  }
  const readChecked = (label, resource) => {
    try {
      const data = readRegularPackageFile(distDir, resource.html_path, LIMITS.htmlBytes, fileSystem)
      if (sha256(data) !== resource.html_sha256) {
        failures.push(`${label}: checksum of stored bytes ≠ manifest`)
        return null
      }
      return data.toString('utf8')
    } catch (error) {
      failures.push(`${label}: ${error.message}`)
      return null
    }
  }

  const memberPaths = new Set(manifest.clusters.flatMap((cluster) => Object.values(cluster.members).map((member) => member.canonical_path)))
  const cohorts = new Map(LOCALES.map((locale) => [locale, []]))
  for (const cluster of manifest.clusters) {
    const effective = fullEffectiveLocales(cluster)
    for (const [locale, member] of Object.entries(cluster.members)) {
      const label = member.canonical_path
      const html = readChecked(label, member)
      if (html === null) continue
      const { issues, doc } = memberDocumentIssues(html, {
        locale, canonicalPath: member.canonical_path, indexable: member.quality.indexable,
      })
      failures.push(...issues.map((issue) => `${label}: ${issue}`))
      if (locale !== 'ru') {
        try {
          const readChunk = (src) => readRegularPackageFile(distDir, src.slice(1), LIMITS.assetBytes, fileSystem).toString('utf8')
          failures.push(...bootChunkIssues(html, locale, readChunk).map((issue) => `${label}: ${issue} (#2465)`))
        } catch (error) {
          failures.push(`${label}: boot chunks unreadable — ${error.message}`)
        }
      }
      // #2467: a translated sibling link is only as good as the member behind it.
      for (const anchor of doc.anchors) {
        const target = typeof anchor.href === 'string' ? anchor.href.split(/[?#]/, 1)[0] : ''
        if (anchor.container !== 'body' || !/^\/(?:be|uk|pl|en)\/quests\//.test(target)) continue
        if (!target.startsWith(`/${locale}/`) || !memberPaths.has(target)) failures.push(`${label}: links ${target}, which is not a ${locale} member`)
      }
      checkAssets(label, doc)
      cohorts.get(locale).push({ path: member.canonical_path, html, declared: member.quality })
      const full = servingProjection(cluster, locale, manifest.release_id, effective)
      failures.push(...projectionIssues(html, member, cluster, full).map((issue) => `${label}: ${issue}`))
      if (locale === 'ru' && effective.length) {
        // Source drift: RU keeps its released body with empty translated slots.
        const drift = servingProjection(cluster, 'ru', manifest.release_id, [])
        failures.push(...projectionIssues(html, member, cluster, drift).map((issue) => `${label} (RU-only): ${issue}`))
      }
    }
  }

  for (const [locale, entries] of cohorts) {
    if (!entries.length) continue
    const scored = scoreDetailCohort(entries)
    for (const entry of entries) {
      const actual = scored.get(entry.path)
      if (!actual) continue
      if (actual.words !== entry.declared.word_count) {
        failures.push(`${entry.path}: declared ${entry.declared.word_count} words, page carries ${actual.words}`)
      }
      if (locale === 'ru') {
        if (actual.indexable !== entry.declared.indexable) failures.push(`${entry.path}: declared indexable=${entry.declared.indexable}, RU cohort says ${actual.indexable}`)
      } else if (!actual.indexable || actual.ratio + 1e-9 < entry.declared.own_fivegram_ratio) {
        failures.push(`${entry.path}: fails the ${locale} cohort depth rule on its stored bytes`)
      }
    }
  }

  for (const locale of LOCALES) {
    const error = manifest.errors[locale]
    const label = `error page ${locale}`
    const html = readChecked(label, error)
    if (html === null) continue
    const { issues, doc } = errorDocumentIssues(html, locale)
    failures.push(...issues.map((issue) => `${label}: ${issue}`))
    checkAssets(label, doc)
    const rendered = renderErrorLink(html, error.ru_link_label, '/quests/1/sample')
    if (rendered.includes(SLOTS.error) || !rendered.includes('href="/quests/1/sample"')) failures.push(`${label}: RU source link projection failed`)
  }

  const declared = new Set([
    ...manifest.clusters.flatMap((cluster) => Object.entries(cluster.members)
      .filter(([locale]) => locale !== 'ru').map(([, member]) => member.html_path)),
    ...LOCALES.map((locale) => manifest.errors[locale].html_path),
  ])
  for (const relative of listPrefixedQuestArtifacts(distDir, fileSystem)) {
    if (!declared.has(relative)) failures.push(`${relative}: prefixed quest artifact is not a manifest member`)
  }

  return { failures, manifest, manifestSha256 }
}

module.exports = {
  listPrefixedQuestArtifacts,
  projectionIssues,
  readRegularPackageFile,
  verifyQuestSeoPackage,
}
