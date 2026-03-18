import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')

const ALLOWED_DOCUMENT_TITLE_FILES = new Set([
  'app/+html.tsx',
  'app/(tabs)/quests/[city]/[questId].tsx',
  'components/travel/details/TravelDetailsContainer.tsx',
  'components/travel/details/hooks/useTravelDetailsHeadSync.ts',
])

const SEARCH_DIRS = ['app', 'components', 'hooks', 'utils']
const IGNORE_PARTS = ['/__tests__/', '/node_modules/', '/dist/']

function walk(dirPath: string, acc: string[]) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const absolute = path.join(dirPath, entry.name)
    const normalized = absolute.split(path.sep).join('/')
    if (IGNORE_PARTS.some((part) => normalized.includes(part))) continue

    if (entry.isDirectory()) {
      walk(absolute, acc)
      continue
    }

    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue
    acc.push(absolute)
  }
}

function getProjectFiles() {
  const files: string[] = []
  for (const dir of SEARCH_DIRS) {
    const absoluteDir = path.join(ROOT, dir)
    if (fs.existsSync(absoluteDir)) {
      walk(absoluteDir, files)
    }
  }
  return files
}

describe('web head patching allowlist', () => {
  it('limits manual document.title writes to reviewed files', () => {
    const offenders: string[] = []

    for (const filePath of getProjectFiles()) {
      const relativePath = path.relative(ROOT, filePath).split(path.sep).join('/')
      const source = fs.readFileSync(filePath, 'utf8')
      if (!/document\.title\s*=/.test(source)) continue
      if (ALLOWED_DOCUMENT_TITLE_FILES.has(relativePath)) continue
      offenders.push(relativePath)
    }

    expect(offenders).toEqual([])
  })
})
