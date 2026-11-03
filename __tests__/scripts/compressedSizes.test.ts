/** @jest-environment node */

import crypto from 'node:crypto'
import zlib from 'node:zlib'

const { compressedSizesSync } = require('../../scripts/lib/compressedSizes')

// #2980: the JS budget of every deploy measures chunks through this pass; the
// committed budget is pinned to the numbers of sequential gzip + Brotli q11, so
// the parallel pass must give the same bytes, in the caller's order.
describe('compressedSizesSync', () => {
  const sequential = (buffer: Buffer) => ({
    gzip: zlib.gzipSync(buffer).length,
    brotli: zlib.brotliCompressSync(buffer, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  })

  const buffers = [
    Buffer.alloc(0),
    Buffer.from('a'.repeat(1000)),
    crypto.randomBytes(200_000),
    ...Array.from({ length: 30 }, (_, index) => Buffer.from(`const chunk${index} = ${JSON.stringify('x'.repeat(index * 997))}\n`.repeat(index + 1))),
  ]

  it('gives the sequential gzip and Brotli q11 sizes in input order across workers', () => {
    expect(compressedSizesSync(buffers, { workers: 4 })).toEqual(buffers.map(sequential))
  })

  it('measures in the calling thread when one worker is enough', () => {
    expect(compressedSizesSync(buffers.slice(0, 2), { workers: 1 })).toEqual(buffers.slice(0, 2).map(sequential))
    expect(compressedSizesSync([])).toEqual([])
  })

  // The calling thread is blocked in Atomics.wait and cannot see worker events:
  // the deadline is what turns a stuck pool into a failed guard, not a hung deploy.
  it('fails instead of waiting forever when the workers do not finish in time', () => {
    const slow = Array.from({ length: 4 }, () => crypto.randomBytes(2_000_000))
    expect(() => compressedSizesSync(slow, { workers: 2, timeoutMs: 1 })).toThrow(/did not finish in 1 ms/)
  })
})
