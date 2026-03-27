const { runNodeCli } = require('./cli-test-utils')
const {
  APP_TARGETED_TESTS,
  CATEGORY_DEFINITIONS,
  parseArgs,
  getMatchedFiles,
  getMatchedCategoryNames,
  getTargetedTestsForChangedFiles,
  shouldRunForChangedFiles,
} = require('@/scripts/run-app-contract-tests-if-needed')
const {
  expectTargetedTestsListUnique,
  expectTargetedTestsListResolvable,
} = require('./targeted-test-list-contract-utils')

describe('run-app-contract-tests-if-needed', () => {
  it('parses supported args', () => {
    expect(parseArgs(['--changed-files-file', 'changed_files.txt', '--dry-run'])).toEqual({
      changedFilesFile: 'changed_files.txt',
      dryRun: true,
      output: 'text',
    })
  })

  it('detects relevant changed files for app targeted checks', () => {
    expect(shouldRunForChangedFiles(['components/travel/UpsertTravel.tsx'])).toBe(true)
    expect(shouldRunForChangedFiles(['components/messages/ChatView.tsx'])).toBe(true)
    expect(shouldRunForChangedFiles(['README.md'])).toBe(false)
  })

  it('matches categories and aggregates targeted tests by area', () => {
    const changedFiles = [
      'components/travel/UpsertTravel.tsx',
      'components/messages/ChatView.tsx',
      'README.md',
    ]

    expect(getMatchedFiles(changedFiles)).toEqual([
      'components/travel/UpsertTravel.tsx',
      'components/messages/ChatView.tsx',
    ])
    expect(getMatchedCategoryNames(changedFiles)).toEqual(['travel', 'messages'])

    expect(getTargetedTestsForChangedFiles(changedFiles)).toEqual([
      '__tests__/api/messages.test.ts',
      '__tests__/api/travelRating.test.ts',
      '__tests__/api/travels.test.ts',
      '__tests__/components/listTravel/ListTravel.filters.integration.test.tsx',
      '__tests__/components/listTravel/ListTravel.integration.test.tsx',
      '__tests__/components/messages/ChatView.test.tsx',
      '__tests__/components/messages/MessageBubble.test.tsx',
      '__tests__/components/messages/NewConversationPicker.test.tsx',
      '__tests__/components/messages/ThreadList.test.tsx',
      '__tests__/components/travel/TravelDetailsContainer.redesign.test.tsx',
      '__tests__/components/travel/TravelDetailsLazy.test.tsx',
      '__tests__/components/travel/UpsertTravel.integration.test.tsx',
      '__tests__/hooks/useTravelDetails.test.ts',
      '__tests__/hooks/useUpsertTravelController.test.ts',
      '__tests__/utils/travelFormNormalization.test.ts',
      '__tests__/utils/travelSeo.test.ts',
    ])
  })

  it('returns full fallback set when input is unavailable', () => {
    expect(getTargetedTestsForChangedFiles([], { forceAll: true })).toEqual(APP_TARGETED_TESTS)
  })

  it('keeps targeted app test list stable', () => {
    expect(APP_TARGETED_TESTS).toEqual([
      '__tests__/api/messages.test.ts',
      '__tests__/api/subscriptions.test.ts',
      '__tests__/api/travelRating.test.ts',
      '__tests__/api/travels.test.ts',
      '__tests__/api/travelsFavorites.test.ts',
      '__tests__/app/favorites-screen.test.tsx',
      '__tests__/app/mapLayout.test.ts',
      '__tests__/app/subscriptions.test.tsx',
      '__tests__/components/MapPage/Map.web.test.tsx',
      '__tests__/components/MapPage/useMapApi.test.ts',
      '__tests__/components/listTravel/ListTravel.filters.integration.test.tsx',
      '__tests__/components/listTravel/ListTravel.integration.test.tsx',
      '__tests__/components/login.test.tsx',
      '__tests__/components/messages/ChatView.test.tsx',
      '__tests__/components/messages/MessageBubble.test.tsx',
      '__tests__/components/messages/NewConversationPicker.test.tsx',
      '__tests__/components/messages/ThreadList.test.tsx',
      '__tests__/components/profile.test.tsx',
      '__tests__/components/travel/TravelDetailsContainer.redesign.test.tsx',
      '__tests__/components/travel/TravelDetailsLazy.test.tsx',
      '__tests__/components/travel/UpsertTravel.integration.test.tsx',
      '__tests__/hooks/useMapScreenController.buildRouteTo.test.ts',
      '__tests__/hooks/useTravelDetails.test.ts',
      '__tests__/hooks/useUpsertTravelController.test.ts',
      '__tests__/integration/map-route.integration.test.ts',
      '__tests__/stores/authStore.test.ts',
      '__tests__/utils/favoritesCleanup.test.ts',
      '__tests__/utils/mapFiltersStorage.test.ts',
      '__tests__/utils/travelFormNormalization.test.ts',
      '__tests__/utils/travelSeo.test.ts',
    ])
  })

  it('keeps targeted app tests list unique', () => {
    expectTargetedTestsListUnique(APP_TARGETED_TESTS)
  })

  it('keeps targeted app tests paths resolvable in repository', () => {
    expectTargetedTestsListResolvable(APP_TARGETED_TESTS)
  })

  it('keeps category definitions aligned with targeted tests', () => {
    expect(CATEGORY_DEFINITIONS.map((category) => category.name)).toEqual([
      'travel',
      'map',
      'account',
      'messages',
    ])
  })

  it('emits run decision in dry-run json mode for matched files', () => {
    const result = runNodeCli(
      ['scripts/run-app-contract-tests-if-needed.js', '--dry-run', '--json'],
      { CHANGED_FILES: 'components/travel/UpsertTravel.tsx\n' },
    )

    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.check).toBe('app-targeted-tests')
    expect(payload.decision).toBe('run')
    expect(payload.reason).toBe('match')
    expect(payload.targetedTests).toBeGreaterThan(0)
  })
})
