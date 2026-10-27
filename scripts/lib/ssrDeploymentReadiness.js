'use strict';

const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PENDING = new Set(['selection_pending', 'publication_unavailable', 'refresh_pending']);
const DATA_ERRORS = new Set(['refresh_failed', 'refresh_stale', 'publication_corrupt']);
const FAILURE_FIELDS = new Set(['schema_version', 'state', 'kind', 'locale', 'publication_id',
  'corpus_revision', 'source_revision', 'content_revision', 'canonical_path', 'ru_source_path',
  'versions', 'quality', 'page', 'error_code', 'source_checked_at', 'source_age_seconds']);

function assertReadinessMode(mode) {
  if (!['strict', 'deployment'].includes(mode)) throw new Error('Expected strict or deployment readiness mode');
}

function assertCodeHealth(proof, sha) {
  if (!proof || proof.schema_version !== 1 || proof.status !== 'ok' || proof.sha !== sha
      || proof.client_sha !== sha || proof.renderer_sha !== sha || proof.dirty !== false) {
    throw new Error('The active client and healthy renderer must independently match the clean source SHA');
  }
  return proof;
}

async function verifyCodeHealth(sha) {
  const output = execFileSync('bash', [path.resolve(__dirname, '../web-ssr-publication.sh'), 'verify-code', sha], {
    encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return assertCodeHealth(JSON.parse(output), sha);
}

function retryAfter(response) {
  const value = response.headers.get('retry-after');
  if (!value || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 30) {
    throw new Error('Content readiness needs a bounded Retry-After');
  }
  return Number(value);
}

function assertNoStore(response) {
  if (!/(?:^|[,\s])no-store(?:$|[,\s])/i.test(response.headers.get('cache-control') || '')
      || response.headers.get('x-cache-status') === 'HIT') {
    throw new Error('Unavailable content must not enter the guest cache');
  }
}

function classifySelectedContent(response, payload, { kind, locale }) {
  if (![404, 503].includes(response.status) || !response.headers.get('content-type')?.includes('application/json')
      || !payload || payload.schema_version !== 2 || payload.kind !== kind || payload.locale !== locale
      || Object.keys(payload).some((key) => !FAILURE_FIELDS.has(key)) || payload.page !== null
      || !Array.isArray(payload.versions) || payload.versions.length !== 0) {
    throw new Error('Unavailable content does not match the selected public API contract');
  }
  if (['publication_id', 'corpus_revision', 'source_revision', 'content_revision', 'canonical_path', 'ru_source_path']
    .some((key) => payload[key] != null)) throw new Error('Unavailable content carries an unexpected selected publication');
  if (payload.quality != null && (typeof payload.quality !== 'object' || Array.isArray(payload.quality)
      || Object.keys(payload.quality).sort().join(',') !== 'indexable,own_fivegram_ratio,word_count'
      || payload.quality.indexable !== false || payload.quality.word_count !== 0 || payload.quality.own_fivegram_ratio !== null)) {
    throw new Error('Unavailable content has an invalid public quality verdict');
  }
  assertNoStore(response);
  if (response.status === 404 && payload.state === 'unavailable') return { content_status: 'unavailable' };
  if (response.status !== 503 || payload.state !== 'temporary_failure') throw new Error('Invalid content readiness state');
  const code = payload.error_code;
  if (!PENDING.has(code) && !DATA_ERRORS.has(code)) throw new Error('Unknown content readiness reason');
  const age = payload.source_age_seconds;
  const checked = payload.source_checked_at;
  if ((age !== null && (!Number.isFinite(age) || age < 0))
      || (checked !== null && (!Number.isFinite(checked) || checked <= 0))
      || (PENDING.has(code) && age !== null && age > 30)
      || (PENDING.has(code) && (age === null || checked === null) && code !== 'publication_unavailable')) {
    throw new Error('Content readiness has no valid fixed source-age proof');
  }
  return { content_status: PENDING.has(code) ? 'pending' : 'error', error_code: code,
    source_age_seconds: age, retry_after_seconds: retryAfter(response) };
}

function documentContentState(response, find) {
  const state = response.headers.get('x-metravel-travel-graph-state');
  const markers = find((node) => node.attribs?.['data-travel-link-graph']);
  if (!state && !markers.some((node) => ['pending', 'error'].includes(node.attribs['data-travel-link-graph']))) return null;
  if (!['available', 'pending', 'error'].includes(state) || markers.length !== 1
      || markers[0].attribs['data-travel-link-graph'] !== state) {
    throw new Error('Article discovery state differs between the renderer and response');
  }
  if (state === 'available') {
    if (!/(?:^|[,\s])no-store(?:$|[,\s])/i.test(response.headers.get('cache-control') || '')) return null;
    assertNoStore(response);
    return { content_status: 'pending', error_code: 'cache_transition',
      retry_after_seconds: response.headers.has('retry-after') ? retryAfter(response) : 1 };
  }
  assertNoStore(response);
  const code = markers[0].attribs['data-travel-graph-error'];
  if ((state === 'pending' && !PENDING.has(code))
      || (state === 'error' && !DATA_ERRORS.has(code) && !['graph_transport_failed', 'unavailable'].includes(code))) {
    throw Object.assign(new Error('Article discovery has a code/schema contract failure, not a recognized content state'),
      { code: 'SSR_CODE_CONTRACT' });
  }
  return { content_status: code === 'unavailable' ? 'unavailable' : state,
    error_code: code, retry_after_seconds: retryAfter(response) };
}

module.exports = { assertReadinessMode, assertCodeHealth, verifyCodeHealth, classifySelectedContent, documentContentState };
