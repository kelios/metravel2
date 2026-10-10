import { createHash } from 'node:crypto'
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDiskCheckpointStores } from '@/workers/book-renderer/htmlCheckpoint/diskStores'
import { incrementalContentStep } from '@/workers/book-renderer/htmlCheckpoint/incrementalStep'
import type { IncrementalContentCheckpoint } from '@/workers/book-renderer/htmlCheckpoint/incrementalStep'
import { incrementalContent } from '@/services/pdf-export/parsers/incrementalContent'
import type { SafeContentFragment } from '@/services/pdf-export/parsers/incrementalContent'

let root: string
beforeEach(() => { root = mkdtempSync(join(realpathSync(tmpdir()), 'html-checkpoint-')) })
afterEach(() => { rmSync(root, {recursive: true, force: true}) })

describe('private immutable checkpoint disk stores', () => {
  it('retains UTF16 blocks including split/lone surrogates across fresh store instances', () => {
    const block = 'A'.repeat(1021) + '\ud800X\udc00'; const stores = createDiskCheckpointStores(root)
    stores.text.put(0, block)
    const restored = createDiskCheckpointStores(root)
    expect(restored.text.get(0)).toBe(block)
    const stored = JSON.parse(readFileSync(join(root, 'text/0.json'), 'utf8')) as {sha256: string}
    expect(stored.sha256).toBe(createHash('sha256').update(Buffer.from(block, 'utf16le')).digest('hex'))
    expect(lstatSync(join(root, 'text/0.json')).mode & 0o777).toBe(0o600)
    expect(lstatSync(join(root, 'text')).mode & 0o777).toBe(0o700)
  })
  it('makes crash-before-cursor retries identical and refuses conflicting immutable writes', () => {
    const stores = createDiskCheckpointStores(root); const block = 'A'.repeat(1024)
    stores.text.put(0, block)
    const restored = createDiskCheckpointStores(root); restored.text.put(0, block)
    expect(() => restored.text.put(0, 'B'.repeat(1024))).toThrow()
    expect(restored.text.get(0)).toBe(block)
    const node = {value: true, next: null, count: 1}
    const hash = stores.context.put(node); expect(restored.context.put(node)).toBe(hash)
    expect(restored.context.get(hash)).toEqual(node)
    expect(readdirSync(join(root, 'text'))).toEqual(['0.json'])
    expect(readdirSync(join(root, 'contexts'))).toEqual([`${hash}.json`])
  })
  it('receipts exact encoded files and verified retries, and propagates output-ledger rejection', () => {
    const receipts: Array<{ref: string; checksum: string; size_bytes: number; created: boolean}> = []
    const stores = createDiskCheckpointStores(root, {onwrite: file => receipts.push(file)})
    stores.text.put(0, 'X'.repeat(1024)); stores.text.put(0, 'X'.repeat(1024))
    stores.tags.put({name: 'IMG', next: null, count: 1})
    expect(receipts.map(file => file.created)).toEqual([true, false, true])
    for (const file of receipts) {
      const bytes = readFileSync(join(root, file.ref)); expect(file.size_bytes).toBe(bytes.length)
      expect(file.checksum).toBe(createHash('sha256').update(bytes).digest('hex'))
    }
    const rejected = createDiskCheckpointStores(root, {onwrite: () => { throw new Error('Output budget') }})
    expect(() => rejected.context.put({value: true, next: null, count: 1})).toThrow('Output budget')
    expect(() => rejected.text.put(0, 'X'.repeat(1024))).toThrow('Output budget')
  })
  it('retries an uncommitted parser source-block write from its prior checkpoint without duplicate output', async () => {
    const prefix = '<p>' + 'a'.repeat(1017); const suffix = 'TAIL</p>'
    const actual: SafeContentFragment[] = []; let checkpoint: IncrementalContentCheckpoint | undefined
    const accept = (input: string, eof = false): void => {
      let step = incrementalContentStep(input, checkpoint, {stores: createDiskCheckpointStores(root), maxFragmentChars: 512, eof})
      actual.push(...step.fragments); checkpoint = JSON.parse(JSON.stringify(step.checkpoint)) as IncrementalContentCheckpoint
      while (step.needsDrain) {
        step = incrementalContentStep('', checkpoint, {stores: createDiskCheckpointStores(root), maxFragmentChars: 512})
        actual.push(...step.fragments); checkpoint = JSON.parse(JSON.stringify(step.checkpoint)) as IncrementalContentCheckpoint
      }
    }
    for (let offset = 0; offset < prefix.length; offset += 128) accept(prefix.slice(offset, offset + 128))
    const frozen = JSON.stringify(checkpoint)
    expect(() => incrementalContentStep(suffix, checkpoint, {maxFragmentChars: 512, stores: createDiskCheckpointStores(root, {
      onwrite: receipt => { if (receipt.ref === 'text/0.json') throw new Error('Uncommitted output ledger') },
    })})).toThrow('Uncommitted output ledger')
    expect(JSON.stringify(checkpoint)).toBe(frozen)
    const receipts: Array<{ref: string; created: boolean}> = []
    let retry = incrementalContentStep(suffix, checkpoint, {maxFragmentChars: 512, stores: createDiskCheckpointStores(root, {onwrite: receipt => receipts.push(receipt)})})
    expect(receipts).toContainEqual(expect.objectContaining({ref: 'text/0.json', created: false}))
    actual.push(...retry.fragments); checkpoint = JSON.parse(JSON.stringify(retry.checkpoint)) as IncrementalContentCheckpoint
    while (retry.needsDrain) {
      retry = incrementalContentStep('', checkpoint, {maxFragmentChars: 512, stores: createDiskCheckpointStores(root)})
      actual.push(...retry.fragments); checkpoint = JSON.parse(JSON.stringify(retry.checkpoint)) as IncrementalContentCheckpoint
    }
    accept('', true)
    async function* original(): AsyncGenerator<string> { yield prefix; yield suffix }
    const expected: SafeContentFragment[] = []
    for await (const fragment of incrementalContent(original(), {maxFragmentChars: 512})) expected.push(fragment)
    expect(actual).toEqual(expected)
  })
  it('rejects wrong root permissions without changing them and requires an existing root', () => {
    chmodSync(root, 0o755)
    expect(() => createDiskCheckpointStores(root)).toThrow('HTML_CHECKPOINT_DIRECTORY_INVALID')
    expect(lstatSync(root).mode & 0o777).toBe(0o755)
    expect(() => createDiskCheckpointStores(join(root, 'absent'))).toThrow()
    expect(existsSync(join(root, 'absent'))).toBe(false)
  })
  it('rejects root/intermediate/child symlinks and writable child directories', () => {
    const actual = join(root, 'actual'); mkdirSync(actual, {mode: 0o700})
    const alias = join(root, 'alias'); symlinkSync(actual, alias, 'dir')
    expect(() => createDiskCheckpointStores(alias)).toThrow('HTML_CHECKPOINT_DIRECTORY_INVALID')
    const nested = join(actual, 'nested'); mkdirSync(nested, {mode: 0o700})
    expect(() => createDiskCheckpointStores(join(alias, 'nested'))).toThrow('HTML_CHECKPOINT_DIRECTORY_INVALID')
    symlinkSync(actual, join(root, 'contexts'), 'dir')
    expect(() => createDiskCheckpointStores(root)).toThrow('HTML_CHECKPOINT_DIRECTORY_INVALID')
    unlinkSync(join(root, 'contexts')); mkdirSync(join(root, 'contexts'), {mode: 0o755})
    expect(() => createDiskCheckpointStores(root)).toThrow('HTML_CHECKPOINT_DIRECTORY_INVALID')
  })
  it('refuses symlink files, oversized files and corrupted content/hash lineage', () => {
    const stores = createDiskCheckpointStores(root); stores.text.put(0, 'A'.repeat(1024))
    const path = join(root, 'text/0.json'); const saved = readFileSync(path, 'utf8')
    const outside = join(root, 'outside.json'); writeFileSync(outside, saved, {mode: 0o600})
    unlinkSync(path); symlinkSync(outside, path)
    expect(() => stores.text.get(0)).toThrow(); expect(() => stores.text.put(0, 'A'.repeat(1024))).toThrow()
    unlinkSync(path); writeFileSync(path, 'X'.repeat(9000), {mode: 0o600})
    expect(() => stores.text.get(0)).toThrow('HTML_CHECKPOINT_FILE_INVALID')
    const corrupted = JSON.parse(saved) as {text: string}; corrupted.text = 'B'.repeat(1024)
    writeFileSync(path, JSON.stringify(corrupted), {mode: 0o600})
    expect(() => stores.text.get(0)).toThrow('HTML_CHECKPOINT_BLOCK_HASH_MISMATCH')
    const hash = stores.context.put({value: false, next: null, count: 1})
    writeFileSync(join(root, 'contexts', `${hash}.json`), '{"value":true,"next":null,"count":1}', {mode: 0o600})
    expect(() => stores.context.get(hash)).toThrow('HTML_CHECKPOINT_CONTEXT_HASH_MISMATCH')
  })
  it('rejects invalid UTF8 retries even when replacement decoding would match expected text, and rejects owner-executable files', () => {
    const stores = createDiskCheckpointStores(root); const block = '\ufffd' + 'X'.repeat(1023)
    stores.text.put(0, block)
    const path = join(root, 'text/0.json'); const original = readFileSync(path)
    const replacement = original.indexOf(Buffer.from('\ufffd'))
    expect(replacement).toBeGreaterThan(0)
    writeFileSync(path, Buffer.concat([original.subarray(0, replacement), Buffer.from([0xff]), original.subarray(replacement + 3)]))
    expect(() => stores.text.get(0)).toThrow('HTML_CHECKPOINT_ENCODING_INVALID')
    expect(() => stores.text.put(0, block)).toThrow('HTML_CHECKPOINT_ENCODING_INVALID')
    writeFileSync(path, original); chmodSync(path, 0o700)
    expect(() => stores.text.get(0)).toThrow('HTML_CHECKPOINT_FILE_INVALID')
  })
  it('produces exact legacy fragments with fresh parser AND disk store objects after every feed', async () => {
    const source = '<svg><foreignobject></svg>'.repeat(120) + '<div/>TAIL<p>😀 &amp; ' + 'long '.repeat(800) + '</p><details><summary>Q</summary><p>A</p></details>'
    const result: SafeContentFragment[] = []; let checkpoint: IncrementalContentCheckpoint | undefined
    for (let offset = 0; offset < source.length; offset += 17) {
      const step = incrementalContentStep(source.slice(offset, offset + 17), checkpoint, {stores: createDiskCheckpointStores(root), expandDisclosures: true})
      result.push(...step.fragments); checkpoint = JSON.parse(JSON.stringify(step.checkpoint)) as IncrementalContentCheckpoint
      let draining = step.needsDrain
      while (draining) { const next = incrementalContentStep('', checkpoint, {stores: createDiskCheckpointStores(root), expandDisclosures: true}); result.push(...next.fragments); checkpoint = JSON.parse(JSON.stringify(next.checkpoint)) as IncrementalContentCheckpoint; draining = next.needsDrain }
    }
    let ending = incrementalContentStep('', checkpoint, {stores: createDiskCheckpointStores(root), expandDisclosures: true, eof: true}); result.push(...ending.fragments)
    while (!ending.done) { ending = incrementalContentStep('', ending.checkpoint, {stores: createDiskCheckpointStores(root), expandDisclosures: true}); result.push(...ending.fragments) }
    async function* original(): AsyncGenerator<string> { for (let offset = 0; offset < source.length; offset += 17) yield source.slice(offset, offset + 17) }
    const expected: SafeContentFragment[] = []
    for await (const fragment of incrementalContent(original(), {expandDisclosures: true})) expected.push(fragment)
    expect(result).toEqual(expected)
  })
})
