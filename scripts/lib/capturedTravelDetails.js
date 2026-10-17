'use strict'

const { readSeoInputs } = require('./seoInputsCapture')
const { createRequestPacer, BUILD_FETCH_MIN_INTERVAL_MS } = require('./requestPacer')

// The caller's independent catalogue/anchor/probe coverage stays authoritative.
// Only an exact successful numeric detail read from THIS build can be reused.
function createCapturedTravelReader({ file, identity, fetchJson, pace = createRequestPacer(BUILD_FETCH_MIN_INTERVAL_MS) }) {
  const inputs = readSeoInputs(file, identity)
  const details = new Map(inputs.rawTravelDetails)
  const stats = { reused_details: 0, fetched_requests: 0 }
  const read = async (url, options) => {
    const parsed = new URL(url)
    if (parsed.origin === identity.api_origin && /^\/api\/travels\/[1-9][0-9]*\/$/.test(parsed.pathname)
      && !parsed.search && !parsed.hash && details.has(url)) {
      stats.reused_details += 1
      return details.get(url)
    }
    await pace()
    stats.fetched_requests += 1
    return fetchJson(url, options)
  }
  read.stats = stats
  return read
}
function capturedTravelReaderFromArgs(args, site, fetchJson) {
  const get = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }
  const file = get('quest-seo-inputs')
  if (!file) return null
  return createCapturedTravelReader({ file, identity: {
    nonce: get('quest-seo-input-nonce'), frontend_sha: get('frontend-sha'),
    api_origin: new URL(site).origin, publication_mode: get('quest-seo-publication-mode'),
  }, fetchJson })
}
module.exports = { createCapturedTravelReader, capturedTravelReaderFromArgs }
