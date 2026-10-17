/** @jest-environment node */
import fs from 'fs'
import path from 'path'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const contract = require('../../scripts/lib/questSeoContract')
const capture = require('../../scripts/lib/seoInputsCapture')
const { collectSeoInputs } = require('../../scripts/generate-seo-pages')
const generator = path.resolve('scripts/generate-seo-pages.js')
const identity = { nonce: 'a'.repeat(48), frontend_sha: 'b'.repeat(40), api_origin: 'https://metravel.by', publication_mode: 'translations' }
const quest = { quest_id: 'minsk-fixture', city_id: '4', city_name: 'Минск', city_alias: 'minsk', title: 'Контрольный маршрут', points: 1, duration_min: 60 }
function receipt() {
  const source = contract.sha256('source')
  const records = [{ quest_pk: 1, city_id: 4, quest_slug: quest.quest_id, source_revision: source,
    locales: Object.fromEntries(contract.LOCALES.map((locale: string, index: number) => [locale, {
      content_revision: locale === 'ru' ? source : contract.sha256(locale), fence_revision: String(index + 1), published: true, complete: true,
    }])) }]
  return { schema_version: 1, receipt_digest: contract.sha256(contract.canonicalJson(records)), quests: records }
}
function bundle(locale: string) {
  // Deterministic lower-case prose long enough to exercise translated writes.
  const words = Array.from({ length: 430 }, (_, i) => `слово${String.fromCharCode(1072 + i % 30)}${String.fromCharCode(1072 + Math.floor(i / 30))}`)
  return { quest_id: quest.quest_id, title: `${quest.title} ${locale}`, content_locale: locale,
    available_locales: contract.LOCALES, city: { name: 'Минск' }, intro: { story: words.join(' ') + '.' },
    steps: Array.from({ length: 8 }, (_, step) => ({ step_id: `s${step}`, title: `Площадь ${step}`, location: `Площадь ${step}`,
      story: Array.from({ length: 4 }, (_, sentence) => Array.from({ length: 35 }, (_, word) => {
        const n = step * 140 + sentence * 35 + word
        return `объект${String.fromCharCode(1072 + n % 30)}${String.fromCharCode(1072 + Math.floor(n / 30) % 30)}${String.fromCharCode(1072 + Math.floor(n / 900))}`
      }).join(' ') + '.').join(' ') })) }
}
function payload() {
  return { questSeoReceipt: receipt(), quests: [quest], questBundles: [[quest.quest_id, bundle('ru')]],
    travels: [], travelDetails: [], rawTravelDetails: [], articles: [{ id: 42, name: 'Контрольная статья', description: 'Контроль' }],
    localizedBundles: ['be', 'uk', 'pl', 'en'].map(locale => [`${locale}/${quest.quest_id}`, bundle(locale)]) }
}

describe('build-local SEO input capture', () => {
  let root: string, file: string
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    root = fs.realpathSync(makeTempDir('seo-inputs-')); fs.chmodSync(root, 0o700); file = path.join(root, 'inputs.json') })
  afterEach(() => { removeDir(root); jest.restoreAllMocks() })

  it('publishes complete closed private bytes without replacing a prior capture', () => {
    const input = payload()
    capture.writeSeoInputs(file, identity, input)
    expect(fs.statSync(file).mode & 0o777).toBe(0o600)
    expect(fs.statSync(file).nlink).toBe(1)
    expect(fs.readdirSync(root)).toEqual(['inputs.json'])
    expect(capture.readSeoInputs(file, identity)).toEqual(input)
    expect(() => capture.writeSeoInputs(file, identity, input)).toThrow()
    expect(capture.readSeoInputs(file, identity)).toEqual(input)
  })
  it.each([
    { nonce: 'c'.repeat(48) }, { frontend_sha: 'c'.repeat(40) },
    { api_origin: 'https://other.invalid' }, { publication_mode: 'ru-only' },
  ])('rejects reuse for a different build identity %j', delta => {
    capture.writeSeoInputs(file, identity, payload())
    expect(() => capture.readSeoInputs(file, { ...identity, ...delta })).toThrow(/another build/)
  })
  it.each(['truncated', 'payload', 'receipt', 'extra-key'])('rejects %s capture data', mode => {
    capture.writeSeoInputs(file, identity, payload())
    const value = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (mode === 'payload') value.inputs.articles[0].name += ' changed'
    if (mode === 'receipt') value.inputs.questSeoReceipt.receipt_digest = '0'.repeat(64)
    if (mode === 'extra-key') value.unexpected = true
    fs.writeFileSync(file, mode === 'truncated' ? '{"schema_version":1,' : JSON.stringify(value))
    expect(() => capture.readSeoInputs(file, identity)).toThrow()
  })
  it.each(['symlink', 'hardlink', 'public-file', 'public-parent', 'oversize'])('rejects unsafe %s file metadata', mode => {
    capture.writeSeoInputs(file, identity, payload())
    if (mode === 'symlink') { fs.renameSync(file, file + '.real'); fs.symlinkSync(file + '.real', file) }
    if (mode === 'hardlink') fs.linkSync(file, file + '.alias')
    if (mode === 'public-file') fs.chmodSync(file, 0o644)
    if (mode === 'public-parent') fs.chmodSync(root, 0o755)
    if (mode === 'oversize') fs.truncateSync(file, capture.MAX_INPUT_BYTES + 1)
    expect(() => capture.readSeoInputs(file, identity)).toThrow()
  })
  it.each(['growth', 'truncation'])('bounds reads to the admitted size during concurrent %s', mode => {
    capture.writeSeoInputs(file, identity, payload())
    const admittedSize = fs.statSync(file).size
    const read = fs.readSync
    let first = true
    const lengths: number[] = []
    jest.spyOn(fs, 'readSync').mockImplementation(((fd: number, buffer: Buffer, offset: number, length: number, position: number | null) => {
      lengths.push(buffer.length)
      if (first) {
        first = false
        fs.truncateSync(file, mode === 'growth' ? capture.MAX_INPUT_BYTES + 1 : 0)
      }
      return read(fd, buffer, offset, length, position)
    }) as any)
    expect(() => capture.readSeoInputs(file, identity)).toThrow(mode === 'growth' ? /grew while reading/ : /truncated while reading/)
    expect(Math.max(...lengths)).toBeLessThanOrEqual(admittedSize)
  })
  it('refuses a FIFO without waiting for a writer', () => {
    expect(runCli('mkfifo', ['-m', '600', file]).status).toBe(0)
    const script = `try { require(${JSON.stringify(path.resolve('scripts/lib/seoInputsCapture.js'))}).readSeoInputs(process.argv[1], JSON.parse(process.argv[2])); process.exit(2) } catch(error) { console.log(error.message) }`
    const result = runCli(process.execPath, ['-e', script, file, JSON.stringify(identity)], { timeoutMs: 2000 })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('private regular bounded file required')
  })
  it('refuses collection inside public dist before any API content read', () => {
    const result = runCli(process.execPath, [generator, '--dist', root, '--collect-inputs', file,
      '--quest-seo-candidate', path.join(root, 'candidate.json'), '--quest-seo-input-nonce', identity.nonce,
      '--frontend-sha', identity.frontend_sha, '--api', identity.api_origin], { timeoutMs: 2000 })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Private SEO inputs must be outside dist')
    expect(result.stdout).not.toContain('Fetching')
    expect(fs.readdirSync(root)).toEqual([])
  })
  it('rejects missing/duplicate exact-language inputs before publication', () => {
    const missing = payload(); missing.localizedBundles.pop()
    expect(() => capture.writeSeoInputs(file, identity, missing)).toThrow(/exact-lang set/)
    const duplicate = payload(); duplicate.localizedBundles.push(duplicate.localizedBundles[0])
    expect(() => capture.writeSeoInputs(file, identity, duplicate)).toThrow(/duplicate/)
    expect(fs.readdirSync(root)).toEqual([])
  })

  it('collects without dist, before content reads takes complete R1, and enumerates every locale', async () => {
    const calls: string[] = []
    const data = await collectSeoInputs({ candidate: true, publicationMode: 'translations', pace: async () => {},
      readReceipt: () => { calls.push('R1'); return receipt() }, fetchJson: async (url: string) => {
        calls.push(url)
        const parsed = new URL(url)
        if (parsed.pathname === '/api/quests/') return [quest]
        if (parsed.pathname.startsWith('/api/quests/by-quest-id/')) return bundle(parsed.searchParams.get('lang') || 'ru')
        if (parsed.pathname === '/api/travels/') return []
        if (parsed.pathname === '/api/') return { articles: '/api/articles/' }
        if (parsed.pathname === '/api/articles/') return [{ id: 42 }]
        throw new Error(`Unexpected fixture URL ${url}`)
      } })
    expect(calls[0]).toBe('R1')
    expect(calls.filter(url => url.includes('?lang=')).map(url => new URL(url).searchParams.get('lang')).sort()).toEqual(['be', 'en', 'pl', 'uk'])
    expect(data.localizedBundles).toHaveLength(4)
    expect(fs.readdirSync(root)).toEqual([])
  })
  it.each(['catalogue', 'ru-bundle', 'translation', 'travel-detail'])('refuses failed %s producer rather than publishing partial inputs', async mode => {
    const run = collectSeoInputs({ candidate: true, pace: async () => {}, readReceipt: () => receipt(),
      fetchJson: async (url: string) => {
        const parsed = new URL(url)
        if (parsed.pathname === '/api/quests/') { if (mode === 'catalogue') throw new Error('catalogue down'); return [quest] }
        if (parsed.pathname.startsWith('/api/quests/by-quest-id/')) {
          if (mode === 'ru-bundle' && !parsed.searchParams.has('lang') || mode === 'translation' && parsed.searchParams.has('lang')) throw new Error('bundle down')
          return bundle(parsed.searchParams.get('lang') || 'ru')
        }
        if (parsed.pathname === '/api/travels/') return mode === 'travel-detail' ? [{ id: 9, slug: 'nine' }] : []
        if (parsed.pathname.startsWith('/api/travels/')) throw new Error('detail down')
        if (parsed.pathname === '/api/') return { articles: '/api/articles/' }
        return [{ id: 42 }]
      } })
    await expect(run).rejects.toThrow()
    expect(fs.readdirSync(root)).toEqual([])
  })

  it('renders byte-identical complete output from captured input with zero HTTP, retaining quality and R1', () => {
    const input = payload()
    const receiptPath = path.join(root, 'receipt.cjs')
    fs.writeFileSync(receiptPath, `process.stdout.write(${JSON.stringify(JSON.stringify(receipt()))})`)
    const preload = path.join(root, 'producer.cjs')
    fs.writeFileSync(preload, `
const input=${JSON.stringify(input)};
const f=require(${JSON.stringify(path.resolve('scripts/lib/fetchJson.js'))});
f.fetchJsonOnce=f.fetchJson=async url=>{
 if(process.env.FORBID_NETWORK==='1') throw Error('HTTP must not occur while rendering');
 const u=new URL(url);
 if(u.pathname==='/api/quests/')return input.quests;
 if(u.pathname.startsWith('/api/quests/by-quest-id/'))return u.searchParams.has('lang')?new Map(input.localizedBundles).get(u.searchParams.get('lang')+'/'+input.quests[0].quest_id):input.questBundles[0][1];
 if(u.pathname==='/api/travels/')return input.travels;
 if(u.pathname==='/api/')return {articles:'/api/articles/'};
 if(u.pathname==='/api/articles/')return input.articles;
 throw Error('Unexpected fixture URL '+url);
};`)
    const online = path.join(root, 'online'), offline = path.join(root, 'offline')
    for (const dist of [online, offline]) {
      fs.mkdirSync(path.join(dist, 'quests/country'), { recursive: true })
      fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Fixture</title></head><body><div id="root"></div></body></html>')
      fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, 'quests/country/[country].html'))
    }
    const options = ['--quest-seo-publication-mode', 'translations', '--api', identity.api_origin]
    const first = runCli(process.execPath, ['--require', preload, generator, '--dist', online, '--quest-seo-candidate', path.join(root, 'online-candidate.json'), ...options], {
      env: { QUEST_SEO_RECEIPT_COMMAND: `${JSON.stringify(process.execPath)} ${JSON.stringify(receiptPath)}` }, timeoutMs: 20000 })
    if (first.status !== 0) throw new Error(first.stderr + first.stdout)
    expect(first.status).toBe(0)
    // Actual collection entrypoint succeeds while its requested dist does not exist.
    const collected = runCli(process.execPath, ['--require', preload, generator,
      '--dist', path.join(root, 'not-exported-yet'), '--quest-seo-candidate', path.join(root, 'collect-candidate.json'), ...options,
      '--collect-inputs', file, '--quest-seo-input-nonce', identity.nonce, '--frontend-sha', identity.frontend_sha], {
      env: { QUEST_SEO_RECEIPT_COMMAND: `${JSON.stringify(process.execPath)} ${JSON.stringify(receiptPath)}` }, timeoutMs: 20000 })
    if (collected.status !== 0) throw new Error(collected.stderr + collected.stdout)
    expect(collected.status).toBe(0)
    expect(fs.existsSync(path.join(root, 'not-exported-yet'))).toBe(false)
    const second = runCli(process.execPath, ['--require', preload, generator, '--dist', offline, '--quest-seo-candidate', path.join(root, 'offline-candidate.json'), ...options,
      '--quest-seo-inputs', file, '--quest-seo-input-nonce', identity.nonce, '--frontend-sha', identity.frontend_sha], { env: { FORBID_NETWORK: '1' }, timeoutMs: 20000 })
    if (second.status !== 0) throw new Error(second.stderr + second.stdout)
    expect(second.status).toBe(0)
    function tree(dir: string, prefix = ''): Record<string, string> {
      return Object.assign({}, ...fs.readdirSync(dir).map(name => fs.statSync(path.join(dir, name)).isDirectory()
        ? tree(path.join(dir, name), prefix + name + '/') : { [prefix + name]: fs.readFileSync(path.join(dir, name), 'utf8') }))
    }
    expect(tree(offline)).toEqual(tree(online))
    expect(fs.existsSync(path.join(offline, 'pl/quests/4/minsk-fixture.html'))).toBe(true)
    expect(JSON.parse(fs.readFileSync(path.join(root, 'offline-candidate.json'), 'utf8'))).toEqual(JSON.parse(fs.readFileSync(path.join(root, 'online-candidate.json'), 'utf8')))
  })
  it('reuses exact RAW detail responses while preserving independent catalogue, missing IDs and uploads anchors', async () => {
    const { createCapturedTravelReader } = require('../../scripts/lib/capturedTravelDetails')
    const bodyAudit = require('../../scripts/audit-article-body-media')
    const media = require('../../scripts/post-deploy-media-check')
    const { normalizeTravelDetail } = require('../../scripts/generate-seo-pages')
    const raw = { id: 116, description: '<p>body</p>',
      rich_text: { recommendation: { safe_html: '<img src="https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/fixture.jpg">' } },
      media: { article_body: { gallery: [{ src: '/gallery/116/frame.webp' }] } }, travelAddress: [] }
    // This field is intentionally absent from normalized SEO details.
    expect(normalizeTravelDetail(raw).rich_text).toBeUndefined()
    const input = payload()
    input.rawTravelDetails = [[identity.api_origin + '/api/travels/116/', raw]] as any
    capture.writeSeoInputs(file, identity, input)
    const network: string[] = [], paced: string[] = []
    const read = createCapturedTravelReader({ file, identity,
      pace: async () => { paced.push('network-slot') }, fetchJson: async (url: string) => {
        network.push(url)
        return url.includes('?') ? [{ id: 116 }, { id: 999 }] : { ...raw, id: 999 }
      } })
    expect(await read(identity.api_origin + '/api/travels/116/')).toEqual(raw)
    expect(network).toEqual([]); expect(paced).toEqual([])
    const rows = await read(identity.api_origin + '/api/travels/?page=1&perPage=100')
    expect(rows.map((row: any) => row.id)).toEqual([116, 999])
    const covered = await bodyAudit.fetchTravelDetails(rows.map((row: any) => row.id), {
      site: identity.api_origin, families: bodyAudit.RISKY_FAMILIES, fetchJson: read, minIntervalMs: 0,
    })
    expect(covered.map((row: any) => row.id)).toEqual([116, 999])
    expect(covered[0].targets.some((target: any) => target.family === 'uploads')).toBe(true)
    expect(covered[1].targets).toEqual(covered[0].targets)
    expect(network).toEqual([identity.api_origin + '/api/travels/?page=1&perPage=100', identity.api_origin + '/api/travels/999/'])
    const anchored = await media.collectUploadsScanDetails(read, { count: 2, results: rows })
    expect(anchored.anchorsReachable).toBe(true)
    expect(anchored.details).toEqual([raw])
    expect(network).toHaveLength(2) // Anchor coverage exists; only its transport was reused.
    await read(identity.api_origin + '/api/travels/116/?fresh=1')
    await read('https://other.invalid/api/travels/116/')
    expect(network.slice(-2)).toEqual([identity.api_origin + '/api/travels/116/?fresh=1', 'https://other.invalid/api/travels/116/'])
    expect(paced).toHaveLength(4)
  })

})
