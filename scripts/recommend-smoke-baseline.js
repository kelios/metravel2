const fs = require('fs')
const path = require('path')

const DEFAULT_DIR = 'test-results'
const DEFAULT_LIMIT = 7

const parseArgs = (argv) => {
  const args = {
    dir: DEFAULT_DIR,
    limit: DEFAULT_LIMIT,
    files: [],
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--dir' && argv[i + 1]) {
      args.dir = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--limit' && argv[i + 1]) {
      const parsed = Number(argv[i + 1])
      if (Number.isFinite(parsed) && parsed > 0) {
        args.limit = Math.floor(parsed)
      }
      i += 1
      continue
    }
    if (token === '--file' && argv[i + 1]) {
      args.files.push(argv[i + 1])
      i += 1
      continue
    }
  }

  return args
}

const collectDefaultFiles = (dir) => {
  const absDir = path.resolve(process.cwd(), dir)
  if (!fs.existsSync(absDir)) return []
  const entries = fs.readdirSync(absDir, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && /^jest-smoke-results.*\.json$/i.test(e.name))
    .map((e) => path.join(absDir, e.name))
}

const readJson = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const computeDurationSeconds = (jestReport) => {
  if (!Array.isArray(jestReport?.testResults)) return null
  const durationMs = jestReport.testResults.reduce((sum, t) => {
    const start = Number(t?.startTime ?? 0)
    const end = Number(t?.endTime ?? 0)
    const diff = end - start
    return sum + (Number.isFinite(diff) && diff > 0 ? diff : 0)
  }, 0)
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null
  return Number((durationMs / 1000).toFixed(2))
}

const median = (values) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2))
}

const recommendBaseline = ({ files, limit }) => {
  const stats = files
    .map((filePath) => {
      const payload = readJson(filePath)
      const durationSeconds = computeDurationSeconds(payload)
      const mtime = fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : 0
      return { filePath, durationSeconds, mtime }
    })
    .filter((x) => x.durationSeconds !== null)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)

  const durations = stats.map((x) => x.durationSeconds)
  const baseline = median(durations)
  return { stats, durations, baseline }
}

const main = () => {
  const { dir, limit, files } = parseArgs(process.argv.slice(2))
  const sourceFiles = files.length > 0
    ? files.map((f) => path.resolve(process.cwd(), f))
    : collectDefaultFiles(dir)

  const { stats, baseline } = recommendBaseline({ files: sourceFiles, limit })

  if (!stats.length || baseline === null) {
    console.log('No valid smoke reports found for baseline recommendation.')
    console.log('Provide reports via --file <path> or place jest-smoke-results*.json under test-results/.')
    process.exit(1)
  }

  console.log('Smoke baseline recommendation')
  console.log(`- Reports considered: ${stats.length}`)
  console.log(`- Recommended SMOKE_DURATION_PREVIOUS_SECONDS: ${baseline}`)
  console.log('- Source files:')
  stats.forEach((s) => {
    console.log(`  - ${s.filePath} (${s.durationSeconds}s)`)
  })
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  collectDefaultFiles,
  computeDurationSeconds,
  median,
  recommendBaseline,
}
