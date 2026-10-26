#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { randomBytes } = require('node:crypto')
const { spawnSync } = require('node:child_process')
const { verifiedFontBundle } = require('./prepare-book-renderer-fonts')

const ROOT = path.resolve(__dirname, '..')
const ENV_FILES = Object.freeze(['.env', '.env.prod', '.env.e2e'])
const ANDROID_FILES = Object.freeze([
  '.secrets/metravel-android-prod.env',
  '.secrets/google-services.json',
  '.secrets/metravel-android-release.json',
  '.secrets/metravel-android-upload.jks',
  '.secrets/google-play-service-account.json',
])
const FONT_DIR = '.codex-temp/book-renderer-fonts'
const USAGE = 'Usage: npm run worktree:bootstrap -- [--force] [--android-secrets] [--help]'

class BootstrapError extends Error {}
const fail = (message) => { throw new BootstrapError(message) }
const hasControlCharacters = (value) => Array.from(value).some((character) => character.charCodeAt(0) < 32)

function runGit(cwd, args, input) {
  return spawnSync('git', args, {
    cwd, input, encoding: 'utf8', stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'ignore'],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  })
}

function gitValue(git, root, args) {
  const result = git(root, args)
  if (result.status !== 0) fail('Cannot verify frontend checkout metadata.')
  return String(result.stdout || '').trim()
}

function real(file) {
  try { return fs.realpathSync(file) }
  catch { fail('Cannot verify frontend checkout paths.') }
}

function commonDir(git, root) {
  return real(path.resolve(root, gitValue(git, root, ['rev-parse', '--git-common-dir'])))
}

function primaryWorktree(git, root) {
  let result = git(root, ['worktree', 'list', '--porcelain', '-z'])
  let first
  if (result.status === 0) {
    first = String(result.stdout).split('\0')[0]
  } else {
    // Older macOS Git has no -z. Reject quoted/control-containing paths rather
    // than interpreting C escapes or accidentally selecting another checkout.
    result = git(root, ['worktree', 'list', '--porcelain'])
    if (result.status !== 0) fail('Cannot list frontend worktrees.')
    first = String(result.stdout).split('\n')[0]
    if (first.startsWith('worktree "')) fail('Worktree path requires a newer Git with porcelain -z support.')
  }
  if (!first.startsWith('worktree ') || hasControlCharacters(first)) {
    fail('Cannot safely identify the primary frontend worktree.')
  }
  const primary = real(first.slice('worktree '.length))
  if (commonDir(git, primary) !== commonDir(git, root)) fail('Worktree Git directories do not match.')
  return primary
}

function localOrigin(origin, root) {
  if (!origin || hasControlCharacters(origin) || /^[a-z][a-z0-9+.-]*:/i.test(origin) || origin.includes('@')) return null
  const candidate = path.resolve(root, origin)
  return fs.existsSync(candidate) ? real(candidate) : null
}

function canonicalOrigin(origin) {
  return /^(?:git@github\.com:|https:\/\/github\.com\/|ssh:\/\/git@github\.com\/)kelios\/metravel2(?:\.git)?\/?$/.test(origin)
}

function assertRoot(git, root) {
  if (real(gitValue(git, root, ['rev-parse', '--show-toplevel'])) !== root) fail('Run bootstrap from the frontend checkout root.')
  let name
  try { name = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name }
  catch { fail('Cannot verify frontend package identity.') }
  if (name !== 'metravel') fail('Bootstrap is restricted to our MeTravel frontend checkout.')
}

function resolvePrimary(root, git = runGit, visited = new Set()) {
  root = real(root)
  if (visited.has(root) || visited.size >= 8) fail('Invalid local shared-clone source chain.')
  visited.add(root)
  assertRoot(git, root)
  const primary = primaryWorktree(git, root)
  assertRoot(git, primary)
  const origin = gitValue(git, primary, ['remote', 'get-url', 'origin'])
  if (canonicalOrigin(origin)) return primary
  const parent = localOrigin(origin, primary)
  if (!parent) fail('Bootstrap is restricted to our MeTravel frontend checkout.')
  assertRoot(git, parent)
  const objects = real(path.resolve(parent, gitValue(git, parent, ['rev-parse', '--git-path', 'objects'])))
  const cloneObjects = real(path.resolve(primary, gitValue(git, primary, ['rev-parse', '--git-path', 'objects'])))
  let alternates
  try { alternates = fs.readFileSync(path.join(cloneObjects, 'info/alternates'), 'utf8').trim().split(/\r?\n/) }
  catch { fail('Shared clone must borrow objects from its local origin.') }
  if (alternates.length !== 1 || real(path.resolve(cloneObjects, alternates[0])) !== objects) {
    fail('Shared-clone object source does not match its local origin.')
  }
  const head = gitValue(git, root, ['rev-parse', 'HEAD'])
  if (!/^[a-f0-9]{40,64}$/.test(head) || !gitValue(git, parent, ['for-each-ref', `--contains=${head}`, '--format=%(refname)'])) {
    fail('Shared-clone HEAD is not reachable from source refs.')
  }
  return resolvePrimary(parent, git, visited)
}

function lstat(file) {
  try { return fs.lstatSync(file) }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

function safePath(root, relative, directory = false) {
  const parts = relative.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..') || path.isAbsolute(relative)) fail('Invalid bootstrap allowlist path.')
  let current = root
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index])
    const stat = lstat(current)
    if (!stat) continue
    if (stat.isSymbolicLink()) fail(`Refusing symlink in ${relative}.`)
    const needsDirectory = index < parts.length - 1 || directory
    if (needsDirectory ? !stat.isDirectory() : !stat.isFile()) fail(`Unexpected file type in ${relative}.`)
  }
  return current
}

function nulFields(output) {
  if (typeof output !== 'string' || (output && !output.endsWith('\0'))) fail('Cannot verify bootstrap path policy.')
  return output ? output.slice(0, -1).split('\0') : []
}

function assertIgnoredPaths(git, root, files) {
  const allowed = new Set(files)
  const paths = [...allowed]
  const tracked = git(root, ['ls-files', '-z', '--', ...paths])
  if (tracked.error || tracked.signal || tracked.status !== 0) fail('Cannot verify bootstrap path policy.')
  const trackedPaths = nulFields(tracked.stdout)
  if (trackedPaths.some((relative) => !allowed.has(relative)) || new Set(trackedPaths).size !== trackedPaths.length) {
    fail('Cannot verify bootstrap path policy.')
  }
  if (trackedPaths.length) fail('Refusing tracked bootstrap paths.')

  // Verbose records distinguish ignored paths from explicit !negations.
  const ignored = git(root, ['check-ignore', '--no-index', '--verbose', '--non-matching', '-z', '--stdin'], `${paths.join('\0')}\0`)
  if (ignored.error || ignored.signal || ![0, 1].includes(ignored.status)) fail('Cannot verify bootstrap path policy.')
  const fields = nulFields(ignored.stdout)
  if (fields.length !== paths.length * 4) fail('Cannot verify bootstrap path policy.')
  const seen = new Set()
  for (let index = 0; index < fields.length; index += 4) {
    const [source, line, pattern, relative] = fields.slice(index, index + 4)
    if (!allowed.has(relative) || seen.has(relative)) fail('Cannot verify bootstrap path policy.')
    seen.add(relative)
    if (!source || !/^[1-9]\d*$/.test(line) || !Number.isSafeInteger(Number(line)) || !pattern || pattern.startsWith('!')) {
      fail('Bootstrap paths must be ignored.')
    }
  }
  if (ignored.status !== 0) fail('Bootstrap paths must be ignored.')
}

function copyIndependent(source, target, mode, force) {
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
  const temporary = `${target}.bootstrap-${process.pid}-${randomBytes(6).toString('hex')}`
  let input
  let output
  try {
    input = fs.openSync(source, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0))
    if (!fs.fstatSync(input).isFile()) fail('Bootstrap source is no longer a regular file.')
    output = fs.openSync(temporary, 'wx', mode)
    fs.writeFileSync(output, fs.readFileSync(input))
    fs.closeSync(output)
    output = null
    // link is exclusive, so a concurrent new destination cannot be overwritten.
    if (force) fs.renameSync(temporary, target)
    else fs.linkSync(temporary, target)
  } finally {
    if (input != null) fs.closeSync(input)
    if (output != null) fs.closeSync(output)
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
  }
}

function bootstrap({ root = ROOT, force = false, androidSecrets = false, git = runGit, log = console.log } = {}) {
  root = real(root)
  const source = resolvePrimary(root, git)
  if (source === root) {
    log('Already in the primary MeTravel frontend checkout; nothing copied.')
    return []
  }
  const files = [...ENV_FILES, ...(androidSecrets ? ANDROID_FILES : [])]
  const fontSource = safePath(source, FONT_DIR, true)
  safePath(root, FONT_DIR, true)
  if (lstat(fontSource)) {
    // The bundle is flat. Inspect types before its validator reads any bytes.
    for (const entry of fs.readdirSync(fontSource)) safePath(source, `${FONT_DIR}/${entry}`)
    const bundle = verifiedFontBundle(fontSource, source)
    verifiedFontBundle(fontSource, root) // refuse mismatched target revisions
    files.push(...bundle.records.map((record) => `${FONT_DIR}/${record.path}`))
  }
  const plan = files.map((relative) => {
    const from = safePath(source, relative)
    const to = safePath(root, relative)
    const action = !lstat(from) ? 'missing' : lstat(to) && !force ? 'kept' : 'copied'
    return { relative, from, to, action }
  })
  assertIgnoredPaths(git, source, files)
  assertIgnoredPaths(git, root, files)
  // All policy and type checks complete before creating directories/files.
  for (const item of plan) {
    if (item.action === 'copied') {
      safePath(source, item.relative)
      safePath(root, item.relative)
      copyIndependent(item.from, item.to, item.relative.startsWith(FONT_DIR + '/') ? 0o644 : 0o600, force)
    }
    log(`${item.action}: ${item.relative}`)
  }
  if (!lstat(fontSource)) log(`missing: ${FONT_DIR} (source); use node scripts/prepare-book-renderer-fonts.js separately if needed.`)
  log('Native preparation is separate: install independent node_modules, then npm run android:prebuild when needed.')
  log('For iOS Pods: (cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install). Existing operation/release gates apply.')
  return plan.map(({ relative, action }) => ({ relative, action }))
}

function main(args = process.argv.slice(2), options = {}) {
  const log = options.log || console.log
  const error = options.error || console.error
  if (args.some((arg) => !['--force', '--android-secrets', '--help'].includes(arg))) {
    error(USAGE)
    return 1
  }
  if (args.includes('--help')) { log(USAGE); return 0 }
  try {
    bootstrap({ ...options, force: args.includes('--force'), androidSecrets: args.includes('--android-secrets') })
    return 0
  } catch (caught) {
    error(caught instanceof BootstrapError ? caught.message : 'Bootstrap failed; verify ignored prerequisite files and permissions. No file contents are logged.')
    return 1
  }
}

if (require.main === module) process.exitCode = main()
module.exports = { ENV_FILES, ANDROID_FILES, FONT_DIR, bootstrap, main, resolvePrimary }
