'use strict'

const http = require('node:http')
const https = require('node:https')

// Node fetch (undici) drops the forbidden Host header: the internal request to
// http://app:8000 then carries Host app:8000 and Django answers DisallowedHost.
// The SSR runner installs this transport; route loaders use it whenever they
// must address Django under the public host (utils/ssr/fetchPublicRouteJson).
const SSR_API_TRANSPORT = Symbol.for('metravel.ssr.apiTransport')
const MAX_BODY_BYTES = 32 * 1024 * 1024
// Connection-level failures before any response byte. Loaders only send
// idempotent guest GETs, so one more attempt on a new connection is safe;
// HTTP statuses, timeouts and partial bodies are real answers and never retried.
const RETRYABLE_CODES = new Set(['ECONNRESET', 'EPIPE', 'ECONNREFUSED'])
// Gunicorn's replacement worker is ready ~60 ms after the request (#1964).
const RETRY_DELAY_MS = 150

/** A fetch-shaped GET that keeps every header and never follows redirects. */
function ssrApiRequest(url, { headers = {}, signal } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const client = target.protocol === 'https:' ? https : target.protocol === 'http:' ? http : null
    if (!client) {
      reject(new Error('Unsupported SSR API protocol'))
      return
    }
    const send = (retried = false) => {
      let receivedResponse = false
      try {
        const request = client.request(target, {
          method: 'GET', headers, signal, ...(retried ? { agent: false } : {}),
        }, (response) => {
          receivedResponse = true
          const chunks = []
          let size = 0
          response.on('data', (chunk) => {
            size += chunk.length
            if (size > MAX_BODY_BYTES) request.destroy(new Error('SSR API response exceeds its byte bound'))
            else chunks.push(chunk)
          })
          response.on('end', () => {
            const status = response.statusCode || 0
            const body = Buffer.concat(chunks).toString('utf8')
            resolve({ status, ok: status >= 200 && status < 300, json: async () => JSON.parse(body) })
          })
          response.on('error', reject)
        })
        request.on('error', (error) => {
          // Gunicorn retires its only worker every ~400 requests: the retiring
          // worker can close a keep-alive socket as Node reuses it, or drop a
          // fresh connection it accepted just before exiting (#2818). Retry this
          // GET once on a new connection after the replacement takes over,
          // within the same deadline. Only the code is logged, never the URL.
          const recoverable = RETRYABLE_CODES.has(error.code) && !receivedResponse
          if (recoverable) console.warn(`[ssr-api] ${error.code} before response, attempt ${retried ? 2 : 1}, reused=${Boolean(request.reusedSocket)}`)
          if (retried || !recoverable || signal?.aborted) {
            reject(error)
            return
          }
          const cancel = () => {
            clearTimeout(timer)
            reject(signal.reason)
          }
          const timer = setTimeout(() => {
            signal?.removeEventListener('abort', cancel)
            send(true)
          }, RETRY_DELAY_MS)
          signal?.addEventListener('abort', cancel, { once: true })
        })
        request.end()
      } catch (error) {
        reject(error)
      }
    }
    send()
  })
}

function installSsrApiTransport() {
  return globalThis[SSR_API_TRANSPORT] || (globalThis[SSR_API_TRANSPORT] = ssrApiRequest)
}

module.exports = { SSR_API_TRANSPORT, ssrApiRequest, installSsrApiTransport }
