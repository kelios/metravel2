const path = require('path')
const {
  ensure,
  collectFilesRecursive,
  toPosixRelative,
  readTextFile,
  buildForbiddenUsageMessage,
} = require('./policy-test-utils')

const scriptsTestsDir = path.resolve(process.cwd(), '__tests__', 'scripts')
const allowedFiles = new Set([
  'cli-test-utils.ts',
])

describe('cli runner policy', () => {
  it('keeps spawnSync/execFileSync usage only in cli-test-utils helper', () => {
    const files = collectFilesRecursive(scriptsTestsDir)
    const forbidden = []
    const spawnNeedle = 'spawn' + 'Sync('
    const execNeedle = 'execFile' + 'Sync('

    for (const filePath of files) {
      const rel = toPosixRelative(scriptsTestsDir, filePath)
      if (allowedFiles.has(rel)) continue

      const content = readTextFile(filePath)
      if (content.includes(spawnNeedle) || content.includes(execNeedle)) {
        forbidden.push(rel)
      }
    }

    ensure(
      forbidden.length === 0,
      buildForbiddenUsageMessage({
        subject: 'direct CLI process calls',
        forbidden,
        remediation: 'Use runNodeCli from __tests__/scripts/cli-test-utils.ts.',
      }),
    )
  })
})
