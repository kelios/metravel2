import { isUint8Array } from 'node:util/types'

/**
 * SHA-256, FIPS 180-4 §§4.1.2, 4.2.2, 5.1.1, 5.3.3 and 6.2:
 * https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf
 * Explicit portable state supports restart without replay or Node private APIs.
 * Checkpoint provenance must be fenced and checksummed separately by the worker.
 */
const INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]
const KEYS = ['version', 'state_words', 'total_bytes', 'tail_base64']

export interface Sha256CheckpointV1 {
  version: 1
  state_words: number[]
  total_bytes: number
  tail_base64: string
}

function rotate(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits))
}

function restore(value: unknown): Sha256CheckpointV1 {
  const invalid = () => { throw new Error('WORKER_HASH_CHECKPOINT_INVALID') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const keys = Object.keys(value)
  if (keys.length !== KEYS.length || keys.some(key => !KEYS.includes(key))) return invalid()
  const checkpoint = value as Sha256CheckpointV1
  const { version, state_words, total_bytes, tail_base64 } = checkpoint
  if (version !== 1 || !Array.isArray(state_words) || state_words.length !== 8 ||
      !Number.isSafeInteger(total_bytes) || total_bytes < 0 || Object.is(total_bytes, -0) ||
      typeof tail_base64 !== 'string' || tail_base64.length > 84) return invalid()
  const words: number[] = []
  for (let index = 0; index < 8; index++) {
    const word = state_words[index]
    if (!Number.isInteger(word) || word < 0 || word > 0xffffffff || Object.is(word, -0)) return invalid()
    if (total_bytes < 64 && word !== INITIAL[index]) return invalid()
    words.push(word)
  }
  const tail = Buffer.from(tail_base64, 'base64')
  if (tail.length >= 64 || tail.length !== total_bytes % 64 || tail.toString('base64') !== tail_base64) return invalid()
  // All fields are bounded before serialization; hostile objects cannot expand the budget.
  const result: Sha256CheckpointV1 = {
    version: 1, state_words: words, total_bytes, tail_base64: tail.toString('base64'),
  }
  if (Buffer.byteLength(JSON.stringify(result)) > 4096) return invalid()
  return result
}

export class CheckpointSha256 {
  private words: number[]
  private total: number
  private tail: Buffer

  constructor(checkpoint?: unknown) {
    const saved = checkpoint === undefined ? undefined : restore(checkpoint)
    this.words = saved ? saved.state_words : [...INITIAL]
    this.total = saved?.total_bytes ?? 0
    this.tail = saved ? Buffer.from(saved.tail_base64, 'base64') : Buffer.alloc(0)
  }

  update(input: Uint8Array): this {
    if (!isUint8Array(input) || input.byteLength > 65_536 ||
        !Number.isSafeInteger(this.total + input.byteLength)) throw new Error('WORKER_HASH_INPUT_BUDGET_INVALID')
    this.total += input.byteLength
    let offset = 0
    if (this.tail.length) {
      const consumed = Math.min(64 - this.tail.length, input.byteLength)
      this.tail = Buffer.concat([this.tail, Buffer.from(input.subarray(0, consumed))])
      offset = consumed
      if (this.tail.length < 64) return this
      this.compress(this.tail, 0)
      this.tail = Buffer.alloc(0)
    }
    for (; offset + 64 <= input.byteLength; offset += 64) this.compress(input, offset)
    this.tail = Buffer.from(input.subarray(offset))
    return this
  }

  snapshot(): Sha256CheckpointV1 {
    return { version: 1, state_words: [...this.words], total_bytes: this.total, tail_base64: this.tail.toString('base64') }
  }

  digestHex(): string {
    const copy = new CheckpointSha256(this.snapshot())
    const padded = Buffer.alloc(copy.tail.length < 56 ? 64 : 128)
    copy.tail.copy(padded)
    padded[copy.tail.length] = 0x80
    // Split the exact byte count before multiplying, including near MAX_SAFE_INTEGER.
    padded.writeUInt32BE(Math.floor(copy.total / 0x20000000), padded.length - 8)
    padded.writeUInt32BE((copy.total % 0x20000000) * 8, padded.length - 4)
    for (let offset = 0; offset < padded.length; offset += 64) copy.compress(padded, offset)
    return copy.words.map(word => word.toString(16).padStart(8, '0')).join('')
  }

  private compress(block: Uint8Array, offset: number): void {
    const schedule = new Uint32Array(64)
    for (let index = 0; index < 16; index++) {
      const start = offset + index * 4
      schedule[index] = (block[start] << 24) | (block[start + 1] << 16) | (block[start + 2] << 8) | block[start + 3]
    }
    for (let index = 16; index < 64; index++) {
      const x = schedule[index - 15]
      const y = schedule[index - 2]
      const sigma0 = rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)
      const sigma1 = rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10)
      schedule[index] = (sigma1 + schedule[index - 7] + sigma0 + schedule[index - 16]) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = this.words
    for (let index = 0; index < 64; index++) {
      const sum1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)
      const choice = (e & f) ^ (~e & g)
      const t1 = (h + sum1 + choice + K[index] + schedule[index]) >>> 0
      const sum0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (sum0 + majority) >>> 0
      h = g; g = f; f = e; e = (d + t1) >>> 0
      d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    const working = [a, b, c, d, e, f, g, h]
    for (let index = 0; index < 8; index++) this.words[index] = (this.words[index] + working[index]) >>> 0
  }
}
