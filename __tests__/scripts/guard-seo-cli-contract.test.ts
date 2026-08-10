/**
 * Tests for scripts/guard-seo-cli-contract.js — #1391.
 *
 * The guard is the permanent control for `SEO-OPS-001`, a family where four
 * point fixes (#1107, #1325, #1389, #1390) each cured one script and left the
 * pattern free to reappear in the next one. So both directions are pinned here:
 * the real scripts in this repo pass, and a fixture that puts the permissive
 * default back fails with the file and the reason named.
 */

import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli, writeTextFile } from './cli-test-utils'

const {
  COVERED_FILE_PATTERN,
  collectCoveredFiles,
  evaluateGuard,
  isCoveredFile,
} = require('@/scripts/guard-seo-cli-contract')

const GUARD = path.resolve(process.cwd(), 'scripts', 'guard-seo-cli-contract.js')

const COMPLIANT_SOURCE = `const { parseCliArgs, requireNonEmptySelection, runSeoCli } = require('./lib/seo-cli-contract')

const USAGE = 'usage'
const CLI_SPEC = { name: 'seo-demo', usage: USAGE, flags: { 'dry-run': { type: 'boolean' } } }

async function main() {
  const args = parseCliArgs(process.argv, CLI_SPEC)
  if (args.help) { console.log(USAGE); return }
  requireNonEmptySelection([], { what: 'rows', source: 'demo' })
}

if (require.main === module) {
  runSeoCli(main, { name: 'seo-demo', usage: USAGE })
}
`

const sourceOf = (filePath: string, content: string) => ({ filePath, content })

describe('covered set is derived from the filesystem, with no allowlist to escape into', () => {
  it('covers every seo-*, indexnow-* and index-status script directly in scripts/', () => {
    expect(isCoveredFile('scripts/seo-audit.js')).toBe(true)
    expect(isCoveredFile('scripts/seo-index-queue-check.js')).toBe(true)
    expect(isCoveredFile('scripts/indexnow-submit.js')).toBe(true)
    expect(isCoveredFile('scripts/index-status.js')).toBe(true)
    // A script invented tomorrow joins the covered set without touching the guard.
    expect(isCoveredFile('scripts/seo-brand-new-thing.js')).toBe(true)
    expect(COVERED_FILE_PATTERN.test('indexnow-retry.js')).toBe(true)
  })

  it('does not reach outside that surface', () => {
    expect(isCoveredFile('scripts/lib/seo-cli-contract.js')).toBe(false)
    expect(isCoveredFile('scripts/guard-seo-cli-contract.js')).toBe(false)
    expect(isCoveredFile('scripts/test-seo-prod.js')).toBe(false)
    expect(isCoveredFile('utils/seo-helper.js')).toBe(false)
    expect(isCoveredFile('scripts/seo-redirects.json')).toBe(false)
  })

  it('finds the real SEO scripts on disk', () => {
    const covered = collectCoveredFiles(process.cwd())
    expect(covered).toContain('scripts/indexnow-submit.js')
    expect(covered).toContain('scripts/index-status.js')
    expect(covered.length).toBeGreaterThan(5)
  })
})

describe('positive probe: the scripts in this repo satisfy the contract', () => {
  it('passes on every covered script as it exists on disk', () => {
    const sources = collectCoveredFiles(process.cwd()).map((relativePath) =>
      sourceOf(relativePath, fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')),
    )
    const result = evaluateGuard({ sources })

    expect(result.violations).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.checkedFiles).toBe(sources.length)
  })

  it('exits 0 when run as a CLI against this repo', () => {
    const result = runCli(process.execPath, [GUARD], { cwd: process.cwd() })

    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('seo-cli-contract: passed')
  })
})

describe('negative probe: putting the permissive default back fails the guard', () => {
  const cases: Array<{ label: string; rule: string; content: string; reason: RegExp }> = [
    {
      label: 'a flag sniffed with argv.includes — the #1389 shape',
      rule: 'hand-rolled-parse',
      reason: /mistyped flag silently keeps the default/,
      content: COMPLIANT_SOURCE.replace(
        "const args = parseCliArgs(process.argv, CLI_SPEC)",
        "const args = { all: process.argv.includes('--all') }",
      ),
    },
    {
      label: 'a getArg() helper built on indexOf',
      rule: 'hand-rolled-parse',
      reason: /mistyped flag silently keeps the default/,
      content: `${COMPLIANT_SOURCE}\nconst getArg = (n, d) => { const i = process.argv.indexOf(\`--\${n}\`); return i !== -1 ? process.argv[i + 1] : d }\n`,
    },
    {
      label: 'a hand-rolled flag chain',
      rule: 'hand-rolled-parse',
      reason: /declare the flag in the CLI spec/,
      content: `${COMPLIANT_SOURCE}\nfunction readMode(arg) { if (arg === '--all') return 'all'; return 'all' }\n`,
    },
    {
      label: 'a green exit over an empty selection — the #1325 shape',
      rule: 'exit-zero-on-empty',
      reason: /empty selection must fail through requireNonEmptySelection/,
      content: `${COMPLIANT_SOURCE}\nfunction bail(rows) { if (!rows.length) { console.log('nothing to do'); process.exit(0) } }\n`,
    },
    {
      // The same green exit written without an argument — `process.exit()` is 0.
      label: 'an argument-less process.exit()',
      rule: 'exit-zero-on-empty',
      reason: /empty selection must fail through requireNonEmptySelection/,
      content: `${COMPLIANT_SOURCE}\nfunction bail(rows) { if (!rows.length) { process.exit() } }\n`,
    },
    {
      // …and hidden in a ternary, where the zero branch is still the green report.
      label: 'a zero branch inside process.exit(failed ? 1 : 0)',
      rule: 'exit-zero-on-empty',
      reason: /empty selection must fail through requireNonEmptySelection/,
      content: `${COMPLIANT_SOURCE}\nfunction bail(failed) { process.exit(failed > 0 ? 1 : 0) }\n`,
    },
    {
      label: 'a script that never loads the shared contract',
      rule: 'contract-module',
      reason: /does not require scripts\/lib\/seo-cli-contract\.js/,
      content: "const fs = require('fs')\nasync function main() { return fs }\nmain()\n",
    },
  ]

  it.each(cases)('fails on $label, naming the file and the reason', ({ rule, content, reason }) => {
    const result = evaluateGuard({ sources: [sourceOf('scripts/seo-fixture.js', content)] })

    expect(result.ok).toBe(false)
    const violation = result.violations.find((entry: { rule: string }) => entry.rule === rule)
    expect(violation).toBeDefined()
    expect(violation.file).toBe('scripts/seo-fixture.js')
    expect(violation.reason).toMatch(reason)
  })

  it('has no "skip when unclear" path: an unreadable or empty covered file still fails', () => {
    const result = evaluateGuard({ sources: [sourceOf('scripts/seo-fixture.js', '')] })

    expect(result.ok).toBe(false)
    expect(result.violations.map((entry: { rule: string }) => entry.rule)).toEqual(
      expect.arrayContaining(['contract-module', 'strict-parse', 'exit-contract']),
    )
  })

  it('does not mistake prose about the ban for the ban itself', () => {
    const withComment = `// never do process.exit(0) here, and never use argv.includes('--all')\n${COMPLIANT_SOURCE}`
    expect(evaluateGuard({ sources: [sourceOf('scripts/seo-fixture.js', withComment)] }).ok).toBe(true)
  })

  it('exits non-zero as a CLI and prints the offending file and rule', () => {
    const dir = makeTempDir('seo-cli-guard-')
    try {
      writeTextFile(
        path.join(dir, 'scripts', 'seo-regressed.js'),
        COMPLIANT_SOURCE.replace(
          'const args = parseCliArgs(process.argv, CLI_SPEC)',
          "const args = { all: process.argv.includes('--all') }",
        ),
      )
      writeTextFile(path.join(dir, 'scripts', 'seo-good.js'), COMPLIANT_SOURCE)

      const result = runCli(process.execPath, [GUARD, '--json'], { cwd: dir })

      expect(result.status).toBe(1)
      const payload = JSON.parse(result.stdout)
      expect(payload.ok).toBe(false)
      expect(payload.checkedFiles).toBe(2)
      expect(payload.violationCount).toBeGreaterThan(0)
      // Only the regressed fixture is named — the compliant one next to it stays quiet.
      expect([
        ...new Set(payload.violations.map((entry: { file: string }) => entry.file)),
      ]).toEqual(['scripts/seo-regressed.js'])
      expect(payload.violations.map((entry: { rule: string }) => entry.rule)).toEqual(
        expect.arrayContaining(['strict-parse', 'hand-rolled-parse']),
      )
      expect(result.stdout).toContain('mistyped flag silently keeps the default')
    } finally {
      removeDir(dir)
    }
  })

  it('exits 0 as a CLI when every covered fixture follows the contract', () => {
    const dir = makeTempDir('seo-cli-guard-ok-')
    try {
      writeTextFile(path.join(dir, 'scripts', 'seo-good.js'), COMPLIANT_SOURCE)
      writeTextFile(path.join(dir, 'scripts', 'indexnow-good.js'), COMPLIANT_SOURCE)

      const result = runCli(process.execPath, [GUARD, '--json'], { cwd: dir })

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, checkedFiles: 2, violationCount: 0 })
    } finally {
      removeDir(dir)
    }
  })
})

describe('the guard runs in a permanent check, not by hand', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'))

  it('is wired into governance:verify', () => {
    expect(packageJson.scripts['guard:seo-cli-contract']).toBe('node scripts/guard-seo-cli-contract.js')
    expect(packageJson.scripts['governance:verify']).toContain('guard:seo-cli-contract')
  })

  it('keeps its own tests inside the governance suite', () => {
    expect(packageJson.scripts['test:governance']).toContain(
      '__tests__/scripts/guard-seo-cli-contract.test.ts',
    )
    expect(packageJson.scripts['test:governance']).toContain(
      '__tests__/scripts/seo-cli-contract.test.ts',
    )
  })
})
