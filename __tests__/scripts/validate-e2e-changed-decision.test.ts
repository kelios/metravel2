const fs = require('fs')
const path = require('path')
const { makeTempDir, runNodeCli, writeJsonFile } = require('./cli-test-utils')
const { validateE2EChangedDecision } = require('@/scripts/validate-e2e-changed-decision')

describe('validate-e2e-changed-decision', () => {
  it('accepts valid payloads', () => {
    expect(validateE2EChangedDecision({
      contractVersion: 1,
      check: 'e2e-changed',
      source: 'working-tree',
      changedFilesScanned: 2,
      matchedCategories: ['travel'],
      specCount: 1,
      specs: ['e2e/open-travel.spec.ts'],
      decision: 'run',
      shouldRun: true,
      reason: 'match',
      dryRun: true,
    })).toEqual([])
  })

  it('rejects malformed payloads', () => {
    expect(validateE2EChangedDecision({
      contractVersion: 2,
      check: 'nope',
      source: '',
      changedFilesScanned: 'x',
      matchedCategories: [1],
      specCount: 1,
      specs: 'e2e/open-travel.spec.ts',
      decision: 'invalid',
      shouldRun: 'true',
      reason: '',
      dryRun: 'true',
    }).length).toBeGreaterThan(0)
  })

  it('passes via CLI for valid file', () => {
    const dir = makeTempDir('validate-e2e-changed-')
    const filePath = path.join(dir, 'decision.json')
    writeJsonFile(filePath, {
      contractVersion: 1,
      check: 'e2e-changed',
      source: 'file',
      changedFilesScanned: 1,
      matchedCategories: ['messages'],
      specCount: 1,
      specs: ['e2e/messages.spec.ts'],
      decision: 'run',
      shouldRun: true,
      reason: 'match',
      dryRun: true,
    })

    const result = runNodeCli(['scripts/validate-e2e-changed-decision.js', '--file', filePath])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('e2e-changed decision validation passed.')
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
