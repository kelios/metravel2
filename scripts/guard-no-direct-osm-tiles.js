const fs = require('fs')
const path = require('path')

// Guard #989 (FE-MAP M5): запрещает прямые OSM tile-хосты в исходниках вне
// единого провайдера тайлов. Прямой `{s}.tile.openstreetmap.org/.fr/.de` минует
// nginx tile-cache и limit_req (грабли серой карты #503/#807) и нарушает OSM
// Tile Usage Policy. Все карты обязаны брать тайлы через getOsmTileUrl() /
// getOsmNativeTileUrl() из config/mapWebLayers.

const OUTPUT_CONTRACT_VERSION = 1

// Единственный источник истины для tile-URL — сам провайдер. CARTO-константы
// живут там же (back-compat), поэтому файл в allowlist.
const ALLOWED_FILES = new Set([
  'config/mapWebLayers.ts',
])

const IGNORED_DIRS = new Set([
  '.git',
  '.expo',
  '.prod-build-tmp',
  '.tmp',
  '.tmp-article',
  '.chk-web',
  '.chk-android',
  '.codex-temp',
  '.claude',
  'node_modules',
  'dist',
  'dist-stub',
  'dist-dev-diag',
  'dist-web-analyze',
  'dist-web-analyze-sm',
  'web-build',
  'coverage',
  'test-results',
  'playwright-report',
  '__tests__',
  'e2e',
])

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])

// Прямые OSM tile-хосты (org/fr/de). CARTO-подложка живёт в провайдере и
// покрыта allowlist'ом, поэтому здесь не запрещается.
const DIRECT_OSM_TILE_REGEX = /tile\.openstreetmap\.(?:org|fr|de)/

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const parseArgs = (argv) => ({
  output: argv.includes('--json') ? 'json' : 'text',
})

const shouldIgnoreByDir = (relativePath) => {
  const parts = normalizePath(relativePath).split('/')
  return parts.some((part) => IGNORED_DIRS.has(part) || part.startsWith('dist-'))
}

const shouldScanFile = (relativePath) => {
  if (!relativePath) return false
  if (shouldIgnoreByDir(relativePath)) return false
  return SOURCE_EXTENSIONS.has(path.extname(relativePath))
}

// Пропускаем строки-комментарии: доки/пояснения про запрет прямого OSM — не
// нарушение (напр. этот guard и комментарий в провайдере ссылаются на хост).
const isCommentLine = (line) => {
  const trimmed = String(line || '').trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

const collectSourceFiles = (rootDir) => {
  const files = []

  const walk = (dirPath) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const absolute = path.join(dirPath, entry.name)
      const relative = normalizePath(path.relative(rootDir, absolute))
      if (!relative || relative === '.') continue

      if (entry.isDirectory()) {
        if (shouldIgnoreByDir(relative)) continue
        walk(absolute)
        continue
      }

      if (!entry.isFile()) continue
      if (!shouldScanFile(relative)) continue
      files.push(relative)
    }
  }

  walk(rootDir)
  return files
}

const findViolationsInSource = ({ filePath, content }) => {
  const normalizedPath = normalizePath(filePath)
  if (ALLOWED_FILES.has(normalizedPath)) return []

  const lines = String(content || '').split('\n')
  const violations = []
  lines.forEach((line, idx) => {
    if (isCommentLine(line)) return
    if (DIRECT_OSM_TILE_REGEX.test(line)) {
      violations.push({
        file: normalizedPath,
        line: idx + 1,
        snippet: line.trim(),
      })
    }
  })
  return violations
}

const evaluateGuard = ({ sources = [] } = {}) => {
  const violations = []
  for (const source of sources) {
    violations.push(...findViolationsInSource(source))
  }

  if (violations.length === 0) {
    return {
      ok: true,
      reason: 'No direct OSM tile hosts outside the tile provider (config/mapWebLayers)',
      violations: [],
    }
  }

  return {
    ok: false,
    reason: 'Direct OSM tile host found outside the tile provider — route tiles through getOsmTileUrl()/getOsmNativeTileUrl()',
    violations,
  }
}

const buildJsonResult = (result) => {
  const violations = Array.isArray(result?.violations) ? result.violations : []
  return {
    contractVersion: OUTPUT_CONTRACT_VERSION,
    ok: Boolean(result?.ok),
    reason: String(result?.reason || ''),
    violations,
    violationCount: violations.length,
  }
}

const formatViolations = (violations) => violations.map((v) => `- ${v.file}:${v.line} -> ${v.snippet}`)

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const rootDir = process.cwd()
  const files = collectSourceFiles(rootDir)
  const sources = files.map((relativePath) => ({
    filePath: relativePath,
    content: fs.readFileSync(path.join(rootDir, relativePath), 'utf8'),
  }))

  const result = evaluateGuard({ sources })

  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify(buildJsonResult(result), null, 2)}\n`)
    if (!result.ok) process.exit(1)
    return
  }

  if (result.ok) {
    console.log(`no-direct-osm-tiles: passed. ${result.reason}`)
    return
  }

  console.error('no-direct-osm-tiles: failed.')
  console.error(`- ${result.reason}`)
  formatViolations(result.violations).forEach((line) => console.error(line))
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  OUTPUT_CONTRACT_VERSION,
  ALLOWED_FILES,
  IGNORED_DIRS,
  SOURCE_EXTENSIONS,
  DIRECT_OSM_TILE_REGEX,
  parseArgs,
  shouldScanFile,
  isCommentLine,
  findViolationsInSource,
  evaluateGuard,
  buildJsonResult,
}
