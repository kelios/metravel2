const fs = require('fs')
const path = require('path')
const { makeTempDir, writeJsonFile } = require('./cli-test-utils')
const {
  parseArgs,
  collectSelectiveDecisions,
} = require('@/scripts/collect-selective-decisions')

describe('collect-selective-decisions', () => {
  it('parses args with defaults and overrides', () => {
    expect(parseArgs([])).toEqual({
      appFile: 'test-results/selective/app/app-selective-decision.json',
      schemaFile: 'test-results/selective/schema/schema-selective-decision.json',
      validatorFile: 'test-results/selective/validator/validator-selective-decision.json',
      outputFile: 'test-results/selective-decisions.json',
    })
    expect(parseArgs([
      '--app-file', 'app.json',
      '--schema-file', 'a.json',
      '--validator-file', 'b.json',
      '--output-file', 'c.json',
    ])).toEqual({
      appFile: 'app.json',
      schemaFile: 'a.json',
      validatorFile: 'b.json',
      outputFile: 'c.json',
    })
  })

  it('collects valid decisions and warnings for missing files', () => {
    const dir = makeTempDir('collect-selective-')
    const schemaFile = path.join(dir, 'schema.json')
    const appFile = path.join(dir, 'app.json')
    writeJsonFile(appFile, {
      contractVersion: 1,
      check: 'app-targeted-tests',
      decision: 'skip',
      shouldRun: false,
      reason: 'no-match',
      changedFilesScanned: 3,
      relevantMatches: 0,
      matchedFiles: [],
      dryRun: true,
      targetedTests: 0,
    })
    writeJsonFile(schemaFile, {
      contractVersion: 1,
      check: 'schema-contract-checks',
      decision: 'run',
      shouldRun: true,
      reason: 'match',
      changedFilesScanned: 3,
      relevantMatches: 1,
      matchedFiles: ['scripts/summarize-quality-gate.js'],
      dryRun: true,
      targetedTests: 5,
    })

    const aggregate = collectSelectiveDecisions({
      appFile,
      schemaFile,
      validatorFile: path.join(dir, 'missing-validator.json'),
    })

    expect(aggregate.schemaVersion).toBe(1)
    expect(aggregate.decisions).toHaveLength(2)
    expect(aggregate.warnings).toHaveLength(1)
    expect(aggregate.warnings[0]).toContain('decision file not found')
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
