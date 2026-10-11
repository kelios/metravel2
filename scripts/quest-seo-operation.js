#!/usr/bin/env node
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const {
  MANIFEST_NAME, SHA, RELEASE_ID, parseStrictJson, validateManifest, sha256,
} = require('./lib/questSeoContract')

const TRANSPORT = path.join(__dirname, 'quest-seo-transport.py')
const KEYS = ['schema_version', 'result', 'release_id', 'previous_release_id', 'frontend_sha',
  'manifest_sha256', 'root_key', 'relative_release_root']
const quote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`

function require_(condition, message) {
  if (!condition) throw new Error(message)
}

function exactKeys(value, keys) {
  require_(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join() === [...keys].sort().join(), 'Unexpected receipt keys')
}

function checkReceipt(raw, expected, result, previous) {
  require_(Buffer.byteLength(raw) <= 4096, 'Activation receipt exceeds bound')
  const receipt = parseStrictJson(raw, 'activation receipt')
  exactKeys(receipt, KEYS)
  require_(receipt.schema_version === 1 && receipt.result === result, 'Wrong activation result/schema')
  require_(receipt.release_id === expected.release_id && receipt.frontend_sha === expected.frontend_sha
    && receipt.manifest_sha256 === expected.manifest_sha256, 'Release identity mismatch')
  require_(receipt.root_key === 'static/dist'
    && receipt.relative_release_root === `quest-seo-releases/${expected.release_id}/dist`, 'Serving root mismatch')
  require_(receipt.previous_release_id === previous, 'Rollback identity mismatch')
  return receipt
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 120000,
    maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], env: process.env, ...options })
  require_(!result.error && result.status === 0 && !result.signal,
    `${command} failed${result.error ? `: ${result.error.message}` : ` (${result.signal || result.status})`}`)
  return result.stdout || ''
}

function transport(env = process.env) {
  const { PROD_SSH_TARGET: target, PROD_REMOTE_DIR: remote, QUEST_SEO_APP_CONTAINER: app,
    QUEST_SEO_NGINX_CONTAINER: nginx } = env
  require_(target && remote && /^[a-zA-Z0-9_.-]+$/.test(app || '')
    && /^[a-zA-Z0-9_.-]+$/.test(nginx || ''), 'Existing deploy transport is not configured')
  const code = fs.readFileSync(TRANSPORT).toString('base64')
  const python = `import base64;exec(compile(base64.b64decode('${code}'),'<quest-seo-transport>','exec'))`
  const ssh = (command, options) => run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', target, command], options)
  const operation = (action, args = [], options) => ssh(
    `docker exec${action === 'stage' ? ' -i' : ''} ${quote(app)} python -c ${quote(python)} ${[action, ...args].map(quote).join(' ')}`, options)
  return { operation, ssh, remote, app, nginx }
}

function inspect(t) {
  const state = parseStrictJson(t.operation('inspect'), 'serving state')
  exactKeys(state, ['schema_version', 'kind', 'current', 'previous'])
  require_(state.schema_version === 1 && ['legacy', 'managed', 'absent'].includes(state.kind), 'Unknown serving state')
  for (const identity of [state.current, state.previous].filter(Boolean)) {
    exactKeys(identity, ['schema_version', 'release_id', 'frontend_sha', 'manifest_sha256', 'tree_sha256'])
    require_(identity.schema_version === 1 && RELEASE_ID.test(identity.release_id)
      && SHA.test(identity.frontend_sha) && /^[a-f0-9]{64}$/.test(identity.manifest_sha256)
      && /^[a-f0-9]{64}$/.test(identity.tree_sha256), 'Invalid sealed identity')
  }
  require_((state.kind === 'managed') === Boolean(state.current)
    && (state.kind === 'managed' || !state.previous), 'Invalid current pointer state')
  return state
}

function save(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  fs.renameSync(temporary, file)
}

function preflight(t) {
  // Exact Git classification plus actual bind mounts before any server write.
  t.ssh(`set -eu; cd ${quote(t.remote)}; test -d static; test ! -L static; `
    + `status=$(git status --porcelain); unexpected=$(printf '%s\\n' "$status" | sed '/^?? dump.sql$/d; /^?? deploy\\/prod\\/nginx\\/ssl\\//d; /^?? dist\\//d; /^$/d'); `
    + `test -z "$unexpected"; test -z "$(git ls-files -- static/dist static/quest-seo-releases static/.quest-seo-operation.lock static/.quest-seo-activation.json static/quests/quest-default-cover.svg)"; `
    + `test "$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/static"}}{{.Source}}{{end}}{{end}}' ${quote(t.app)})" = ${quote(`${t.remote}/static`)}; `
    + `test "$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/usr/local/metravel/static"}}{{.Source}}{{end}}{{end}}' ${quote(t.nginx)})" = ${quote(`${t.remote}/static`)}`)
}

function overlay(t, dist, stateFile) {
  preflight(t)
  const base = inspect(t)
  checkInventory(t, 0)
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'metravel-quest-overlay-')))
  try {
    const archive = path.join(temporary, 'assets.tar.gz')
    const output = fs.openSync(archive, 'wx', 0o600)
    try {
      t.operation('overlay', [base.kind, base.current?.release_id || 'none'], { stdio: ['ignore', output, 'pipe'] })
    } finally { fs.closeSync(output) }
    const previous = path.join(temporary, 'previous')
    fs.mkdirSync(previous)
    const input = fs.openSync(archive, 'r')
    try { run('python3', [TRANSPORT, 'unpack', previous], { stdio: [input, 'pipe', 'pipe'] }) }
    finally { fs.closeSync(input) }
    run('bash', [path.join(__dirname, 'deploy-expo-overlay.sh'), path.join(dist, '_expo/static'), previous,
      process.env.EXPO_OVERLAY_RETENTION_DAYS || '14', process.env.EXPO_OVERLAY_MAX_MB || '256'], { stdio: 'inherit' })
    save(stateFile, { schema_version: 1, phase: 'overlaid', base })
  } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
}

function identity(dist) {
  const bytes = fs.readFileSync(path.join(dist, MANIFEST_NAME), 'utf8')
  const manifest = validateManifest(parseStrictJson(bytes, 'manifest'))
  const marker = parseStrictJson(fs.readFileSync(path.join(dist, '.build-source.json'), 'utf8'), 'build marker')
  require_(marker.sha === manifest.frontend_sha, 'Source marker mismatch')
  return { release_id: manifest.release_id, frontend_sha: manifest.frontend_sha, manifest_sha256: sha256(bytes) }
}

function activate(t, id, current, result = 'activated', previous = current) {
  return checkReceipt(t.operation(result === 'validated' ? 'validate' : 'activate',
    [id.release_id, id.frontend_sha, current || 'none']), id, result, previous)
}

function prepare(dist, stateFile) {
  const state = parseStrictJson(fs.readFileSync(stateFile, 'utf8'), 'release state')
  require_(state.schema_version === 1 && state.phase === 'overlaid', 'Fresh overlay state required')
  state.identity = identity(dist)
  const manifest = parseStrictJson(fs.readFileSync(path.join(dist, MANIFEST_NAME), 'utf8'), 'manifest')
  state.ru_only = manifest.clusters.every((cluster) => Object.keys(cluster.members).join() === 'ru')
  state.payload_bytes = Number(run('python3', [TRANSPORT, 'size', dist]).trim())
  state.archive = `${stateFile}.package.tar.gz`
  const output = fs.openSync(state.archive, 'wx', 0o600)
  try { run('python3', [TRANSPORT, 'pack', dist], { stdio: ['ignore', output, 'pipe'] }) }
  finally { fs.closeSync(output) }
  state.archive_sha256 = run('python3', [TRANSPORT, 'hash', state.archive]).trim()
  state.phase = 'prepared'
  save(stateFile, state)
}

function readiness(t, id, deadline = Date.now() + 30000) {
  const remaining = () => {
    const ms = deadline - Date.now()
    require_(ms > 0, 'Public readiness exceeded its 30-second deadline')
    return ms
  }
  const nginx = `/etc/nginx/sbin/nginx`
  t.ssh(`docker exec ${quote(t.nginx)} ${nginx} -t -c /etc/nginx/conf/nginx.conf </dev/null && `
    + `docker exec ${quote(t.nginx)} ${nginx} -s reload -c /etc/nginx/conf/nginx.conf </dev/null`, { timeout: remaining() })
  for (const url of ['https://metravel.by/health', 'https://metravel.by/', 'https://metravel.by/api/travels/?perPage=1',
    'https://metravel.by/static/quests/quest-default-cover.svg']) {
    const status = run('curl', ['-sS', '--max-time', String(Math.min(15000, remaining()) / 1000), '-o', '/dev/null', '-w', '%{http_code}', url])
    require_(status === '200', 'Public readiness requires exact HTTP 200')
  }
  const marker = parseStrictJson(run('curl', ['-fsS', '--max-time', String(Math.min(15000, remaining()) / 1000), 'https://metravel.by/.build-source.json']), 'live marker')
  remaining()
  require_(marker.sha === id.frontend_sha, 'Live source marker mismatch')
}

function publishCover(t, id, deadline = Date.now() + 30000) {
  const timeout = deadline - Date.now()
  require_(timeout > 0, 'Shared cover exceeded its readiness deadline')
  const receipt = parseStrictJson(t.operation('cover', [id.release_id, id.frontend_sha, id.manifest_sha256], { timeout }), 'cover receipt')
  exactKeys(receipt, ['schema_version', 'result', 'release_id', 'sha256'])
  require_(receipt.schema_version === 1 && receipt.result === 'published'
    && receipt.release_id === id.release_id && /^[a-f0-9]{64}$/.test(receipt.sha256), 'Shared quest cover publication mismatch')
}

function checkInventory(t, incoming) {
  const budget = process.env.QUEST_SEO_MANAGED_MAX_BYTES
  require_(/^[1-9][0-9]*$/.test(budget || '') && Number.isSafeInteger(Number(budget)), 'Owner-selected QUEST_SEO_MANAGED_MAX_BYTES required')
  const inventory = parseStrictJson(t.operation('inventory', [budget, String(incoming)]), 'generation inventory')
  exactKeys(inventory, ['schema_version', 'release_count', 'total_bytes'])
  require_(inventory.schema_version === 1 && Number.isSafeInteger(inventory.release_count) && inventory.release_count >= 0
    && Number.isSafeInteger(inventory.total_bytes) && inventory.total_bytes >= 0
    && inventory.total_bytes + incoming <= Number(budget), 'Managed inventory budget mismatch')
  return { budget, inventory }
}

function publish(t, dist, stateFile, health = readiness) {
  const state = parseStrictJson(fs.readFileSync(stateFile, 'utf8'), 'release state')
  require_(JSON.stringify(identity(dist)) === JSON.stringify(state.identity), 'Prepared identity changed')
  publishPrepared(t, stateFile, health)
}

function publishPrepared(t, stateFile, health = readiness) {
  const state = parseStrictJson(fs.readFileSync(stateFile, 'utf8'), 'release state')
  require_(state.schema_version === 1 && state.phase === 'prepared', 'Prepared package required')
  const id = state.identity
  require_(id && RELEASE_ID.test(id.release_id) && SHA.test(id.frontend_sha) && /^[a-f0-9]{64}$/.test(id.manifest_sha256), 'Prepared identity invalid')
  require_(state.archive === `${stateFile}.package.tar.gz` && Number.isSafeInteger(state.payload_bytes)
    && state.payload_bytes > 0 && state.payload_bytes <= 2 * 1024 ** 3, 'Prepared archive bound/path mismatch')
  require_(run('python3', [TRANSPORT, 'hash', state.archive]).trim() === state.archive_sha256, 'Prepared archive changed')
  preflight(t)
  require_(state.base.kind !== 'legacy', 'Normal v1 publication refuses legacy conversion; owner maintenance required')
  const actual = inspect(t)
  const expected = state.base.current?.release_id || null
  require_(actual.kind === state.base.kind && actual.current?.release_id === state.base.current?.release_id,
    'Active root changed since overlay; rebuild against the actual pointer')
  require_(actual.kind !== 'absent' || state.ru_only, 'First v1 generation must be a full RU-only baseline')
  const { budget, inventory } = checkInventory(t, state.payload_bytes)
  state.inventory = inventory
  save(stateFile, state)
  try {
    const guard = `bash -s -- preflight ${quote(t.remote)} ${Math.ceil(state.payload_bytes / 1024)} ${quote(process.env.DEPLOY_DISK_RESERVE_MB || '720')} 1536`
    t.ssh(guard, { input: fs.readFileSync(path.join(__dirname, 'deploy-disk-guard.sh')) })
    const input = fs.openSync(state.archive, 'r')
    let staged
    try { staged = parseStrictJson(t.operation('stage', [id.release_id, expected || 'none', budget, String(state.payload_bytes)], { stdio: [input, 'pipe', 'pipe'] }), 'staging receipt') }
    finally { fs.closeSync(input) }
    exactKeys(staged, ['schema_version', 'release_id', 'result'])
    require_(staged.schema_version === 1 && staged.release_id === id.release_id && staged.result === 'staged', 'Staging identity mismatch')
    state.validated = activate(t, id, expected, 'validated')
    state.phase = 'validated'
    save(stateFile, state)
    state.activation_started_at = Date.now()
    state.activated = activate(t, id, expected)
    state.phase = 'activated'
    save(stateFile, state)
  } catch (error) {
    state.phase = 'inspect-required'
    try { state.actual = inspect(t) } catch { state.actual = null }
    state.failure = error.message
    save(stateFile, state)
    throw new Error(`${error.message}; generations retained; inspect/recover with ${stateFile}`)
  }
  try {
    publishCover(t, id, state.activation_started_at + 30000)
    health(t, id, state.activation_started_at + 30000)
    state.phase = 'ready'
    save(stateFile, state)
  } catch (error) {
    rollback(t, state, stateFile, health)
    throw error
  }
}

function baseline(t, file, health = readiness) {
  require_(process.env.QUEST_SEO_OWNER_MAINTENANCE === '1', 'Initial baseline requires separately authorized owner maintenance')
  preflight(t)
  const state = parseStrictJson(fs.readFileSync(file, 'utf8'), 'release state')
  require_(state.phase === 'prepared' && state.base.kind === 'legacy' && state.ru_only, 'Prepared full RU baseline required')
  const actual = inspect(t)
  require_(actual.kind === 'absent', 'Owner must quiesce and move legacy root to its retained backup first')
  state.migration_base = state.base
  state.base = actual
  save(file, state)
  publishPrepared(t, file, health)
}

function rollback(t, state, file, health = readiness) {
  const prior = state.base.current
  require_(prior, 'No retained prior release; owner recovery required')
  const deadline = Date.now() + 30000
  state.rollback = activate(t, prior, state.identity.release_id)
  state.phase = 'rolled-back'
  save(file, state)
  publishCover(t, prior, deadline)
  health(t, prior, deadline)
}

function recover(t, file, health = readiness) {
  preflight(t)
  const state = parseStrictJson(fs.readFileSync(file, 'utf8'), 'release state')
  const actual = inspect(t)
  require_(state.identity && actual.current?.release_id === state.identity.release_id,
    'Actual pointer is another release; owner must inspect, no stale retry')
  const deadline = Date.now() + 30000
  state.activated = activate(t, state.identity, actual.current.release_id, 'activated', state.base.current?.release_id || null)
  state.phase = 'activated'
  save(file, state)
  publishCover(t, state.identity, deadline)
  health(t, state.identity, deadline)
  state.phase = 'ready'
  save(file, state)
}

function main(args) {
  const [action, dist, stateFile] = args
  if (action === 'prepare') { prepare(path.resolve(dist), path.resolve(stateFile)); return }
  const t = transport()
  if (action === 'receipt') process.stdout.write(t.operation('receipt'))
  else if (action === 'inspect') process.stdout.write(`${JSON.stringify(inspect(t))}\n`)
  else if (action === 'overlay') overlay(t, path.resolve(dist), path.resolve(stateFile))
  else if (action === 'publish') publish(t, path.resolve(dist), path.resolve(stateFile))
  else if (action === 'recover') recover(t, path.resolve(dist))
  else if (action === 'baseline') baseline(t, path.resolve(dist))
  else if (action === 'rollback') { preflight(t); const file = path.resolve(dist); rollback(t, parseStrictJson(fs.readFileSync(file, 'utf8'), 'state'), file) }
  else throw new Error('Unknown quest SEO operation')
}

if (require.main === module) {
  try { main(process.argv.slice(2)) } catch (error) { console.error(`ERROR: ${error.message}`); process.exitCode = 1 }
}
module.exports = { checkReceipt, inspect, transport, quote, prepare, publish, recover, rollback, overlay, readiness, baseline, checkInventory, publishCover }
