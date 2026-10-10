import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readRecordWindow, type RecordCursor } from '../../../workers/book-renderer/recordCursor'

describe('durable bounded NDJSON cursor', () => {
  let root: string
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'book-record-cursor-')) })
  afterEach(async () => { await rm(root, { recursive: true, force: true }) })

  it.each([1, 17, 257, 65_536])('resumes through UTF8 and newlines with a %i-byte window', async bytes => {
    const expected = [{ title: 'Люксембург 🥾' }, { text: 'é\nтаблица' }, { id: 3 }]
    await writeFile(join(root, 'rows.ndjson'), expected.map(value => JSON.stringify(value)).join('\n'))
    const rows: unknown[] = []
    let cursor: RecordCursor | undefined
    let done = false
    let total = 0
    while (!done) {
      const next = await readRecordWindow(root, 'rows.ndjson', cursor, { bytes, records: 1 })
      expect(next.read_bytes).toBeLessThanOrEqual(bytes)
      rows.push(...next.rows)
      // JSON roundtrip models a process restart, not a kept iterator/decoder.
      cursor = JSON.parse(JSON.stringify(next.cursor)) as RecordCursor
      total += next.read_bytes
      done = next.done
    }
    expect(rows).toEqual(expected)
    expect(total).toBe(Buffer.byteLength(expected.map(value => JSON.stringify(value)).join('\n')))
    expect(cursor?.records).toBe(3)
  })

  it('bounds rows already read and skips empty lines without an unbounded loop', async () => {
    await writeFile(join(root, 'rows.ndjson'), '\n\n1\n2\n3\n')
    const first = await readRecordWindow<number>(root, 'rows.ndjson', undefined, { records: 1 })
    expect(first.rows).toEqual([])
    expect(first.done).toBe(false)
    let cursor = first.cursor
    const rows: number[] = []
    for (let index = 0; index < 4; index++) {
      const next = await readRecordWindow<number>(root, 'rows.ndjson', cursor, { records: 1 })
      expect(next.read_bytes).toBe(0)
      rows.push(...next.rows)
      cursor = next.cursor
    }
    expect(rows).toEqual([1, 2, 3])
  })

  it('rejects changed length and cursor forgery before resuming', async () => {
    await writeFile(join(root, 'rows.ndjson'), '1\n2\n')
    const { cursor } = await readRecordWindow(root, 'rows.ndjson', undefined, { bytes: 1 })
    for (const invalid of [
      null,
      { ...cursor, extra: 'unbounded payload' },
      Object.create(cursor),
      { ...cursor, file_ref: 'other.ndjson' },
      { ...cursor, offset: -1 },
      { ...cursor, offset: -0 },
      { ...cursor, records: -0 },
      { ...cursor, records: 1 },
      { ...cursor, offset: 100 },
      { ...cursor, carry_base64: '====' },
      { ...cursor, carry_base64: Buffer.from('too long').toString('base64') },
    ]) await expect(readRecordWindow(root, 'rows.ndjson', invalid as RecordCursor)).rejects.toThrow('WORKER_RECORD_CURSOR_INVALID')
    await writeFile(join(root, 'rows.ndjson'), '1\n2\n3\n')
    await expect(readRecordWindow(root, 'rows.ndjson', cursor)).rejects.toThrow('WORKER_RECORD_CURSOR_INVALID')
  })

  it.each(['\ufeff1\n', '1\n\ufeff2\n'])('preserves BOM bytes so invalid JSON is rejected through a restarted decoder', async input => {
    await writeFile(join(root, 'rows.ndjson'), input)
    let cursor: RecordCursor | undefined
    await expect((async () => {
      for (;;) {
        const next = await readRecordWindow(root, 'rows.ndjson', cursor, { bytes: 1, records: 1 })
        cursor = JSON.parse(JSON.stringify(next.cursor)) as RecordCursor
        if (next.done) return
      }
    })()).rejects.toThrow()
  })

  it('rejects oversized records across restarts and invalid UTF8', async () => {
    await writeFile(join(root, 'rows.ndjson'), JSON.stringify('x'.repeat(65_537)))
    let cursor: RecordCursor | undefined
    const first = await readRecordWindow(root, 'rows.ndjson', cursor)
    cursor = first.cursor
    await expect(readRecordWindow(root, 'rows.ndjson', cursor)).rejects.toThrow('WORKER_RECORD_BUDGET_EXCEEDED')
    await writeFile(join(root, 'rows.ndjson'), Buffer.from([34, 0xff, 34, 10]))
    await expect(readRecordWindow(root, 'rows.ndjson')).rejects.toThrow()
  })

  it('rejects traversal and symlink refs, and completes an empty required file', async () => {
    await writeFile(join(root, 'rows.ndjson'), '')
    const empty = await readRecordWindow(root, 'rows.ndjson')
    expect(empty).toMatchObject({ done: true, read_bytes: 0, rows: [] })
    await symlink(join(root, 'rows.ndjson'), join(root, 'alias.ndjson'))
    await expect(readRecordWindow(root, 'alias.ndjson')).rejects.toThrow()
    await expect(readRecordWindow(root, '../rows.ndjson')).rejects.toThrow()
  })
})
