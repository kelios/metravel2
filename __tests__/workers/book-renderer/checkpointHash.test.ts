import { createHash } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import { CheckpointSha256, type Sha256CheckpointV1 } from '../../../workers/book-renderer/checkpointHash'

const digest = (value: Uint8Array) => createHash('sha256').update(value).digest('hex')
const binary = (length: number) => Buffer.from(Array.from({ length }, (_, index) => (index * 149 + 73) & 255))
const restored = (hash: CheckpointSha256) => new CheckpointSha256(JSON.parse(JSON.stringify(hash.snapshot())))

describe('portable bounded SHA-256 checkpoint', () => {
  it('accepts genuine Uint8Array views across realms but rejects other views and lookalikes', () => {
    const crossRealm = runInNewContext('new Uint8Array([97, 98, 99])') as Uint8Array
    expect(new CheckpointSha256().update(crossRealm).digestHex()).toBe(digest(Buffer.from('abc')))
    const invalid = [new Uint16Array([97]), new Uint8ClampedArray([97]), new DataView(new ArrayBuffer(1)),
      new ArrayBuffer(1), { byteLength: 1, 0: 97 }, Object.create(Uint8Array.prototype)]
    for (const value of invalid) {
      const hash = new CheckpointSha256()
      const before = hash.snapshot()
      expect(() => hash.update(value as Uint8Array)).toThrow('WORKER_HASH_INPUT_BUDGET_INVALID')
      expect(hash.snapshot()).toEqual(before)
    }
  })

  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
  ])('matches the standard vector %s', (text, expected) => {
    const value = Buffer.from(text)
    const hash = new CheckpointSha256().update(value)
    expect(hash.digestHex()).toBe(expected)
    expect(hash.digestHex()).toBe(digest(value))
  })

  it('matches one million a bytes within the update budget', () => {
    const value = Buffer.alloc(1_000_000, 'a')
    let hash = new CheckpointSha256()
    for (let offset = 0; offset < value.length; offset += 65_536) hash = restored(hash.update(value.subarray(offset, offset + 65_536)))
    expect(hash.digestHex()).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0')
    expect(hash.digestHex()).toBe(digest(value))
  })

  it.each([0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 255, 256, 257, 65_535, 65_536])(
    'matches independent SHA-256 at %i binary bytes', length => {
      const value = binary(length)
      expect(new CheckpointSha256().update(value).digestHex()).toBe(digest(value))
    },
  )

  it.each([1, 17, 257, 65_536])('restores JSON after every %i-byte chunk including split UTF8', chunk => {
    const value = Buffer.concat([binary(1025), Buffer.from('Люксембург 🥾 é таблица '.repeat(53)), binary(511)])
    let hash = new CheckpointSha256()
    for (let offset = 0; offset < value.length; offset += chunk) {
      hash = restored(hash.update(value.subarray(offset, offset + chunk)))
      expect(hash.snapshot().total_bytes).toBe(Math.min(offset + chunk, value.length))
      expect(Buffer.byteLength(JSON.stringify(hash.snapshot()))).toBeLessThanOrEqual(4096)
    }
    const before = hash.snapshot()
    expect(hash.digestHex()).toBe(digest(value))
    expect(hash.digestHex()).toBe(digest(value))
    expect(hash.snapshot()).toEqual(before)
    const suffix = Buffer.from('追加')
    expect(hash.update(suffix).digestHex()).toBe(digest(Buffer.concat([value, suffix])))
  })

  it('resumes multiple full-size windows without retaining the source buffer', () => {
    const value = binary(131_073)
    let hash = new CheckpointSha256()
    for (let offset = 0; offset < value.length; offset += 65_536) hash = restored(hash.update(value.subarray(offset, offset + 65_536)))
    expect(hash.digestHex()).toBe(digest(value))
  })

  it('copies input tails and both restored and returned state words defensively', () => {
    const value = Buffer.from('abc')
    const hash = new CheckpointSha256().update(value)
    value.fill(0)
    const checkpoint = hash.snapshot()
    const copy = new CheckpointSha256(checkpoint)
    checkpoint.state_words.fill(0)
    checkpoint.tail_base64 = ''
    checkpoint.total_bytes = 0
    const exposed = copy.snapshot()
    exposed.state_words.fill(0)
    expect(hash.digestHex()).toBe(digest(Buffer.from('abc')))
    expect(copy.digestHex()).toBe(hash.digestHex())
    copy.update(Buffer.from('d'))
    expect(hash.snapshot().total_bytes).toBe(3)
    expect(copy.digestHex()).toBe(digest(Buffer.from('abcd')))
  })

  it('rejects malformed or oversized state before decoding or copying it', () => {
    const valid = new CheckpointSha256().update(Buffer.from('abc')).snapshot()
    const word = valid.state_words[0]
    const invalid: unknown[] = [
      null, [], {}, { ...valid, extra: 1 }, { ...valid, version: 2 },
      { ...valid, total_bytes: -1 }, { ...valid, total_bytes: -0 }, { ...valid, total_bytes: 1.5 },
      { ...valid, total_bytes: Number.NaN }, { ...valid, total_bytes: Number.POSITIVE_INFINITY },
      { ...valid, total_bytes: Number.MAX_SAFE_INTEGER + 1 },
      { ...valid, state_words: Array(9).fill(word) }, { ...valid, state_words: Array(8) },
      ...[-1, -0, 0x100000000, 0.5, Number.NaN, '1'].map(value => ({ ...valid, state_words: [value, ...valid.state_words.slice(1)] })),
      { ...valid, state_words: valid.state_words.map(value => value ^ 1) },
      { ...valid, tail_base64: '====' }, { ...valid, tail_base64: 'YWJj\n' },
      { ...valid, tail_base64: 'YQ==' }, { ...valid, tail_base64: 123 },
      { ...valid, tail_base64: 'A'.repeat(85) },
      { ...valid, total_bytes: 64, tail_base64: Buffer.alloc(64).toString('base64') },
    ]
    for (const checkpoint of invalid) expect(() => new CheckpointSha256(checkpoint)).toThrow('WORKER_HASH_CHECKPOINT_INVALID')
  })

  it('rejects an oversized update and byte-count overflow without changing state', () => {
    const hash = new CheckpointSha256().update(Buffer.from('abc'))
    const before = hash.snapshot()
    expect(() => hash.update(Buffer.alloc(65_537))).toThrow('WORKER_HASH_INPUT_BUDGET_INVALID')
    expect(() => hash.update('abc' as unknown as Uint8Array)).toThrow('WORKER_HASH_INPUT_BUDGET_INVALID')
    expect(hash.snapshot()).toEqual(before)
    const maximum: Sha256CheckpointV1 = {
      ...before, total_bytes: Number.MAX_SAFE_INTEGER, tail_base64: Buffer.alloc(63).toString('base64'),
    }
    const full = new CheckpointSha256(maximum)
    expect(full.digestHex()).toMatch(/^[a-f0-9]{64}$/)
    expect(full.snapshot()).toEqual(maximum)
    expect(() => full.update(Buffer.of(1))).toThrow('WORKER_HASH_INPUT_BUDGET_INVALID')
    expect(full.snapshot()).toEqual(maximum)
  })
})
