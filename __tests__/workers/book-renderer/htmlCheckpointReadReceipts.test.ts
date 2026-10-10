/** @jest-environment node */
import fs from 'node:fs'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createDiskCheckpointStores, type CheckpointStoreReceipt } from '@/workers/book-renderer/htmlCheckpoint/diskStores'
import { SOURCE_BLOCK_CHARS } from '@/workers/book-renderer/htmlCheckpoint/sourceText'

const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const textRecord = (text: string) => JSON.stringify({ ordinal: 0, text,
  sha256: hash(Buffer.from(text, 'utf16le')) })

describe('readonly parser stores bind authorization to the same bounded bytes', () => {
  let root: string
  beforeEach(async () => {
    const base = path.resolve(__dirname, '../../../.codex-temp/tests'); await mkdir(base, { recursive: true })
    root = await mkdtemp(path.join(base, 'checkpoint-read-receipts-'))
  })
  afterEach(async () => { jest.restoreAllMocks(); await rm(root, { recursive: true, force: true }) })

  it('reports exact disk-byte receipts for tags, contexts and UTF16 text before returning decoded values', async () => {
    const written: CheckpointStoreReceipt[] = []
    const writable = createDiskCheckpointStores(root, { onwrite: file => written.push(file) })
    const tag = { name: 'foreign-😀', next: null, count: 1 }
    const context = { value: true, next: null, count: 1 }
    const original = '😀'.repeat(SOURCE_BLOCK_CHARS / 2)
    const tagRef = writable.tags.put(tag); const contextRef = writable.context.put(context)
    writable.text.put(0, original)
    const seen: Array<Omit<CheckpointStoreReceipt, 'created'>> = []
    const readonly = createDiskCheckpointStores(root, { readonly: true, onread: file => seen.push(file) })
    expect(readonly.tags.get(tagRef)).toEqual(tag)
    expect(readonly.context.get(contextRef)).toEqual(context)
    expect(readonly.text.get(0)).toBe(original)
    expect(seen.map(row => row.ref)).toEqual([`stack/${tagRef}.json`, `contexts/${contextRef}.json`, 'text/0.json'])
    for (const receipt of seen) {
      const raw = await readFile(path.join(root, receipt.ref))
      expect(receipt).toEqual({ ref: receipt.ref, checksum: hash(raw), size_bytes: raw.length })
    }
    expect(seen).toEqual(written.map(file => ({ ref: file.ref, checksum: file.checksum, size_bytes: file.size_bytes })))
  })

  it('does not create directories, fsync or publish files while constructing or using a readonly store', () => {
    const writer = createDiskCheckpointStores(root); writer.text.put(0, 'x'.repeat(SOURCE_BLOCK_CHARS))
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync'); const fsyncSpy = jest.spyOn(fs, 'fsyncSync')
    const writeSpy = jest.spyOn(fs, 'writeFileSync'); const linkSpy = jest.spyOn(fs, 'linkSync'); const unlinkSpy = jest.spyOn(fs, 'unlinkSync')
    const reader = createDiskCheckpointStores(root, { readonly: true })
    expect(reader.text.get(0)).toBe('x'.repeat(SOURCE_BLOCK_CHARS))
    expect(() => reader.text.put(1, 'y'.repeat(SOURCE_BLOCK_CHARS))).toThrow('HTML_CHECKPOINT_STORE_READONLY')
    expect(() => reader.context.put({ value: false, next: null, count: 1 })).toThrow('HTML_CHECKPOINT_STORE_READONLY')
    expect(() => reader.tags.put({ name: 'p', next: null, count: 1 })).toThrow('HTML_CHECKPOINT_STORE_READONLY')
    for (const spy of [mkdirSpy, fsyncSpy, writeSpy, linkSpy, unlinkSpy]) expect(spy).not.toHaveBeenCalled()
  })

  it('refuses a missing readonly directory without creating it as a side effect', () => {
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync')
    expect(() => createDiskCheckpointStores(root, { readonly: true })).toThrow()
    expect(mkdirSpy).not.toHaveBeenCalled()
    expect(fs.readdirSync(root)).toEqual([])
  })

  it('authorizes before JSON decoding, so even malformed private bytes cannot bypass a denied receipt', () => {
    const writer = createDiskCheckpointStores(root); writer.text.put(0, 'x'.repeat(SOURCE_BLOCK_CHARS))
    fs.writeFileSync(path.join(root, 'text/0.json'), '{')
    const denied: Array<Omit<CheckpointStoreReceipt, 'created'>> = []
    const reader = createDiskCheckpointStores(root, { readonly: true, onread: receipt => { denied.push(receipt); throw new Error('COMMITTED_RECEIPT_DENIED') } })
    expect(() => reader.text.get(0)).toThrow('COMMITTED_RECEIPT_DENIED')
    expect(denied).toEqual([{ ref: 'text/0.json', checksum: hash('{'), size_bytes: 1 }])
  })

  it('opens a record once and returns the authorized bytes despite a pathname replacement inside the receipt callback', () => {
    const original = 'a'.repeat(SOURCE_BLOCK_CHARS); const replacement = 'b'.repeat(SOURCE_BLOCK_CHARS)
    const receipts: CheckpointStoreReceipt[] = []
    createDiskCheckpointStores(root, { onwrite: receipt => receipts.push(receipt) }).text.put(0, original)
    const reader = createDiskCheckpointStores(root, { readonly: true, onread: actual => {
      expect(actual).toEqual({ ref: receipts[0].ref, checksum: receipts[0].checksum, size_bytes: receipts[0].size_bytes })
      fs.writeFileSync(path.join(root, actual.ref), textRecord(replacement))
    } })
    const opened = jest.spyOn(fs, 'openSync')
    expect(reader.text.get(0)).toBe(original)
    expect(opened).toHaveBeenCalledTimes(1)
    expect(opened.mock.calls[0][1]).toBe(fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK)
    expect(createDiskCheckpointStores(root, { readonly: true }).text.get(0)).toBe(replacement)
  })

  it('rejects symlink records before emitting an authorization receipt', () => {
    const writer = createDiskCheckpointStores(root); writer.text.put(0, 'x'.repeat(SOURCE_BLOCK_CHARS))
    fs.renameSync(path.join(root, 'text/0.json'), path.join(root, 'text/real.json'))
    fs.symlinkSync(path.join(root, 'text/real.json'), path.join(root, 'text/0.json'))
    const seen: unknown[] = []
    const reader = createDiskCheckpointStores(root, { readonly: true, onread: receipt => seen.push(receipt) })
    expect(() => reader.text.get(0)).toThrow()
    expect(seen).toEqual([])
  })
})
