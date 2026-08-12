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
  declaresSelection,
  evaluateGuard,
  isCoveredFile,
  readDeclaredSelection,
} = require('@/scripts/guard-seo-cli-contract')

const GUARD = path.resolve(process.cwd(), 'scripts', 'guard-seo-cli-contract.js')

const COMPLIANT_SOURCE = `const { parseCliArgs, requireNonEmptySelection, runSeoCli } = require('./lib/seo-cli-contract')

const USAGE = 'usage'
const CLI_SPEC = { name: 'seo-demo', usage: USAGE, selection: 'rows', flags: { 'dry-run': { type: 'boolean' } } }

async function main() {
  parseCliArgs(process.argv, CLI_SPEC)
  requireNonEmptySelection([], { what: 'rows', source: 'demo' })
}

if (require.main === module) {
  runSeoCli(main, { name: 'seo-demo', usage: USAGE })
}
`

// The #1389 regression shape: the compliant parse call swapped for an argv
// sniff. Built once at module level so a drifted replace target cannot quietly
// yield a still-compliant fixture again — that no-op is exactly how 2cb97468
// broke the two negative probes below.
const REGRESSED_ARGV_SNIFF_SOURCE = COMPLIANT_SOURCE.replace(
  'parseCliArgs(process.argv, CLI_SPEC)',
  "const args = { all: process.argv.includes('--all') }",
)

// The #1398 shape: a script that satisfies every other rule — it loads the
// contract, parses through it, runs through runSeoCli and names no exit code —
// and still reports success over an empty list, because returning from main()
// leaves the process at 0. Rule 4 cannot see this one: there is no exit(0) to ban.
const SILENT_EMPTY_RETURN_SOURCE = COMPLIANT_SOURCE.replace(
  ', requireNonEmptySelection,',
  ',',
).replace(
  "  requireNonEmptySelection([], { what: 'rows', source: 'demo' })",
  '  const rows = []\n  if (rows.length === 0) return',
)

const UNDECLARED_SELECTION_SOURCE = COMPLIANT_SOURCE.replace(" selection: 'rows',", '')

const sourceOf = (filePath: string, content: string) => ({ filePath, content })

describe('covered set is derived from the filesystem, with no allowlist to escape into', () => {
  it('covers every SEO CLI of the family, including the two prod gates', () => {
    expect(isCoveredFile('scripts/seo-audit.js')).toBe(true)
    expect(isCoveredFile('scripts/seo-index-queue-check.js')).toBe(true)
    expect(isCoveredFile('scripts/indexnow-submit.js')).toBe(true)
    expect(isCoveredFile('scripts/index-status.js')).toBe(true)
    // #1107, the first incident of SEO-OPS-001, and its post-deploy twin: the
    // family cannot be closed with its own origin left outside the guard.
    expect(isCoveredFile('scripts/test-seo-prod.js')).toBe(true)
    expect(isCoveredFile('scripts/post-deploy-seo-check.js')).toBe(true)
    // A script invented tomorrow joins the covered set without touching the guard.
    expect(isCoveredFile('scripts/seo-brand-new-thing.js')).toBe(true)
    expect(COVERED_FILE_PATTERN.test('indexnow-retry.js')).toBe(true)
  })

  it('follows a CLI moved into a subfolder instead of losing it', () => {
    expect(isCoveredFile('scripts/seo/seo-audit.js')).toBe(true)
    expect(isCoveredFile('scripts/ops/nested/indexnow-submit.js')).toBe(true)
  })

  it('does not reach outside that surface', () => {
    // scripts/lib is the library home — the shared contract itself lives there.
    expect(isCoveredFile('scripts/lib/seo-cli-contract.js')).toBe(false)
    expect(isCoveredFile('scripts/guard-seo-cli-contract.js')).toBe(false)
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

  it('leaves the scripts that work on one named target alone', () => {
    // The control against a false positive: seo-edit and seo-apply-one take a
    // single --id, so there is no list for requireNonEmptySelection() to guard
    // and demanding it would be noise. The probe is only worth anything because
    // neither file calls the helper — if one ever does, this stops proving it.
    const sources = ['scripts/seo-edit.js', 'scripts/seo-apply-one.js'].map((relativePath) =>
      sourceOf(relativePath, fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')),
    )

    for (const source of sources) {
      expect(source.content).not.toContain('requireNonEmptySelection(')
      expect(declaresSelection(source.content)).toBe(false)
      expect(readDeclaredSelection(source.content)).toBe('none')
    }
    expect(evaluateGuard({ sources })).toMatchObject({ ok: true, violations: [] })
  })

  it('reads what each covered script says it selects', () => {
    // Every covered script declares the field, and the ones that select a list
    // are exactly the ones the empty-selection rule applies to.
    const withSelection = collectCoveredFiles(process.cwd()).filter((relativePath) =>
      declaresSelection(fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')),
    )

    expect(withSelection).toContain('scripts/indexnow-submit.js')
    expect(withSelection).toContain('scripts/index-status.js')
    expect(withSelection).not.toContain('scripts/seo-edit.js')
    expect(withSelection).not.toContain('scripts/seo-apply-one.js')
  })

  it('exits 0 when run as a CLI against this repo', () => {
    const result = runCli(process.execPath, [GUARD], { cwd: process.cwd() })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('seo-cli-contract: passed')
  })

  it('parses its own arguments through the contract it enforces', () => {
    // A guard that answered a mistyped `--jsonn` with human text would break the
    // caller that parses its JSON — the shape it exists to stop.
    const typo = runCli(process.execPath, [GUARD, '--jsonn'], { cwd: process.cwd() })
    expect(typo.status).toBe(2)
    expect(typo.stderr).toContain('Unknown argument: --jsonn')

    const help = runCli(process.execPath, [GUARD, '--help'], { cwd: process.cwd() })
    expect(help.status).toBe(0)
    expect(help.stdout).toContain('SEO CLI contract guard')
  })
})

describe('negative probe: putting the permissive default back fails the guard', () => {
  const cases: Array<{ label: string; rule: string; content: string; reason: RegExp }> = [
    {
      label: 'a flag sniffed with argv.includes — the #1389 shape',
      rule: 'hand-rolled-parse',
      reason: /mistyped flag silently keeps the default/,
      content: REGRESSED_ARGV_SNIFF_SOURCE,
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
    {
      // A switch has the same hole as the if-chain: `default` keeps going.
      label: 'a switch over flag literals with a fall-through default',
      rule: 'hand-rolled-parse',
      reason: /default branch swallows an unknown flag/,
      content: `${COMPLIANT_SOURCE}\nfunction read(t) { switch (t) { case '--all': return 'all'; default: return 'all' } }\n`,
    },
    {
      // Assigning argv to a local first is the obvious way past a needle that
      // only looks for the literal `process.argv.slice(`.
      label: 'argv aliased to a local before being sliced',
      rule: 'hand-rolled-parse',
      reason: /slices the argument vector by hand/,
      content: `${COMPLIANT_SOURCE}\nconst argvAll = process.argv\nconst tokens = argvAll.slice(2)\n`,
    },
    {
      label: 'a zero exit written as process.exitCode',
      rule: 'exit-zero-on-empty',
      reason: /success is the absence of a failure/,
      content: `${COMPLIANT_SOURCE}\nfunction bail(rows) { if (!rows.length) { process.exitCode = 0 } }\n`,
    },
    {
      // #1398: the green report in its quiet spelling — no exit code named at all.
      label: 'a declared selection that just returns when it is empty — the #1398 shape',
      rule: 'empty-selection-guard',
      reason: /never passes it through requireNonEmptySelection/,
      content: SILENT_EMPTY_RETURN_SOURCE,
    },
    {
      label: 'a script that says nothing about whether it selects anything',
      rule: 'selection-declared',
      reason: /does not declare a selection in its CLI spec/,
      content: UNDECLARED_SELECTION_SOURCE,
    },
    {
      // An empty value would otherwise read as "declared, and not a selection" —
      // the escape hatch the declaration exists to close.
      label: 'an empty selection value',
      rule: 'selection-declared',
      reason: /does not declare a selection in its CLI spec/,
      content: COMPLIANT_SOURCE.replace("selection: 'rows'", "selection: ''"),
    },
  ]

  it('builds the regressed fixture from a replace that actually changed the source', () => {
    // A drifted target makes String.replace a silent no-op and every probe on
    // this fixture would then assert against a still-compliant script.
    expect(REGRESSED_ARGV_SNIFF_SOURCE).not.toBe(COMPLIANT_SOURCE)
    // The #1398 fixture has to be regressed in the one way it claims: no helper
    // left anywhere in it, and everything else about it still compliant.
    expect(SILENT_EMPTY_RETURN_SOURCE).not.toContain('requireNonEmptySelection')
    expect(SILENT_EMPTY_RETURN_SOURCE).toContain("selection: 'rows'")
    expect(SILENT_EMPTY_RETURN_SOURCE).toContain('runSeoCli(')
    expect(UNDECLARED_SELECTION_SOURCE).not.toContain('selection:')
  })

  it('names only the missing declaration when a script declares nothing', () => {
    // Two rules could fire on the same file; the one that fires must be the one
    // the author can act on, not "you did not call a helper we cannot know you need".
    const result = evaluateGuard({
      sources: [sourceOf('scripts/seo-fixture.js', UNDECLARED_SELECTION_SOURCE)],
    })

    expect(result.violations.map((entry: { rule: string }) => entry.rule)).toEqual([
      'selection-declared',
    ])
  })

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

  it('refuses to report success when it scanned nothing at all', () => {
    // The guard must not commit the sin it polices: a clean report over zero
    // rows is exactly #1325. Scanning nothing means the scan is broken.
    const result = evaluateGuard({ sources: [] })

    expect(result.ok).toBe(false)
    expect(result.checkedFiles).toBe(0)
    expect(result.violations[0].rule).toBe('empty-scan')

    const dir = makeTempDir('seo-cli-guard-empty-')
    try {
      const cli = runCli(process.execPath, [GUARD, '--json'], { cwd: dir })
      expect(cli.status).toBe(1)
      expect(JSON.parse(cli.stdout)).toMatchObject({ ok: false, checkedFiles: 0 })
    } finally {
      removeDir(dir)
    }
  })

  it('does not mistake prose about the ban for the ban itself', () => {
    const withComment = `// never do process.exit(0) here, and never use argv.includes('--all')\n${COMPLIANT_SOURCE}`
    expect(evaluateGuard({ sources: [sourceOf('scripts/seo-fixture.js', withComment)] }).ok).toBe(true)
  })

  it('exits non-zero as a CLI and prints the offending file and rule', () => {
    const dir = makeTempDir('seo-cli-guard-')
    try {
      writeTextFile(path.join(dir, 'scripts', 'seo-regressed.js'), REGRESSED_ARGV_SNIFF_SOURCE)
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
