#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

/**
 * #1954 (root cause shared with #1950): seeding `localStorage.secure_userToken`
 * is not a web login. On web the client never reads a token from storage at
 * all — `getAccessToken()` returns null in cookie mode (api/client.ts,
 * utils/authPlatform.ts) — so a hard `page.goto('/travel/<numeric-id>')`
 * after that seed arrives at the server anonymous. The editor route for a
 * numeric id is resolved server-side by the HttpOnly `authToken` session
 * cookie (#1932): without it the document comes back 301/404, and a spec
 * that never asserts on the document status/redirect silently exercises
 * nothing instead of failing.
 *
 * Two specs reproduced this after #1950 fixed the first occurrence
 * (`e2e/draft-recovery.spec.ts`), because nothing enforced the fix beyond
 * that one file. This guard rejects the combination anywhere under `e2e/`:
 * seeding `secure_userToken` + a hard navigation into the `/travel/<id>`
 * editor route (`/travel/new` is a named route untouched by #1932 and is
 * intentionally not flagged), unless the file also goes through
 * `ensureWebAuthCookie()` (e2e/helpers/auth.ts) — the only sanctioned way to
 * seed a real web session in a spec.
 *
 * The editor-goto argument is matched inside a single string/template
 * literal, tolerant of an interpolated prefix (`` `${baseURL}/travel/${id}` ``)
 * or string concatenation before the `/travel/` literal. A `.goto(name)`
 * call with a bare identifier is also resolved, one hop, against the
 * nearest `const/let/var name = …;` assignment earlier in the file — this
 * catches `const editUrl = \`/travel/${id}\`; … page.goto(editUrl, …)`
 * without a general parser.
 *
 * KNOWN LIMITATION (accepted, not silently claimed as covered): the
 * `ensureWebAuthCookie` check is file-wide, not scoped to the specific test
 * or helper function containing the seed+goto pair. A file where one test
 * already uses `ensureWebAuthCookie()` and a second, independent test in the
 * same file still seeds `secure_userToken` next to its own editor `goto`
 * would NOT be flagged, because the cookie helper's mere presence anywhere
 * in the file satisfies this regex. Scoping this properly needs brace-aware
 * parsing (to isolate the enclosing function/test body while skipping
 * string/template contents), which is more machinery than these lightweight
 * regex guards use elsewhere in this repo (see
 * scripts/guard-e2e-wait-for-timeout.js) and risks being wrong in a way
 * that is harder to notice than an honest gap. See
 * `__tests__/scripts/guard-e2e-fake-web-session.test.ts` for a test that
 * pins this exact gap so it cannot regress silently. Move to
 * `scripts/lib/` with real scoping if a third consumer of this scanning
 * shape shows up.
 */
const OUTPUT_CONTRACT_VERSION = 1

const SECURE_TOKEN_SEED_REGEX = /localStorage\s*\.\s*setItem\s*\(\s*['"`]secure_userToken['"`]/
const EDITOR_ROUTE_REGEX = /\/travel\/(?!new\b)/
const EDITOR_GOTO_LITERAL_REGEX = /\.\s*goto\s*\(\s*[`'"][^`'"]*?\/travel\/(?!new\b)/
const GOTO_BARE_IDENTIFIER_REGEX = /\.\s*goto\s*\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g
const ENSURE_WEB_AUTH_COOKIE_REGEX = /\bensureWebAuthCookie\b/

function assignmentValueFor(code, identifier) {
  const assignmentRegex = new RegExp(`\\b(?:const|let|var)\\s+${identifier}\\s*=([^;]*);`)
  const match = assignmentRegex.exec(code)
  return match ? match[1] : null
}

function hasEditorGoto(code) {
  if (EDITOR_GOTO_LITERAL_REGEX.test(code)) return true

  for (const match of code.matchAll(GOTO_BARE_IDENTIFIER_REGEX)) {
    const value = assignmentValueFor(code, match[1])
    if (value && EDITOR_ROUTE_REGEX.test(value)) return true
  }

  return false
}

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

function walkE2EFiles(rootDir, relativeDir = 'e2e') {
  const absoluteDir = path.join(rootDir, relativeDir)
  if (!fs.existsSync(absoluteDir)) return []

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(relativeDir, normalizePath(entry.name))
    if (entry.isDirectory()) return walkE2EFiles(rootDir, relativePath)
    return entry.name.endsWith('.ts') ? [relativePath] : []
  })
}

// Same comment-stripping approach as scripts/guard-e2e-wait-for-timeout.js
// (kept local on purpose: these small e2e guards do not share a lib module).
function stripJavaScriptComments(source) {
  let out = ''
  let quote = ''
  let escaped = false

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index]
    const next = source[index + 1]

    if (quote) {
      out += current
      if (escaped) {
        escaped = false
      } else if (current === '\\') {
        escaped = true
      } else if (current === quote) {
        quote = ''
      }
      continue
    }

    if (current === '"' || current === "'" || current === '`') {
      quote = current
      out += current
      continue
    }

    if (current === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1
      out += '\n'
      continue
    }

    if (current === '/' && next === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') out += '\n'
        index += 1
      }
      index += 1
      continue
    }

    out += current
  }

  return out
}

function findFakeWebSessionViolation(source) {
  const code = stripJavaScriptComments(String(source || ''))
  const hasSeed = SECURE_TOKEN_SEED_REGEX.test(code)
  const hasRealCookie = ENSURE_WEB_AUTH_COOKIE_REGEX.test(code)
  return hasSeed && hasEditorGoto(code) && !hasRealCookie
}

function collectViolations(rootDir) {
  const violations = []
  for (const file of walkE2EFiles(rootDir).sort()) {
    const source = fs.readFileSync(path.join(rootDir, file), 'utf8')
    if (findFakeWebSessionViolation(source)) violations.push(file)
  }
  return violations
}

const parseArgs = (argv) => ({
  output: argv.includes('--json') ? 'json' : 'text',
})

const buildJsonResult = (violations) => ({
  contractVersion: OUTPUT_CONTRACT_VERSION,
  ok: violations.length === 0,
  violations,
  violationCount: violations.length,
})

function main() {
  const args = parseArgs(process.argv.slice(2))
  const rootDir = path.resolve(__dirname, '..')
  const violations = collectViolations(rootDir)

  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify(buildJsonResult(violations), null, 2)}\n`)
    if (violations.length > 0) process.exit(1)
    return
  }

  if (violations.length > 0) {
    console.error(
      '[guard-e2e-fake-web-session] FAIL: localStorage secure_userToken seed + hard navigation into /travel/<id> without ensureWebAuthCookie()',
    )
    for (const file of violations) console.error(`- ${file}`)
    console.error(
      'Web login is a cookie session, not a token in localStorage (utils/authPlatform.ts). ' +
        'Use ensureWebAuthCookie() from e2e/helpers/auth.ts — see e2e/draft-recovery.spec.ts.',
    )
    process.exit(1)
  }

  console.log(
    '[guard-e2e-fake-web-session] OK: no spec seeds secure_userToken and hard-navigates into /travel/<id> without ensureWebAuthCookie()',
  )
}

if (require.main === module) main()

module.exports = {
  OUTPUT_CONTRACT_VERSION,
  SECURE_TOKEN_SEED_REGEX,
  EDITOR_ROUTE_REGEX,
  EDITOR_GOTO_LITERAL_REGEX,
  GOTO_BARE_IDENTIFIER_REGEX,
  ENSURE_WEB_AUTH_COOKIE_REGEX,
  walkE2EFiles,
  stripJavaScriptComments,
  hasEditorGoto,
  findFakeWebSessionViolation,
  collectViolations,
  parseArgs,
  buildJsonResult,
}
