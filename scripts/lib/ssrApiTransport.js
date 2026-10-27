'use strict'

const http = require('node:http')
const https = require('node:https')

// Node fetch (undici) drops the forbidden Host header: the internal request to
// http://app:8000 then carries Host app:8000 and Django answers DisallowedHost.
// The SSR runner installs this transport; route loaders use it whenever they
// must address Django under the public host (utils/ssr/fetchPublicRouteJson).
const SSR_API_TRANSPORT = Symbol.for('metravel.ssr.apiTransport')
const MAX_BODY_BYTES = 32 * 1024 * 1024

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
          // A retiring worker can close a keep-alive socket as Node reuses it.
          // Retry this GET once on a new connection, within the same deadline.
          if (!retried && request.reusedSocket && error.code === 'ECONNRESET'
              && !receivedResponse && !signal?.aborted) send(true)
          else reject(error)
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
