/**
 * Regression tests for scripts/lib/httpText.js — #1649.
 *
 * `let body = ''; res.on('data', (c) => (body += c))` decodes every transport
 * chunk on its own. A multi-byte code point that straddles a chunk boundary is
 * decoded as two invalid halves and both come back as U+FFFD — and a script
 * that reads an article and PUTs it back writes that corruption into the
 * database. Production evidence: `GET /api/travels/520/` arrives as 15717 +
 * 6×16384 + 6922 bytes and the naive accumulator produces exactly 4 U+FFFD at
 * those offsets, while a whole-body decode produces none.
 *
 * The boundary is a property of the wire, so the tests do not hope for a lucky
 * split: they cut the payload at EVERY byte offset, and separately at the exact
 * middle of a Cyrillic and a Polish letter.
 */

import { EventEmitter } from 'events'
import http from 'http'
import zlib from 'zlib'
import type { AddressInfo } from 'net'

const {
  ACCEPT_ENCODING,
  decodeHttpBody,
  readResponseBuffer,
  readResponseText,
  withAcceptEncoding,
} = require('@/scripts/lib/httpText')

/** Cyrillic (2 bytes), Polish (2 bytes), em dash (3 bytes), emoji (4 bytes) */
const SAMPLE = 'Маршрут по Беларуси — Świteź, Żółć, ёжик 🦔 и Ogród Saski'

type FakeResponse = EventEmitter & { headers: Record<string, string>; destroy: () => void }

const fakeResponse = (chunks: Buffer[], headers: Record<string, string> = {}): FakeResponse => {
  const res = new EventEmitter() as FakeResponse
  res.headers = headers
  res.destroy = () => undefined
  setImmediate(() => {
    for (const chunk of chunks) res.emit('data', chunk)
    res.emit('end')
  })
  return res
}

/** What the code under test replaces: decode each chunk on its own. */
const naiveAccumulate = (chunks: Buffer[]): string =>
  chunks.reduce((text, chunk) => text + chunk.toString('utf8'), '')

const splitAt = (buffer: Buffer, cut: number): Buffer[] => [buffer.subarray(0, cut), buffer.subarray(cut)]

describe('readResponseText — code points split across transport chunks', () => {
  it('reassembles the body at every possible byte boundary', async () => {
    const bytes = Buffer.from(SAMPLE, 'utf8')
    for (let cut = 1; cut < bytes.length; cut += 1) {
      const text = await readResponseText(fakeResponse(splitAt(bytes, cut)))
      expect({ cut, text }).toEqual({ cut, text: SAMPLE })
    }
  })

  it('keeps a Cyrillic and a Polish letter intact when the cut lands inside it', async () => {
    for (const letter of ['я', 'ж', 'ż', 'ś', 'ó']) {
      const bytes = Buffer.from(`before ${letter} after`, 'utf8')
      // Both letters are two bytes in UTF-8, so the cut lands between them.
      const cut = Buffer.byteLength('before ', 'utf8') + 1
      const chunks = splitAt(bytes, cut)

      expect(await readResponseText(fakeResponse(chunks))).toBe(`before ${letter} after`)
      // The test would pass on a broken implementation if the split were benign.
      expect(naiveAccumulate(chunks)).toContain('�')
    }
  })

  it('is not vacuous: the accumulator it replaces corrupts this very payload', () => {
    const bytes = Buffer.from(SAMPLE, 'utf8')
    const corrupted = Array.from({ length: bytes.length - 1 }, (_, index) => index + 1).filter((cut) =>
      naiveAccumulate(splitAt(bytes, cut)).includes('�'),
    )
    // One boundary per continuation byte of every multi-byte character.
    expect(corrupted.length).toBeGreaterThan(20)
  })

  it('survives a body arriving one byte at a time', async () => {
    const bytes = Buffer.from(SAMPLE, 'utf8')
    const chunks = Array.from({ length: bytes.length }, (_, index) => bytes.subarray(index, index + 1))
    expect(await readResponseText(fakeResponse(chunks))).toBe(SAMPLE)
  })

  it('rejects a response somebody already put a StringDecoder on', async () => {
    const res = new EventEmitter() as FakeResponse
    res.headers = {}
    res.destroy = () => undefined
    setImmediate(() => res.emit('data', 'already decoded'))
    await expect(readResponseBuffer(res)).rejects.toThrow(/remove res\.setEncoding/)
  })

  it('propagates a stream error instead of resolving a truncated body', async () => {
    const res = new EventEmitter() as FakeResponse
    res.headers = {}
    res.destroy = () => undefined
    setImmediate(() => {
      res.emit('data', Buffer.from('half'))
      res.emit('error', new Error('socket hang up'))
    })
    await expect(readResponseText(res)).rejects.toThrow('socket hang up')
  })
})

describe('decodeHttpBody — content encodings', () => {
  it('decompresses gzip and brotli before decoding text', () => {
    expect(decodeHttpBody(zlib.gzipSync(Buffer.from(SAMPLE, 'utf8')), { 'content-encoding': 'gzip' })).toBe(SAMPLE)
    expect(decodeHttpBody(zlib.brotliCompressSync(Buffer.from(SAMPLE, 'utf8')), { 'content-encoding': 'br' })).toBe(
      SAMPLE,
    )
    expect(decodeHttpBody(zlib.deflateSync(Buffer.from(SAMPLE, 'utf8')), { 'content-encoding': 'deflate' })).toBe(
      SAMPLE,
    )
  })

  it('undoes a stacked Content-Encoding right-to-left', () => {
    const stacked = zlib.brotliCompressSync(zlib.gzipSync(Buffer.from(SAMPLE, 'utf8')))
    expect(decodeHttpBody(stacked, { 'content-encoding': 'gzip, br' })).toBe(SAMPLE)
  })

  it('reassembles a compressed body split across chunks', async () => {
    const compressed = zlib.gzipSync(Buffer.from(SAMPLE, 'utf8'))
    const chunks = splitAt(compressed, Math.floor(compressed.length / 2))
    expect(await readResponseText(fakeResponse(chunks, { 'content-encoding': 'gzip' }))).toBe(SAMPLE)
  })

  it('treats identity and a missing header as plain bytes', () => {
    const bytes = Buffer.from(SAMPLE, 'utf8')
    expect(decodeHttpBody(bytes, { 'content-encoding': 'identity' })).toBe(SAMPLE)
    expect(decodeHttpBody(bytes, {})).toBe(SAMPLE)
    expect(decodeHttpBody(Buffer.alloc(0), { 'content-encoding': 'gzip' })).toBe('')
  })

  it('refuses a codec it cannot undo instead of reading compressed bytes as text', () => {
    expect(() => decodeHttpBody(Buffer.from('binary'), { 'content-encoding': 'zstd' })).toThrow(
      /unsupported Content-Encoding "zstd"/,
    )
    // Deterministic — a retry would fetch the same codec back.
    try {
      decodeHttpBody(Buffer.from('binary'), { 'content-encoding': 'zstd' })
    } catch (error) {
      expect((error as { retryable?: boolean }).retryable).toBe(false)
    }
  })
})

describe('withAcceptEncoding', () => {
  it('advertises exactly what decodeHttpBody can undo', () => {
    expect(withAcceptEncoding()).toEqual({ 'Accept-Encoding': ACCEPT_ENCODING })
    for (const codec of ACCEPT_ENCODING.split(',').map((part: string) => part.trim())) {
      expect(() => decodeHttpBody(Buffer.alloc(0), { 'content-encoding': codec })).not.toThrow()
    }
  })

  it('keeps other headers and never overrides an explicit choice', () => {
    expect(withAcceptEncoding({ 'User-Agent': 'x' })).toEqual({
      'User-Agent': 'x',
      'Accept-Encoding': ACCEPT_ENCODING,
    })
    expect(withAcceptEncoding({ 'accept-encoding': 'identity' })).toEqual({ 'accept-encoding': 'identity' })
  })
})

describe('fetchJson over a real socket', () => {
  /**
   * Serve `body` as two writes with a gap, so the client sees two chunks.
   *
   * `cut` is resolved against the bytes actually put on the wire: gzip of this
   * fixture is ~170 bytes against ~3.7 kB of plain text, so an offset taken
   * from the uncompressed payload would sit past the end and the "split" would
   * be a single write plus an empty one — a test that proves nothing.
   */
  const startServer = async (body: string, cutOf: (payload: Buffer) => number, compress: boolean) => {
    const server = http.createServer((req, res) => {
      const gzip = compress && String(req.headers['accept-encoding'] || '').includes('gzip')
      const payload = gzip ? zlib.gzipSync(Buffer.from(body, 'utf8')) : Buffer.from(body, 'utf8')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (gzip) headers['Content-Encoding'] = 'gzip'
      const cut = cutOf(payload)
      expect(cut).toBeGreaterThan(0)
      expect(cut).toBeLessThan(payload.length)
      res.writeHead(200, headers)
      res.write(payload.subarray(0, cut))
      setTimeout(() => res.end(payload.subarray(cut)), 20)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    return { server, url: `http://127.0.0.1:${port}/travels/520/` }
  }

  const payload = JSON.stringify({ id: 520, description: `${SAMPLE} `.repeat(40) })

  /** A byte offset that lands on a UTF-8 continuation byte (0b10xxxxxx). */
  const cutInsideCodePoint = (bytes: Buffer): number => {
    for (let index = Math.floor(bytes.length / 2); index < bytes.length; index += 1) {
      if ((bytes[index] & 0xc0) === 0x80) return index
    }
    throw new Error('fixture has no multi-byte character')
  }

  it.each([
    // identity: the cut lands mid-letter, which is the defect itself.
    // gzip: compressed bytes carry no code points, so the cut only has to land
    // mid-stream — half a DEFLATE block is just as undecodable on its own.
    ['identity', false, cutInsideCodePoint],
    ['gzip', true, (bytes: Buffer) => Math.floor(bytes.length / 2)],
  ])('reads an article whole when the wire cuts the body in half (%s)', async (_name, compress, cutOf) => {
    const { fetchJson } = require('@/scripts/lib/fetchJson')
    const { server, url } = await startServer(payload, cutOf as (b: Buffer) => number, compress as boolean)
    try {
      const json = await fetchJson(url)
      expect(json.description).not.toContain('�')
      expect(json.description).toBe(`${SAMPLE} `.repeat(40))
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
