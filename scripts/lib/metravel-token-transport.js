'use strict'

const http = require('node:http')
const https = require('node:https')
const crypto = require('node:crypto')
const { TokenError, containsControl } = require('./metravel-token-errors')
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024
const PRODUCTION_ORIGIN = 'https://metravel.by'
const LOCAL_ORIGIN = 'http://localhost:8000'

function normalizeOrigin(value = 'https://metravel.by', fixture) {
  try {
    if (typeof value !== 'string' || containsControl(value, true)) throw new Error()
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error()
    const isolated = fixture && process.env.NODE_ENV === 'test' && fixture.origin === url.origin &&
      (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.test'))
    if (fixture && !isolated) throw new Error()
    if (!isolated && ![PRODUCTION_ORIGIN, LOCAL_ORIGIN].includes(url.origin)) throw new Error()
    if (isolated && !['http:', 'https:'].includes(url.protocol)) throw new Error()
    return url.origin
  } catch { throw new TokenError('origin', { operation: 'configure' }) }
}

function targetPolicy(value, fixture) {
  const origin = normalizeOrigin(value, fixture)
  return { origin, production: !fixture && origin === PRODUCTION_ORIGIN, local: !fixture && origin === LOCAL_ORIGIN, fixture: Boolean(fixture) }
}

function endpointUrl(origin, endpoint) {
  try {
    if (typeof endpoint !== 'string' || containsControl(endpoint, true) || endpoint.includes('\\')) throw new Error()
    const url = new URL(endpoint, `${origin}/`)
    if (url.origin !== origin || url.username || url.password || url.hash) throw new Error()
    return url.href
  } catch { throw new TokenError('origin', { operation: 'request' }) }
}

// Capture upload data once. FormData's random boundary is fixed for both auth
// attempts; buffers are copies, and an optional factory must reproduce the input.
async function snapshotBody(body, boundary = `metravel-${crypto.randomBytes(18).toString('hex')}`) {
  if (body == null) return { bytes: undefined, contentType: null, boundary }
  if (typeof body === 'string') return { bytes: Buffer.from(body), contentType: null, boundary }
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) return { bytes: Buffer.from(body), contentType: null, boundary }
  if (body instanceof URLSearchParams) return { bytes: Buffer.from(body.toString()), contentType: 'application/x-www-form-urlencoded;charset=UTF-8', boundary }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const parts = []
    const quote = (text) => String(text).replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/"/g, '%22')
    for (const [name, value] of body.entries()) {
      let header = `--${boundary}\r\nContent-Disposition: form-data; name="${quote(name)}"`
      if (typeof value === 'string') parts.push(Buffer.from(`${header}\r\n\r\n${value}\r\n`))
      else {
        header += `; filename="${quote(value.name || 'blob')}"\r\nContent-Type: ${value.type || 'application/octet-stream'}`
        if (/[\r\n]/.test(value.type || '')) throw new TokenError('body')
        parts.push(Buffer.from(`${header}\r\n\r\n`), Buffer.from(await value.arrayBuffer()), Buffer.from('\r\n'))
      }
    }
    parts.push(Buffer.from(`--${boundary}--\r\n`))
    return { bytes: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}`, boundary }
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) return { bytes: Buffer.from(await body.arrayBuffer()), contentType: body.type || null, boundary }
  // Streams cannot be silently replayed. Supply a bodyFactory producing immutable
  // supported input instead, or buffer the existing stream before calling.
  throw new TokenError('body')
}

function nativeTransport(url, init, timeoutMs, allowRedirectStatus = false) {
  return new Promise((resolve, reject) => {
    const transport = new URL(url).protocol === 'https:' ? https : http
    let done = false
    const fail = (reason) => { if (!done) { done = true; reject(new TokenError(reason)) } }
    const request = transport.request(url, {
      method: init.method, headers: init.headers, rejectUnauthorized: true,
      // No agent with caller-controlled TLS policy or implicit redirect handling.
      agent: false,
    }, (response) => {
      if (!allowRedirectStatus && response.statusCode >= 300 && response.statusCode < 400) {
        fail('redirect'); response.destroy(); request.destroy(); return
      }
      let size = 0
      const chunks = []
      response.on('data', (chunk) => {
        size += chunk.length
        if (size > MAX_RESPONSE_BYTES) { request.destroy(); fail('response') } else chunks.push(chunk)
      })
      response.on('error', () => fail('network'))
      response.on('end', () => {
        if (done) return
        done = true
        const bytes = Buffer.concat(chunks)
        // A minimal fetch-compatible buffered response; callers retain response
        // data internally but never feed it into the safe error formatter.
        resolve({ status: response.statusCode, ok: response.statusCode >= 200 && response.statusCode < 300,
          headers: new Headers(Object.entries(response.headers).flatMap(([key, value]) => value == null ? [] : [[key, Array.isArray(value) ? value.join(', ') : value]])),
          text: async () => bytes.toString('utf8'), json: async () => { try { return JSON.parse(bytes.toString('utf8')) } catch { throw new TokenError('response') } },
          arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        })
      })
    })
    const abort = () => { request.destroy(); fail('timeout') }
    const timer = setTimeout(abort, timeoutMs)
    if (init.signal) {
      if (init.signal.aborted) abort()
      else init.signal.addEventListener('abort', abort, { once: true })
    }
    request.on('error', () => fail('network'))
    request.on('close', () => { clearTimeout(timer); if (init.signal) init.signal.removeEventListener('abort', abort) })
    if (!done) request.end(init.body)
  })
}

async function trustedRequest(origin, endpoint, init = {}, { fixture, timeoutMs = 15000, allowRedirectStatus = false } = {}) {
  const url = endpointUrl(origin, endpoint)
  if (!(timeoutMs > 0)) throw new TokenError('timeout')
  if (!fixture || !fixture.fetchImpl) return nativeTransport(url, init, timeoutMs, allowRedirectStatus)
  // Explicit test-only transport remains bounded and receives the same boundary
  // settings. Production callers cannot supply their own transport callback.
  const controller = new AbortController()
  let timer
  const abort = () => controller.abort()
  if (init.signal) {
    if (init.signal.aborted) controller.abort()
    else init.signal.addEventListener('abort', abort, { once: true })
  }
  try {
    const response = await Promise.race([
      Promise.resolve().then(() => fixture.fetchImpl(url, { ...init, signal: controller.signal, redirect: 'error' })),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new TokenError('timeout')) }, timeoutMs) }),
    ])
    if (!response || !Number.isInteger(response.status)) throw new TokenError('response')
    if (!allowRedirectStatus && response.status >= 300 && response.status < 400) throw new TokenError('redirect')
    return response
  } catch (error) { throw error instanceof TokenError ? error : new TokenError('network') }
  finally { clearTimeout(timer); if (init.signal) init.signal.removeEventListener('abort', abort) }
}

module.exports = { normalizeOrigin, targetPolicy, endpointUrl, snapshotBody, trustedRequest }
