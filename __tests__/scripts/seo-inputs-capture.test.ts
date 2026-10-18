/** @jest-environment node */
import fs from 'fs'
import path from 'path'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const contract = require('../../scripts/lib/questSeoContract')
const capture = require('../../scripts/lib/seoInputsCapture')
const { collectSeoInputs } = require('../../scripts/generate-seo-pages')
const { normalizeTravelDetail } = require('../../scripts/lib/travelDetail')
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
function completeRawDetail(id = 116) {
  return { id, description: '<p>тело статьи</p>', media: { article_body: { gallery: [{ src: '/gallery/116/frame.webp' }] } },
    gallery: [{ url: 'https://images.invalid/one.jpg' }], travelAddress: [{ id: 1, coord: '53.9,27.5' }],
    coordsMeTravel: ['53.9,27.5'], countryCode: 'BY', user: { id: 1, name: 'Юля' },
    userName: 'julia', author_name: 'Юля', authorName: 'Julia', owner_name: 'Юлия', ownerName: 'J.',
    userId: 1, user_id: '1', user_ids: [1], userTravelsCount: 12,
    youtube_link: 'https://www.youtube.com/watch?v=fixture', recommendation: '<p>совет</p>', plus: '<p>плюс</p>', minus: '<p>минус</p>',
    rating: 4.5, rating_count: 3, user_rating: 5, number_days: 2, monthName: 'Май', year: 2026,
    rich_text: { recommendation: { safe_html: '<img src="https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/fixture.jpg">' } } }
}
function withTravelDetails() {
  const input = payload(), raw = completeRawDetail()
  input.travels = [{ id: raw.id, slug: 'fixture', name: 'Поездка в Минск' }] as any
  input.travelDetails = [[raw.id, normalizeTravelDetail(raw)]] as any
  input.rawTravelDetails = [[`${identity.api_origin}/api/travels/${raw.id}/`, raw]] as any
  return input
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
  it('stores numeric raw once and losslessly materializes every normalizer field while retaining raw-only audit fields', () => {
    const input = withTravelDetails()
    capture.writeSeoInputs(file, identity, input)
    const envelope = JSON.parse(fs.readFileSync(file, 'utf8'))
    expect(envelope.schema_version).toBe(2)
    expect(envelope.inputs.travelDetails).toEqual([[116, { raw_url: `${identity.api_origin}/api/travels/116/` }]])
    expect(envelope.inputs.rawTravelDetails).toEqual(input.rawTravelDetails)
    expect(envelope.payload_sha256).toBe(contract.sha256(JSON.stringify(envelope.inputs)))
    const encoded = capture.readSeoInputs(file, identity)
    expect(encoded).toEqual(envelope.inputs)
    expect(capture.materializeTravelDetails(encoded, identity)).toEqual(input.travelDetails)
    expect(encoded.rawTravelDetails[0][1].rich_text).toEqual(completeRawDetail().rich_text)
    expect(Object.keys(capture.materializeTravelDetails(encoded, identity)[0][1])).toHaveLength(26)
    expect(encoded.travelDetails).toEqual(envelope.inputs.travelDetails) // Materialization does not mutate media readers' view.
  })
  it('reports exact UTF-8 section, payload and envelope bytes without content', () => {
    const input = withTravelDetails()
    capture.writeSeoInputs(file, identity, input)
    const logged = (console.log as jest.Mock).mock.calls.find(([line]) => line.startsWith('SEO inputs bytes: '))[0]
    const sizes = JSON.parse(logged.slice('SEO inputs bytes: '.length))
    const bytes = fs.readFileSync(file), envelope = JSON.parse(bytes.toString('utf8'))
    expect(sizes.limit_bytes).toBe(128 * 1024 ** 2)
    expect(sizes.payload_bytes).toBe(Buffer.byteLength(JSON.stringify(envelope.inputs)))
    expect(sizes.capture_bytes).toBe(bytes.length)
    expect(sizes.raw_ref_count).toBe(1)
    expect(sizes.inline_count).toBe(0)
    expect(Object.keys(sizes.section_bytes).sort()).toEqual(Object.keys(input).sort())
    for (const [key, value] of Object.entries(envelope.inputs)) {
      expect(sizes.section_bytes[key]).toBe(Buffer.byteLength(JSON.stringify({ [key]: value })) - 2)
    }
    expect(Object.values(sizes.section_bytes).reduce((sum: number, count: any) => sum + count, 9)).toBe(sizes.payload_bytes)
    expect(logged).not.toContain('тело статьи')
  })
  it('refuses a normalized/raw mismatch without falling back to a duplicated inline detail', () => {
    const input = withTravelDetails()
    ;(input.travelDetails[0][1] as any).recommendation = '<p>different</p>'
    expect(() => capture.writeSeoInputs(file, identity, input)).toThrow(/normalized travel detail mismatch/)
    expect(fs.readdirSync(root)).toEqual([])
  })
  it.each(['missing', 'foreign', 'query', 'hash', 'id-mismatch', 'extra', 'empty', 'bad-type', 'inline-with-raw', 'duplicate-detail', 'duplicate-raw'])('rejects %s references even with a recomputed payload hash', mode => {
    capture.writeSeoInputs(file, identity, withTravelDetails())
    const envelope = JSON.parse(fs.readFileSync(file, 'utf8')), inputs = envelope.inputs
    const descriptor = inputs.travelDetails[0][1]
    if (mode === 'missing') inputs.rawTravelDetails = []
    if (mode === 'foreign') descriptor.raw_url = 'https://other.invalid/api/travels/116/'
    if (mode === 'query') descriptor.raw_url += '?fresh=1'
    if (mode === 'hash') descriptor.raw_url += '#detail'
    if (mode === 'id-mismatch') inputs.travelDetails[0][0] = 117
    if (mode === 'extra') descriptor.inline = normalizeTravelDetail(completeRawDetail())
    if (mode === 'empty') inputs.travelDetails[0][1] = {}
    if (mode === 'bad-type') descriptor.raw_url = 116
    if (mode === 'inline-with-raw') inputs.travelDetails[0][1] = { inline: normalizeTravelDetail(completeRawDetail()) }
    if (mode === 'duplicate-detail') inputs.travelDetails.push(inputs.travelDetails[0])
    if (mode === 'duplicate-raw') inputs.rawTravelDetails.push(inputs.rawTravelDetails[0])
    envelope.payload_sha256 = contract.sha256(JSON.stringify(inputs))
    fs.writeFileSync(file, JSON.stringify(envelope))
    expect(() => capture.readSeoInputs(file, identity)).toThrow()
    expect(() => capture.materializeTravelDetails(inputs, identity)).toThrow()
  })
  it('does not publish or retain a partial file after a write failure', () => {
    jest.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => { throw new Error('disk full') })
    expect(() => capture.writeSeoInputs(file, identity, payload())).toThrow('disk full')
    expect(fs.readdirSync(root)).toEqual([])
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
  it.each(['invalid-200', 'http-failure'])('keeps accepted slug fallback inline after %s and leaves numeric audit requests paced', async mode => {
    const raw = completeRawDetail(), numeric = `${identity.api_origin}/api/travels/116/`
    const data = await collectSeoInputs({ apiBase: identity.api_origin, candidate: true, publicationMode: 'translations',
      pace: async () => {}, readReceipt: () => receipt(), fetchJson: async (url: string) => {
        const parsed = new URL(url)
        if (parsed.pathname === '/api/quests/') return [quest]
        if (parsed.pathname.startsWith('/api/quests/by-quest-id/')) return bundle(parsed.searchParams.get('lang') || 'ru')
        if (parsed.pathname === '/api/travels/') return [{ id: raw.id, slug: 'fixture' }]
        if (url === numeric) { if (mode === 'http-failure') throw new Error('HTTP 503'); return ['invalid'] }
        if (parsed.pathname === '/api/travels/by-slug/fixture/') return raw
        if (parsed.pathname === '/api/') return { articles: '/api/articles/' }
        if (parsed.pathname === '/api/articles/') return [{ id: 42 }]
        throw new Error(`Unexpected fixture URL ${url}`)
      } })
    expect(Object.keys(data).sort()).toEqual(Object.keys(payload()).sort())
    expect(data.travelDetails).toEqual([[116, normalizeTravelDetail(raw)]])
    expect(data.rawTravelDetails).toEqual([])
    capture.writeSeoInputs(file, identity, data)
    const encoded = capture.readSeoInputs(file, identity)
    expect(encoded.travelDetails).toEqual([[116, { inline: normalizeTravelDetail(raw) }]])
    expect(capture.materializeTravelDetails(encoded, identity)).toEqual(data.travelDetails)
    const pace = jest.fn(async () => {}), fetchJson = jest.fn(async () => raw)
    const read = require('../../scripts/lib/capturedTravelDetails').createCapturedTravelReader({ file, identity, pace, fetchJson })
    expect(await read(numeric)).toEqual(raw)
    expect(pace).toHaveBeenCalledTimes(1)
    expect(fetchJson).toHaveBeenCalledWith(numeric, undefined)
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
    const input = withTravelDetails(), fallback = completeRawDetail(117)
    input.travels.push({ id: 117, slug: 'slug-fallback', name: 'Поездка с запасным адресом' } as never)
    input.travelDetails.push([117, normalizeTravelDetail(fallback)] as never)
    const receiptPath = path.join(root, 'receipt.cjs')
    fs.writeFileSync(receiptPath, `process.stdout.write(${JSON.stringify(JSON.stringify(receipt()))})`)
    const preload = path.join(root, 'producer.cjs')
    fs.writeFileSync(preload, `
const input=${JSON.stringify(input)};
const fallback=${JSON.stringify(fallback)};
const f=require(${JSON.stringify(path.resolve('scripts/lib/fetchJson.js'))});
f.fetchJsonOnce=f.fetchJson=async url=>{
 if(process.env.FORBID_NETWORK==='1') throw Error('HTTP must not occur while rendering');
 const u=new URL(url);
 if(u.pathname==='/api/quests/')return input.quests;
 if(u.pathname.startsWith('/api/quests/by-quest-id/'))return u.searchParams.has('lang')?new Map(input.localizedBundles).get(u.searchParams.get('lang')+'/'+input.quests[0].quest_id):input.questBundles[0][1];
 if(u.pathname==='/api/travels/')return input.travels;
 if(u.pathname==='/api/travels/116/')return input.rawTravelDetails[0][1];
 if(u.pathname==='/api/travels/117/')return ['invalid numeric response'];
 if(u.pathname==='/api/travels/by-slug/slug-fallback/')return fallback;
 if(u.pathname==='/api/')return {articles:'/api/articles/'};
 if(u.pathname==='/api/articles/')return input.articles;
 throw Error('Unexpected fixture URL '+url);
};`)
    const online = path.join(root, 'online'), offline = path.join(root, 'offline')
    for (const dist of [online, offline]) {
      fs.mkdirSync(path.join(dist, 'quests/country'), { recursive: true })
      // An export ships its web chunks; translated members boot with them (#2465).
      const webJs = path.join(dist, '_expo/static/js/web')
      fs.mkdirSync(webJs, { recursive: true })
      for (const chunk of ['entry-0a.js', '[...missing]-0a.js', 'locale-be-0a.js', 'locale-uk-0a.js', 'locale-pl-0a.js', 'locale-en-0a.js']) {
        fs.writeFileSync(path.join(webJs, chunk), '__d(function(){},0,[]);')
      }
      fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Fixture</title><script src="/_expo/static/js/web/entry-0a.js" defer></script></head><body><div id="root"></div></body></html>')
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
    const encoded = capture.readSeoInputs(file, identity)
    expect(encoded.travelDetails).toEqual([[116, { raw_url: `${identity.api_origin}/api/travels/116/` }], [117, { inline: normalizeTravelDetail(fallback) }]])
    const second = runCli(process.execPath, ['--require', preload, generator, '--dist', offline, '--quest-seo-candidate', path.join(root, 'offline-candidate.json'), ...options,
      '--quest-seo-inputs', file, '--quest-seo-input-nonce', identity.nonce, '--frontend-sha', identity.frontend_sha], { env: { FORBID_NETWORK: '1' }, timeoutMs: 20000 })
    if (second.status !== 0) throw new Error(second.stderr + second.stdout)
    expect(second.status).toBe(0)
    function tree(dir: string, prefix = ''): Record<string, string> {
      return Object.assign({}, ...fs.readdirSync(dir).map(name => fs.statSync(path.join(dir, name)).isDirectory()
        ? tree(path.join(dir, name), prefix + name + '/') : { [prefix + name]: fs.readFileSync(path.join(dir, name), 'utf8') }))
    }
    expect(tree(offline)).toEqual(tree(online))
    expect(fs.readFileSync(path.join(offline, 'travels/fixture.html'), 'utf8')).toContain('тело статьи')
    expect(fs.readFileSync(path.join(offline, 'travels/slug-fallback.html'), 'utf8')).toContain('тело статьи')
    expect(fs.readFileSync(path.join(offline, 'pl/quests/4/minsk-fixture.html'), 'utf8')).toContain('<script src="/_expo/static/js/web/[...missing]-0a.js" defer></script>')
    expect(JSON.parse(fs.readFileSync(path.join(root, 'offline-candidate.json'), 'utf8'))).toEqual(JSON.parse(fs.readFileSync(path.join(root, 'online-candidate.json'), 'utf8')))
  })
  it('removes the large-body duplicate under the fixed 128 MiB limit and reports refusal before full serialization', () => {
    const script = `
const fs=require('fs'),path=require('path'),assert=require('assert');
const capture=require(${JSON.stringify(path.resolve('scripts/lib/seoInputsCapture.js'))});
const {normalizeTravelDetail}=require(${JSON.stringify(path.resolve('scripts/lib/travelDetail.js'))});
const {sha256}=require(${JSON.stringify(path.resolve('scripts/lib/questSeoContract.js'))});
const input=${JSON.stringify(payload())}, identity=${JSON.stringify(identity)};
const body='<p>'+('body & media '.repeat(Math.ceil(70*1024**2/13))).slice(0,70*1024**2)+'</p>';
const raw={id:116,description:body,rich_text:{recommendation:{safe_html:'audit-only'}}};
input.travels=[{id:116,slug:'large',name:'Large fixture'}];
input.travelDetails=[[116,normalizeTravelDetail(raw)]];
input.rawTravelDetails=[[identity.api_origin+'/api/travels/116/',raw]];
const legacyBytes=Object.entries(input).reduce((sum,[key,value])=>sum+Buffer.byteLength(JSON.stringify(key))+1+Buffer.byteLength(JSON.stringify(value)),9);
assert.equal(capture.MAX_INPUT_BYTES,128*1024**2);
assert(legacyBytes>capture.MAX_INPUT_BYTES);
let fullSerializations=0, diagnostic;
const stringify=JSON.stringify;
JSON.stringify=function(value,...rest){if(value&&value.travelDetails&&value.rawTravelDetails)fullSerializations++;return stringify(value,...rest)};
console.log=line=>{if(line.startsWith('SEO inputs bytes: '))diagnostic=JSON.parse(line.slice('SEO inputs bytes: '.length))};
capture.writeSeoInputs(process.argv[1],identity,input);
assert.equal(fullSerializations,1);
const size=fs.statSync(process.argv[1]).size;
assert.equal(diagnostic.capture_bytes,size);
assert(size<capture.MAX_INPUT_BYTES-8192);
const encoded=capture.readSeoInputs(process.argv[1],identity);
assert.deepStrictEqual(encoded.travelDetails,[[116,{raw_url:identity.api_origin+'/api/travels/116/'}]]);
const detail=capture.materializeTravelDetails(encoded,identity)[0][1];
assert.equal(sha256(detail.description),sha256(body));
assert.deepStrictEqual(encoded.rawTravelDetails[0][1].rich_text,raw.rich_text);
const before=fullSerializations;
raw.extra_raw_body=body;
assert.throws(()=>capture.writeSeoInputs(process.argv[1]+'.oversize',identity,input),/payload exceeds bound/);
assert.equal(fullSerializations,before);
assert(diagnostic.payload_bytes>capture.MAX_INPUT_BYTES);
assert.equal(diagnostic.limit_bytes,128*1024**2);
assert.equal(diagnostic.raw_ref_count,1);
assert.equal(diagnostic.inline_count,0);
assert(!fs.existsSync(process.argv[1]+'.oversize'));
assert(!fs.existsSync(process.argv[1]+'.oversize.partial'));
process.stdout.write(stringify({legacy_bytes:legacyBytes,capture_bytes:size,limit_bytes:capture.MAX_INPUT_BYTES}));`
    const result = runCli(process.execPath, ['-e', script, file], { timeoutMs: 30000 })
    if (result.status !== 0) throw new Error(result.stderr + result.stdout)
    expect(result.status).toBe(0)
    const sizes = JSON.parse(result.stdout)
    expect(sizes.legacy_bytes).toBeGreaterThan(128 * 1024 ** 2)
    expect(sizes.capture_bytes).toBeLessThan(128 * 1024 ** 2 - 8192)
    expect(sizes.limit_bytes).toBe(128 * 1024 ** 2)
  }, 35000)
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
