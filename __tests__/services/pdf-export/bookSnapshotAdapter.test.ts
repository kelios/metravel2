/** @jest-environment node */
import {
  assertBookDocument,
  BookSnapshotContractError,
  iterateSnapshotChunks,
  iterateTextFieldRefs,
  streamSnapshotChunk,
  toBookPlanEntry,
} from '@/services/pdf-export/segments/snapshotAdapter'
import type { BookSnapshotReader } from '@/services/pdf-export/segments/snapshotAdapter'
import {
  BOOK_RENDERER_VERSION,
  BOOK_SNAPSHOT_READ_BYTES,
  BOOK_SNAPSHOT_TEXT_CHARACTERS,
} from '@/types/bookDocument'
import type {
  BookDocument,
  BookMediaChunk,
  BookSnapshotChunk,
  BookSnapshotManifestPage,
  BookTextChunk,
} from '@/types/bookDocument'
import { DEFAULT_BOOK_SETTINGS, toBookSettingsDto } from '@/types/bookSettings'

const documentHeader: BookDocument = {
  schema_version: 1,
  contract_version: 2,
  settings_version: 1,
  snapshot_id: '01234567-89ab-4cde-8123-456789abcdef',
  snapshot_hash: 'a'.repeat(64),
  selection_hash: 'b'.repeat(64),
  settings_hash: 'c'.repeat(64),
  renderer_version: BOOK_RENDERER_VERSION,
  seed: 'pinned-job-seed',
  generated_at: '2026-10-09T12:00:00.000Z',
  settings: toBookSettingsDto(DEFAULT_BOOK_SETTINGS, 'PL'),
  entitlement: { premium: true, policy_version: 1 },
}

function textChunk(position: number, offset = 1, travelId = 17): BookTextChunk {
  const checksum = 'd'.repeat(64)
  return {
    position,
    travel_id: travelId,
    kind: 'text',
    source_key: `description:${offset}`,
    occurrence_key: '',
    file_ref: `${documentHeader.snapshot_id}/${checksum}`,
    checksum,
    size_bytes: 7,
    metadata: { field: 'description', offset },
  }
}

function mediaChunk(position: number, role = 'gallery'): BookMediaChunk {
  const checksum = 'e'.repeat(64)
  return {
    position,
    travel_id: 17,
    kind: 'media',
    source_key: `${role}:${position + 1}`,
    occurrence_key: `17:${role}:${position + 1}`,
    file_ref: `${documentHeader.snapshot_id}/${checksum}`,
    checksum,
    size_bytes: 9_000_000,
    metadata: { role, resource_key: 'uploads/shared.webp', version: checksum },
  }
}

function page(chunks: BookSnapshotChunk[], hasMore = false, after = -1): BookSnapshotManifestPage {
  return {
    snapshot_id: documentHeader.snapshot_id,
    snapshot_hash: documentHeader.snapshot_hash,
    selection_hash: documentHeader.selection_hash,
    settings_hash: documentHeader.settings_hash,
    chunks,
    has_more: hasMore,
    next_position: chunks.at(-1)?.position ?? after,
  }
}

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = []
  for await (const item of source) result.push(item)
  return result
}

function pagedReader(pages: unknown[]): Pick<BookSnapshotReader, 'manifestPage'> {
  let index = 0
  return { manifestPage: jest.fn(async () => pages[index++]) }
}

describe('B1 frozen book snapshot adapter', () => {
  it.each(['../../outside', 'unknown-role'])('rejects unrecognized media roles before yielding %s', async (role) => {
    await expect(collect(iterateSnapshotChunks(documentHeader, pagedReader([page([mediaChunk(0, role)])]))))
      .rejects.toMatchObject({ code: 'SNAPSHOT_INTEGRITY_FAILED' })
  })
  it('rejects a durable source reference in another job namespace', async () => {
    const chunk = { ...mediaChunk(0), file_ref: `11111111-1111-4111-8111-111111111111/attempt-1/${mediaChunk(0).checksum}` }
    await expect(collect(iterateSnapshotChunks(documentHeader, pagedReader([page([chunk])]))))
      .rejects.toMatchObject({ code: 'SNAPSHOT_INTEGRITY_FAILED' })
  })
  it('pulls one bounded page at a time and preserves server order across pages', async () => {
    const first = textChunk(0, 1, 90)
    const second = textChunk(1, 1, 12)
    const reader = pagedReader([page([first], true), page([second])])
    const iterator = iterateSnapshotChunks(documentHeader, reader, { page_size: 1 })
    expect(reader.manifestPage).not.toHaveBeenCalled()
    expect((await iterator.next()).value).toBe(first)
    expect(reader.manifestPage).toHaveBeenCalledTimes(1)
    expect((await iterator.next()).value).toBe(second)
    expect(reader.manifestPage).toHaveBeenNthCalledWith(2, { after_position: 0, limit: 1 })
    expect((await iterator.next()).done).toBe(true)
  })

  it('does not read ahead when a segment consumer stops', async () => {
    const reader = pagedReader([page([textChunk(0)], true), page([textChunk(1)])])
    const iterator = iterateSnapshotChunks(documentHeader, reader, { page_size: 1 })
    await iterator.next()
    await iterator.return(undefined)
    expect(reader.manifestPage).toHaveBeenCalledTimes(1)
  })

  it.each(['snapshot_id', 'snapshot_hash', 'selection_hash', 'settings_hash'] as const)(
    'fails when a manifest page changes pinned %s', async (field) => {
      const changed = { ...page([textChunk(1)]), [field]: 'f'.repeat(64) }
      const reader = pagedReader([page([textChunk(0)], true), changed])
      await expect(collect(iterateSnapshotChunks(documentHeader, reader))).rejects.toMatchObject({
        code: 'SNAPSHOT_INTEGRITY_FAILED',
      })
    },
  )

  it.each([
    [textChunk(0), textChunk(0)],
    [textChunk(1)],
    [textChunk(0), textChunk(2)],
  ])('rejects duplicate, missing and nonzero-first positions before yielding the page', async (...chunks) => {
    const reader = pagedReader([page(chunks)])
    await expect(iterateSnapshotChunks(documentHeader, reader).next()).rejects.toMatchObject({
      code: 'SNAPSHOT_INTEGRITY_FAILED',
    })
  })

  it('rejects a stalled or dishonest pagination cursor', async () => {
    for (const invalidPage of [page([], true), { ...page([textChunk(0)], true), next_position: 19 }]) {
      await expect(collect(iterateSnapshotChunks(documentHeader, pagedReader([invalidPage]))))
        .rejects.toMatchObject({ code: 'SNAPSHOT_INTEGRITY_FAILED' })
    }
  })

  it('enforces the requested page budget and the B1 maximum of 100 rows', async () => {
    await expect(collect(iterateSnapshotChunks(documentHeader, pagedReader([page([textChunk(0), textChunk(1)])]), {
      page_size: 1,
    }))).rejects.toMatchObject({ code: 'SNAPSHOT_RESOURCE_BUDGET_EXCEEDED' })
    const reader = pagedReader([])
    for (const pageSize of [0, 101, 1.5]) {
      await expect(collect(iterateSnapshotChunks(documentHeader, reader, { page_size: pageSize })))
        .rejects.toMatchObject({ code: 'SNAPSHOT_CONTRACT_INVALID' })
    }
    expect(reader.manifestPage).not.toHaveBeenCalled()
  })

  it('rejects a changed private source/checksum reference', async () => {
    const changed = { ...textChunk(0), file_ref: 'https://example.com/mutable-image.webp' }
    await expect(collect(iterateSnapshotChunks(documentHeader, pagedReader([page([changed])]))))
      .rejects.toMatchObject({ code: 'SNAPSHOT_INTEGRITY_FAILED' })
  })

  it('enforces source/text byte budgets without capping streamed media originals', async () => {
    const hugeText = { ...textChunk(0), size_bytes: BOOK_SNAPSHOT_READ_BYTES + 1 }
    await expect(collect(iterateSnapshotChunks(documentHeader, pagedReader([page([hugeText])]))))
      .rejects.toMatchObject({ code: 'SNAPSHOT_RESOURCE_BUDGET_EXCEEDED' })
    await expect(collect(iterateSnapshotChunks(documentHeader, pagedReader([page([textChunk(0)])]), {
      max_source_chunk_bytes: 6,
    }))).rejects.toMatchObject({ code: 'SNAPSHOT_RESOURCE_BUDGET_EXCEEDED' })
    const media = mediaChunk(0)
    expect(await collect(iterateSnapshotChunks(documentHeader, pagedReader([page([media])])))).toEqual([media])
  })

  it('retains repeated placements while sharing the immutable resource reference', async () => {
    const cover = mediaChunk(0, 'cover')
    const inline = mediaChunk(1, 'inline')
    const gallery = mediaChunk(2)
    const entries = (await collect(iterateSnapshotChunks(documentHeader, pagedReader([page([cover, inline, gallery])]))))
      .map(toBookPlanEntry)
    expect(new Set(entries.map((entry) => entry.source_ref)).size).toBe(1)
    expect(new Set(entries.map((entry) => entry.resource_key)).size).toBe(1)
    expect(new Set(entries.map((entry) => entry.occurrence_key)).size).toBe(3)
    expect(new Set(entries.map((entry) => entry.block_key)).size).toBe(3)
    expect(entries.map((entry) => entry.order)).toEqual([0, 1, 2])
  })

  it('rejects media without placement/version identity or with a wrong linked travel identity', async () => {
    const original = mediaChunk(0)
    const variants = [
      { ...original, occurrence_key: '' },
      { ...original, metadata: { ...original.metadata, version: 'f'.repeat(64) } },
      { ...original, metadata: { ...original.metadata, linked_travel_id: 0 } },
    ]
    for (const variant of variants) {
      await expect(collect(iterateSnapshotChunks(documentHeader, pagedReader([page([variant])]))))
        .rejects.toMatchObject({ code: 'SNAPSHOT_INTEGRITY_FAILED' })
    }
  })

  it('preserves pinned author/YouTube and route-category records without re-sorting or rebuilding URLs', async () => {
    const ref = textChunk(0)
    const travel: BookSnapshotChunk = {
      ...ref, kind: 'travel', source_key: 'travel:17', metadata: {
        id: 17, name: 'Pinned title', slug: 'pinned-slug', year: 2012,
        image: 'uploads/pinned.webp', created_at: '2026-10-09T12:00:00Z',
        number_days: 2, number_peoples: 1, budget: 10,
        youtube_link: 'https://www.youtube.com/watch?v=pinned', travel_revision: 'f'.repeat(64),
      },
    }
    const author: BookSnapshotChunk = {
      ...ref, position: 1, kind: 'author', source_key: 'author:8', metadata: { id: 8, name: 'Pinned author' },
    }
    const category: BookSnapshotChunk = {
      ...ref, position: 2, kind: 'route-category', source_key: 'route:4:category:5',
      metadata: { id: 5, name: 'Pinned category', route_id: 4 },
    }
    expect(await collect(iterateSnapshotChunks(documentHeader, pagedReader([page([travel, author, category])]))))
      .toEqual([travel, author, category])
  })

  it('retains legitimate nullable B1 records but rejects missing or wrong source metadata types', async () => {
    const ref = textChunk(0)
    const country: BookSnapshotChunk = {
      ...ref, kind: 'country', source_key: 'country:2', metadata: {
        country_id: 2, title_ru: null, title_en: null, country_code: null,
      },
    }
    expect(await collect(iterateSnapshotChunks(documentHeader, pagedReader([page([country])])))).toEqual([country])
    for (const invalid of [
      { ...country, metadata: {} },
      { ...country, metadata: { ...country.metadata, country_id: '2' } },
      { ...country, kind: 'author', metadata: { id: 2, name: null } },
    ]) {
      await expect(collect(iterateSnapshotChunks(documentHeader, pagedReader([{
        ...page([]), chunks: [invalid], next_position: 0,
      }])))).rejects.toMatchObject({ code: 'SNAPSHOT_CONTRACT_INVALID' })
    }
  })

  it('streams only the selected field refs in exact one-based B1 character order', async () => {
    const expected = [textChunk(0), textChunk(3, BOOK_SNAPSHOT_TEXT_CHARACTERS + 1)]
    async function* refs() {
      yield expected[0]
      yield mediaChunk(1)
      yield { ...textChunk(2), metadata: { field: 'plus', offset: 1 }, source_key: 'plus:1' } as BookTextChunk
      yield expected[1]
      yield textChunk(4, 1, 23)
    }
    expect(await collect(iterateTextFieldRefs(refs(), 17, 'description'))).toEqual(expected)
  })

  it.each([0, 2, BOOK_SNAPSHOT_TEXT_CHARACTERS + 2])('rejects missing or wrong initial text offset %s', async (offset) => {
    async function* refs() { yield textChunk(0, offset) }
    await expect(collect(iterateTextFieldRefs(refs(), 17, 'description'))).rejects.toMatchObject({
      code: 'SNAPSHOT_INTEGRITY_FAILED',
    })
  })

  it('rejects invalid text metadata and unknown source kinds in the bounded manifest', async () => {
    const original = textChunk(0)
    for (const invalid of [
      { ...original, kind: 'unexpected' },
      { ...original, metadata: { field: 'description', offset: 0 } },
      { ...original, metadata: { field: 'unexpected', offset: 1 } },
      { ...original, source_key: 'description:16385' },
    ]) {
      await expect(collect(iterateSnapshotChunks(documentHeader, pagedReader([{
        ...page([]), chunks: [invalid], next_position: 0,
      }])))).rejects.toMatchObject({ code: 'SNAPSHOT_CONTRACT_INVALID' })
    }
  })

  it('pins renderer version and generated clock instead of accepting current process values', () => {
    expect(() => assertBookDocument(documentHeader)).not.toThrow()
    for (const changes of [
      { renderer_version: 'unavailable' },
      { renderer_version: 'metravel-book-renderer/2.0.0' },
      { generated_at: '' },
      { generated_at: 'not-an-ISO-date' },
      { generated_at: '2026-10-09T12:00:00' },
      { seed: '' },
      { snapshot_hash: 'not-a-hash' },
    ]) {
      expect(() => assertBookDocument({ ...documentHeader, ...changes })).toThrow(BookSnapshotContractError)
    }
  })
})

describe('verified bounded source-byte delivery', () => {
  it('verifies before opening bytes and forwards parts without copying or concatenation', async () => {
    const parts = [new Uint8Array([1, 2]), new Uint8Array([3, 4, 5, 6, 7])]
    const events: string[] = []
    const reader = {
      verifyChunk: jest.fn(async () => { events.push('verified') }),
      async *readChunk() { events.push('opened'); yield* parts },
    }
    const delivered = await collect(streamSnapshotChunk(reader, textChunk(0)))
    expect(events).toEqual(['verified', 'opened'])
    expect(delivered[0]).toBe(parts[0])
    expect(delivered[1]).toBe(parts[1])
  })

  it('does not expose bytes when checksum/access verification fails', async () => {
    const reader = {
      verifyChunk: jest.fn(async () => { throw new Error('Checksum mismatch') }),
      readChunk: jest.fn(async function* () { yield new Uint8Array(7) }),
    }
    await expect(collect(streamSnapshotChunk(reader, textChunk(0)))).rejects.toThrow('Checksum mismatch')
    expect(reader.readChunk).not.toHaveBeenCalled()
  })

  it.each([6, 8])('rejects delivered byte size %s when the pinned size is 7', async (bytes) => {
    const reader = { verifyChunk: async () => {}, async *readChunk() { yield new Uint8Array(bytes) } }
    await expect(collect(streamSnapshotChunk(reader, textChunk(0)))).rejects.toMatchObject({
      code: 'SNAPSHOT_INTEGRITY_FAILED',
    })
  })

  it('rejects oversized read parts and supports media exceeding a text-window byte limit', async () => {
    const tooLargeReader = {
      verifyChunk: async () => {}, async *readChunk() { yield new Uint8Array(BOOK_SNAPSHOT_READ_BYTES + 1) },
    }
    const media = { ...mediaChunk(0), size_bytes: BOOK_SNAPSHOT_READ_BYTES * 2 + 1 }
    await expect(collect(streamSnapshotChunk(tooLargeReader, media))).rejects.toMatchObject({
      code: 'SNAPSHOT_RESOURCE_BUDGET_EXCEEDED',
    })
    const boundedReader = {
      verifyChunk: async () => {}, async *readChunk() {
        yield new Uint8Array(BOOK_SNAPSHOT_READ_BYTES)
        yield new Uint8Array(BOOK_SNAPSHOT_READ_BYTES)
        yield new Uint8Array(1)
      },
    }
    expect((await collect(streamSnapshotChunk(boundedReader, media))).map((part) => part.byteLength))
      .toEqual([BOOK_SNAPSHOT_READ_BYTES, BOOK_SNAPSHOT_READ_BYTES, 1])
  })

  it('rejects empty reader parts instead of accepting a non-advancing read', async () => {
    const reader = { verifyChunk: async () => {}, async *readChunk() { yield new Uint8Array(0) } }
    await expect(collect(streamSnapshotChunk(reader, textChunk(0)))).rejects.toMatchObject({
      code: 'SNAPSHOT_CONTRACT_INVALID',
    })
  })
})
