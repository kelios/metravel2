import path from 'path'

import { makeTempDir, removeDir, runNodeCli, writeTextFile } from './cli-test-utils'

const {
  CLI_SPEC,
  USAGE,
  UsageError,
  filterRecentSitemapEntries,
  main,
  parseArgs,
  parseSitemapEntries,
  parseUrlsFileContent,
  submit,
} = require('../../scripts/indexnow-submit')

const SCRIPT = path.resolve(process.cwd(), 'scripts', 'indexnow-submit.js')

const argvOf = (...flags: string[]) => ['node', 'script', ...flags]

describe('IndexNow sitemap freshness filter', () => {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset>',
    '<url><loc>https://metravel.by/quests/1/fresh</loc><lastmod>2026-07-15</lastmod></url>',
    '<url><loc>https://metravel.by/quests/1/yesterday</loc><lastmod>2026-07-14T17:00:00Z</lastmod></url>',
    '<url><loc>https://metravel.by/quests/1/old</loc><lastmod>2026-07-10</lastmod></url>',
    '<url><loc>https://metravel.by/quests/1/unknown</loc></url>',
    '</urlset>',
  ].join('')

  it('parses loc and lastmod from sitemap URL entries', () => {
    expect(parseSitemapEntries(xml)).toEqual([
      { loc: 'https://metravel.by/quests/1/fresh', lastmod: '2026-07-15' },
      {
        loc: 'https://metravel.by/quests/1/yesterday',
        lastmod: '2026-07-14T17:00:00Z',
      },
      { loc: 'https://metravel.by/quests/1/old', lastmod: '2026-07-10' },
      { loc: 'https://metravel.by/quests/1/unknown', lastmod: '' },
    ])
  })

  it('keeps only URLs changed during the requested UTC date window', () => {
    const entries = parseSitemapEntries(xml)
    expect(
      filterRecentSitemapEntries(entries, 2, new Date('2026-07-15T09:00:00Z')),
    ).toEqual([
      { loc: 'https://metravel.by/quests/1/fresh', lastmod: '2026-07-15' },
      {
        loc: 'https://metravel.by/quests/1/yesterday',
        lastmod: '2026-07-14T17:00:00Z',
      },
    ])
  })
})

// Daily batches after the retitle wave (#1326): the queue is submitted ten URLs
// at a time, so the script has to accept an explicit list instead of rebuilding
// the whole site from the API.
describe('IndexNow explicit batch file', () => {
  it('reads one URL per line, ignoring comments, blanks and duplicates', () => {
    const text = [
      '# batch 1 — 2026-08-08',
      'https://metravel.by/travels/a',
      '',
      '  https://metravel.by/travels/b  ',
      'https://metravel.by/travels/a',
      'https://metravel.by/ # home',
    ].join('\n')

    expect(parseUrlsFileContent(text)).toEqual([
      'https://metravel.by/travels/a',
      'https://metravel.by/travels/b',
      'https://metravel.by/',
    ])
  })

  it('refuses a batch containing a foreign host', () => {
    const text = ['https://metravel.by/travels/a', 'https://example.com/x'].join('\n')

    expect(() => parseUrlsFileContent(text)).toThrow('outside https://metravel.by')
  })

  it('returns an empty list for an empty file instead of throwing', () => {
    expect(parseUrlsFileContent('')).toEqual([])
    expect(parseUrlsFileContent('# only a comment\n')).toEqual([])
  })
})

// #1389: `argv.includes` let any unknown flag fall through to the default branch,
// and that branch submitted the whole site. A mode is now mandatory.
describe('IndexNow argument parsing', () => {
  it('requires an explicit mode', () => {
    expect(() => parseArgs(argvOf())).toThrow(UsageError)
    expect(() => parseArgs(argvOf())).toThrow('No mode given')
    expect(() => parseArgs(argvOf('--dry-run'))).toThrow('No mode given')
  })

  it('rejects an unknown argument instead of picking a URL set', () => {
    expect(() => parseArgs(argvOf('--nonsense'))).toThrow(UsageError)
    expect(() => parseArgs(argvOf('--nonsense'))).toThrow('Unknown argument: --nonsense')
    expect(() => parseArgs(argvOf('--all', '--recent-day', '2'))).toThrow(
      'Unknown argument: --recent-day',
    )
  })

  it('accepts --help before any mode check', () => {
    expect(parseArgs(argvOf('--help')).help).toBe(true)
    expect(parseArgs(argvOf('-h')).help).toBe(true)
  })

  it('reads each mode explicitly', () => {
    expect(parseArgs(argvOf('--all'))).toMatchObject({ mode: 'all', dryRun: false })
    expect(parseArgs(argvOf('--all', '--dry-run'))).toMatchObject({ mode: 'all', dryRun: true })
    expect(parseArgs(argvOf('--sitemap'))).toMatchObject({ mode: 'sitemap', recentDays: null })
    expect(parseArgs(argvOf('--urls-file', 'batch.txt'))).toMatchObject({
      mode: 'urls-file',
      urlsFile: 'batch.txt',
    })
  })

  it('refuses conflicting modes', () => {
    expect(() => parseArgs(argvOf('--all', '--sitemap'))).toThrow('choose one')
    expect(() => parseArgs(argvOf('--sitemap', '--urls-file', 'batch.txt'))).toThrow('choose one')
  })

  it('requires a path for --urls-file', () => {
    expect(() => parseArgs(argvOf('--urls-file'))).toThrow('expects a path')
    expect(() => parseArgs(argvOf('--urls-file', '--dry-run'))).toThrow('expects a path')
    // A mistyped flag must not be swallowed as a filename and resurface as ENOENT.
    expect(() => parseArgs(argvOf('--urls-file', '-h'))).toThrow('expects a path')
  })

  it('refuses a repeated flag instead of silently keeping the last one', () => {
    expect(() => parseArgs(argvOf('--urls-file', 'a.txt', '--urls-file', 'b.txt'))).toThrow(
      '--urls-file given twice',
    )
    expect(() => parseArgs(argvOf('--sitemap', '--recent-days', '3', '--recent-days', '9'))).toThrow(
      '--recent-days given twice',
    )
  })

  it('documents in USAGE every flag the parser accepts', () => {
    const flags = Object.keys(CLI_SPEC.flags).map((flag) => `--${flag}`)

    expect(flags).toEqual(
      expect.arrayContaining(['--dry-run', '--all', '--sitemap', '--urls-file', '--recent-days']),
    )
    for (const flag of [...flags, '--help', '-h']) {
      expect(USAGE).toContain(flag)
    }
  })

  it('requires a positive integer for --recent-days, and only with --sitemap', () => {
    expect(parseArgs(argvOf('--sitemap', '--recent-days', '2')).recentDays).toBe(2)
    expect(() => parseArgs(argvOf('--sitemap', '--recent-days', '0'))).toThrow(
      '--recent-days expects a positive integer',
    )
    expect(() => parseArgs(argvOf('--sitemap', '--recent-days'))).toThrow(
      '--recent-days expects a positive integer',
    )
    expect(() => parseArgs(argvOf('--all', '--recent-days', '2'))).toThrow(
      '--recent-days requires --sitemap',
    )
  })
})

describe('IndexNow submission is never reached without a mode', () => {
  const makeSpies = () => ({
    collectFromApi: jest.fn().mockResolvedValue(['https://metravel.by/']),
    collectFromSitemap: jest.fn().mockResolvedValue(['https://metravel.by/']),
    readUrlsFile: jest.fn().mockReturnValue(['https://metravel.by/']),
    submit: jest.fn().mockResolvedValue(undefined),
  })

  let logSpy: jest.SpyInstance

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it.each([
    ['no flags at all', [] as string[]],
    ['only --dry-run', ['--dry-run']],
    ['an unknown flag', ['--nonsense']],
    ['a typo in a known flag', ['--sitemaps']],
  ])('collects nothing and submits nothing with %s', async (_label, flags) => {
    const spies = makeSpies()

    await expect(main(argvOf(...flags), spies)).rejects.toThrow(UsageError)

    expect(spies.collectFromApi).not.toHaveBeenCalled()
    expect(spies.collectFromSitemap).not.toHaveBeenCalled()
    expect(spies.readUrlsFile).not.toHaveBeenCalled()
    expect(spies.submit).not.toHaveBeenCalled()
  })

  it('collects nothing and submits nothing with --help', async () => {
    const spies = makeSpies()

    await main(argvOf('--help'), spies)

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('--urls-file <path>'))
    expect(spies.collectFromApi).not.toHaveBeenCalled()
    expect(spies.collectFromSitemap).not.toHaveBeenCalled()
    expect(spies.readUrlsFile).not.toHaveBeenCalled()
    expect(spies.submit).not.toHaveBeenCalled()
  })

  it('submits nothing under --dry-run, but only once a mode is explicit', async () => {
    const spies = makeSpies()

    await main(argvOf('--all', '--dry-run'), spies)

    expect(spies.collectFromApi).toHaveBeenCalledTimes(1)
    expect(spies.submit).toHaveBeenCalledWith(
      'api.indexnow.org/indexnow',
      ['https://metravel.by/'],
      { dryRun: true },
    )
  })

  it('refuses a submit call that forgot the dryRun flag instead of posting for real', async () => {
    await expect(submit('api.indexnow.org/indexnow', ['https://metravel.by/'])).rejects.toThrow(
      'requires an explicit dryRun flag',
    )
  })

  it('passes the sitemap freshness window through to the collector', async () => {
    const spies = makeSpies()

    await main(argvOf('--sitemap', '--recent-days', '2', '--dry-run'), spies)

    expect(spies.collectFromSitemap).toHaveBeenCalledWith({ recentDays: 2 })
    expect(spies.collectFromApi).not.toHaveBeenCalled()
  })
})

describe('IndexNow CLI exit codes', () => {
  it('prints usage and exits 0 for --help', () => {
    const result = runNodeCli([SCRIPT, '--help'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Modes (exactly one is required')
    expect(result.stdout).not.toContain('Collecting URLs')
  })

  it('prints usage to stderr and exits non-zero for an unknown flag', () => {
    const result = runNodeCli([SCRIPT, '--nonsense'])

    expect(result.status).toBe(2)
    expect(result.stderr).toContain('Unknown argument: --nonsense')
    expect(result.stderr).toContain('Modes (exactly one is required')
    expect(result.stdout).not.toContain('Collecting URLs')
  })

  it('refuses to run with no mode and exits non-zero', () => {
    const result = runNodeCli([SCRIPT])

    expect(result.status).toBe(2)
    expect(result.stderr).toContain('No mode given')
    expect(result.stdout).not.toContain('Collecting URLs')
  })

  // The real submit() path, end to end, with no network reachable from the run:
  // --urls-file reads from disk, so a lost dryRun flag would show up here as a
  // live POST rather than a `[dry-run]` line.
  it('goes through the real submit path under --dry-run without sending anything', () => {
    const dir = makeTempDir('indexnow-batch-')
    const batch = path.join(dir, 'batch.txt')
    writeTextFile(batch, 'https://metravel.by/travels/a\nhttps://metravel.by/travels/b\n')

    try {
      const result = runNodeCli([SCRIPT, '--urls-file', batch, '--dry-run'])

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('[dry-run] POST https://api.indexnow.org/indexnow — 2 URLs')
      expect(result.stdout).toContain('[dry-run] POST https://yandex.com/indexnow — 2 URLs')
      expect(result.stdout).not.toContain('→ HTTP')
    } finally {
      removeDir(dir)
    }
  })
})
