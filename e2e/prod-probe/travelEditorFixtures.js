/* Owned data only. Importing this module performs no network/process work. */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { request } = require('@playwright/test')
const { openProdProbe, buildConsentValue, formatProbeError } = require('./prodProbe')
const { applyEnvFile } = require('../../scripts/e2e-env-files')

const ROOT = path.resolve(__dirname, '../..')
const OUT = path.join(ROOT, '.codex-temp/editor-regression')
const METADATA = ['moderation_decision', 'moderation_decision_reason', 'moderation_decided_at']
const assert = (value, message) => { if (!value) throw new Error(message) }
const unpack = dto => Array.isArray(dto) ? dto : dto?.data ?? dto?.results ?? dto?.items ?? []
const positiveId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0
const loopback = url => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)

function targetConfig(baseUrl, backendUrl) {
  const url = new URL(baseUrl)
  assert(!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'Fixture origin must be a bare HTTP origin')
  assert(['http:', 'https:'].includes(url.protocol), 'Unsupported fixture origin')
  const production = url.origin === 'https://metravel.by'
  assert(production || (loopback(url.origin) && backendUrl && loopback(backendUrl)), 'Local fixtures require verified loopback web AND backend origins')
  if (!production) {
    const backend = new URL(backendUrl)
    assert(['http:', 'https:'].includes(backend.protocol) && !backend.username && !backend.password && !backend.search && !backend.hash, 'Invalid local backend origin')
  }
  return { origin: url.origin, production, backendUrl: production ? 'https://metravel.by/api' : new URL(backendUrl).origin }
}
function runDirectory(runId) {
  assert(/^run-[a-zA-Z0-9_-]{1,70}$/.test(runId || ''), 'Safe run-prefixed fixture identity required')
  return path.join(OUT, runId)
}
function writePrivate(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 })
  const temporary = `${filename}.tmp`
  fs.writeFileSync(temporary, typeof value === 'string' ? value : JSON.stringify(value, null, 2), { mode: 0o600 })
  fs.chmodSync(temporary, 0o600); fs.renameSync(temporary, filename)
}
function readPrivate(filename) { return JSON.parse(fs.readFileSync(filename, 'utf8')) }
function validateRegistry(reg, runId) {
  assert(reg.version === 1 && reg.runId === runId && /^QAEDITOR-[a-zA-Z0-9-]+$/.test(reg.marker), 'Foreign or invalid fixture registry')
  const config = targetConfig(reg.origin, reg.backendUrl)
  for (const [role, account] of Object.entries(reg.accounts)) {
    assert(['author', 'other'].includes(role) && account.name === `${reg.marker}-${role}`, 'Foreign account marker')
    assert(account.id == null || (Number.isSafeInteger(account.id) && positiveId(account.id) && ![1, 104, 120].includes(account.id)), 'Protected account in fixture registry')
  }
  for (const fixture of reg.fixtures) assert(positiveId(fixture.id) && ['private-long', 'public'].includes(fixture.label) &&
    fixture.name === `${reg.marker} ${fixture.label}`, 'Foreign travel marker')
  return config
}
function ownsTravel(dto, fixture, reg) {
  const owners = [dto.userIds, dto.user_id, dto.user?.id, ...(Array.isArray(dto.users) ? dto.users.map(user => user?.id ?? user) : [])]
    .filter(value => value != null).flatMap(value => String(value).split(',')).map(value => value.trim())
  return Number(dto.id) === fixture.id && dto.name === fixture.name && owners.includes(String(reg.accounts.author.id))
}
function sqlRead(config, sql) {
  assert(/^SELECT\b/.test(sql.trim()) && !/;\s*\S|\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|COPY)\b/i.test(sql), 'Only one readonly owned-ID SELECT is allowed')
  const productionScript = String.raw`set -euo pipefail
source scripts/deploy-target.sh
require_deploy_target
QAEDITOR_DB_CTR="$(metravel_resolve_container_over_ssh metravel-gis)"
ssh "$PROD_SSH_TARGET" "docker exec -i $QAEDITOR_DB_CTR sh -c 'PGOPTIONS=--default_transaction_read_only=on psql -X -qAt -v ON_ERROR_STOP=1 -U \$POSTGRES_USER -d \$POSTGRES_DB'"
`
  const localScript = String.raw`set -euo pipefail
set -a
source "$1/local_env.sh"
set +a
case "$APP_DB_HOST" in localhost|127.0.0.1|::1) ;; *) exit 9 ;; esac
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export PGPASSWORD="$APP_DB_PASS" PGOPTIONS=--default_transaction_read_only=on
exec psql -X -qAt -v ON_ERROR_STOP=1 -h "$APP_DB_HOST" -p "$APP_DB_PORT" -U "$APP_DB_USER" -d "$APP_DB_NAME"
`
  try {
    return execFileSync('bash', ['-c', config.production ? productionScript : localScript, 'editor-owned-read',
      process.env.METRAVEL_LOCAL_BACKEND_ROOT || '/Users/juliasavran/Sites/metravel/metravel'],
    { cwd: ROOT, input: `${sql.trim()}\n`, encoding: 'utf8', timeout: 60_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch { throw new Error('Owned readonly DB lookup failed; subprocess output withheld to protect activation/config secrets') }
}
async function json(response, label, validationFields = []) {
  if (!response.ok()) {
    // Only a caller-supplied payload field name can enter the durable error.
    // Never log validation messages/values or inspect auth response bodies.
    const body = validationFields.length ? await response.json().catch(() => null) : null
    const fields = body && typeof body === 'object' && !Array.isArray(body)
      ? validationFields.filter(key => Object.hasOwn(body, key)).sort().slice(0, 12) : []
    throw new Error(`${label}: HTTP${response.status()}${fields.length ? `; validationFields=${fields.join(',')}` : ''}`)
  }
  const result = await response.json().catch(() => null)
  assert(result && typeof result === 'object', `${label}: expected JSON, not document HTML`)
  return result
}
async function identity(api, id, superuser = false) {
  const dto = await json(await api.get('/api/user/me/'), 'Verify real cookie identity')
  assert(Number(dto.id) === Number(id) && (dto.is_superuser === true) === superuser, 'Unexpected real account identity/role')
  return dto
}
async function csrf(api, origin) {
  const state = await api.storageState()
  const token = state.cookies.find(cookie => cookie.name === 'csrftoken' && cookie.domain.replace(/^\./, '') === new URL(origin).hostname)?.value
  return { Origin: origin, Referer: `${origin}/`, ...(token ? { 'X-CSRFToken': token } : {}) }
}
function snapshot(dto) {
  return Object.fromEntries(['id', 'name', 'slug', 'publication_status', ...METADATA].map(key => [key, dto[key] ?? null]))
}
function fixtureCreatePayload({ marker, label, country, category, pointCategory }) {
  return { id: null, name: `${marker} ${label}`, description: `<p>${marker}: расходная проверка редактора, запись будет удалена.</p>`,
    categories: [category], countries: [country], transports: [], month: [], complexity: [], companions: [], over_nights_stay: [],
    budget: null, year: 2026, number_peoples: 1, number_days: 1, minus: null, plus: null, recommendation: null, youtube_link: null,
    visa: false, gallery: [], thumbs200ForCollectionArr: [], travelImageThumbUrlArr: [], travelImageAddress: [],
    publication_format: 'full', publication_status: 'draft', enforce_moderation_validation: false,
    coordsMeTravel: [{ id: null, lat: 53.90111, lng: 27.56111, country, address: `${marker} disposable point`, categories: [pointCategory], image: null }] }
}
function commandPayload(current, command, reason) {
  assert(['draft', 'pending_review', 'approved', 'published'].includes(current.publication_status), 'Unknown fixture publication state')
  assert(['submit', 'approve', 'reject'].includes(command), 'Unsupported fixture command')
  const payload = { ...current, publication_status: command === 'submit' ? 'pending_review' : command === 'approve' ? 'published' : 'draft', enforce_moderation_validation: command === 'submit' }
  for (const key of ['publish', 'moderation', ...METADATA]) delete payload[key]
  if (command === 'reject') {
    assert(typeof reason === 'string' && reason.trim().length > 0 && reason.trim().length <= 2000, 'Invalid rejection reason')
    payload.moderation_decision_reason = reason.trim()
  }
  return payload
}
function reasonFor(marker) {
  const start = `${marker} BEGIN\n`, end = `\n${marker} END`
  return start + 'Уточните описание маршрута и доступность точки. '.repeat(80).slice(0, 2000 - start.length - end.length) + end
}

async function openOwnedBatch({ baseUrl, backendUrl, runId, needOther = true, initialRegistry }) {
  const config = targetConfig(baseUrl, backendUrl)
  const directory = runDirectory(runId), registryFile = path.join(directory, 'registry.private.json')
  assert(initialRegistry || !fs.existsSync(registryFile), 'Existing fixture batch must be cleaned/resumed, not overwritten')
  applyEnvFile(path.join(ROOT, '.env.e2e'))
  const reg = initialRegistry || { version: 1, runId, ...config, marker: `QAEDITOR-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    accounts: {}, fixtures: [], pendingCreate: null, ledger: [], cleaned: false }
  validateRegistry(reg, runId)
  assert(reg.origin === config.origin && reg.backendUrl === config.backendUrl, 'Cleanup target differs from registered origin')
  const save = () => writePrivate(registryFile, reg)
  const stateFile = role => path.join(directory, `${role}.storage.private.json`)
  save()
  let admin
  function ledger(stage, operation, detail = {}) { reg.ledger.push({ at: new Date().toISOString(), stage, operation, ...detail }); save() }
  async function authorApi(role = 'author') {
    const account = reg.accounts[role]
    assert(account?.activated && positiveId(account.id) && !account.deleted, 'Disposable cookie identity is unavailable')
    let api
    try {
      api = await request.newContext({ baseURL: reg.origin, storageState: stateFile(role) })
      await identity(api, account.id)
      return api
    } catch {
      if (api) await api.dispose()
      const retry = await request.newContext({ baseURL: reg.origin })
      try {
        const credentials = readPrivate(path.join(directory, `${role}.credentials.private.json`))
        await json(await retry.post('/api/user/login/', { data: credentials }), 'Reauthenticate only owned disposable account')
        await identity(retry, account.id)
        await saveState(retry, role)
        return retry
      } catch (error) { await retry.dispose(); throw error }
    }
  }
  async function saveState(api, role) {
    const account = reg.accounts[role], dto = await identity(api, account.id)
    const state = await api.storageState()
    assert(state.cookies.some(cookie => cookie.name === 'authToken' && cookie.value && cookie.httpOnly === true &&
      cookie.domain.replace(/^\./, '') === new URL(reg.origin).hostname), 'Real activation/login issued no matching HttpOnly cookie')
    state.origins = [{ origin: reg.origin, localStorage: [{ name: 'userId', value: String(account.id) },
      { name: 'userName', value: String(dto.name || account.name) }, { name: 'isSuperuser', value: 'false' },
      { name: 'metravel_consent_v1', value: buildConsentValue(false) },
      { name: '@metravel/locale-preference:v1', value: JSON.stringify({ version: 1, mode: 'explicit', locale: 'ru' }) }] }]
    writePrivate(stateFile(role), state)
  }
  async function account(role) {
    const source = String(process.env.E2E_EMAIL || ''), at = source.lastIndexOf('@')
    assert(at > 0, 'Canonical test mailbox is required; address withheld')
    const credentials = { email: `${source.slice(0, at).split('+')[0]}+${reg.marker.toLowerCase()}-${role}${source.slice(at)}`,
      password: `${crypto.randomBytes(24).toString('base64url')}aA9!` }
    reg.accounts[role] = { id: null, name: `${reg.marker}-${role}`, activated: false, deleted: false }
    writePrivate(path.join(directory, `${role}.credentials.private.json`), credentials); save()
    const api = await request.newContext({ baseURL: reg.origin })
    try {
      const terms = await json(await api.get('/api/terms/version/'), 'Current terms')
      const version = String(terms.version ?? terms.current_version ?? terms.current_terms_version ?? '')
      assert(version, 'Terms version missing')
      ledger('setup', 'register-intent', { role })
      const dto = await json(await api.post('/api/user/registration/', { data: { ...credentials, confirmPassword: credentials.password,
        username: reg.accounts[role].name, terms_version: version } }), 'Register disposable account')
      assert(positiveId(dto.id) && ![1, 104, 120].includes(Number(dto.id)), 'Registration returned protected or invalid ID')
      reg.accounts[role].id = Number(dto.id); save()
      const token = sqlRead(config, `SELECT account_activation_token FROM users WHERE id=${Number(dto.id)} AND name='${reg.accounts[role].name}';`)
      assert(token && !/\s/.test(token), 'Own activation token unavailable')
      ledger('setup', 'activate-intent', { role, id: Number(dto.id) })
      await json(await api.post('/api/user/confirm-registration/', { data: { hash: token } }), 'Activate own account')
      await identity(api, dto.id)
      reg.accounts[role].activated = true; save(); await saveState(api, role)
      ledger('setup', 'account-verified', { role, id: Number(dto.id) })
    } finally { await api.dispose() }
  }
  async function ownDetail(api, fixture) {
    const dto = await json(await api.get(`/api/travels/${fixture.id}/`), 'Own fixture detail')
    assert(ownsTravel(dto, fixture, reg), 'Fixture detail owner/marker/ID mismatch')
    return dto
  }
  async function ownList(api) {
    return unpack(await json(await api.get(`/api/travels/?${new URLSearchParams({ where: JSON.stringify({ user_id: reg.accounts.author.id }), perPage: '30' })}`), 'Own fixture list'))
  }
  async function command(api, fixture, name, reason) {
    const current = await ownDetail(api, fixture)
    const payload = commandPayload({ ...fixture.payload, name: current.name, description: current.description,
      coordsMeTravel: current.coordsMeTravel, gallery: current.gallery, publication_status: current.publication_status }, name, reason)
    ledger('setup', `${name}-intent`, { id: fixture.id })
    await json(await api.put('/api/travels/upsert/', { headers: await csrf(api, reg.origin), data: payload }), `Fixture ${name}`, Object.keys(payload))
    const after = await ownDetail(api, fixture)
    assert(after.publication_status === payload.publication_status, 'Fixture command did not commit status')
    if (name === 'reject') assert(after.moderation_decision === 'rejected' && after.moderation_decision_reason === reason && after.moderation_decided_at, 'Real rejection metadata missing')
    if (name === 'approve') assert(after.moderation_decision === 'approved' && after.moderation_decided_at, 'Real approval metadata missing')
    ledger('setup', `${name}-verified`, { id: fixture.id, status: after.publication_status })
    return after
  }
  async function setup() {
    assert(!initialRegistry, 'Cleanup recovery cannot create new fixtures')
    admin = await openProdProbe({ baseUrl: reg.origin, consent: 'necessary' })
    await identity(admin.context.request, 104, true)
    await account('author'); if (needOther) await account('other')
    const api = await authorApi()
    try {
      const filters = await json(await api.get('/api/getFiltersTravel/'), 'Travel dictionaries')
      const countries = unpack(await json(await api.get('/api/countries/'), 'Country dictionaries'))
      const first = data => Number(unpack(data)[0]?.id)
      const country = Number(countries[0]?.country_id ?? countries[0]?.id)
      const category = first(filters.categories ?? filters.categoryTravel), pointCategory = first(filters.categoryTravelAddress)
      assert([country, category, pointCategory].every(positiveId), 'Required fixture dictionaries unavailable')
      for (const label of ['private-long', 'public']) {
        const payload = fixtureCreatePayload({ marker: reg.marker, label, country, category, pointCategory })
        reg.pendingCreate = { label, name: payload.name }; ledger('setup', 'create-intent', { label })
        const created = await json(await api.put('/api/travels/upsert/', { headers: await csrf(api, reg.origin), data: payload }), 'Create own fixture', Object.keys(payload))
        assert(positiveId(created.id), 'Fixture creation returned no ID')
        const fixture = { id: Number(created.id), label, name: payload.name,
          payload: { ...payload, id: Number(created.id), coordsMeTravel: created.coordsMeTravel ?? payload.coordsMeTravel },
          pointIds: (created.coordsMeTravel || []).map(point => Number(point.id)).filter(positiveId), mediaUrls: [] }
        reg.fixtures.push(fixture); reg.pendingCreate = null; save()
        // A positive create-response ID alone is insufficient authority for a
        // second write. Verify the exact own marker/owner through a fresh GET.
        const owned = await ownDetail(api, fixture)
        fixture.pointIds = (owned.coordsMeTravel || []).map(point => Number(point.id)).filter(positiveId)
        fixture.payload.coordsMeTravel = owned.coordsMeTravel
        save()
        assert(fixture.pointIds.length === 1, 'Fixture point ID missing')
        await command(api, fixture, 'submit')
        fixture.before = snapshot(await command(admin.context.request, fixture, label === 'private-long' ? 'reject' : 'approve', reasonFor(reg.marker)))
        fixture.slug = fixture.before.slug; save()
      }
      const rows = await ownList(api)
      for (const fixture of reg.fixtures) {
        const row = rows.find(item => Number(item.id) === fixture.id)
        assert(row && METADATA.every(key => (row[key] ?? null) === fixture.before[key]), 'Own list lost committed fixture metadata')
      }
      reg.setupComplete = true; save()
      return reg
    } finally { await api.dispose() }
  }
  async function cleanup() {
    validateRegistry(reg, runId)
    // Recover an acknowledged-but-unread registration by its UNIQUE own marker,
    // never by reading a user list or encrypted email. Activation remains an API command.
    for (const [role, entry] of Object.entries(reg.accounts)) {
      if (entry.deleted) continue
      if (entry.id && sqlRead(config, `SELECT count(*) FROM users WHERE id=${entry.id} AND name='${entry.name}';`) === '0') {
        entry.deleted = true; ledger('cleanup', 'account-already-absent', { role, id: entry.id }); continue
      }
      if (!entry.id) {
        const found = sqlRead(config, `SELECT id FROM users WHERE name='${entry.name}';`)
        assert(!found || /^\d+$/.test(found), 'Ambiguous own registration recovery')
        if (!found) { entry.deleted = true; save(); continue }
        entry.id = Number(found); validateRegistry(reg, runId); save()
      }
      if (!entry.activated) {
        const recovery = await request.newContext({ baseURL: reg.origin })
        try {
          const token = sqlRead(config, `SELECT account_activation_token FROM users WHERE id=${entry.id} AND name='${entry.name}';`)
          if (token) await json(await recovery.post('/api/user/confirm-registration/', { data: { hash: token } }), 'Recover own activation for cleanup')
          else await json(await recovery.post('/api/user/login/', { data: readPrivate(path.join(directory, `${role}.credentials.private.json`)) }), 'Recover own activated cookie')
          await identity(recovery, entry.id); entry.activated = true; save(); await saveState(recovery, role)
        } finally { await recovery.dispose() }
      }
    }
    let api
    try {
      if (reg.accounts.author?.activated && !reg.accounts.author.deleted) api = await authorApi()
      if (reg.pendingCreate) {
        assert(api, 'Pending create requires own author access')
        const matches = (await ownList(api)).filter(item => item.name === reg.pendingCreate.name)
        assert(matches.length <= 1, 'Ambiguous fixture creation recovery')
        for (const dto of matches) {
          const fixture = { ...reg.pendingCreate, id: Number(dto.id), pointIds: [], mediaUrls: [] }
          assert(ownsTravel(dto, fixture, reg), 'Pending create recovery ownership mismatch')
          const detail = await ownDetail(api, fixture)
          fixture.pointIds = (detail.coordsMeTravel || []).map(point => Number(point.id)).filter(positiveId)
          reg.fixtures.push(fixture)
        }
        reg.pendingCreate = null; save()
      }
      for (const fixture of reg.fixtures) {
        if (fixture.deleted) continue
        assert(api, 'Own article cleanup session missing')
        const response = await api.get(`/api/travels/${fixture.id}/`)
        if (response.status() !== 404) {
          const dto = await json(response, 'Verify cleanup owner')
          assert(ownsTravel(dto, fixture, reg), 'Refused foreign travel deletion')
          fixture.pointIds = [...new Set([...fixture.pointIds, ...(dto.coordsMeTravel || []).map(point => Number(point.id)).filter(positiveId)])]
          // An upload may have committed before its response was lost. Recover
          // only delivery URLs read back from this already verified own object.
          fixture.mediaUrls = [...new Set([...fixture.mediaUrls, dto.travel_image_thumb_url, dto.travel_image_thumb_small_url].filter(value => typeof value === 'string' && value))]
          save()
          ledger('cleanup', 'travel-delete-intent', { id: fixture.id })
          const deleted = await api.delete(`/api/travels/${fixture.id}/`, { headers: await csrf(api, reg.origin) })
          assert(deleted.status() === 204, 'Own travel delete was not acknowledged204')
        }
        assert((await api.get(`/api/travels/${fixture.id}/`)).status() === 404, 'Deleted own travel remains readable')
        fixture.deleted = true; ledger('cleanup', 'travel-404', { id: fixture.id })
      }
      if (api) {
        assert(!(await ownList(api)).some(row => reg.fixtures.some(fixture => fixture.id === Number(row.id))), 'Fixture remains in own list')
        const pending = unpack(await json(await api.get(`/api/travels/?${new URLSearchParams({ where: JSON.stringify({ user_id: reg.accounts.author.id, publication_status: ['pending_review'] }), perPage: '30' })}`), 'Own moderation cleanup readback'))
        assert(!pending.some(row => reg.fixtures.some(fixture => fixture.id === Number(row.id))), 'Fixture remains in moderation list')
      }
    } finally { if (api) await api.dispose() }
    const media = await request.newContext({ baseURL: reg.origin })
    try {
      for (const fixture of reg.fixtures) for (const value of fixture.mediaUrls) {
        const url = new URL(value)
        assert(url.hostname === new URL(reg.origin).hostname && !url.username && !url.password && url.pathname.startsWith(`/travel-image/${fixture.id}/`), 'Foreign media cleanup URL')
        url.protocol = new URL(reg.origin).protocol; url.host = new URL(reg.origin).host
        assert((await media.get(url.toString(), { headers: { 'Cache-Control': 'no-cache' } })).status() === 404, 'Deleted owner media remains deliverable')
        ledger('cleanup', 'media-404', { id: fixture.id })
      }
    } finally { await media.dispose() }
    for (const [role, entry] of Object.entries(reg.accounts)) {
      if (entry.deleted) continue
      const session = await authorApi(role)
      try {
        const me = await identity(session, entry.id)
        assert(me.name === entry.name, 'Refused foreign account deletion')
        ledger('cleanup', 'account-delete-intent', { role, id: entry.id })
        const deleted = await session.delete('/api/user/delete-account/', { headers: await csrf(session, reg.origin) })
        assert([200, 204].includes(deleted.status()) && (await session.get('/api/user/me/')).status() === 401, 'Own account cleanup not confirmed')
        entry.deleted = true; ledger('cleanup', 'account-401', { role, id: entry.id })
      } finally { await session.dispose() }
    }
    const ids = reg.fixtures.map(fixture => fixture.id), points = reg.fixtures.flatMap(fixture => fixture.pointIds), users = Object.values(reg.accounts).map(entry => entry.id).filter(positiveId)
    const counts = []
    if (ids.length) {
      counts.push(`(SELECT count(*) FROM travels WHERE id IN (${ids}))`)
      for (const table of ['travel_user', 'travel_address', 'travel_category', 'travel_country', 'travel_text_versions']) counts.push(`(SELECT count(*) FROM ${table} WHERE travel_id IN (${ids}))`)
      counts.push(`(SELECT count(*) FROM media WHERE model_id IN (${ids}) AND collection_name='travelMainImage')`)
    }
    if (points.length) counts.push(`(SELECT count(*) FROM travel_address WHERE id IN (${points}))`, `(SELECT count(*) FROM travel_address_category WHERE travel_address_id IN (${points}))`)
    if (users.length) counts.push(`(SELECT count(*) FROM users WHERE id IN (${users}))`)
    const result = counts.length ? sqlRead(config, `SELECT ${counts.join(',')};`) : ''
    assert(!counts.length || result.split('|').length === counts.length && result.split('|').every(value => value === '0'), 'Exact owned-ID cleanup SQL counts are not all zero')
    reg.cleaned = true; reg.cleanedAt = new Date().toISOString(); reg.cleanupCounts = result
    ledger('cleanup', 'complete', { ownedIdCounts: result, storageEvidence: reg.fixtures.some(fixture => fixture.mediaUrls.length)
      ? 'owner API/media proxy404 plus existing post_delete source contract; no independent S3 inventory claim'
      : 'no fixture media URLs; no media delivery or S3 inventory claim' })
  }
  return { reg, directory, registryFile, stateFile, setup, cleanup, authorApi, ownDetail, ownList, ledger,
    get admin() { return admin }, async close() { if (admin) await admin.close() } }
}

// Resuming cleanup reuses the same implementation and private registry without
// creating a new batch. No setup request is made by the constructor.
async function resumeCleanup(runId) {
  const filename = path.join(runDirectory(runId), 'registry.private.json'), saved = readPrivate(filename)
  validateRegistry(saved, runId)
  if (saved.cleaned) return saved
  const batch = await openOwnedBatch({ baseUrl: saved.origin, backendUrl: saved.backendUrl, runId, initialRegistry: saved })
  try { await batch.cleanup(); return batch.reg } finally { await batch.close() }
}

module.exports = { ROOT, OUT, METADATA, targetConfig, runDirectory, writePrivate, readPrivate, validateRegistry, ownsTravel,
  fixtureCreatePayload, commandPayload, reasonFor, identity, snapshot, openOwnedBatch, resumeCleanup, assert, unpack, json }

if (require.main === module) {
  const args = process.argv.slice(2), runId = args.find(arg => arg.startsWith('--run-id='))?.slice(9)
  if (args[0] !== 'cleanup' || !args.includes('--execute')) { console.error('Use cleanup --execute --run-id=<exact-run-id>'); process.exitCode = 1 }
  else resumeCleanup(runId).then(() => console.log('Owned cleanup complete')).catch(error => { console.error(formatProbeError(error)); process.exitCode = 1 })
}
