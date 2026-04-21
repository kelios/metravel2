const { spawnSync } = require('child_process')
const { parseSelectiveRunnerArgs } = require('./selective-runner-args')
const {
  getMatchedFiles,
  getCategoryBreakdown,
  decideExecutionFromMatches,
  buildDecisionSummary,
  appendStepSummary,
} = require('./selective-check-utils')
const { readChangedFiles, readChangedFilesWithMeta } = require('./changed-files-utils')
const { buildSelectiveDecision, emitSelectiveDecision } = require('./selective-runner-output')

const CATEGORY_DEFINITIONS = [
  {
    name: 'travel',
    patterns: [
      /^app\/\(tabs\)\/travel\/.+/,
      /^app\/\(tabs\)\/travels\/.+/,
      /^components\/travel\//,
      /^components\/listTravel\//,
      /^hooks\/useTravel.+/,
      /^hooks\/travel-details\//,
      /^utils\/travel.+/,
      /^api\/travel.+/,
      /^api\/travels.+/,
    ],
    tests: [
      '__tests__/api/travels.test.ts',
      '__tests__/api/travelRating.test.ts',
      '__tests__/components/listTravel/ListTravel.integration.test.tsx',
      '__tests__/components/listTravel/ListTravel.filters.integration.test.tsx',
      '__tests__/components/travel/TravelDetailsLazy.test.tsx',
      '__tests__/components/travel/TravelDetailsContainer.redesign.test.tsx',
      '__tests__/components/travel/UpsertTravel.integration.test.tsx',
      '__tests__/hooks/useTravelDetails.test.ts',
      '__tests__/hooks/useUpsertTravelController.test.ts',
      '__tests__/utils/travelFormNormalization.test.ts',
      '__tests__/utils/travelSeo.test.ts',
    ],
  },
  {
    name: 'map',
    patterns: [
      /^app\/\(tabs\)\/map\.tsx$/,
      /^components\/MapPage\//,
      /^components\/map\//,
      /^components\/map-core\//,
      /^hooks\/map\//,
      /^utils\/map.+/,
      /^api\/fetchTravelsForMap.+/,
    ],
    tests: [
      '__tests__/app/mapLayout.test.ts',
      '__tests__/integration/map-route.integration.test.ts',
      '__tests__/components/MapPage/Map.web.test.tsx',
      '__tests__/components/MapPage/useMapApi.test.ts',
      '__tests__/hooks/useMapScreenController.buildRouteTo.test.ts',
      '__tests__/utils/mapFiltersStorage.test.ts',
    ],
  },
  {
    name: 'account',
    patterns: [
      /^app\/\(tabs\)\/(profile|favorites|subscriptions)\.tsx$/,
      /^components\/auth\//,
      /^components\/profile\//,
      /^stores\/authStore\./,
      /^api\/subscriptions.+/,
      /^api\/travelsFavorites.+/,
      /^utils\/favorites.+/,
    ],
    tests: [
      '__tests__/app/favorites-screen.test.tsx',
      '__tests__/app/subscriptions.test.tsx',
      '__tests__/api/subscriptions.test.ts',
      '__tests__/api/travelsFavorites.test.ts',
      '__tests__/components/login.test.tsx',
      '__tests__/components/profile.test.tsx',
      '__tests__/stores/authStore.test.ts',
      '__tests__/utils/favoritesCleanup.test.ts',
    ],
  },
  {
    name: 'messages',
    patterns: [
      /^app\/\(tabs\)\/messages\.tsx$/,
      /^components\/messages\//,
      /^api\/messages.+/,
    ],
    tests: [
      '__tests__/api/messages.test.ts',
      '__tests__/components/messages/ChatView.test.tsx',
      '__tests__/components/messages/MessageBubble.test.tsx',
      '__tests__/components/messages/NewConversationPicker.test.tsx',
      '__tests__/components/messages/ThreadList.test.tsx',
    ],
  },
]

const APP_TARGETED_TESTS = [...new Set(CATEGORY_DEFINITIONS.flatMap((category) => category.tests))].sort()
const RELEVANT_CATEGORIES = CATEGORY_DEFINITIONS.flatMap((category) =>
  category.patterns.map((pattern) => ({ name: category.name, pattern }))
)
const RELEVANT_PATTERNS = RELEVANT_CATEGORIES.map((category) => category.pattern)

const parseArgs = (argv) => parseSelectiveRunnerArgs(argv)

const getMatchedAppFiles = (changedFiles) => getMatchedFiles(changedFiles, RELEVANT_PATTERNS)

const getMatchedCategoryNames = (changedFiles) => {
  const files = Array.isArray(changedFiles) ? changedFiles : []
  return CATEGORY_DEFINITIONS
    .filter((category) => category.patterns.some((pattern) => files.some((filePath) => pattern.test(filePath))))
    .map((category) => category.name)
}

const getTargetedTestsForChangedFiles = (changedFiles, { forceAll = false } = {}) => {
  if (forceAll) return APP_TARGETED_TESTS

  const matchedCategories = new Set(getMatchedCategoryNames(changedFiles))
  if (matchedCategories.size === 0) return []

  return [...new Set(
    CATEGORY_DEFINITIONS
      .filter((category) => matchedCategories.has(category.name))
      .flatMap((category) => category.tests)
  )].sort()
}

const shouldRunForChangedFiles = (changedFiles) => {
  return getMatchedAppFiles(changedFiles).length > 0
}

const resolveCommand = (command) => {
  if (process.platform !== 'win32') {
    return command
  }

  if (command === 'yarn') return 'yarn.cmd'
  return command
}

const runAppTargetedTests = (tests) => {
  const result = spawnSync(
    resolveCommand('yarn'),
    ['jest', '--runInBand', ...(tests || [])],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  )
  return result.status ?? 1
}

const buildSummaryMarkdown = ({
  status,
  changedFiles,
  matchedFiles,
  targetedTests,
  matchedCategories,
  dryRun,
  executionReason,
}) => {
  const notes = []
  const breakdown = getCategoryBreakdown(changedFiles || [], RELEVANT_CATEGORIES)
  if (breakdown.length > 0) {
    notes.push(`Category matches: ${breakdown.map((item) => `${item.name}=${item.count}`).join(', ')}`)
  }
  if ((matchedCategories || []).length > 0) {
    notes.push(`Selected categories: ${matchedCategories.join(', ')}`)
  }
  if (executionReason === 'missing-input') {
    notes.push('Fail-safe: changed-files input unavailable; forcing targeted app tests.')
  }
  if (status === 'run') {
    notes.push(`Targeted tests: ${targetedTests.length}`)
    if (dryRun) notes.push('Mode: dry-run')
  }
  return buildDecisionSummary({
    title: 'App Targeted Tests',
    decision: status,
    changedFiles: changedFiles || [],
    matchedFiles: matchedFiles || [],
    notes,
  })
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const log = args.output === 'json' ? console.error : console.log
  if (args.output === 'json' && !args.dryRun) {
    console.error('app-targeted-check: --json is supported only with --dry-run.')
    process.exit(2)
  }

  const changedFilesMeta = readChangedFilesWithMeta({ changedFilesFile: args.changedFilesFile })
  const changedFiles = changedFilesMeta.files
  const matchedFiles = getMatchedAppFiles(changedFiles)
  const execution = decideExecutionFromMatches({
    matchedFiles,
    inputAvailable: changedFilesMeta.available,
  })
  const targetedTests = getTargetedTestsForChangedFiles(changedFiles, {
    forceAll: execution.reason === 'missing-input',
  })
  const matchedCategories = execution.reason === 'missing-input'
    ? CATEGORY_DEFINITIONS.map((category) => category.name)
    : getMatchedCategoryNames(changedFiles)

  if (!execution.shouldRun) {
    log('app-targeted-check: skipped (no relevant app file changes).')
    appendStepSummary(buildSummaryMarkdown({
      status: 'skip',
      changedFiles,
      matchedFiles,
      targetedTests,
      matchedCategories,
      dryRun: args.dryRun,
      executionReason: execution.reason,
    }))
    if (args.output === 'json') {
      emitSelectiveDecision(buildSelectiveDecision({
        check: 'app-targeted-tests',
        decision: 'skip',
        reason: execution.reason,
        changedFiles,
        matchedFiles,
        dryRun: args.dryRun,
        targetedTests: targetedTests.length,
      }))
    }
    return
  }

  if (execution.reason === 'missing-input') {
    log('app-targeted-check: changed-files input unavailable; forcing targeted app tests.')
  } else {
    log(`app-targeted-check: running ${targetedTests.length} targeted app tests.`)
  }
  appendStepSummary(buildSummaryMarkdown({
    status: 'run',
    changedFiles,
    matchedFiles,
    targetedTests,
    matchedCategories,
    dryRun: args.dryRun,
    executionReason: execution.reason,
  }))

  if (args.dryRun) {
    log(`app-targeted-check: dry-run, would run ${targetedTests.length} tests.`)
    if (args.output === 'json') {
      emitSelectiveDecision(buildSelectiveDecision({
        check: 'app-targeted-tests',
        decision: 'run',
        reason: execution.reason,
        changedFiles,
        matchedFiles,
        dryRun: args.dryRun,
        targetedTests: targetedTests.length,
      }))
    }
    return
  }

  const status = runAppTargetedTests(targetedTests)
  if (status !== 0) {
    process.exit(status)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  CATEGORY_DEFINITIONS,
  APP_TARGETED_TESTS,
  RELEVANT_CATEGORIES,
  RELEVANT_PATTERNS,
  parseArgs,
  getMatchedFiles: getMatchedAppFiles,
  getMatchedCategoryNames,
  getTargetedTestsForChangedFiles,
  shouldRunForChangedFiles,
  readChangedFiles,
  readChangedFilesWithMeta,
  decideExecutionFromMatches,
  buildSelectiveDecision,
  buildSummaryMarkdown,
}
