const { runNodeCli } = require('./cli-test-utils')
const {
  ALL_E2E_SPECS,
  E2E_CATEGORY_DEFINITIONS,
  parseArgs,
  getMatchedCategories,
  getSpecsForChangedFiles,
  buildDecisionPayload,
} = require('@/scripts/run-e2e-changed')
const {
  expectTargetedTestsListUnique,
  expectTargetedTestsListResolvable,
} = require('./targeted-test-list-contract-utils')

describe('run-e2e-changed', () => {
  it('parses supported args', () => {
    expect(parseArgs(['--base-ref', 'origin/main', '--changed-files-file', 'changed_files.txt', '--dry-run', '--json'])).toEqual({
      baseRef: 'origin/main',
      changedFilesFile: 'changed_files.txt',
      dryRun: true,
      output: 'json',
    })
  })

  it('matches e2e categories by changed files', () => {
    expect(getMatchedCategories([
      'components/travel/UpsertTravel.tsx',
      'components/messages/ChatView.tsx',
      'README.md',
    ])).toEqual(['travel', 'messages'])
  })

  it('aggregates stable smoke specs for matched categories', () => {
    expect(getSpecsForChangedFiles([
      'components/travel/UpsertTravel.tsx',
      'components/messages/ChatView.tsx',
    ])).toEqual([
      'e2e/messages.spec.ts',
      'e2e/seo-travel-detail.spec.ts',
      'e2e/travel-detail-page.spec.ts',
    ])
  })

  it('returns the full fallback list when input is unavailable', () => {
    expect(getSpecsForChangedFiles([], { forceAll: true })).toEqual(ALL_E2E_SPECS)
  })

  it('discovers the complete regression spec set without production-only probes', () => {
    expect(ALL_E2E_SPECS.length).toBeGreaterThan(70)
    expect(ALL_E2E_SPECS).toContain('e2e/quests-list-detail.spec.ts')
    expect(ALL_E2E_SPECS).not.toContain('e2e/prod-media-smoke.spec.ts')
  })

  it('keeps targeted e2e spec list unique and resolvable', () => {
    expectTargetedTestsListUnique(ALL_E2E_SPECS)
    expectTargetedTestsListResolvable(ALL_E2E_SPECS)
  })

  it('keeps category definitions aligned with e2e routing', () => {
    expect(E2E_CATEGORY_DEFINITIONS.map((category: { name: string }) => category.name)).toEqual([
      'travel',
      'search',
      'map',
      'account',
      'messages',
      'quests',
      'places',
      'articles',
      'calendar',
      'trips',
      'roulette',
      'export',
      'i18n-security',
    ])
  })

  it('always selects a directly changed e2e spec', () => {
    expect(getSpecsForChangedFiles(['e2e/quests-list-detail.spec.ts'])).toEqual([
      'e2e/quests-list-detail.spec.ts',
    ])
  })

  it('leaves live-mutation specs to the explicit live-contract suite', () => {
    expect(getSpecsForChangedFiles(['e2e/public-trips.spec.ts'])).toEqual([])
  })

  it('fans out infrastructure changes to the complete regression suite', () => {
    expect(getSpecsForChangedFiles(['e2e/helpers/navigation.ts'])).toEqual(ALL_E2E_SPECS)
    expect(getSpecsForChangedFiles(['playwright.config.ts'])).toEqual(ALL_E2E_SPECS)
  })

  it('maps quest source changes to quest list/detail and review contracts', () => {
    expect(getSpecsForChangedFiles(['components/quests/QuestCard.tsx'])).toEqual([
      'e2e/quest-reviews-reader.spec.ts',
      'e2e/quests-list-detail.spec.ts',
    ])
  })

  it('builds json payload in dry-run mode', () => {
    const payload = buildDecisionPayload({
      source: 'working-tree',
      changedFiles: ['components/messages/ChatView.tsx'],
      matchedCategories: ['messages'],
      specs: ['e2e/messages.spec.ts'],
      reason: 'match',
      dryRun: true,
    })

    expect(payload).toEqual({
      contractVersion: 1,
      check: 'e2e-changed',
      source: 'working-tree',
      changedFilesScanned: 1,
      matchedCategories: ['messages'],
      specCount: 1,
      specs: ['e2e/messages.spec.ts'],
      decision: 'run',
      shouldRun: true,
      reason: 'match',
      dryRun: true,
    })
  })

  it('emits run decision in dry-run json mode for matched files', () => {
    const result = runNodeCli(
      ['scripts/run-e2e-changed.js', '--dry-run', '--json'],
      { CHANGED_FILES: 'components/messages/ChatView.tsx\n' },
    )

    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.check).toBe('e2e-changed')
    expect(payload.decision).toBe('run')
    expect(payload.shouldRun).toBe(true)
    expect(payload.reason).toBe('match')
    expect(payload.matchedCategories).toEqual(['messages'])
    expect(payload.specs).toEqual(['e2e/messages.spec.ts'])
  })

  it('reads changed files from explicit file input in dry-run json mode', () => {
    const { makeTempDir, removeDir, writeTextFile } = require('./cli-test-utils')

    const dir = makeTempDir('run-e2e-changed-')
    const changedFilesFile = `${dir}/changed.txt`
    writeTextFile(changedFilesFile, 'components/messages/ChatView.tsx\n')

    const result = runNodeCli([
      'scripts/run-e2e-changed.js',
      '--changed-files-file', changedFilesFile,
      '--dry-run',
      '--json',
    ])

    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.source).toBe('file')
    expect(payload.reason).toBe('match')
    expect(payload.matchedCategories).toEqual(['messages'])
    expect(payload.specs).toEqual(['e2e/messages.spec.ts'])

    removeDir(dir)
  })
})
