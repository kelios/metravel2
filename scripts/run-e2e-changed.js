const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { readChangedFilesWithMeta } = require('./changed-files-utils')
const { resolveChangedFilesInput } = require('./run-local-selective-checks')

const E2E_CATEGORY_DEFINITIONS = [
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
    specs: [
      'e2e/travel-detail-page.spec.ts',
      'e2e/seo-travel-detail.spec.ts',
      'e2e/travels.spec.ts',
    ],
  },
  {
    name: 'search',
    patterns: [
      /^app\/\(tabs\)\/search\.tsx$/,
      /^components\/listTravel\//,
      /^hooks\/useListTravel.+/,
      /^utils\/mapFiltersStorage\./,
    ],
    specs: [
      'e2e/search.spec.ts',
      'e2e/filters-sorting-ux.spec.ts',
      'e2e/home-quick-filters-nightstay.spec.ts',
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
    specs: [
      'e2e/map-page.spec.ts',
      'e2e/points-map-popup.spec.ts',
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
    specs: [
      'e2e/auth-smoke.spec.ts',
      'e2e/subscriptions.spec.ts',
    ],
  },
  {
    name: 'messages',
    patterns: [
      /^app\/\(tabs\)\/messages\.tsx$/,
      /^components\/messages\//,
      /^api\/messages.+/,
    ],
    specs: [
      'e2e/messages.spec.ts',
    ],
  },
  {
    name: 'quests',
    patterns: [
      /^app\/\(tabs\)\/quests(?:\/|\.)/,
      /^components\/quests\//,
      /^hooks\/useQuest/,
      /^api\/quests?\./,
      /^utils\/quest/,
    ],
    specs: [
      'e2e/quests-list-detail.spec.ts',
      'e2e/quest-reviews-reader.spec.ts',
    ],
  },
  {
    name: 'places',
    patterns: [
      /^app\/\(tabs\)\/places(?:\/|\.)/,
      /^components\/places\//,
      /^api\/places?\./,
      /^hooks\/usePlaces?/,
    ],
    specs: [
      'e2e/places.spec.ts',
    ],
  },
  {
    name: 'articles',
    patterns: [
      /^app\/\(tabs\)\/articles?(?:\/|\.)/,
      /^components\/Article/,
      /^components\/article\//,
      /^api\/articles?\./,
    ],
    specs: [
      'e2e/article-anchor-scroll.spec.ts',
      'e2e/article-editor-browser-actions.spec.ts',
    ],
  },
  {
    name: 'calendar',
    patterns: [
      /^app\/\(tabs\)\/calendar(?:\/|\.)/,
      /^components\/calendar\//,
      /^api\/calendar/,
      /^stores\/calendar/,
    ],
    specs: [
      'e2e/calendar.spec.ts',
      'e2e/calendarVisitedPlacement.spec.ts',
    ],
  },
  {
    name: 'trips',
    patterns: [
      /^app\/\(tabs\)\/trips(?:\/|\.)/,
      /^components\/trips\//,
      /^api\/trips?\./,
      /^stores\/trips?/,
    ],
    specs: [
      'e2e/planned-trips.spec.ts',
      'e2e/public-trips.spec.ts',
    ],
  },
  {
    name: 'roulette',
    patterns: [
      /^app\/\(tabs\)\/roulette\.tsx$/,
      /^components\/roulette\//,
      /^hooks\/useRoulette/,
    ],
    specs: [
      'e2e/roulette.spec.ts',
    ],
  },
  {
    name: 'export',
    patterns: [
      /^app\/\(tabs\)\/export(?:\/|\.)/,
      /^components\/export\//,
      /^hooks\/usePdfExport/,
      /^services\/pdf/,
    ],
    specs: [
      'e2e/travel-share.spec.ts',
    ],
  },
  {
    name: 'i18n-security',
    patterns: [
      /^i18n\//,
      /^components\/settings\//,
      /^utils\/(?:externalLinks|sanitize|security)/,
      /^app\/(?:privacy|terms|about)/,
    ],
    specs: [
      'e2e/mobile-dark-theme.spec.ts',
      'e2e/public-regressions.spec.ts',
      'e2e/trust-safety.spec.ts',
    ],
  },
]

const E2E_INFRASTRUCTURE_PATTERNS = [
  /^playwright\.config\.ts$/,
  /^e2e\/global-setup\.ts$/,
  /^e2e\/fixtures\.ts$/,
  /^e2e\/helpers\//,
  /^scripts\/(?:e2e-run|e2e-webserver|run-e2e-changed|serve-web-build)\.js$/,
]

const discoverRegressionSpecs = () => {
  const e2eDir = path.resolve(__dirname, '..', 'e2e')
  return fs.readdirSync(e2eDir)
    .filter((fileName) => fileName.endsWith('.spec.ts'))
    .filter((fileName) => !fileName.startsWith('_'))
    .filter((fileName) => fileName !== 'prod-media-smoke.spec.ts')
    .map((fileName) => `e2e/${fileName}`)
    .sort()
}

const ALL_E2E_SPECS = discoverRegressionSpecs()

const parseArgs = (argv) => {
  const out = {
    baseRef: '',
    changedFilesFile: '',
    dryRun: false,
    output: 'text',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--base-ref' && argv[i + 1]) {
      out.baseRef = String(argv[i + 1]).trim()
      i += 1
      continue
    }
    if (token === '--changed-files-file' && argv[i + 1]) {
      out.changedFilesFile = String(argv[i + 1]).trim()
      i += 1
      continue
    }
    if (token === '--dry-run') {
      out.dryRun = true
      continue
    }
    if (token === '--json') {
      out.output = 'json'
    }
  }

  return out
}

const getMatchedCategories = (changedFiles, { forceAll = false } = {}) => {
  if (forceAll) {
    return E2E_CATEGORY_DEFINITIONS.map((category) => category.name)
  }

  const files = Array.isArray(changedFiles) ? changedFiles : []
  return E2E_CATEGORY_DEFINITIONS
    .filter((category) => category.patterns.some((pattern) => files.some((filePath) => pattern.test(filePath))))
    .map((category) => category.name)
}

const getSpecsForChangedFiles = (changedFiles, { forceAll = false } = {}) => {
  if (forceAll) return ALL_E2E_SPECS

  const files = Array.isArray(changedFiles) ? changedFiles : []
  if (E2E_INFRASTRUCTURE_PATTERNS.some((pattern) => files.some((filePath) => pattern.test(filePath)))) {
    return ALL_E2E_SPECS
  }

  const matchedCategories = new Set(getMatchedCategories(changedFiles))
  const directlyChangedSpecs = files.filter((filePath) => /^e2e\/[^/]+\.spec\.ts$/.test(filePath))

  return [...new Set(
    [
      ...directlyChangedSpecs,
      ...E2E_CATEGORY_DEFINITIONS
        .filter((category) => matchedCategories.has(category.name))
        .flatMap((category) => category.specs),
    ]
  )].sort()
}

const buildDecisionPayload = ({ source, changedFiles, matchedCategories, specs, reason, dryRun }) => {
  return {
    contractVersion: 1,
    check: 'e2e-changed',
    source,
    changedFilesScanned: (changedFiles || []).length,
    matchedCategories,
    specCount: (specs || []).length,
    specs,
    decision: specs.length > 0 ? 'run' : 'skip',
    shouldRun: specs.length > 0,
    reason,
    dryRun: Boolean(dryRun),
  }
}

const runE2EChanged = (specs) => {
  const result = spawnSync(
    process.execPath,
    ['scripts/e2e-run.js', ...specs],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        E2E_SUITE: '',
      },
    },
  )

  return result.status ?? 1
}

const resolveE2EChangedFilesInput = ({ baseRef = '', changedFilesFile = '' } = {}) => {
  const directInput = readChangedFilesWithMeta({ changedFilesFile })
  if (directInput.available) {
    return {
      files: directInput.files,
      source: directInput.source,
    }
  }

  return resolveChangedFilesInput({ baseRef })
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  if (args.output === 'json' && !args.dryRun) {
    console.error('e2e-changed: --json is supported only with --dry-run.')
    process.exit(2)
  }

  const input = resolveE2EChangedFilesInput(args)
  const changedFiles = input.files
  const forceAll = input.source === 'none'
  const matchedCategories = getMatchedCategories(changedFiles, { forceAll })
  const specs = getSpecsForChangedFiles(changedFiles, { forceAll })
  const reason = forceAll ? 'missing-input' : (specs.length > 0 ? 'match' : 'no-match')
  const payload = buildDecisionPayload({
    source: input.source,
    changedFiles,
    matchedCategories,
    specs,
    reason,
    dryRun: args.dryRun,
  })

  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
    return
  }

  if (specs.length === 0) {
    console.log('e2e-changed: skipped (no relevant app/e2e surface changes).')
    return
  }

  console.log(
    `e2e-changed: ${args.dryRun ? 'would run' : 'running'} ${specs.length} spec(s) for categories: ${matchedCategories.join(', ')}`
  )
  console.log(`e2e-changed: specs=${specs.join(', ')}`)

  if (args.dryRun) {
    return
  }

  const status = runE2EChanged(specs)
  if (status !== 0) {
    process.exit(status)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  E2E_CATEGORY_DEFINITIONS,
  ALL_E2E_SPECS,
  parseArgs,
  resolveE2EChangedFilesInput,
  getMatchedCategories,
  getSpecsForChangedFiles,
  buildDecisionPayload,
}
