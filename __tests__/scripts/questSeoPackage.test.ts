/**
 * #2365 B — v1 quest SEO package: receipt fence, exact-lang eligibility,
 * cohort depth, slots, manifest, finalization and the static verifier.
 *
 * `__tests__/fixtures/questSeoV1/*` is a byte-for-byte copy of the backend
 * consumer fixtures (`sergey-savran/metravel@origin/master:docs/contracts/quest-seo-v1/`,
 * fetched 2026-10-11 at 1bcd604); refresh it from there when interface v1 changes.
 */
const fs = require('fs')
const path = require('path')
const { makeTempDir } = require('./cli-test-utils')

const contract = require('@/scripts/lib/questSeoContract')
const {
  assertCatalogMatchesReceipt,
  buildLocaleErrorPageHtml,
  buildQuestLocaleCandidate,
  createSsgTranslator,
  finalizeQuestSeoPackage,
  runRevisionReceiptCommand,
  writeCandidateFile,
} = require('@/scripts/lib/questLocalePackage')
const { verifyQuestSeoPackage, listPrefixedQuestArtifacts } = require('@/scripts/lib/questSeoPackageVerify')
const { scoreDetailCohort } = require('@/scripts/lib/questDetailCohort')
const gsp = require('@/scripts/generate-seo-pages')
const { verifyQuestSeoPackageState } = require('@/scripts/verify-static-quest-seo')
const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin')
const { questRouteKey } = require('@/utils/questCityAlias')
const { validateQuestServingProjection } = require('@/utils/questLocaleRouting')
const { LOCALE_REGISTRY } = require('@/i18n/config')

const FIXTURES = path.join(__dirname, '..', 'fixtures', 'questSeoV1')
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8')
const CATALOGS = loadSsgCatalogs(path.resolve(__dirname, '..', '..')).catalogs
const SHA = 'a'.repeat(40)
const COVER = 'https://metravel.by/quest-cover/quests/1/main/cover.webp'

const BASE_HTML = [
  '<!DOCTYPE html><html  lang="ru" dir="ltr"><head><meta charset="utf-8"/>',
  '<title>Квест | Metravel</title><meta property="og:locale" content="ru_RU"/>',
  '<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"MeTravel"}]}</script>',
  '</head><body><div id="root">Загружаем квест…</div></body></html>',
].join('')

// Deterministic lowercase "words" (no digits/capitals — the depth skeleton drops those).
function prose(seed: number, words: number) {
  let state = seed * 7919 + 17
  const out: string[] = []
  for (let i = 0; i < words; i += 1) {
    let word = ''
    for (let j = 0; j < 6; j += 1) {
      state = (state * 1103515245 + 12345) % 2147483648
      word += String.fromCharCode(97 + (state % 26))
    }
    out.push(word)
  }
  const sentences: string[] = []
  for (let i = 0; i < out.length; i += 12) sentences.push(`${out.slice(i, i + 12).join(' ')}.`)
  return sentences.join(' ')
}

type Q = { quest_id: string; city_id: string; city_name: string; city_alias: string; title: string; points: number; duration_min: number; cover_url: string }
const QUESTS: Q[] = ['alpha', 'bravo', 'charlie', 'delta'].map((slug) => ({
  quest_id: `quest-${slug}`, city_id: '4', city_name: 'Минск', city_alias: 'minsk',
  title: `Квест ${slug}`, points: 2, duration_min: 90, cover_url: COVER,
}))

function bundle(quest: Q, locale: string, seed: number, opts: { words?: number; contentLocale?: string; leakTask?: boolean } = {}) {
  const task = 'посмотрите на верхушку высокой башни и назовите предмет который там виден'
  const story = prose(seed, opts.words ?? 420)
  return {
    quest_id: quest.quest_id,
    title: locale === 'ru' ? quest.title : `${quest.title} (${locale})`,
    content_locale: opts.contentLocale ?? locale,
    available_locales: ['ru', 'be', 'uk', 'pl', 'en'],
    city: { name: locale === 'ru' ? 'Минск' : 'Mińsk' },
    // The intro story is published verbatim: a translator pasting the task there is a real leak path.
    intro: { step_id: 'intro', title: 'Intro', story: opts.leakTask ? `${task}. ${story}` : story },
    steps: [{
      step_id: 's1', title: 'Ратуша', location: 'Площадь', story: prose(seed + 1, 40),
      task, hint: 'нужно отойти дальше и поднять голову чтобы увидеть', answer_pattern: { type: 'exact', value: 'корона' },
      poi_info: { opening_hours: '10:00–18:00' },
    }],
  }
}

function receiptFor(quests: Q[], published: Record<string, string[]> = {}, fence = 1) {
  const records = quests.map((quest, index) => {
    const source = contract.sha256(`src-${quest.quest_id}`)
    const locales: Record<string, unknown> = {}
    contract.LOCALES.forEach((locale: string, i: number) => {
      const on = locale === 'ru' || (published[quest.quest_id] || []).includes(locale)
      locales[locale] = {
        content_revision: locale === 'ru' ? source : contract.sha256(`${quest.quest_id}-${locale}`),
        fence_revision: String(fence + index * 10 + i), published: on, complete: on,
      }
    })
    return { quest_pk: index + 1, city_id: Number(quest.city_id), quest_slug: quest.quest_id, source_revision: source, locales }
  })
  return JSON.stringify({ schema_version: 1, receipt_digest: contract.sha256(contract.canonicalJson(records)), quests: records })
}

function ruPages(quests: Q[], ruBundles: Record<string, unknown>) {
  const built = quests.map((quest) => {
    const route = questRouteKey(quest)
    return { quest, route, path: route.path, html: gsp.buildQuestDetailPageHtml({ baseHtml: BASE_HTML, quest, bundle: ruBundles[quest.quest_id], route }) }
  })
  const cohort = scoreDetailCohort(built)
  const quality = new Map()
  const pages = built.map((page) => {
    const verdict = cohort.get(page.path)
    quality.set(page.path, { indexable: verdict.indexable, word_count: verdict.words, own_fivegram_ratio: verdict.ratio })
    const html = verdict.indexable ? page.html : gsp.injectBuildOwnedRobots(page.html, 'noindex, follow')
    return { ...page, html: contract.insertQuestLocaleSlots(html) }
  })
  return { pages, quality }
}

async function buildCase(options: {
  published?: Record<string, string[]>; localized?: (quest: Q, locale: string, i: number) => unknown;
  fetchError?: Error; ruWords?: Record<string, number>; publicationMode?: string;
} = {}) {
  const root = makeTempDir('quest-seo-package-')
  const dist = path.join(root, 'dist')
  fs.mkdirSync(dist, { recursive: true })
  fs.writeFileSync(path.join(dist, '.build-source.json'), JSON.stringify({ sha: SHA }))
  const ruBundles = Object.fromEntries(QUESTS.map((quest, i) => [quest.quest_id, bundle(quest, 'ru', 100 + i, { words: options.ruWords?.[quest.quest_id] })]))
  const { pages, quality } = ruPages(QUESTS, ruBundles)
  for (const page of pages) {
    const file = path.join(dist, contract.memberHtmlPath(4, page.route.questId, 'ru'))
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, page.html)
  }
  const published = options.published ?? { 'quest-alpha': ['pl', 'en'], 'quest-bravo': ['pl'], 'quest-charlie': ['pl'] }
  const receiptText = receiptFor(QUESTS, published)
  const receipt = contract.parseRevisionReceipt(receiptText)
  const fetched: string[] = []
  const candidate = await buildQuestLocaleCandidate({
    publicationMode: options.publicationMode,
    ruPages: pages,
    ruQuality: quality,
    receipt,
    receiptIndex: assertCatalogMatchesReceipt(QUESTS, receipt, questRouteKey),
    catalogs: CATALOGS,
    fetchLocalizedBundle: async (questId: string, locale: string) => {
      fetched.push(`${questId}:${locale}`)
      if (options.fetchError) throw options.fetchError
      const index = QUESTS.findIndex((quest) => quest.quest_id === questId)
      const quest = QUESTS[index]
      return options.localized ? options.localized(quest, locale, index) : bundle(quest, locale, 500 + index * 10 + locale.length)
    },
    buildLocalizedPage: ({ quest, route, bundle: localized, translator }: any) =>
      gsp.buildQuestDetailPageHtml({ baseHtml: BASE_HTML, quest, bundle: localized, route, ssg: translator }),
    findSpoilers: (html: string, localized: unknown) => gsp.findQuestSpoilerLeaks(html, localized, gsp.buildQuestRouteDigest(localized)).errors,
    writeDistFile: (relative: string, html: string) => {
      const file = path.join(dist, relative)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, html)
    },
    mapBounded: async (items: unknown[], fn: (item: unknown) => Promise<unknown>) => Promise.all(items.map(fn)),
  })
  const candidatePath = path.join(root, 'candidate.json')
  writeCandidateFile(candidatePath, candidate, dist)
  return { root, dist, candidate, candidatePath, receiptText, fetched }
}

const finalize = (c: { dist: string; candidatePath: string }, receiptText: string) =>
  finalizeQuestSeoPackage({
    distDir: c.dist, candidatePath: c.candidatePath, now: new Date('2026-10-11T12:00:00.000Z'),
    takeReceipt: () => contract.parseRevisionReceipt(receiptText),
  })

describe('v1 contract parity with the backend consumer fixtures', () => {
  it('parses the fixture receipt and recomputes its documented digest', () => {
    const receipt = contract.parseRevisionReceipt(fixture('revision-receipt.json'))
    expect(receipt.quests[0]).toMatchObject({ quest_pk: 1, city_id: 1, quest_slug: 'minsk-proof' })
  })

  it('accepts the fixture manifest and its stored member/error HTML exactly as the gateway does', () => {
    const manifest = contract.validateManifest(JSON.parse(fixture('quest-seo-manifest.v1.json')), { releaseId: 'fixture-release-1' })
    const [cluster] = manifest.clusters
    for (const [file, member] of [['member-ru.html', cluster.members.ru], ['member-pl.html', cluster.members.pl]]) {
      const html = fixture(file)
      expect(contract.sha256(html)).toBe(member.html_sha256)
      expect(contract.memberDocumentIssues(html, { locale: member.locale, canonicalPath: member.canonical_path, indexable: true }).issues).toEqual([])
    }
    expect(contract.sha256(fixture('error-pl.html'))).toBe(manifest.errors.pl.html_sha256)
    expect(contract.errorDocumentIssues(fixture('error-pl.html'), 'pl').issues).toEqual([])
  })

  it('renders the fixture PL bootstrap identical to the anonymous projection fixture', () => {
    const manifest = JSON.parse(fixture('quest-seo-manifest.v1.json'))
    const [cluster] = manifest.clusters
    const payload = contract.servingProjection(cluster, 'pl', manifest.release_id, contract.fullEffectiveLocales(cluster))
    expect(payload).toEqual(JSON.parse(fixture('projection-ru-pl.json')))
    const rendered = contract.renderQuestLocaleSlots(fixture('member-pl.html'), cluster.members.pl, payload)
    const doc = contract.scanHtmlDocument(rendered)
    expect(doc.alternates.map((a: any) => a.hreflang)).toEqual(['ru', 'pl', 'x-default'])
    expect(JSON.parse(doc.servingScripts[0].body)).toEqual(payload)
  })

  it('keeps the SSG locale registry in parity with i18n/config.ts', () => {
    for (const locale of contract.LOCALES) {
      expect(contract.LOCALE_META[locale]).toEqual({
        languageTag: LOCALE_REGISTRY[locale].languageTag, ogLocale: LOCALE_REGISTRY[locale].ogLocale,
      })
    }
  })
})

describe('private revision receipt C', () => {
  const good = receiptFor(QUESTS.slice(0, 2), { 'quest-alpha': ['pl'] })

  it.each([
    ['a truncated (partial) output', good.slice(0, good.length - 40)],
    ['an altered record (digest mismatch)', good.replace('"published":true', '"published":false')],
    ['a duplicate key', good.replace('{"schema_version":1,', '{"schema_version":1,"schema_version":1,')],
    ['an empty output', ''],
  ])('rejects %s instead of treating it as an empty publication', (_label, text) => {
    expect(() => contract.parseRevisionReceipt(text)).toThrow()
  })

  it('rejects a source race, including an edit-and-restore that only moved the fence', () => {
    const before = contract.parseRevisionReceipt(good)
    const raced = contract.parseRevisionReceipt(receiptFor(QUESTS.slice(0, 2), { 'quest-alpha': ['pl'] }, 2))
    expect(raced.quests[0].locales.pl.content_revision).toBe(before.quests[0].locales.pl.content_revision)
    expect(() => contract.assertReceiptsMatch(before, raced)).toThrow(/R1 ≠ R2/)
    expect(() => contract.assertReceiptsMatch(before, contract.parseRevisionReceipt(good))).not.toThrow()
  })

  it('fails closed on a nonzero exit or a timed-out command', () => {
    const exit = () => ({ status: 1, signal: null, stdout: good })
    const timeout = () => ({ error: Object.assign(new Error('spawnSync /bin/sh ETIMEDOUT'), { code: 'ETIMEDOUT' }), stdout: '' })
    expect(() => runRevisionReceiptCommand('receipt', { spawn: exit })).toThrow(/exited with 1/)
    expect(() => runRevisionReceiptCommand('receipt', { spawn: timeout })).toThrow(/ETIMEDOUT/)
    expect(() => runRevisionReceiptCommand('', { spawn: exit })).toThrow(/not configured/)
    expect(runRevisionReceiptCommand('receipt', { spawn: () => ({ status: 0, signal: null, stdout: good }) }).quests).toHaveLength(2)
  })

  it('rejects a catalog that disagrees with the receipt identities', () => {
    const receipt = contract.parseRevisionReceipt(good)
    expect(() => assertCatalogMatchesReceipt(QUESTS, receipt, questRouteKey)).toThrow(/catalog ≠ revision receipt/)
  })
})

describe('exact-lang candidate and finalized package', () => {
  it('publishes exact, complete, deep translations as reciprocal clusters with one canonical each', async () => {
    const c = await buildCase()
    const result = finalize(c, c.receiptText)
    expect(result).toMatchObject({ clusters: 4, members: 8 })
    const manifest = JSON.parse(fs.readFileSync(path.join(c.dist, contract.MANIFEST_NAME), 'utf8'))
    expect(manifest.release_id).toBe(`qs-20261011T120000Z-${SHA.slice(0, 12)}`)
    expect(manifest.generated_at).toBe('2026-10-11T12:00:00Z')
    const alpha = manifest.clusters.find((cluster: any) => cluster.quest_slug === 'quest-alpha')
    expect(Object.keys(alpha.members)).toEqual(['ru', 'pl', 'en'])
    expect(manifest.clusters.find((cluster: any) => cluster.quest_slug === 'quest-delta').members).toHaveProperty('ru')
    expect(fs.existsSync(c.candidatePath)).toBe(false)
    expect(verifyQuestSeoPackage(c.dist).failures).toEqual([])

    const projections = Object.keys(alpha.members).map((locale) => {
      const html = fs.readFileSync(path.join(c.dist, alpha.members[locale].html_path), 'utf8')
      const payload = contract.servingProjection(alpha, locale, manifest.release_id, contract.fullEffectiveLocales(alpha))
      const doc = contract.scanHtmlDocument(contract.renderQuestLocaleSlots(html, alpha.members[locale], payload))
      expect(doc.canonicals.map((x: any) => x.href)).toEqual([`https://metravel.by${alpha.members[locale].canonical_path}`])
      expect(validateQuestServingProjection(JSON.parse(doc.servingScripts[0].body), { cityId: 4, questSlug: 'quest-alpha', locale })).toEqual(payload)
      return doc.alternates.map((a: any) => `${a.hreflang} ${a.href}`).sort()
    })
    expect(new Set(projections.map((set) => JSON.stringify(set))).size).toBe(1)
    expect(projections[0]).toEqual([
      'en https://metravel.by/en/quests/4/quest-alpha', 'pl https://metravel.by/pl/quests/4/quest-alpha',
      'ru https://metravel.by/quests/4/quest-alpha', 'x-default https://metravel.by/quests/4/quest-alpha',
    ])
  })

  it('renders a fully localized PL page: language, canonical, JSON-LD, labels and shared media geometry', async () => {
    const c = await buildCase()
    const pl = fs.readFileSync(path.join(c.dist, 'pl/quests/4/quest-alpha.html'), 'utf8')
    const ru = fs.readFileSync(path.join(c.dist, 'quests/4/quest-alpha.html'), 'utf8')
    expect(pl).toContain('<html  lang="pl" dir="ltr">')
    expect(pl).toContain('content="pl_PL"')
    expect(pl).not.toContain('content="ru_RU"')
    expect(pl).toContain('<link data-rh="true" rel="canonical" href="https://metravel.by/pl/quests/4/quest-alpha"/>')
    expect(pl).toContain('"inLanguage":"pl"')
    expect(pl).toContain('Co jest na trasie')
    expect(pl).toContain('Godziny otwarcia: 10:00–18:00')
    for (const ruLabel of ['Что на маршруте', 'Куда дальше', 'Городской квест Metravel', 'Часы работы', 'Маршрут:']) expect(pl).not.toContain(ruLabel)
    const og = (html: string) => /property="og:image" content="([^"]+)"/.exec(html)?.[1]
    const ldImage = (html: string) => /"image":\["([^"]+)"\]/.exec(html)?.[1]
    expect(og(pl)).toBe(og(ru))
    expect(ldImage(pl)).toBe(ldImage(ru))
    expect(og(pl)).toMatch(/[?&]w=\d+/)
  })

  it('does not admit an API fallback (content_locale mismatch) as a translation', async () => {
    const c = await buildCase({
      localized: (quest, locale, i) => bundle(quest, locale, 500 + i * 10, { contentLocale: quest.quest_id === 'quest-bravo' ? 'ru' : locale }),
    })
    const bravo = c.candidate.clusters.find((cluster: any) => cluster.quest_slug === 'quest-bravo')
    expect(Object.keys(bravo.members)).toEqual(['ru'])
    expect(fs.existsSync(path.join(c.dist, 'pl/quests/4/quest-bravo.html'))).toBe(false)
  })

  it('never fetches an unpublished or incomplete translation', async () => {
    const c = await buildCase({ published: { 'quest-alpha': ['pl'] } })
    expect(c.fetched).toEqual(['quest-alpha:pl'])
  })

  it('builds a full RU baseline with all errors and an unchanged complete private receipt', async () => {
    const c = await buildCase({ publicationMode: 'ru-only', fetchError: new Error('must not fetch translations') })
    expect(c.fetched).toEqual([])
    expect(c.candidate.clusters).toHaveLength(QUESTS.length)
    for (const cluster of c.candidate.clusters) expect(Object.keys(cluster.members)).toEqual(['ru'])
    expect(Object.keys(c.candidate.errors).sort()).toEqual(['be', 'en', 'pl', 'ru', 'uk'])
    expect(c.candidate.receipt_before.quests[0].locales.pl.published).toBe(true)
    expect(c.candidate.receipt_before.quests[0].locales.en.published).toBe(true)
  })

  it('keeps thin translations and translations of a noindex RU anchor out of the package', async () => {
    const c = await buildCase({
      ruWords: { 'quest-charlie': 40 },
      localized: (quest, locale, i) => bundle(quest, locale, 500 + i * 10, { words: quest.quest_id === 'quest-bravo' ? 60 : 420 }),
    })
    const members = (slug: string) => Object.keys(c.candidate.clusters.find((cluster: any) => cluster.quest_slug === slug).members)
    expect(members('quest-bravo')).toEqual(['ru'])
    expect(members('quest-charlie')).toEqual(['ru'])
    expect(members('quest-alpha')).toEqual(['ru', 'pl', 'en'])
    const charlieRu = c.candidate.clusters.find((cluster: any) => cluster.quest_slug === 'quest-charlie').members.ru
    expect(charlieRu.quality.indexable).toBe(false)
    finalize(c, c.receiptText)
    expect(fs.readFileSync(path.join(c.dist, 'quests/4/quest-charlie.html'), 'utf8')).toContain('<meta name="robots" content="noindex, follow"/>')
    expect(verifyQuestSeoPackage(c.dist).failures).toEqual([])
  })

  it('leaves out a translation whose page would reveal a task instead of shipping it', async () => {
    const c = await buildCase({ localized: (quest, locale, i) => bundle(quest, locale, 500 + i * 10, { leakTask: quest.quest_id === 'quest-alpha' && locale === 'pl' }) })
    const alpha = c.candidate.clusters.find((cluster: any) => cluster.quest_slug === 'quest-alpha')
    expect(Object.keys(alpha.members)).toEqual(['ru', 'en'])
  })

  it('never writes answers, tasks or hints into the manifest', async () => {
    const c = await buildCase()
    finalize(c, c.receiptText)
    const manifest = fs.readFileSync(path.join(c.dist, contract.MANIFEST_NAME), 'utf8')
    for (const secret of ['корона', 'верхушку', 'поднять голову', 'answer', 'token']) expect(manifest).not.toContain(secret)
  })

  it('aborts the whole candidate on a timed-out exact-lang read (no mass withdrawal)', async () => {
    await expect(buildCase({ fetchError: new Error('timeout after 30000ms') })).rejects.toThrow(/timeout/)
  })

  it('aborts the whole candidate on a partial bundle read', async () => {
    await expect(buildCase({ localized: (quest, locale) => ({ title: 'x', content_locale: locale }) })).rejects.toThrow(/partial or unreadable bundle/)
  })

  it('rejects the candidate when sources change between R1 and R2 and writes no manifest', async () => {
    const c = await buildCase()
    const raced = receiptFor(QUESTS, { 'quest-alpha': ['pl', 'en'], 'quest-bravo': ['pl'], 'quest-charlie': ['pl'] }, 3)
    expect(() => finalize(c, raced)).toThrow(/R1 ≠ R2/)
    expect(fs.existsSync(path.join(c.dist, contract.MANIFEST_NAME))).toBe(false)
    expect(verifyQuestSeoPackageState(c.dist)).toEqual([expect.stringMatching(/prefixed quest artifacts without a sealed/)])
    expect(verifyQuestSeoPackageState(c.dist, { candidatePending: true })).toEqual([])
  })

  it('never rewrites a sealed manifest and keeps the candidate outside dist', async () => {
    const c = await buildCase()
    finalize(c, c.receiptText)
    expect(() => finalize(c, c.receiptText)).toThrow(/already exists/)
    expect(() => writeCandidateFile(path.join(c.dist, 'candidate.json'), c.candidate, c.dist)).toThrow(/outside dist/)
  })

  it('does not replace a manifest sealed by a concurrent finalize after the existence check', async () => {
    const c = await buildCase()
    const manifestPath = path.join(c.dist, contract.MANIFEST_NAME)
    fs.writeFileSync(manifestPath, 'sealed-by-peer\n')
    const raceFs = { ...fs, existsSync: (target: fs.PathLike) => target !== manifestPath && fs.existsSync(target) }
    expect(() => finalizeQuestSeoPackage({
      distDir: c.dist, candidatePath: c.candidatePath, now: new Date('2026-10-11T12:00:00.000Z'),
      takeReceipt: () => contract.parseRevisionReceipt(c.receiptText), fileSystem: raceFs as typeof fs,
    })).toThrow(/EEXIST/)
    expect(fs.readFileSync(manifestPath, 'utf8')).toBe('sealed-by-peer\n')
    expect(fs.readdirSync(c.dist).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })
})

describe('static verifier of a sealed package', () => {
  async function sealed() {
    const c = await buildCase()
    finalize(c, c.receiptText)
    return c
  }

  it('fails on changed stored bytes', async () => {
    const c = await sealed()
    fs.appendFileSync(path.join(c.dist, 'pl/quests/4/quest-alpha.html'), ' ')
    expect(verifyQuestSeoPackage(c.dist).failures).toEqual([expect.stringMatching(/checksum of stored bytes/)])
  })

  it('fails on a symlinked member', async () => {
    const c = await sealed()
    const file = path.join(c.dist, 'pl/quests/4/quest-alpha.html')
    fs.renameSync(file, `${file}.real`)
    fs.symlinkSync(`${file}.real`, file)
    expect(verifyQuestSeoPackage(c.dist).failures.join('\n')).toMatch(/symbolic link/)
  })

  it('fails on a prefixed page that is not a manifest member', async () => {
    const c = await sealed()
    const stray = path.join(c.dist, 'pl/quests/4/quest-delta.html')
    fs.writeFileSync(stray, '<html lang="pl"></html>')
    expect(listPrefixedQuestArtifacts(c.dist)).toContain('pl/quests/4/quest-delta.html')
    expect(verifyQuestSeoPackage(c.dist).failures).toEqual(['pl/quests/4/quest-delta.html: prefixed quest artifact is not a manifest member'])
  })

  it('fails when the frontend SHA does not match .build-source.json', async () => {
    const c = await sealed()
    fs.writeFileSync(path.join(c.dist, '.build-source.json'), JSON.stringify({ sha: 'b'.repeat(40) }))
    expect(verifyQuestSeoPackage(c.dist).failures).toEqual([expect.stringMatching(/sha does not equal/)])
  })

  it('fails when a declared depth disagrees with the stored page', async () => {
    const c = await sealed()
    const manifestPath = path.join(c.dist, contract.MANIFEST_NAME)
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    manifest.clusters[0].members.pl.quality.word_count += 1
    expect(verifyQuestSeoPackage(c.dist, { manifest }).failures.join('\n')).toMatch(/declared \d+ words/)
  })
})

describe('bounded slots', () => {
  it('inserts each marker once at its contract position and refuses double insertion', () => {
    const html = gsp.buildQuestDetailPageHtml({
      baseHtml: BASE_HTML, quest: QUESTS[0], bundle: bundle(QUESTS[0], 'ru', 1), route: questRouteKey(QUESTS[0]),
    })
    const slotted = contract.insertQuestLocaleSlots(html)
    const markers = contract.scanHtmlDocument(slotted).markers.map((m: any) => `${m.marker}@${m.container}`)
    expect(markers).toEqual([`${contract.SLOTS.head}@head`, `${contract.SLOTS.links}@body`, `${contract.SLOTS.bootstrap}@body`])
    expect(slotted.indexOf(contract.SLOTS.links)).toBe(slotted.indexOf('</h1>') + '</h1>'.length)
    expect(() => contract.insertQuestLocaleSlots(slotted)).toThrow(/already carries/)
  })

  it('reads script bodies at the right offsets after letters whose lowercase is longer (İstanbul)', () => {
    const doc = contract.scanHtmlDocument('<html lang="ru"><head></head><body><p>İstanbul İzmir</p>' +
      '<script type="application/json" id="quest-serving-v1">{"a":1}</SCRIPT><!--QUEST_LOCALE_BOOTSTRAP_V1--></body></html>')
    expect(doc.servingScripts.map((script: any) => script.body)).toEqual(['{"a":1}'])
    expect(doc.markers).toEqual([{ marker: contract.SLOTS.bootstrap, container: 'body' }])
  })

  it('keeps the bootstrap inert even if a label tries to close the script', () => {
    const json = contract.scriptJson({ label: '</script><script>alert(1)</script>\u2028&' })
    expect(json).not.toMatch(/[<>&\u2028]/)
    expect(JSON.parse(json).label).toBe('</script><script>alert(1)</script>\u2028&')
  })

  it('renders an RU-only representation without alternates or version links', () => {
    const manifest = JSON.parse(fixture('quest-seo-manifest.v1.json'))
    const [cluster] = manifest.clusters
    const payload = contract.servingProjection(cluster, 'ru', manifest.release_id, [])
    const doc = contract.scanHtmlDocument(contract.renderQuestLocaleSlots(fixture('member-ru.html'), cluster.members.ru, payload))
    expect(doc.alternates).toEqual([])
    expect(doc.anchors).toEqual([])
    expect(JSON.parse(doc.servingScripts[0].body).versions).toEqual([])
  })
})

describe('RU regression of the shared detail builder', () => {
  it('keeps the historical Russian labels and lang for RU pages', () => {
    const html = gsp.buildQuestDetailPageHtml({
      baseHtml: BASE_HTML, quest: QUESTS[0], bundle: bundle(QUESTS[0], 'ru', 1), route: questRouteKey(QUESTS[0]),
    })
    expect(html).toContain('<html  lang="ru" dir="ltr">')
    expect(html).toContain('href="https://metravel.by/quests/4/quest-alpha"')
    expect(html).toContain('Маршрут: 2 точки')
    expect(html).toContain('Время: примерно 1 ч 30 мин')
    expect(html).toContain('Что на маршруте')
    expect(html).toContain('Часы работы: 10:00–18:00')
    expect(html).toContain('"inLanguage":"ru"')
    expect(html).toContain('"touristType":"Городской квест, пеший маршрут"')
    expect(html).not.toContain('<!--QUEST_')
  })

  it('translates through the shipped catalogs and fails on a missing key', () => {
    const pl = createSsgTranslator(CATALOGS, 'pl')
    expect(pl.tp('seoSsg:questDetail.factRoute', 5)).toBe('Trasa: 5 punktów')
    expect(() => pl.t('seoSsg:questDetail.doesNotExist')).toThrow(/Missing pl translation/)
  })

  it('marks only the target language of the catalog link on a localized error page', () => {
    const html = buildLocaleErrorPageHtml(createSsgTranslator(CATALOGS, 'en'))
    expect(html).toContain('<html lang="en">')
    expect(html).toMatch(/<a href="\/quests" hreflang="ru">[^<]+<\/a>/)
    expect(html).not.toMatch(/<a [^>]*\blang="ru"/)
  })
})
