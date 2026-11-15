#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSyncWithStdin } = require('./lib/runSyncWithStdin')
const { parseCliTokens, runCli, UsageError } = require('./lib/cli-contract')

const REPO_ROOT = path.resolve(__dirname, '..')
const DAY_MS = 24 * 60 * 60 * 1000
const CACHE_NAMES = new Set([
  'node_modules', 'DerivedData', 'Pods', '.gradle', 'ModuleCache.noindex',
  'Index.noindex', 'SDKExplicitPrecompiledModules',
])
const USAGE = 'Usage: npm run clean:temp -- [--dry-run | --apply] [--help]'
const CLI = { name: 'clean:temp', usage: USAGE, flags: { 'dry-run': { type: 'boolean' }, apply: { type: 'boolean' } } }

function parseOptions(tokens) {
  const options = parseCliTokens(tokens, CLI)
  if (options.dryRun && options.apply) throw new UsageError('Choose --dry-run or --apply, not both.')
  return { apply: options.apply === true }
}

const within = (parent, child) => {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}
const activity = (stat) => Math.max(stat.mtimeMs, stat.ctimeMs)
const identity = (stat) => [stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeMs, stat.ctimeMs].join(':')
const cacheName = (name) => CACHE_NAMES.has(name) || /^metro-tmp-.+/.test(name)

const STORE_NAME = /^(?:instagram(?:[-.]|$)|quests-plan(?:[-.]|$)|books-|ops(?:[-.]|$)|handoff(?:[-.]|$)|review-gate(?:[-.]|$)|task-claim(?:[-.]|$))/i
const VENV_NAME = /^\.?venv$/i

// Working-store names protect a path only above `contentFrom` (a count of
// leading path parts). Below a cache root or a registered worktree root the
// same words are package or repository content, not our stores: the project's
// own node_modules ships onnxruntime-web/.../ops and every checkout tracks
// .claude/agents/instagram-*.md. Virtual environments stay protected at any depth.
function protectedPath(relative, contentFrom = Infinity) {
  const parts = relative.split(path.sep)
  return parts.some((part, index) => VENV_NAME.test(part) || (index < contentFrom && STORE_NAME.test(part))) ||
    (parts.length <= contentFrom && parts.includes('deploy') && /\.log(?:\.|$)/i.test(parts[parts.length - 1]))
}

// Check the entire path, including ancestors of the cleanup root. Neither the
// CLI nor the exported fixture API may enter storage through a symbolic link.
function realAncestors(file) {
  const absolute = path.resolve(file)
  let current = path.parse(absolute).root
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part)
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Symbolic ancestor: ${JSON.stringify(current)}`)
  }
}

function runGit(cwd, args) {
  return spawnSyncWithStdin('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  })
}

function gitValue(git, cwd, args) {
  const result = git(cwd, args)
  if (result.error || result.signal || result.status !== 0) throw new Error('Git safety check failed.')
  return String(result.stdout || '').trim()
}

function worktrees(repoRoot, git) {
  try {
    const origin = gitValue(git, repoRoot, ['remote', 'get-url', 'origin'])
    if (!/^(?:git@github\.com:|https:\/\/github\.com\/|ssh:\/\/git@github\.com\/)kelios\/metravel2(?:\.git)?\/?$/.test(origin)) return []
    const nul = git(repoRoot, ['worktree', 'list', '--porcelain', '-z'])
    const nulSupported = !nul.error && !nul.signal && nul.status === 0
    const output = nulSupported ? String(nul.stdout || '') : gitValue(git, repoRoot, ['worktree', 'list', '--porcelain'])
    return output.split(nulSupported ? '\0\0' : '\n\n').filter(Boolean).map((record) => {
      const fields = record.split(nulSupported ? '\0' : '\n')
      const first = fields[0]
      if (!first.startsWith('worktree ')) throw new Error('Invalid worktree metadata.')
      // Git 2.33 on the project workstation lacks -z. Never decode its C-style
      // quoted paths: ambiguous/control-containing names remain untouched.
      const controls = Array.from(first).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
      if ((!nulSupported && first.startsWith('worktree "')) || controls) throw new Error('Unsafe worktree path.')
      return { path: path.resolve(first.slice(9)), locked: fields.some((field) => /^(?:locked|prunable)(?: |$)/.test(field)) }
    })
  } catch {
    // Failed/old Git metadata is never permission to remove a worktree.
    return []
  }
}

function worktreeSafe(candidate, context) {
  const record = worktrees(context.repoRoot, context.git).find((entry) => entry.path === candidate)
  if (!record || record.locked) return false
  try {
    const mainCommon = gitValue(context.git, context.repoRoot, ['rev-parse', '--git-common-dir'])
    const candidateCommon = gitValue(context.git, candidate, ['rev-parse', '--git-common-dir'])
    if (fs.realpathSync(path.resolve(context.repoRoot, mainCommon)) !== fs.realpathSync(path.resolve(candidate, candidateCommon))) return false
    if (path.resolve(gitValue(context.git, candidate, ['rev-parse', '--show-toplevel'])) !== candidate) return false
    if (gitValue(context.git, candidate, ['status', '--porcelain=v1', '--untracked-files=all'])) return false
    // `git worktree remove` deletes ignored files without --force (.env*,
    // .secrets/, keystores, nested notes). Only reconstructible ignored content
    // may disappear with the worktree.
    const ignored = gitValue(context.git, candidate, ['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--directory'])
    if (ignored.split('\0').filter(Boolean).some((entry) => {
      const parts = entry.replace(/\/$/, '').split('/')
      return !parts.some(cacheName) && parts[parts.length - 1] !== '.DS_Store'
    })) return false
    gitValue(context.git, candidate, ['merge-base', '--is-ancestor', 'HEAD', 'origin/main'])
    return true
  } catch {
    return false
  }
}

// A registered worktree keeps `.git` as a file. Only then are the names below
// its root repository content: tracked files come back from Git, and the
// removal itself is still gated by worktreeSafe (clean status, ignored files
// confined to caches, HEAD merged).
function worktreeRoot(file, context) {
  if (!context.worktreePaths.has(file)) return false
  try { return fs.lstatSync(path.join(file, '.git')).isFile() }
  catch { return false }
}

function scanTree(file, context, insideCache = false, protectedAncestor = false, contentFrom = Infinity) {
  const stat = fs.lstatSync(file)
  const relative = path.relative(context.root, file)
  const name = path.basename(file)
  const protectedHere = protectedPath(relative, contentFrom) || (name === 'node_modules' && stat.isSymbolicLink())
  const override = context.ownChanges.get(file)
  const latest = override && override.identity === identity(stat) ? override.activity : activity(stat)
  const summary = {
    latest, bytes: stat.isDirectory() ? 0 : stat.size, blocked: protectedHere,
    gitMarkers: name === '.git' ? 1 : 0, candidates: [], stat,
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) return summary

  const isCache = cacheName(name)
  const protectedTree = protectedAncestor || protectedHere
  const childContentFrom = contentFrom !== Infinity ? contentFrom
    : (isCache || worktreeRoot(file, context)) ? relative.split(path.sep).length : Infinity
  for (const child of fs.readdirSync(file)) {
    const childSummary = scanTree(path.join(file, child), context, insideCache || isCache || name === '.git', protectedTree, childContentFrom)
    summary.latest = Math.max(summary.latest, childSummary.latest)
    summary.bytes += childSummary.bytes
    summary.blocked ||= childSummary.blocked
    summary.gitMarkers += childSummary.gitMarkers
    summary.candidates.push(...childSummary.candidates)
  }
  // Detect a directory replaced during enumeration before using its inventory.
  if (identity(fs.lstatSync(file)) !== identity(stat)) throw new Error('Directory changed during inventory.')
  if (!protectedTree && !insideCache) {
    if (isCache && !summary.blocked && summary.gitMarkers === 0) {
      summary.candidates.push({ path: file, kind: 'cache', bytes: summary.bytes, identity: identity(stat) })
    }
    if (context.worktreePaths.has(file) && !summary.blocked && summary.gitMarkers === 1) {
      const marker = path.join(file, '.git')
      if (fs.lstatSync(marker).isFile()) summary.candidates.push({ path: file, kind: 'worktree', bytes: summary.bytes, identity: identity(stat) })
    }
  }
  return summary
}

function currentPath(candidate, context) {
  return context.currentPaths.some((checkout) => within(context.root, checkout) &&
    (within(candidate, checkout) || within(checkout, candidate)))
}

function createPlan(options = {}) {
  const root = path.resolve(options.root || path.join(REPO_ROOT, '.codex-temp'))
  const repoRoot = path.resolve(options.repoRoot || REPO_ROOT)
  const context = {
    root, repoRoot, now: options.now ?? Date.now(), git: options.git || runGit,
    currentPaths: [repoRoot, path.resolve(options.currentCheckout || process.cwd())],
    ownChanges: new Map(), worktreePaths: new Set(),
  }
  const plan = { root, candidates: [], skipped: [], context }
  try { realAncestors(root) }
  catch (error) {
    if (error.code === 'ENOENT' && !fs.existsSync(root)) return plan
    throw error
  }
  if (!fs.lstatSync(root).isDirectory()) throw new Error('Cleanup root must be a real directory.')
  context.worktreePaths = new Set(worktrees(repoRoot, context.git).map((entry) => entry.path))
  for (const entry of fs.readdirSync(root)) {
    const top = path.join(root, entry)
    try {
      const summary = scanTree(top, context)
      if (summary.latest <= context.now - 3 * DAY_MS) {
        for (const item of summary.candidates) {
          if (!currentPath(item.path, context) && (item.kind !== 'worktree' || worktreeSafe(item.path, context))) {
            plan.candidates.push({ ...item, top })
          }
        }
      }
      // Archives have an independent retention window. A recent deployment log
      // cannot hide an old package, and is never itself a cleanup candidate.
      if (entry === 'deploy' && summary.stat.isDirectory()) {
        for (const name of fs.readdirSync(top)) {
          const file = path.join(top, name)
          const stat = fs.lstatSync(file)
          if (/^.+\.package\.tar\.gz$/.test(name) && !protectedPath(path.relative(root, file)) && stat.isFile() && !stat.isSymbolicLink() && activity(stat) <= context.now - 14 * DAY_MS && !currentPath(file, context)) {
            plan.candidates.push({ path: file, top, kind: 'archive', bytes: stat.size, identity: identity(stat) })
          }
        }
      }
    } catch {
      plan.skipped.push({ path: top, reason: 'Unreadable or changing entry.' })
    }
  }
  plan.candidates.sort((a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path))
  plan.candidates = plan.candidates.filter((item, index, all) => !all.slice(0, index).some((parent) => within(parent.path, item.path)))
  return plan
}

function revalidate(item, context) {
  if (!within(context.root, item.path) || item.path === context.root || currentPath(item.path, context)) return false
  realAncestors(item.path)
  if (identity(fs.lstatSync(item.path)) !== item.identity) return false
  if (item.kind === 'archive') {
    const stat = fs.lstatSync(item.path)
    return !protectedPath(path.relative(context.root, item.path)) &&
      path.dirname(item.path) === path.join(context.root, 'deploy') && /^.+\.package\.tar\.gz$/.test(path.basename(item.path)) &&
      stat.isFile() && activity(stat) <= context.now - 14 * DAY_MS
  }
  const top = scanTree(item.top, context)
  const candidate = top.candidates.find((entry) => entry.path === item.path && entry.kind === item.kind)
  return Boolean(candidate && top.latest <= context.now - 3 * DAY_MS && (item.kind !== 'worktree' || worktreeSafe(item.path, context)))
}

function applyPlan(plan, log = console.log) {
  const { context } = plan
  const removed = []
  const skipped = []
  for (const item of plan.candidates) {
    try {
      let safe = false
      try { safe = revalidate(item, context) }
      catch { /* Missing, unreadable or replaced paths fail closed. */ }
      if (!safe) {
        skipped.push(item.path)
        log(`SKIP changed or unsafe ${JSON.stringify(item.path)}`)
        continue
      }
      // Our own removals update ancestor directory timestamps. Remember their
      // exact new identity, retaining the old activity only while unchanged;
      // a later outside write still makes the containing entry recent.
      const parents = []
      for (let parent = path.dirname(item.path); within(item.top, parent); parent = path.dirname(parent)) {
        const stat = fs.lstatSync(parent)
        const previous = context.ownChanges.get(parent)
        parents.push({ path: parent, activity: previous?.identity === identity(stat) ? previous.activity : activity(stat) })
        if (parent === item.top) break
      }
      if (item.kind === 'worktree') gitValue(context.git, context.repoRoot, ['worktree', 'remove', item.path])
      else fs.rmSync(item.path, { recursive: item.kind === 'cache', force: false })
      for (const parent of parents) {
        const stat = fs.lstatSync(parent.path)
        context.ownChanges.set(parent.path, { activity: parent.activity, identity: identity(stat) })
      }
      removed.push(item.path)
      log(`REMOVED ${item.kind} ${item.bytes} bytes ${JSON.stringify(item.path)}`)
    } catch (error) {
      // A failed Git remove must never fall back to recursive filesystem deletion.
      if (error.code === 'ENOENT') {
        skipped.push(item.path)
        log(`SKIP missing or changed ${JSON.stringify(item.path)}`)
      } else throw error
    }
  }
  return { removed, skipped }
}

function cleanTemp(options = {}) {
  const log = options.log || console.log
  const plan = createPlan(options)
  log(`${options.apply ? 'APPLY' : 'DRY-RUN'} root ${JSON.stringify(plan.root)}`)
  for (const item of plan.candidates) log(`CANDIDATE ${item.kind} ${item.bytes} bytes ${JSON.stringify(item.path)}`)
  for (const item of plan.skipped) log(`SKIP ${JSON.stringify(item.path)} ${item.reason}`)
  const bytes = plan.candidates.reduce((total, item) => total + item.bytes, 0)
  log(`TOTAL ${plan.candidates.length} candidates, ${bytes} bytes (${(bytes / 1024 / 1024).toFixed(2)} MiB)`)
  const result = options.apply ? applyPlan(plan, log) : { removed: [], skipped: [] }
  return { ...result, plan, bytes }
}

function main(tokens = process.argv.slice(2)) {
  return cleanTemp(parseOptions(tokens))
}

if (require.main === module) runCli(() => main(), CLI)

module.exports = { DAY_MS, CACHE_NAMES, parseOptions, createPlan, applyPlan, cleanTemp, main }
