const fs = require('fs')
const path = require('path')

const scriptsTestsDir = path.resolve(process.cwd(), '__tests__', 'scripts')
const allowedFiles = new Set([
  'cli-test-utils.ts',
])

const ensure = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const collectFiles = (dir) => {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectFiles(abs))
      continue
    }
    out.push(abs)
  }
  return out
}

describe('cli runner policy', () => {
  it('keeps spawnSync/execFileSync usage only in cli-test-utils helper', () => {
    const files = collectFiles(scriptsTestsDir)
    const forbidden = []
    const spawnNeedle = 'spawn' + 'Sync('
    const execNeedle = 'execFile' + 'Sync('

    for (const filePath of files) {
      const rel = path.relative(scriptsTestsDir, filePath).replace(/\\/g, '/')
      if (allowedFiles.has(rel)) continue

      const content = fs.readFileSync(filePath, 'utf8')
      if (content.includes(spawnNeedle) || content.includes(execNeedle)) {
        forbidden.push(rel)
      }
    }

    ensure(
      forbidden.length === 0,
      `Found forbidden direct CLI process calls in: [${forbidden.join(', ')}]. Use runNodeCli from __tests__/scripts/cli-test-utils.ts.`,
    )
  })
})
