/** @jest-environment node */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { preparePlanningStep } from '@/workers/book-renderer/planningStep'
import { readFieldSourceFeed } from '@/workers/book-renderer/planningSource'
import { PlanningStorage } from '@/workers/book-renderer/planningStorage'
import { advanceTravelMetadata, startTravelMetadata } from '@/workers/book-renderer/planningTravel'
import { canonicalJson } from '@/workers/book-renderer/filesystem'
import { indexSnapshot } from '@/workers/book-renderer/snapshot'
import { pinnedTravel } from '@/workers/book-renderer/planner'
import type { PlanningFile } from '@/workers/book-renderer/planningTypes'
import { buildSnapshotFixture } from '../../fixtures/pdfBook/buildSnapshotFixture'

const LIMITS = { input_bytes: 65_536, output_bytes: 2_097_152, output_records: 24, probes: 1 }
const PIN = 'd'.repeat(64)
describe('bounded original UTF8 feeds and chapter metadata', () => {
  let scratch: string
  beforeEach(async () => {
    const root = path.resolve(__dirname, '../../../.codex-temp/tests')
    await mkdir(root, { recursive: true }); scratch = await mkdtemp(path.join(root, 'book-planning-source-'))
  })
  afterEach(async () => { await rm(scratch, { recursive: true, force: true }) })

  async function fixture(text: string, window = 11) {
    const f = await buildSnapshotFixture(path.join(scratch, 'input'), { travels: [{ id: 41, title: 'Ультрафиолет 😀', description: text, photos: 2, points: 2 }], durableTextWindow: window })
    const out = path.join(scratch, 'plan')
    let checkpoint: PlanningFile | undefined
    let generation = 0
    while (true) {
      const result = await preparePlanningStep(f.jobDir, out, f.document, { renderer_content_hash: PIN, generation: ++generation, checkpoint })
      checkpoint = result.checkpoint
      if (result.phase === 'indexed') break
    }
    return { f, out }
  }

  it('restores at every feed across one-byte UTF8 splits, preserving original B1 codepoint windows', async () => {
    const text = '\ufeff' + '<p>\ufeffёлка😀𐐀 € &amp;\ufeff</p>'.repeat(80)
    const { f, out } = await fixture(text, 17)
    const metadata = await startTravelMetadata(new PlanningStorage(out, LIMITS), f.document, f.manifest.length, 41)
    for (const bytes of [1, 17, 257, 65_536]) {
      let previous: unknown
      let actual = ''
      let done = false
      let calls = 0
      while (!done) {
        const feed = await readFieldSourceFeed(f.jobDir, new PlanningStorage(out, LIMITS), f.document, f.manifest.length, 41,
          'description', metadata.counts.fields.description ?? 0, previous, bytes)
        expect(feed.text.length).toBeLessThanOrEqual(256)
        expect(feed.read_bytes).toBeLessThanOrEqual(Math.min(255, bytes))
        expect(Buffer.from(feed.cursor.utf8_carry_base64, 'base64').length).toBeLessThanOrEqual(3)
        actual += feed.text; previous = JSON.parse(JSON.stringify(feed.cursor)) as unknown; done = feed.eof
        if (feed.eof) expect(feed.cursor.next_character_offset).toBe(Array.from(text).length + 1)
        expect(++calls).toBeLessThan(20_000)
      }
      expect(actual).toBe(text)
    }
  }, 60_000)

  it('produces the existing pinned chapter metadata using one related record per call', async () => {
    const { f, out } = await fixture('<p>Book</p>')
    const old = path.join(scratch, 'old')
    await mkdir(path.join(old, 'expected-occurrences'), { recursive: true, mode: 0o700 })
    await indexSnapshot(f.jobDir, old, f.document)
    let cursor = await startTravelMetadata(new PlanningStorage(out, LIMITS), f.document, f.manifest.length, 41)
    let calls = 0
    while (!cursor.complete) {
      const next = await advanceTravelMetadata(new PlanningStorage(out, LIMITS), f.document, f.manifest.length, cursor)
      cursor = JSON.parse(JSON.stringify(next.cursor)) as typeof cursor
      expect(++calls).toBeLessThan(100)
    }
    expect(cursor.travel).toEqual(JSON.parse(JSON.stringify(await pinnedTravel(old, 41))))
    expect(JSON.parse(await readFile(path.join(out, 'metadata', '41.json'), 'utf8'))).toEqual(cursor.travel)
  })

  it('rejects future descriptors and valid-UTF8 mutations before a verified window finishes', async () => {
    const { f, out } = await fixture('<p>abc😀</p>')
    const metadata = await startTravelMetadata(new PlanningStorage(out, LIMITS), f.document, f.manifest.length, 41)
    const count = metadata.counts.fields.description ?? 0
    await expect(readFieldSourceFeed(f.jobDir, new PlanningStorage(out, LIMITS), f.document, 0, 41, 'description', count)).rejects.toThrow('WORKER_PLANNING_PREFIX_MISMATCH')
    const row = f.manifest.find(chunk => chunk.kind === 'text' && chunk.metadata.field === 'description')!
    const bytes = await readFile(path.join(f.jobDir, row.file_ref)); bytes[1] = 'x'.charCodeAt(0)
    await writeFile(path.join(f.jobDir, row.file_ref), bytes)
    await expect(readFieldSourceFeed(f.jobDir, new PlanningStorage(out, LIMITS), f.document, f.manifest.length, 41, 'description', count)).rejects.toThrow('SNAPSHOT_INTEGRITY_FAILED')
  })

  it('rejects incomplete durable fields rather than treating a paused prefix as actual EOF', async () => {
    const { f, out } = await fixture('short', 31)
    const ref = path.join(out, 'index', 'travel', '41', 'fields', 'description', '0.json')
    const row = JSON.parse(await readFile(ref, 'utf8')) as { metadata: { field_end: boolean } }
    row.metadata.field_end = false
    await writeFile(ref, canonicalJson(row), { mode: 0o600 })
    await expect(readFieldSourceFeed(f.jobDir, new PlanningStorage(out, LIMITS), f.document, f.manifest.length, 41, 'description', 1)).rejects.toThrow('SNAPSHOT_TEXT_FIELD_INCOMPLETE')
  })
})
