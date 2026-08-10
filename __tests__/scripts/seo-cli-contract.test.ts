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

const {
  EmptySelectionError,
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
    expect(parse('--help')).toMatchObject({ help: true, mode: null })
    expect(parse('-h').help).toBe(true)
    expect(parse('--sitemap', '--help').help).toBe(true)
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
