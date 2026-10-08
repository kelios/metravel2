'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const os = require('node:os')
const { execFileSync } = require('node:child_process')
const { TokenError, validateToken } = require('./metravel-token-errors')
const MAX_CACHE_BYTES = 64 * 1024
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function canonicalPath(file) {
  try {
    const absolute = path.resolve(file)
    const parts = absolute.split(path.sep).filter(Boolean)
    let current = path.parse(absolute).root
    for (let index = 0; index < parts.length - 1; index++) {
      current = path.join(current, parts[index])
      const stat = fs.lstatSync(current)
      // macOS exposes these two OS-owned aliases; caller-created symlinks at
      // every other ancestor are forbidden, not just the final O_NOFOLLOW leaf.
      const systemAlias = process.platform === 'darwin' && ['/var', '/tmp'].includes(current) && fs.realpathSync(current) === `/private${current}`
      if ((!stat.isDirectory() && !systemAlias) || (stat.isSymbolicLink() && !systemAlias)) throw new Error()
    }
    return path.join(fs.realpathSync(path.dirname(absolute)), path.basename(absolute))
  } catch { throw new TokenError('cache', { operation: 'read' }) }
}

function fixtureHome(homeDir) {
  try {
    const stat = fs.lstatSync(homeDir)
    const canonical = fs.realpathSync(homeDir)
    const tempRoot = fs.realpathSync(os.tmpdir())
    const realHome = fs.realpathSync(os.homedir())
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) || (process.getuid && stat.uid !== process.getuid()) ||
        !canonical.startsWith(`${tempRoot}${path.sep}`) || canonical === realHome || canonical.startsWith(`${realHome}${path.sep}`)) throw new Error()
    canonicalPath(path.join(canonical, 'fixture-boundary'))
    return canonical
  } catch { throw new TokenError('configuration', { operation: 'configure' }) }
}

function assertContained(file, homeDir) {
  const canonical = canonicalPath(file)
  if (!canonical.startsWith(`${homeDir}${path.sep}`)) throw new TokenError('configuration', { operation: 'configure' })
  return canonical
}

function readRegular(file, { optional = true } = {}) {
  let fd
  try {
    const requested = path.resolve(file)
    const before = fs.lstatSync(requested)
    file = canonicalPath(requested)
    if (!before.isFile() || before.isSymbolicLink() || before.size > MAX_CACHE_BYTES) throw new TokenError('cache', { operation: 'read' })
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    const actual = fs.fstatSync(fd)
    if (actual.ino !== before.ino || actual.dev !== before.dev || actual.size > MAX_CACHE_BYTES) throw new TokenError('cache', { operation: 'read' })
    return { bytes: fs.readFileSync(fd), stat: actual }
  } catch (error) {
    if (optional && error.code === 'ENOENT') return null
    throw error instanceof TokenError ? error : new TokenError('cache', { operation: 'read' })
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}

function parseSource(source) {
  let value
  if (source.kind === 'value') value = source.value
  else if (source.kind === 'env') value = (source.env || process.env)[source.name]
  else if (source.kind === 'file') {
    const stored = readRegular(source.path)
    if (!stored) return null
    const text = stored.bytes.toString('utf8').trim()
    if (!text) return null
    if (source.format === 'json') {
      try { value = JSON.parse(text)[source.key || 'token'] } catch { throw new TokenError('cache', { operation: 'read' }) }
    } else if (source.format === 'plain' || !source.format) value = text
    else throw new TokenError('configuration', { operation: 'configure' })
  } else throw new TokenError('configuration', { operation: 'configure' })
  return value == null || value === '' ? null : validateToken(value)
}

function readTokenCandidate(sources) {
  if (!Array.isArray(sources) || sources.length > 16) throw new TokenError('configuration', { operation: 'configure' })
  for (const source of sources) {
    const token = parseSource(source)
    if (token) return token
  }
  return null
}

function protectedCache(file) {
  const normalized = path.resolve(file).replace(/\\/g, '/').toLowerCase()
  return /(?:^|\/)(?:\.metravel_editor_token|mcp_token\.json|metravel-task-board\.env)(?:$|\/)/.test(normalized) ||
    /(?:prod-probe|storage-state|storage_state|browser|playwright|e2e-auth)/.test(normalized)
}
const digest = (token) => crypto.createHash('sha256').update(token).digest('hex')
const bindingKey = (origin, cache) => `${origin}|${path.resolve(cache.path)}|${cache.format || 'plain'}|${cache.key || 'token'}`

function readBindings(file) {
  const stored = readRegular(file)
  if (!stored) return { version: 1, bindings: {} }
  try {
    const data = JSON.parse(stored.bytes.toString('utf8'))
    if (data.version !== 1 || !data.bindings || typeof data.bindings !== 'object' || Array.isArray(data.bindings)) throw new Error()
    return data
  } catch { throw new TokenError('cache', { operation: 'persist' }) }
}

function assertUnchanged(file, original) {
  const current = readRegular(file)
  if (Boolean(current) !== Boolean(original) || (current && (current.stat.ino !== original.stat.ino || current.stat.dev !== original.stat.dev || !current.bytes.equals(original.bytes)))) {
    throw new TokenError('cache', { operation: 'persist' })
  }
}

// All destinations are prepared before the first rename. If publication fails,
// restore the saved bytes; never return the refreshed token as a published success.
function publicationPaths(entries) {
  const names = new Set(), inodes = new Set()
  return entries.map((entry) => {
    const file = canonicalPath(entry.file)
    if (names.has(file)) throw new TokenError('cache', { operation: 'persist' })
    names.add(file)
    const original = readRegular(file)
    if (original) {
      const inode = `${original.stat.dev}:${original.stat.ino}`
      if (inodes.has(inode)) throw new TokenError('cache', { operation: 'persist' })
      inodes.add(inode)
    }
    return { ...entry, file, original }
  })
}

function atomicPublish(entries) {
  const destinations = publicationPaths(entries)
  const prepared = [], committed = [], restoreTemps = []
  let publicationError
  try {
    for (const { file, bytes, original } of destinations) {
      if (original && process.getuid && original.stat.uid !== process.getuid()) throw new TokenError('cache', { operation: 'persist' })
      const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(12).toString('hex')}.tmp`)
      const fd = fs.openSync(temp, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600)
      prepared.push({ file, temp, original })
      try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
    }
    for (const item of prepared) {
      assertUnchanged(item.file, item.original)
      // Remember the exact inode being published, not a post-rename reread that
      // could accidentally adopt a foreign writer's replacement as our own.
      item.published = readRegular(item.temp, { optional: false })
      fs.renameSync(item.temp, item.file)
      committed.push(item)
    }
  } catch {
    let restorationFailed = false
    for (const item of committed.reverse()) {
      try {
        assertUnchanged(item.file, item.published)
        if (!item.original) fs.unlinkSync(item.file)
        else {
          const temp = `${item.file}.${process.pid}.${crypto.randomBytes(12).toString('hex')}.restore`
          const fd = fs.openSync(temp, 'wx', 0o600)
          restoreTemps.push(temp)
          try { fs.writeFileSync(fd, item.original.bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
          assertUnchanged(item.file, item.published)
          fs.renameSync(temp, item.file)
        }
      } catch { restorationFailed = true }
    }
    publicationError = new TokenError('cache', { operation: restorationFailed ? 'refresh' : 'persist' })
  } finally {
    for (const temp of [...prepared.map((item) => item.temp), ...restoreTemps]) {
      try { fs.unlinkSync(temp) } catch (error) { if (error.code !== 'ENOENT' && !publicationError) publicationError = new TokenError('cache', { operation: 'persist' }) }
    }
  }
  if (publicationError) throw publicationError
}

function assertRefreshDestinations({ origin, homeDir, caches, verifiedTokens }) {
  const dedicated = path.join(homeDir, '.metravel_token.qa104')
  const metadata = path.join(homeDir, '.metravel_token.profiles.json')
  publicationPaths([...caches.map((cache) => ({ file: cache.path })), { file: metadata }])
  const bindings = readBindings(metadata)
  for (const cache of caches) {
    if (protectedCache(cache.path)) throw new TokenError('cache', { operation: 'persist' })
    const isDedicated = path.resolve(cache.path) === path.resolve(dedicated)
    if ((cache.authority === 'qa104' && !isDedicated) || (!isDedicated && cache.authority !== 'verified-binding')) throw new TokenError('cache', { operation: 'persist' })
    const previous = parseSource({ kind: 'file', ...cache })
    const bound = bindings.bindings[bindingKey(origin, cache)]
    if (isDedicated && previous && !verifiedTokens.has(previous) && !(bound && bound.id === 104 && bound.digest === digest(previous))) throw new TokenError('cache', { operation: 'persist' })
    const parent = fs.lstatSync(path.dirname(cache.path))
    if (!parent.isDirectory() || parent.isSymbolicLink()) throw new TokenError('cache', { operation: 'persist' })
    fs.accessSync(path.dirname(cache.path), fs.constants.W_OK)
    const existing = readRegular(cache.path)
    if (existing && process.getuid && existing.stat.uid !== process.getuid()) throw new TokenError('cache', { operation: 'persist' })
  }
}

function persistToken({ token, origin, homeDir, caches, verifiedTokens }) {
  const dedicated = path.join(homeDir, '.metravel_token.qa104')
  const metadata = path.join(homeDir, '.metravel_token.profiles.json')
  const bindings = readBindings(metadata)
  const entries = []
  for (const cache of caches) {
    if (protectedCache(cache.path)) throw new TokenError('cache', { operation: 'persist' })
    const isDedicated = path.resolve(cache.path) === path.resolve(dedicated)
    if (cache.authority === 'qa104' && !isDedicated) throw new TokenError('cache', { operation: 'persist' })
    const previous = parseSource({ kind: 'file', ...cache })
    const key = bindingKey(origin, cache)
    const bound = bindings.bindings[key]
    const hasVerifiedBinding = bound && bound.id === 104 && previous && bound.digest === digest(previous)
    if (!isDedicated && cache.authority !== 'verified-binding') throw new TokenError('cache', { operation: 'persist' })
    if (!isDedicated && !hasVerifiedBinding && !(previous && verifiedTokens.has(previous))) continue
    // A pre-existing dedicated cache must also have been checked for identity.
    if (isDedicated && previous && !verifiedTokens.has(previous) && !(bound && bound.id === 104 && bound.digest === digest(previous))) {
      throw new TokenError('cache', { operation: 'persist' })
    }
    let bytes
    if (cache.format === 'json') {
      const original = readRegular(cache.path)
      let object = {}
      if (original) {
        try { object = JSON.parse(original.bytes.toString('utf8')) } catch { throw new TokenError('cache', { operation: 'persist' }) }
        if (!object || typeof object !== 'object' || Array.isArray(object)) throw new TokenError('cache', { operation: 'persist' })
      }
      bytes = Buffer.from(`${JSON.stringify({ ...object, [cache.key || 'token']: token })}\n`)
    } else bytes = Buffer.from(`${token}\n`)
    entries.push({ file: cache.path, bytes })
    bindings.bindings[key] = { id: 104, digest: digest(token) }
  }
  if (!entries.length) throw new TokenError('cache', { operation: 'persist' })
  entries.push({ file: metadata, bytes: Buffer.from(`${JSON.stringify(bindings)}\n`) })
  atomicPublish(entries)
}

function processIdentity(pid) {
  try {
    process.kill(pid, 0)
  } catch (error) {
    if (error.code === 'ESRCH') return null
    throw new TokenError('lock', { operation: 'refresh' })
  }
  try {
    if (process.platform === 'linux') {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
      const start = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19]
      if (!/^\d+$/.test(start)) throw new Error()
      return `linux:${start}`
    }
    if (process.platform === 'darwin') {
      // lstart is a civil/locale-formatted date. Every participant must observe
      // the same birth identity even when its CLI has a different TZ or locale.
      const start = execFileSync('/bin/ps', ['-p', String(pid), '-o', 'lstart='], {
        encoding: 'utf8', timeout: 500, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, TZ: 'UTC', LC_ALL: 'C', LANG: 'C' },
      }).trim()
      if (!start || start.length > 128) throw new Error()
      return `darwin:${start}`
    }
  } catch {
    // Disappearance between kill(0) and the OS metadata read is a dead process,
    // while unreadable metadata for a live process is fail-closed.
    try { process.kill(pid, 0) } catch (error) { if (error.code === 'ESRCH') return null }
  }
  throw new TokenError('lock', { operation: 'refresh' })
}

function readOwner(stored, { claim = false } = {}) {
  let owner
  try { owner = JSON.parse(stored.bytes.toString('utf8')) } catch { throw new TokenError('lock', { operation: 'refresh' }) }
  if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0 || typeof owner.nonce !== 'string' || !/^[a-f0-9]{48}$/.test(owner.nonce) ||
      (claim && (typeof owner.birth !== 'string' || !owner.birth || typeof owner.choosing !== 'boolean' || !Number.isSafeInteger(owner.ticket) || owner.ticket < 0 || (!owner.choosing && owner.ticket === 0)))) {
    throw new TokenError('lock', { operation: 'refresh' })
  }
  return owner
}

function ownerIsAlive(owner) {
  const birth = processIdentity(owner.pid)
  return Boolean(birth && (!owner.birth || owner.birth === birth))
}

function writeClaim(file, owner, initial = false) {
  const temp = `${file}.${crypto.randomBytes(12).toString('hex')}.tmp`
  try {
    const fd = fs.openSync(temp, 'wx', 0o600)
    try { fs.writeFileSync(fd, JSON.stringify(owner)); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
    // Initial publication is complete and exclusive: no observable empty claim.
    if (initial) fs.linkSync(temp, file)
    else fs.renameSync(temp, file)
  } catch { throw new TokenError('lock', { operation: 'refresh' }) }
  finally { try { fs.unlinkSync(temp) } catch { /* Never delete somebody else's claim on cleanup. */ } }
}

function liveClaims(directory) {
  const files = fs.readdirSync(directory).filter((name) => name.endsWith('.json'))
  if (files.length > 128) throw new TokenError('lock', { operation: 'refresh' })
  const claims = []
  for (const name of files) {
    const stored = readRegular(path.join(directory, name))
    if (!stored) continue
    const owner = readOwner(stored, { claim: true })
    if (name !== `${owner.pid}-${owner.nonce}.json`) throw new TokenError('lock', { operation: 'refresh' })
    // Unique nonce filenames are never reused by another process/generation.
    // A stale claim need not be unlinked to recover; ignoring it cannot remove
    // a new live generation at the shared primary lock path.
    if (ownerIsAlive(owner)) claims.push({ name, owner })
  }
  return claims
}

async function withRefreshLock(lockFile, deadline, work, hooks = {}) {
  lockFile = canonicalPath(lockFile)
  const directory = `${lockFile}.claims`
  try { fs.mkdirSync(directory, { mode: 0o700 }) } catch (error) { if (error.code !== 'EEXIST') throw new TokenError('lock', { operation: 'refresh' }) }
  const stat = fs.lstatSync(directory)
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) || (process.getuid && stat.uid !== process.getuid())) throw new TokenError('lock', { operation: 'refresh' })
  const nonce = crypto.randomBytes(24).toString('hex')
  const owner = { pid: process.pid, nonce, birth: processIdentity(process.pid), choosing: true, ticket: 0 }
  const claimName = `${owner.pid}-${nonce}.json`
  const claimFile = path.join(directory, claimName)
  let published = false, owned = false, result, failure
  try {
    // Test-only barrier may inspect the old generation before entering election.
    // Correctness never relies on this optimistic snapshot.
    if (hooks.afterInspect) await hooks.afterInspect(readRegular(lockFile))
    writeClaim(claimFile, owner, true); published = true
    if (hooks.afterChoosing) await hooks.afterChoosing()
    const claims = liveClaims(directory)
    owner.ticket = Math.max(0, ...claims.map(({ owner: other }) => other.ticket)) + 1
    if (!Number.isSafeInteger(owner.ticket)) throw new TokenError('lock', { operation: 'refresh' })
    owner.choosing = false
    writeClaim(claimFile, owner)
    if (hooks.afterTicket) await hooks.afterTicket()
    for (;;) {
      if (Date.now() >= deadline) throw new TokenError('lock', { operation: 'refresh' })
      const ahead = liveClaims(directory).some(({ name, owner: other }) => name !== claimName &&
        (other.choosing || other.ticket < owner.ticket || (other.ticket === owner.ticket && name < claimName)))
      if (!ahead) break
      await sleep(Math.min(15, Math.max(1, deadline - Date.now())))
    }
    // All cooperating acquisitions AND releases hold their elected claim. The
    // read/dead-unlink/wx-acquire sequence cannot interleave with another winner.
    for (;;) {
      const stored = readRegular(lockFile)
      if (!stored) {
        writeClaim(lockFile, owner, true); owned = true; break
      }
      const previous = readOwner(stored)
      if (!ownerIsAlive(previous)) {
        assertUnchanged(lockFile, stored)
        fs.unlinkSync(lockFile)
        continue
      }
      if (Date.now() >= deadline) throw new TokenError('lock', { operation: 'refresh' })
      await sleep(Math.min(15, Math.max(1, deadline - Date.now())))
    }
    result = await work()
  } catch (error) { failure = error }
  if (owned) {
    try {
      const stored = readRegular(lockFile)
      if (!stored) throw new Error()
      const previous = readOwner(stored)
      if (previous.pid !== owner.pid || previous.nonce !== nonce || previous.birth !== owner.birth) throw new Error()
      assertUnchanged(lockFile, stored)
      fs.unlinkSync(lockFile)
    } catch { if (!failure) failure = new TokenError('lock', { operation: 'refresh' }) }
  }
  if (published) {
    try {
      const stored = readRegular(claimFile)
      if (!stored) throw new Error()
      const previous = readOwner(stored, { claim: true })
      if (previous.pid !== owner.pid || previous.nonce !== nonce || previous.birth !== owner.birth) throw new Error()
      fs.unlinkSync(claimFile)
    } catch { if (!failure) failure = new TokenError('lock', { operation: 'refresh' }) }
  }
  if (failure) throw failure
  return result
}

module.exports = { parseSource, readTokenCandidate, readRegular, protectedCache, canonicalPath, fixtureHome, assertContained,
  assertRefreshDestinations, persistToken, atomicPublish, withRefreshLock, processIdentity }
