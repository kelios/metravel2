#!/usr/bin/env node
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { spawnSync } = require('child_process')
const { captureWorker, supervise } = require('./lib/ownedProcessSupervisor')
const {
  MANIFEST_NAME, SHA, RELEASE_ID, parseStrictJson, validateManifest, sha256, canonicalJson,
} = require('./lib/questSeoContract')

const TRANSPORT = path.join(__dirname, 'quest-seo-transport.py')
const KEYS = ['schema_version', 'result', 'release_id', 'previous_release_id', 'frontend_sha',
  'manifest_sha256', 'root_key', 'relative_release_root']
const PLAN_KEYS = ['schema_version', 'expected_current', 'index_sha256', 'budget_bytes', 'reserve_bytes',
  'logical_bytes', 'physical_bytes', 'incremental_bytes', 'directory_allowance_bytes', 'temporary_bytes',
  'private_index_bytes', 'peak_bytes', 'required_free_bytes', 'sources_sha256', 'plan_sha256']
const BACKEND_RESERVE = 1536 * 1024 ** 2
const CAPTURE_NONCE = /^[a-f0-9]{48}$/
// The existing expanded 2-GiB / 50,000-entry bound plus gzip/tar framing.
const MAX_CAPTURE_BYTES = 2 * 1024 ** 3 + 64 * 1024 ** 2
const GATEWAY_PROBE_PATH = /^\/(be|uk|pl|en)\/quests\/[1-9][0-9]*\/[A-Za-z0-9_-]{1,100}$/
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
    `docker exec${['stage-v2', 'storage-plan-v2', 'stage-v3', 'transfer-plan-v3'].includes(action) ? ' -i' : ''} ${quote(app)} python -c ${quote(python)} ${[action, ...args].map(quote).join(' ')}`, options)
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
  const code = fs.readFileSync(TRANSPORT).toString('base64')
  const python = `import base64;exec(compile(base64.b64decode('${code}'),'<quest-seo-transport>','exec'))`
  t.ssh(`set -eu; cd ${quote(t.remote)}; test -d static; test ! -L static; `
    + `status=$(git status --porcelain); unexpected=$(printf '%s\\n' "$status" | sed '/^?? dump.sql$/d; /^?? deploy\\/prod\\/nginx\\/ssl\\//d; /^?? dist\\//d; /^$/d'); `
    + `test -z "$unexpected"; test -z "$(git ls-files -- static/dist static/quest-seo-releases static/.quest-seo-operation.lock static/.quest-seo-activation.json static/quests/quest-default-cover.svg)"; `
    + `python3 -c ${quote(python)} static-preflight ${[t.remote, t.app, t.nginx].map(quote).join(' ')}`)
}

function legacyRootIdentity(t) {
  const code = 'import json,os,stat,sys;p=sys.argv[1];s=os.lstat(p);'
    + 'assert stat.S_ISDIR(s.st_mode) and os.path.realpath(p)==p;'
    + 'print(json.dumps({"device":s.st_dev,"inode":s.st_ino}))'
  const result = parseStrictJson(t.ssh(`python3 -c ${quote(code)} ${quote(`${t.remote}/static/dist`)}`), 'legacy root identity')
  exactKeys(result, ['device', 'inode'])
  require_([result.device, result.inode].every((v) => Number.isSafeInteger(v) && v >= 0), 'Invalid legacy root identity')
  return result
}

function sameBase(expected, actual) {
  return expected.kind === actual.kind && (expected.kind !== 'managed'
    || ['schema_version', 'release_id', 'frontend_sha', 'manifest_sha256', 'tree_sha256']
      .every((key) => expected.current?.[key] === actual.current?.[key]))
}

function capturePath(stateFile, nonce) {
  require_(CAPTURE_NONCE.test(nonce || ''), 'Unique build capture nonce required')
  require_(path.isAbsolute(stateFile) && fs.realpathSync(path.dirname(stateFile)) === path.dirname(stateFile),
    'Canonical private state directory required')
  return `${stateFile}.overlay-${nonce}.tar.gz`
}

function archiveDigest(fd) {
  const hash = crypto.createHash('sha256'), chunk = Buffer.alloc(1024 * 1024)
  let position = 0, size
  while ((size = fs.readSync(fd, chunk, 0, chunk.length, position))) {
    hash.update(chunk.subarray(0, size)); position += size
    require_(position <= MAX_CAPTURE_BYTES, 'Captured archive exceeds bound')
  }
  return hash.digest('hex')
}

function openCapture(archive) {
  const fd = fs.openSync(archive, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
  try {
    const info = fs.fstatSync(fd)
    require_(info.isFile() && info.nlink === 1 && (info.mode & 0o077) === 0
      && (typeof process.getuid !== 'function' || info.uid === process.getuid())
      && info.size > 0 && info.size <= MAX_CAPTURE_BYTES, 'Bounded private regular capture required')
    return { fd, info }
  } catch (error) { fs.closeSync(fd); throw error }
}

function unchangedArchive(fd, info) {
  const actual = fs.fstatSync(fd)
  require_(actual.size === info.size && actual.mtimeMs === info.mtimeMs && actual.ctimeMs === info.ctimeMs,
    'Captured archive changed while reading')
}

function captureOverlay(t, dist, stateFile, nonce) {
  const archive = capturePath(stateFile, nonce)
  require_(!fs.existsSync(stateFile) && !fs.lstatSync(path.dirname(stateFile)).isSymbolicLink(), 'Fresh capture state required')
  preflight(t)
  const base = inspect(t)
  const legacyRoot = base.kind === 'legacy' ? legacyRootIdentity(t) : null
  checkInventory(t, 0)
  let complete = false
  const output = fs.openSync(archive, 'wx', 0o600)
  try {
    try {
      t.operation('overlay', [base.kind, base.current?.release_id || 'none'], { stdio: ['ignore', output, 'pipe'] })
    } finally { fs.closeSync(output) }
    require_(sameBase(base, inspect(t)) && (base.kind !== 'legacy'
      || JSON.stringify(legacyRootIdentity(t)) === JSON.stringify(legacyRoot)), 'Active root changed during capture')
    const { fd, info } = openCapture(archive)
    let digest
    try { digest = archiveDigest(fd); unchangedArchive(fd, info) } finally { fs.closeSync(fd) }
    const state = { schema_version: 1, phase: 'captured', base, capture: {
      nonce, state_file: stateFile, dist, archive, bytes: info.size, sha256: digest, legacy_root: legacyRoot,
    } }
    // Publish only the complete, closed, hash-bound result; never replace stale state.
    const temporary = `${stateFile}.${nonce}.tmp`
    try {
      fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
      fs.linkSync(temporary, stateFile)
    } finally { fs.rmSync(temporary, { force: true }) }
    complete = true
  } finally { if (!complete) fs.rmSync(archive, { force: true }) }
}

function applyOverlay(t, dist, stateFile, nonce) {
  const state = parseStrictJson(fs.readFileSync(stateFile, 'utf8'), 'captured release state')
  const capture = state.capture, archive = capturePath(stateFile, nonce)
  require_(state.schema_version === 1 && state.phase === 'captured' && capture?.nonce === nonce
    && capture.state_file === stateFile && capture.dist === dist && capture.archive === archive,
  'Fresh build-bound capture required')
  preflight(t)
  const actual = inspect(t)
  require_(sameBase(state.base, actual) && (actual.kind !== 'legacy'
    || JSON.stringify(legacyRootIdentity(t)) === JSON.stringify(capture.legacy_root)), 'Active root changed since capture')
  const { fd, info } = openCapture(archive)
  let temporary
  try {
    require_(Number.isSafeInteger(capture.bytes) && capture.bytes === info.size
      && /^[a-f0-9]{64}$/.test(capture.sha256) && archiveDigest(fd) === capture.sha256, 'Captured archive digest/size mismatch')
    unchangedArchive(fd, info)
    temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'metravel-quest-overlay-')))
    const previous = path.join(temporary, 'previous')
    fs.mkdirSync(previous)
    run('python3', [TRANSPORT, 'unpack', previous], { stdio: [fd, 'pipe', 'pipe'] })
    unchangedArchive(fd, info)
    run('bash', [path.join(__dirname, 'deploy-expo-overlay.sh'), path.join(dist, '_expo/static'), previous,
      process.env.EXPO_OVERLAY_RETENTION_DAYS || '14', process.env.EXPO_OVERLAY_MAX_MB || '256'], { stdio: 'inherit' })
    save(stateFile, { schema_version: 1, phase: 'overlaid', base: state.base })
    fs.unlinkSync(archive)
  } finally {
    fs.closeSync(fd)
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true })
  }
}

function discardCapture(stateFile, nonce) {
  const archive = capturePath(stateFile, nonce)
  if (fs.existsSync(stateFile)) {
    const state = parseStrictJson(fs.readFileSync(stateFile, 'utf8'), 'captured release state')
    if (state.phase === 'captured' && state.capture?.nonce === nonce && state.capture.state_file === stateFile
      && state.capture.archive === archive) fs.unlinkSync(stateFile)
  }
  fs.rmSync(archive, { force: true })
  fs.rmSync(`${stateFile}.${nonce}.tmp`, { force: true })
}

function overlay(t, dist, stateFile) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true })
  // Preserve the original synchronous entrypoint's support for /tmp and other
  // symlinked parent aliases while binding the private split flow physically.
  stateFile = path.join(fs.realpathSync(path.dirname(stateFile)), path.basename(stateFile))
  const nonce = crypto.randomBytes(24).toString('hex')
  captureOverlay(t, dist, stateFile, nonce)
  applyOverlay(t, dist, stateFile, nonce)
}

function superviseCapture(dist, stateFile, nonce, command = ['bash', path.join(__dirname, 'quest-seo-operation.sh'), 'capture-sync', dist, stateFile, nonce]) {
  // Transport setup performs SSH too, so run it inside the owned worker group.
  capturePath(stateFile, nonce)
  return supervise(command, 'Quest asset capture').then((code) => {
    if (code !== 0) discardCapture(stateFile, nonce)
    return code
  })
}

function identity(dist, bytes = fs.readFileSync(path.join(dist, MANIFEST_NAME), 'utf8')) {
  const manifest = validateManifest(parseStrictJson(bytes, 'manifest'))
  const marker = parseStrictJson(fs.readFileSync(path.join(dist, '.build-source.json'), 'utf8'), 'build marker')
  require_(marker.sha === manifest.frontend_sha, 'Source marker mismatch')
  return { release_id: manifest.release_id, frontend_sha: manifest.frontend_sha, manifest_sha256: sha256(bytes) }
}

function activate(t, id, current, result = 'activated', previous = current) {
  return checkReceipt(t.operation(result === 'validated' ? 'validate' : 'activate',
    [id.release_id, id.frontend_sha, current || 'none']), id, result, previous)
}

function publicationMode(manifest) {
  const translated = manifest.clusters.flatMap((cluster) => Object.values(cluster.members))
    .find((member) => member.locale !== 'ru')
  const probe = translated?.canonical_path
  require_(!translated || (typeof probe === 'string' && GATEWAY_PROBE_PATH.test(probe)), 'Invalid prepared gateway probe path')
  return { ru_only: !translated, gateway_probe_path: probe }
}

function prepare(dist, stateFile) {
  const state = parseStrictJson(fs.readFileSync(stateFile, 'utf8'), 'release state')
  require_(state.schema_version === 1 && state.phase === 'overlaid', 'Fresh overlay state required')
  const manifestBytes = fs.readFileSync(path.join(dist, MANIFEST_NAME), 'utf8')
  state.identity = identity(dist, manifestBytes)
  const manifest = parseStrictJson(manifestBytes, 'manifest')
  Object.assign(state, publicationMode(manifest))
  state.payload_bytes = Number(run('python3', [TRANSPORT, 'size', dist]).trim())
  state.index = `${stateFile}.files.v2.json`
  state.index_sha256 = run('python3', [TRANSPORT, 'index-v2', dist, state.index]).trim()
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
  require_(Number.isSafeInteger(incoming) && incoming >= 0, 'Invalid logical incoming bytes')
  const budget = managedBudget()
  const inventory = parseStrictJson(t.operation('inventory-v2', [budget]), 'generation physical inventory')
  exactKeys(inventory, ['schema_version', 'release_count', 'total_bytes', 'allocated_bytes', 'budget_bytes'])
  require_(inventory.schema_version === 2 && Number.isSafeInteger(inventory.release_count) && inventory.release_count >= 0
    && Number.isSafeInteger(inventory.total_bytes) && inventory.total_bytes >= 0
    && Number.isSafeInteger(inventory.allocated_bytes) && inventory.allocated_bytes >= 0
    && inventory.budget_bytes === Number(budget) && inventory.allocated_bytes <= Number(budget), 'Managed inventory budget mismatch')
  return { budget, inventory }
}

function managedBudget() {
  const budget = process.env.QUEST_SEO_MANAGED_MAX_BYTES
  require_(/^[1-9][0-9]*$/.test(budget || '') && Number.isSafeInteger(Number(budget)), 'Owner-selected QUEST_SEO_MANAGED_MAX_BYTES required')
  return budget
}

function retain(t, expected, budget) {
  const result = parseStrictJson(t.operation('retain-v2', [expected, budget]), 'bounded retention receipt')
  exactKeys(result, ['schema_version', 'result', 'active_release_id', 'preserved', 'removed', 'remaining_bytes', 'remaining_allocated_bytes'])
  require_(result.schema_version === 2 && result.result === 'cleaned' && result.active_release_id === expected
    && Array.isArray(result.preserved) && result.preserved.includes(expected) && result.preserved.length <= 2
    && Array.isArray(result.removed) && [...result.preserved, ...result.removed].every((id) => RELEASE_ID.test(id))
    && new Set([...result.preserved, ...result.removed]).size === result.preserved.length + result.removed.length
    && Number.isSafeInteger(result.remaining_bytes) && result.remaining_bytes >= 0
    && Number.isSafeInteger(result.remaining_allocated_bytes) && result.remaining_allocated_bytes >= 0
    && result.remaining_allocated_bytes <= Number(budget), 'Invalid bounded retention receipt')
  return result
}

function preparedIndex(state) {
  require_(state.index && fs.lstatSync(state.index).isFile() && fs.lstatSync(state.index).size <= 8 * 1024 ** 2, 'Bounded private file index required')
  const index = fs.readFileSync(state.index)
  require_(sha256(index) === state.index_sha256, 'Prepared private file index changed')
  return index
}

function storageReserve() {
  const diskReserve = process.env.DEPLOY_DISK_RESERVE_MB || '720'
  require_(/^[1-9][0-9]*$/.test(diskReserve) && Number.isSafeInteger(Number(diskReserve) * 1024 ** 2), 'Invalid deploy disk reserve')
  return Math.max(BACKEND_RESERVE, Number(diskReserve) * 1024 ** 2)
}

function validateStoragePlan(plan, state, budget, expected, reserve) {
  exactKeys(plan, PLAN_KEYS)
  const counters = PLAN_KEYS.filter((key) => key.endsWith('_bytes'))
  require_(plan.schema_version === 2 && plan.expected_current === expected && plan.index_sha256 === state.index_sha256
    && plan.budget_bytes === Number(budget) && plan.reserve_bytes === reserve && plan.logical_bytes === state.payload_bytes
    && counters.every((key) => Number.isSafeInteger(plan[key]) && plan[key] >= 0)
    && /^[a-f0-9]{64}$/.test(plan.sources_sha256) && /^[a-f0-9]{64}$/.test(plan.plan_sha256)
    && plan.peak_bytes === plan.physical_bytes + plan.incremental_bytes + plan.directory_allowance_bytes + plan.temporary_bytes + plan.private_index_bytes
    && plan.required_free_bytes === plan.peak_bytes - plan.physical_bytes + reserve
    && plan.peak_bytes <= Number(budget), 'Invalid private storage plan')
  return plan
}

function storagePlan(t, state, budget, expected) {
  const reserve = storageReserve()
  const plan = parseStrictJson(t.operation('storage-plan-v2', [expected || 'none', budget, String(reserve)],
    { input: preparedIndex(state), stdio: ['pipe', 'pipe', 'pipe'] }), 'private storage plan')
  return validateStoragePlan(plan, state, budget, expected, reserve)
}

function transferPlan(t, state, budget, expected) {
  const index = preparedIndex(state), reserve = storageReserve()
  const raw = t.operation('transfer-plan-v3', [expected || 'none', budget, String(reserve)],
    { input: index, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 8 * 1024 ** 2 + 16384 })
  require_(Buffer.byteLength(raw) <= 8 * 1024 ** 2 + 16384, 'Private transfer plan exceeds bound')
  const transfer = parseStrictJson(raw, 'private transfer plan')
  exactKeys(transfer, ['schema_version', 'storage_plan', 'required_paths', 'transfer_plan_sha256'])
  validateStoragePlan(transfer.storage_plan, state, budget, expected, reserve)
  const first = new Map()
  const pathOrder = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))
  for (const row of parseStrictJson(index.toString(), 'private index').files.sort((a, b) => pathOrder(a.path, b.path))) {
    const key = canonicalJson([row.sha256, row.size, row.mode, row.mtime])
    if (!first.has(key)) first.set(key, row.path)
  }
  const representatives = new Set(first.values())
  require_(transfer.schema_version === 3 && Array.isArray(transfer.required_paths)
    && transfer.required_paths.every((item) => typeof item === 'string' && representatives.has(item))
    && canonicalJson(transfer.required_paths) === canonicalJson([...new Set(transfer.required_paths)].sort(pathOrder)),
  'Invalid private transfer paths')
  const { transfer_plan_sha256: digest, ...unsigned } = transfer
  const { plan_sha256: planDigest, ...unsignedPlan } = transfer.storage_plan
  require_(sha256(canonicalJson(unsigned)) === digest && sha256(canonicalJson(unsignedPlan)) === planDigest,
    'Private transfer plan hash mismatch')
  return transfer
}

function verifyGateway(t, probePath) {
  require_(typeof probePath === 'string' && GATEWAY_PROBE_PATH.test(probePath), 'Invalid prepared gateway probe path')
  const python = `import hashlib,json,pathlib,re,subprocess,sys,urllib.error,urllib.request
remote,nginx,probe=sys.argv[1:]
if not re.fullmatch(r'/(be|uk|pl|en)/quests/[1-9][0-9]*/[A-Za-z0-9_-]{1,100}',probe): raise ValueError('Invalid gateway probe path')
with (pathlib.Path(remote)/'deploy/prod/nginx/nginx.conf').open('rb') as source: config=source.read(1024*1024+1)
if not config or len(config)>1024*1024: raise ValueError('Canonical gateway config exceeds bound')
canonical=hashlib.sha256(config).hexdigest()
digest=subprocess.run(['docker','exec',nginx,'sha256sum','/etc/nginx/conf/nginx.conf'],check=True,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=5).stdout
if len(digest)>4096 or not re.fullmatch(rb'[0-9a-f]{64}  /etc/nginx/conf/nginx.conf\\n?',digest): raise ValueError('Invalid running gateway config digest')
running=digest[:64].decode('ascii')
if running!=canonical: raise ValueError('Running gateway config differs from canonical source')
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs): return None
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
request=urllib.request.Request('https://metravel.by'+probe,method='HEAD',headers={'Cache-Control':'no-cache'})
try: response=opener.open(request,timeout=5)
except urllib.error.HTTPError as error: response=error
with response:
 def header(name):
  values=response.headers.get_all(name,[])
  if len(values)!=1 or len(values[0])>256: raise ValueError('Missing, duplicate or oversized gateway header')
  return values[0].strip()
 result={'schema_version':1,'result':'verified','probe_path':probe,'canonical_sha256':canonical,'running_sha256':running,'status':response.status,'cache_control':header('Cache-Control'),'pragma':header('Pragma'),'expires':header('Expires')}
raw=json.dumps(result,separators=(',',':'))
if len(raw.encode())>4096: raise ValueError('Gateway receipt exceeds bound')
print(raw)
`
  const raw = t.ssh(`# QUEST_SEO_GATEWAY_PROBE_V1\npython3 -c ${quote(python)} ${[t.remote, t.nginx, probePath].map(quote).join(' ')}`,
    { timeout: 20000, maxBuffer: 4096 })
  require_(typeof raw === 'string' && Buffer.byteLength(raw) <= 4096, 'Gateway receipt exceeds bound')
  const receipt = parseStrictJson(raw, 'live gateway receipt')
  exactKeys(receipt, ['schema_version', 'result', 'probe_path', 'canonical_sha256', 'running_sha256', 'status', 'cache_control', 'pragma', 'expires'])
  require_(receipt.schema_version === 1 && receipt.result === 'verified' && receipt.probe_path === probePath
    && /^[a-f0-9]{64}$/.test(receipt.canonical_sha256) && receipt.running_sha256 === receipt.canonical_sha256
    && [200, 404].includes(receipt.status) && receipt.cache_control === 'no-store'
    && receipt.pragma === 'no-cache' && receipt.expires === '0', 'Live canonical locale gateway required before translated publication')
  return receipt
}

function publish(t, dist, stateFile, health = readiness) {
  const state = parseStrictJson(fs.readFileSync(stateFile, 'utf8'), 'release state')
  const manifestBytes = fs.readFileSync(path.join(dist, MANIFEST_NAME), 'utf8')
  require_(JSON.stringify(identity(dist, manifestBytes)) === JSON.stringify(state.identity), 'Prepared identity changed')
  const mode = publicationMode(validateManifest(parseStrictJson(manifestBytes, 'manifest')))
  require_(state.ru_only === mode.ru_only && state.gateway_probe_path === mode.gateway_probe_path,
    'Prepared publication mode or gateway probe path changed')
  publishPrepared(t, stateFile, health)
}

function publishPrepared(t, stateFile, health = readiness) {
  const state = parseStrictJson(fs.readFileSync(stateFile, 'utf8'), 'release state')
  require_(state.schema_version === 1 && state.phase === 'prepared', 'Prepared package required')
  const id = state.identity
  require_(id && RELEASE_ID.test(id.release_id) && SHA.test(id.frontend_sha) && /^[a-f0-9]{64}$/.test(id.manifest_sha256), 'Prepared identity invalid')
  require_(state.archive === `${stateFile}.package.tar.gz` && Number.isSafeInteger(state.payload_bytes)
    && state.payload_bytes > 0 && state.payload_bytes <= 2 * 1024 ** 3, 'Prepared archive bound/path mismatch')
  require_(state.index === `${stateFile}.files.v2.json` && /^[a-f0-9]{64}$/.test(state.index_sha256 || ''),
    'Prepared v2 file index required; prepare this artifact with current tooling')
  preparedIndex(state)
  require_(run('python3', [TRANSPORT, 'hash', state.archive]).trim() === state.archive_sha256, 'Prepared archive changed')
  preflight(t)
  require_(state.base.kind !== 'legacy', 'Normal v1 publication refuses legacy conversion; owner maintenance required')
  const actual = inspect(t)
  const expected = state.base.current?.release_id || null
  require_(actual.kind === state.base.kind && actual.current?.release_id === state.base.current?.release_id,
    'Active root changed since overlay; rebuild against the actual pointer')
  require_(actual.kind !== 'absent' || state.ru_only, 'First v1 generation must be a full RU-only baseline')
  require_(typeof state.ru_only === 'boolean', 'Prepared publication mode required')
  if (!state.ru_only) state.gateway = verifyGateway(t, state.gateway_probe_path)
  const budget = managedBudget()
  if (expected) state.retention = retain(t, expected, budget)
  const { inventory } = checkInventory(t, 0)
  state.inventory = inventory
  state.transfer_plan = transferPlan(t, state, budget, expected)
  state.storage_plan = state.transfer_plan.storage_plan
  save(stateFile, state)
  try {
    const guard = `bash -s -- preflight ${quote(t.remote)} ${Math.ceil((state.storage_plan.peak_bytes - state.storage_plan.physical_bytes) / 1024)} ${quote(process.env.DEPLOY_DISK_RESERVE_MB || '720')} 1536`
    t.ssh(guard, { input: fs.readFileSync(path.join(__dirname, 'deploy-disk-guard.sh')) })
    const planFile = `${stateFile}.plan.v3.json`, frame = `${stateFile}.stage-v3`
    save(planFile, state.transfer_plan)
    let staged
    try {
      const output = fs.openSync(frame, 'wx', 0o600)
      try { run('python3', [TRANSPORT, 'frame-v3', state.index, planFile, state.archive], { stdio: ['ignore', output, 'pipe'] }) }
      finally { fs.closeSync(output) }
      const input = fs.openSync(frame, 'r')
      try { staged = parseStrictJson(t.operation('stage-v3', [id.release_id, expected || 'none', budget, String(state.storage_plan.reserve_bytes)], { stdio: [input, 'pipe', 'pipe'] }), 'staging receipt') }
      finally { fs.closeSync(input) }
    } finally { fs.rmSync(frame, { force: true }) }
    exactKeys(staged, ['schema_version', 'release_id', 'result', 'index_sha256', 'plan_sha256', 'transfer_plan_sha256', 'allocated_bytes', 'max_rss_bytes'])
    require_(staged.schema_version === 3 && staged.release_id === id.release_id && staged.result === 'staged'
      && staged.index_sha256 === state.index_sha256 && staged.plan_sha256 === state.storage_plan.plan_sha256
      && staged.transfer_plan_sha256 === state.transfer_plan.transfer_plan_sha256
      && Number.isSafeInteger(staged.max_rss_bytes) && staged.max_rss_bytes > 0
      && Number.isSafeInteger(staged.allocated_bytes) && staged.allocated_bytes >= 0
      && staged.allocated_bytes <= Number(budget), 'Staging identity mismatch')
    state.staged = staged
    state.validated = activate(t, id, expected, 'validated')
    state.phase = 'validated'
    save(stateFile, state)
    state.activation_started_at = Date.now()
    state.activated = activate(t, id, expected)
    // The 30-second readiness budget bounds the live, not-yet-verified pointer.
    // Full-tree validation before the switch (~41 s on prod) is not part of it.
    state.activated_at = Date.now()
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
    publishCover(t, id, state.activated_at + 30000)
    health(t, id, state.activated_at + 30000)
    state.phase = 'ready'
    save(stateFile, state)
  } catch (error) {
    // Keep the forward failure even if the rollback itself fails afterwards;
    // rollback() persists it, and nothing local may delay the rollback.
    state.failure = error.message
    try { rollback(t, state, stateFile, health) } catch (rollbackError) {
      try { save(stateFile, state) } catch { /* the thrown message still carries both errors */ }
      throw new Error(`${error.message}; rollback failed: ${rollbackError.message}`)
    }
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
  state.rollback = activate(t, prior, state.identity.release_id)
  const deadline = Date.now() + 30000
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
  state.activated = activate(t, state.identity, actual.current.release_id, 'activated', state.base.current?.release_id || null)
  const deadline = Date.now() + 30000
  state.phase = 'activated'
  save(file, state)
  publishCover(t, state.identity, deadline)
  health(t, state.identity, deadline)
  state.phase = 'ready'
  save(file, state)
}

function abortStage(t, file) {
  const state = parseStrictJson(fs.readFileSync(file, 'utf8'), 'release state')
  require_(state.schema_version === 1 && ['prepared', 'validated', 'inspect-required'].includes(state.phase)
    && RELEASE_ID.test(state.identity?.release_id || '') && ['managed', 'absent'].includes(state.base?.kind),
  'Hash-bound interrupted staging state required')
  require_(state.index === `${file}.files.v2.json` && state.storage_plan?.index_sha256 === state.index_sha256
    && /^[a-f0-9]{64}$/.test(state.storage_plan?.plan_sha256 || ''), 'Saved private staging plan required')
  preparedIndex(state)
  preflight(t)
  const receipt = parseStrictJson(t.operation('abort-stage-v2', [state.identity.release_id,
    state.base.current?.release_id || 'none', state.index_sha256, state.storage_plan.plan_sha256]), 'abort staging receipt')
  exactKeys(receipt, ['schema_version', 'result', 'release_id', 'index_sha256', 'plan_sha256'])
  require_(receipt.schema_version === 2 && receipt.result === 'aborted' && receipt.release_id === state.identity.release_id
    && receipt.index_sha256 === state.index_sha256 && receipt.plan_sha256 === state.storage_plan.plan_sha256,
  'Abort staging identity mismatch')
  state.aborted = receipt
  state.phase = 'aborted'
  save(file, state)
}

function main(args) {
  const [action, dist, stateFile, nonce] = args
  if (action === 'capture-worker') return captureWorker(JSON.parse(dist))
  if (action === 'capture') return superviseCapture(path.resolve(dist), path.resolve(stateFile), nonce)
  if (action === 'prepare') { prepare(path.resolve(dist), path.resolve(stateFile)); return }
  const t = transport()
  if (action === 'receipt') process.stdout.write(t.operation('receipt'))
  else if (action === 'inspect') process.stdout.write(`${JSON.stringify(inspect(t))}\n`)
  else if (action === 'overlay') overlay(t, path.resolve(dist), path.resolve(stateFile))
  else if (action === 'capture-sync') captureOverlay(t, path.resolve(dist), path.resolve(stateFile), nonce)
  else if (action === 'apply') applyOverlay(t, path.resolve(dist), path.resolve(stateFile), nonce)
  else if (action === 'publish') publish(t, path.resolve(dist), path.resolve(stateFile))
  else if (action === 'recover') recover(t, path.resolve(dist))
  else if (action === 'baseline') baseline(t, path.resolve(dist))
  else if (action === 'abort-stage') abortStage(t, path.resolve(dist))
  else if (action === 'rollback') { preflight(t); const file = path.resolve(dist); rollback(t, parseStrictJson(fs.readFileSync(file, 'utf8'), 'state'), file) }
  else throw new Error('Unknown quest SEO operation')
}

if (require.main === module) {
  Promise.resolve().then(() => main(process.argv.slice(2))).then((status) => {
    if (typeof status === 'number') process.exitCode = status
  }).catch((error) => { console.error(`ERROR: ${error.message}`); process.exitCode = 1 })
}
module.exports = { checkReceipt, inspect, transport, quote, prepare, publish, recover, rollback, overlay,
  captureOverlay, applyOverlay, superviseCapture, captureWorker,
  readiness, baseline, checkInventory, publishCover, storagePlan, transferPlan, verifyGateway, abortStage }
