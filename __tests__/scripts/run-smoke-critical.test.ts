const {
  DEFAULT_CI_OUTPUT_FILE,
  parseArgs,
  buildJestArgs,
} = require('@/scripts/run-smoke-critical')
const { SMOKE_CRITICAL_TESTS } = require('@/scripts/smoke-critical-tests')

describe('run-smoke-critical', () => {
  it('parses args with defaults and overrides', () => {
    expect(parseArgs([])).toEqual({
      ci: false,
      outputFile: DEFAULT_CI_OUTPUT_FILE,
    })
    expect(parseArgs(['--ci'])).toEqual({
      ci: true,
      outputFile: DEFAULT_CI_OUTPUT_FILE,
    })
    expect(parseArgs(['--ci', '--output-file', 'tmp/out.json'])).toEqual({
      ci: true,
      outputFile: 'tmp/out.json',
    })
  })

  it('rejects invalid args', () => {
    expect(() => parseArgs(['--output-file'])).toThrow('--output-file requires a value')
    expect(() => parseArgs(['--unknown'])).toThrow('Unknown argument: --unknown')
  })

  it('builds standard jest args for local runs', () => {
    expect(buildJestArgs({
      ci: false,
      outputFile: DEFAULT_CI_OUTPUT_FILE,
    })).toEqual([
      'jest',
      '--passWithNoTests',
      '--runInBand',
      ...SMOKE_CRITICAL_TESTS,
    ])
  })

  it('builds json jest args for ci runs', () => {
    expect(buildJestArgs({
      ci: true,
      outputFile: 'test-results/custom-smoke.json',
    })).toEqual([
      'jest',
      '--passWithNoTests',
      '--runInBand',
      '--json',
      '--outputFile=test-results/custom-smoke.json',
      ...SMOKE_CRITICAL_TESTS,
    ])
  })
})
