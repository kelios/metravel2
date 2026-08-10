/**
 * Contract tests for scripts/lib/seo-cli-contract.js — #1391.
 *
 * Four incidents in one family (`SEO-OPS-001`: #1107, #1325, #1389, #1390) broke
 * the same invariant: an undefined or unsupported input produced a wide action or
 * a success report instead of a visible failure. This module is the one place
 * that decides what happens on such input, so every branch of that decision is
 * pinned here — an unknown flag, a missing mode, a swallowed value, an empty
 * selection.
 */

import path from 'path'

import { makeTempDir, removeDir, runNodeCli, writeTextFile } from './cli-test-utils'

const CONTRACT_PATH = path.resolve(process.cwd(), 'scripts', 'lib', 'seo-cli-contract.js')

const {
  EmptySelectionError,
  HelpRequested,
  UsageError,
  formatFlagList,
  normalizeSpec,
  parseCliArgs,
  requireNonEmptySelection,
  toCamelCase,
} = require('@/scripts/lib/seo-cli-contract')

const SPEC = {
  name: 'demo',
  usage: 'demo usage',
  flags: {
    all: { type: 'boolean' },
    sitemap: { type: 'boolean' },
    'urls-file': { type: 'string', valueName: 'a path' },
    'dry-run': { type: 'boolean' },
    'user-id': { type: 'string', default: '1' },
    api: { type: 'string', default: 'https://metravel.by', stripTrailingSlash: true },
    limit: { type: 'int', min: 0, default: 0 },
    delay: { type: 'int', key: 'delayMs', min: 0, default: 250 },
    'recent-days': {
      type: 'int',
      min: 1,
      valueName: 'a positive integer',
      requiresMode: 'sitemap',
      reason: 'API records do not expose lastmod',
    },
  },
  modes: {
    flags: ['all', 'sitemap', 'urls-file'],
    label: 'URL sets',
    missing: 'No mode given: pass --all, --sitemap or --urls-file <path> explicitly',
  },
}

const argvOf = (...flags: string[]) => ['node', 'script', ...flags]
const parse = (...flags: string[]) => parseCliArgs(argvOf(...flags), SPEC)

describe('parseCliArgs: unsupported input is a visible failure, never a default', () => {
  it('rejects an unknown argument instead of falling through to the widest action', () => {
    expect(() => parse('--nonsense')).toThrow(UsageError)
    expect(() => parse('--nonsense')).toThrow('Unknown argument: --nonsense')
    // The exact shape of #1389: one dropped character, and `argv.includes` used
    // to answer with the default set.
    expect(() => parse('--all', '--recent-day', '2')).toThrow('Unknown argument: --recent-day')
  })

  it('rejects a positional argument rather than ignoring it', () => {
    expect(() => parse('all')).toThrow('Unexpected argument: all')
  })

  it('refuses a repeated flag instead of silently keeping the last one', () => {
    expect(() => parse('--urls-file', 'a.txt', '--urls-file', 'b.txt')).toThrow(
      '--urls-file given twice',
    )
  })
})

describe('parseCliArgs: modes', () => {
  it('requires exactly one declared mode', () => {
    expect(() => parse()).toThrow(UsageError)
    expect(() => parse()).toThrow('No mode given')
    expect(() => parse('--dry-run')).toThrow('No mode given')
  })

  it('reports the chosen mode and refuses two of them at once', () => {
    expect(parse('--all')).toMatchObject({ mode: 'all', all: true, dryRun: false })
    expect(parse('--urls-file', 'batch.txt')).toMatchObject({
      mode: 'urls-file',
      urlsFile: 'batch.txt',
    })
    expect(() => parse('--all', '--sitemap')).toThrow(
      '--all and --sitemap pick different URL sets — choose one',
    )
  })

  it('generates a mode list when the spec gives no custom message', () => {
    const spec = { ...SPEC, modes: { flags: ['all', 'sitemap', 'urls-file'] } }
    expect(() => parseCliArgs(argvOf(), spec)).toThrow(
      'No mode given: pass --all, --sitemap or --urls-file explicitly',
    )
  })
})

describe('parseCliArgs: values', () => {
  it('never swallows the next flag as a value', () => {
    expect(() => parse('--urls-file')).toThrow('--urls-file expects a path')
    // A mistyped flag must not be taken for a filename and resurface as ENOENT.
    expect(() => parse('--urls-file', '-h')).toThrow('--urls-file expects a path')
    expect(() => parse('--urls-file', '--dry-run')).toThrow('--urls-file expects a path')
  })

  it('refuses a non-integer or out-of-range number instead of coercing it to the default', () => {
    // `parseInt('abc', 10) || 0` used to turn a typo into "no limit".
    expect(() => parse('--all', '--limit', 'abc')).toThrow('--limit expects an integer')
    expect(() => parse('--all', '--limit', '2.5')).toThrow('--limit expects an integer')
    expect(() => parse('--all', '--limit', '-1')).toThrow('--limit expects an integer')
    expect(() => parse('--sitemap', '--recent-days', '0')).toThrow(
      '--recent-days expects a positive integer',
    )
    expect(parse('--sitemap', '--recent-days', '2').recentDays).toBe(2)
  })

  it('reads digits only, so Number() cannot smuggle in hex, exponents or padding', () => {
    // `Number('1e3')` is 1000 and `Number('0x10')` is 16 — an operator who typed
    // one of those meant something else, and the run must stop, not guess.
    expect(() => parse('--all', '--limit', '1e3')).toThrow('--limit expects an integer')
    expect(() => parse('--all', '--limit', '0x10')).toThrow('--limit expects an integer')
    expect(() => parse('--all', '--limit', ' 7 ')).toThrow('--limit expects an integer')
    expect(() => parse('--all', '--limit', '')).toThrow('--limit expects an integer')
    expect(parse('--all', '--limit', '7').limit).toBe(7)
  })

  it('lets a free-text flag carry a leading dash, but keeps paths and numbers strict', () => {
    const spec = {
      name: 'demo',
      usage: 'demo usage',
      flags: {
        name: { type: 'string', valueName: 'a title', allowLeadingDash: true },
        file: { type: 'string', valueName: 'a path' },
      },
    }
    // «-40 °C: зимний Байкал» is a real title; rejecting it would make the
    // article unrenamable from the CLI.
    expect(parseCliArgs(argvOf('--name', '-40 °C: зимний Байкал'), spec).name).toBe(
      '-40 °C: зимний Байкал',
    )
    expect(() => parseCliArgs(argvOf('--file', '-h'), spec)).toThrow('--file expects a path')
  })

  it('applies declared defaults, camelCase keys, key overrides and trailing-slash trimming', () => {
    expect(parse('--all')).toMatchObject({
      userId: '1',
      api: 'https://metravel.by',
      limit: 0,
      delayMs: 250,
      recentDays: null,
    })
    expect(parse('--all', '--api', 'https://dev.metravel.by//').api).toBe('https://dev.metravel.by')
    expect(parse('--all', '--delay', '0').delayMs).toBe(0)
  })

  it('enforces flag/mode coupling with the reason spelled out', () => {
    expect(() => parse('--all', '--recent-days', '2')).toThrow(
      '--recent-days requires --sitemap because API records do not expose lastmod',
    )
  })

  it('refuses a flag the chosen mode would ignore instead of dropping it', () => {
    // `--restore 186 --dry-run` used to swallow the rehearsal flag and write for
    // real: a mode that ignores a flag has to say so.
    const spec = {
      name: 'demo',
      usage: 'demo usage',
      flags: {
        id: { type: 'string' },
        restore: { type: 'string' },
        'dry-run': {
          type: 'boolean',
          forbiddenModes: ['restore'],
          reason: 'a restore always writes',
        },
      },
      modes: { flags: ['id', 'restore'], label: 'actions' },
    }
    expect(() => parseCliArgs(argvOf('--restore', '186', '--dry-run'), spec)).toThrow(
      '--dry-run cannot be combined with --restore because a restore always writes',
    )
    expect(parseCliArgs(argvOf('--id', '186', '--dry-run'), spec).dryRun).toBe(true)
    expect(parseCliArgs(argvOf('--restore', '186'), spec).mode).toBe('restore')
  })

  it('enforces required flags', () => {
    const spec = {
      name: 'demo',
      usage: 'demo usage',
      flags: { id: { type: 'string', required: true } },
    }
    expect(() => parseCliArgs(argvOf(), spec)).toThrow('--id is required')
    expect(parseCliArgs(argvOf('--id', '7'), spec).id).toBe('7')
  })
})

describe('parseCliArgs: --help', () => {
  it('answers the question instead of demanding the flags it is being asked about', () => {
    expect(() => parse('--help')).toThrow(HelpRequested)
    expect(() => parse('-h')).toThrow(HelpRequested)
    expect(() => parse('--sitemap', '--help')).toThrow(HelpRequested)
  })

  it('throws instead of returning a flag, so a forgotten branch cannot run the script', () => {
    // Returned as `{help: true}`, a caller that forgets `if (args.help) return`
    // runs for real — in seo-fix-links that made `--help` rewrite every
    // published body, because "no mode" reads as "not a dry run".
    expect(() => parse('--help')).toThrow(HelpRequested)
    expect(() => parse('--help')).not.toThrow(UsageError)
  })

  it('still rejects an unknown flag passed next to --help', () => {
    expect(() => parse('--help', '--nonsense')).toThrow('Unknown argument: --nonsense')
  })
})

describe('normalizeSpec: a broken spec is a programmer error, not bad user input', () => {
  const badSpecs: Array<[string, unknown]> = [
    ['missing name', { usage: 'u', flags: {} }],
    ['missing usage', { name: 'n', flags: {} }],
    ['unknown flag type', { name: 'n', usage: 'u', flags: { a: { type: 'float' } } }],
    ['non-kebab flag name', { name: 'n', usage: 'u', flags: { Aa: { type: 'boolean' } } }],
    ['reserved --help', { name: 'n', usage: 'u', flags: { help: { type: 'boolean' } } }],
    [
      'mode that is not a declared flag',
      { name: 'n', usage: 'u', flags: { a: { type: 'boolean' } }, modes: { flags: ['a', 'b'] } },
    ],
  ]

  it.each(badSpecs)('throws a plain Error for %s', (_label, spec) => {
    expect(() => normalizeSpec(spec)).toThrow(Error)
    expect(() => normalizeSpec(spec)).not.toThrow(UsageError)
  })
})

describe('requireNonEmptySelection', () => {
  it('passes a non-empty selection straight through', () => {
    expect(requireNonEmptySelection([1, 2], { what: 'articles' })).toEqual([1, 2])
  })

  it('turns an empty selection into a failure instead of a green "0 checked" report', () => {
    expect(() =>
      requireNonEmptySelection([], { what: 'articles', source: '/api/travels/' }),
    ).toThrow(EmptySelectionError)
    expect(() =>
      requireNonEmptySelection([], { what: 'articles', source: '/api/travels/', hint: 'check the envelope key' }),
    ).toThrow('/api/travels/ returned 0 articles — refusing to report success (check the envelope key)')
  })

  it('fails on a malformed payload the same way as on an empty one', () => {
    expect(() => requireNonEmptySelection(null, { what: 'rows' })).toThrow(EmptySelectionError)
    expect(() => requireNonEmptySelection({ results: 'nope' }, { what: 'rows' })).toThrow(
      EmptySelectionError,
    )
  })

  it('keeps a caller-supplied message verbatim', () => {
    expect(() => requireNonEmptySelection([], { message: 'вернул 0 статей' })).toThrow(
      'вернул 0 статей',
    )
  })
})

describe('runSeoCli exit-code contract', () => {
  const scriptFor = (body: string) => `
const path = require('path')
const contract = require(${JSON.stringify(CONTRACT_PATH)})
const { ExpectedFailureError, UsageError, requireNonEmptySelection, runSeoCli } = contract
async function main() { ${body} }
runSeoCli(main, { name: 'probe', usage: 'PROBE USAGE' })
`

  const runScript = (body: string) => {
    const dir = makeTempDir('seo-cli-runner-')
    try {
      const file = path.join(dir, 'probe.js')
      writeTextFile(file, scriptFor(body))
      return runNodeCli([file])
    } finally {
      removeDir(dir)
    }
  }

  it('reports a found problem as one line and exit 1, not as a crash', () => {
    // A gate that ran correctly and found 4 stale URLs already printed the detail;
    // burying that under a stack makes the verdict look like a bug in the script.
    const result = runScript("throw new ExpectedFailureError('4 stale URLs in the queue')")

    expect(result.status).toBe(1)
    expect(result.stderr.trim()).toBe('[probe] 4 stale URLs in the queue')
    expect(result.stderr).not.toContain('at ')
  })

  it('keeps the stack for an unexpected failure', () => {
    // Half-applied production batch: "which line died" is the whole question.
    const result = runScript("throw new TypeError('cannot read property x of undefined')")

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('cannot read property x of undefined')
    expect(result.stderr).toContain('at ')
  })

  it('keeps an empty selection to one line too', () => {
    const result = runScript("requireNonEmptySelection([], { what: 'rows', source: 'src' })")

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('src returned 0 rows')
    expect(result.stderr).not.toContain('at ')
  })

  it('prints usage and exits 2 for a bad invocation, 0 for --help', () => {
    const bad = runScript("throw new UsageError('called wrong')")
    expect(bad.status).toBe(2)
    expect(bad.stderr).toContain('PROBE USAGE')

    const help = runScript("contract.parseCliArgs(['n', 's', '--help'], { name: 'probe', usage: 'PROBE USAGE', flags: {} })")
    expect(help.status).toBe(0)
    expect(help.stdout).toContain('PROBE USAGE')
  })
})

describe('helpers', () => {
  it('builds camelCase keys from kebab-case flags', () => {
    expect(toCamelCase('user-id')).toBe('userId')
    expect(toCamelCase('only-problems')).toBe('onlyProblems')
    expect(toCamelCase('json')).toBe('json')
  })

  it('formats a readable flag list', () => {
    expect(formatFlagList(['all', 'sitemap', 'urls-file'])).toBe('--all, --sitemap or --urls-file')
    expect(formatFlagList(['all'])).toBe('--all')
  })
})
