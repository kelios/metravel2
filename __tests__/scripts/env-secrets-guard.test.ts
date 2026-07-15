import path from 'node:path'

import {
  makeTempDir,
  removeDir,
  runNodeCli,
  writeTextFile,
} from './cli-test-utils'

const repoRoot = path.resolve(__dirname, '../..')
const guardPath = path.join(repoRoot, 'scripts/guard-env-secrets.js')

describe('environment and secret guard', () => {
  it('passes for the tracked repository files', () => {
    const result = runNodeCli([guardPath])

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
  })

  it('fails closed without printing a synthetic secret value', () => {
    const tempRoot = makeTempDir('metravel-secret-guard-')
    const fixturePath = path.join(tempRoot, 'runtime-config.yml')
    const sentinel = 'synthetic-private-value-never-print'
    writeTextFile(
      fixturePath,
      `METRAVEL_TASK_BOARD_API_TOKEN: ${sentinel}\n`,
    )

    try {
      const result = runNodeCli([guardPath, '--scan-file', fixturePath])
      const output = `${result.stdout}\n${result.stderr}`

      expect(result.status).toBe(1)
      expect(output).toContain('METRAVEL_TASK_BOARD_API_TOKEN')
      expect(output).not.toContain(sentinel)
    } finally {
      removeDir(tempRoot)
    }
  })
})
