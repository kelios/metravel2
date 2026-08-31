/**
 * scripts/lib/httpText.js
 * Transport-safe reader for Node `http`/`https` responses.
 *
 * #1649: `let body = ''; res.on('data', (c) => (body += c))` decodes every
 * transport chunk on its own. A multi-byte code point that straddles a
 * HTTP/TLS chunk boundary is then decoded as two invalid halves and both come
 * back as U+FFFD — and a script that reads an article and PUTs it back writes
 * that corruption into the database. The boundary is a property of the wire,
 * not of the payload: `GET /api/travels/520/` arrives as 15717 + 6×16384 +
 * 6922 bytes, and exactly 4 replacement characters appear at those offsets.
 * Compression only moves the boundaries, so it hides the defect instead of
 * fixing it.
 *
 * Two rules, both enforced here rather than repeated at ~15 call sites:
 *   1. bytes first — every chunk is buffered as a Buffer and the whole body is
 *      decoded once, so no code point can be split by construction;
 *   2. advertise only what we can decode — the client sends an explicit
 *      `Accept-Encoding` and refuses to hand back text for a content-encoding
 *      it cannot decompress, instead of decoding compressed bytes as UTF-8.
 *
 * `res.setEncoding()` (Node's own StringDecoder) is also correct, but it hands
 * back strings, which makes gzip/br decompression impossible and leaves the
 * decision at every call site. Passing such a response here is a programming
 * error and fails loudly.
 */

const zlib = require('zlib')

/** Encodings this module can actually decompress — what clients may advertise */
const ACCEPT_ENCODING = 'gzip, br'

/**
 * Merge the advertised encoding into request headers without clobbering an
 * explicit choice a caller already made.
 */
const withAcceptEncoding = (headers = {}, encoding = ACCEPT_ENCODING) => {
  const hasOwn = Object.keys(headers).some((key) => key.toLowerCase() === 'accept-encoding')
  return hasOwn ? { ...headers } : { ...headers, 'Accept-Encoding': encoding }
}

/** Buffer the whole body. No decode happens here, so no code point can split. */
const readResponseBuffer = (res) =>
  new Promise((resolve, reject) => {
    const chunks = []
    res.on('data', (chunk) => {
      if (typeof chunk === 'string') {
        // Someone called res.setEncoding() upstream: the response is already
        // being decoded chunk-by-chunk and re-encoding it here would only hide
        // that. Fail where the mistake is, not in the saved article.
        res.destroy()
        reject(new Error('httpText: response emits strings — remove res.setEncoding() before readResponseBuffer()'))
        return
      }
      chunks.push(chunk)
    })
    res.on('error', reject)
    res.on('end', () => resolve(Buffer.concat(chunks)))
  })

const decompressors = {
  gzip: (buffer) => zlib.gunzipSync(buffer),
  'x-gzip': (buffer) => zlib.gunzipSync(buffer),
  br: (buffer) => zlib.brotliDecompressSync(buffer),
  // Servers disagree on whether `deflate` is zlib-wrapped (RFC) or raw. We do
  // not advertise it, but decode both shapes when one arrives anyway.
  deflate: (buffer) => {
    try {
      return zlib.inflateSync(buffer)
    } catch {
      return zlib.inflateRawSync(buffer)
    }
  },
  identity: (buffer) => buffer,
}

/**
 * Decompress per `Content-Encoding`, then decode the complete bytes as UTF-8.
 * A codec we did not ask for throws — decoding compressed bytes as text would
 * produce confident garbage.
 */
const decodeHttpBody = (buffer, headers = {}) => {
  if (!buffer || buffer.length === 0) return ''
  const header = String(headers['content-encoding'] || '').trim().toLowerCase()
  // `Content-Encoding: gzip, br` is applied left-to-right, so it is undone
  // right-to-left.
  const codecs = header ? header.split(',').map((part) => part.trim()).filter(Boolean) : []
  let bytes = buffer
  for (let i = codecs.length - 1; i >= 0; i -= 1) {
    const decompress = decompressors[codecs[i]]
    if (!decompress) {
      // Deterministic: retrying the same request buys the same codec back.
      throw Object.assign(
        new Error(`httpText: unsupported Content-Encoding "${header}" — cannot decode body as text`),
        { retryable: false },
      )
    }
    bytes = decompress(bytes)
  }
  return bytes.toString('utf8')
}

/** Whole-body text of a response: buffer everything, decompress, decode once. */
const readResponseText = async (res) => decodeHttpBody(await readResponseBuffer(res), res.headers || {})

module.exports = {
  ACCEPT_ENCODING,
  decodeHttpBody,
  readResponseBuffer,
  readResponseText,
  withAcceptEncoding,
}
