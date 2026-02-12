const {
  policyUtilsRequirePattern,
  builderImportPattern,
  builderCallPattern,
} = require('./policy-message-format-governance-patterns')
const exported = require('./policy-message-format-governance-patterns')

describe('policy message format governance patterns', () => {
  it('keeps exported governance pattern API stable', () => {
    expect(Object.keys(exported).sort()).toEqual([
      'builderCallPattern',
      'builderImportPattern',
      'policyUtilsRequirePattern',
    ])
    expect(String(policyUtilsRequirePattern)).toBe('/require\\([\'"]\\.\\/policy-test-utils[\'"]\\)/')
    expect(String(builderImportPattern)).toBe('/\\{[\\s\\S]*\\bbuildForbiddenUsageMessage\\b[\\s\\S]*\\}\\s*=\\s*require\\([\'"]\\.\\/policy-test-utils[\'"]\\)/')
    expect(String(builderCallPattern)).toBe('/\\bbuildForbiddenUsageMessage\\s*\\(/')
  })

  it('matches valid shared-builder import and call fixture', () => {
    const fixture = `
const {
  ensure,
  buildForbiddenUsageMessage,
} = require('./policy-test-utils')
ensure(true, buildForbiddenUsageMessage({ subject: 'x', forbidden: [], remediation: 'y' }))
`
    expect(policyUtilsRequirePattern.test(fixture)).toBe(true)
    expect(builderImportPattern.test(fixture)).toBe(true)
    expect(builderCallPattern.test(fixture)).toBe(true)
  })

  it('does not match when builder import is missing', () => {
    const fixture = `
const { ensure } = require('./policy-test-utils')
ensure(true, 'fallback')
`
    expect(policyUtilsRequirePattern.test(fixture)).toBe(true)
    expect(builderImportPattern.test(fixture)).toBe(false)
    expect(builderCallPattern.test(fixture)).toBe(false)
  })

  it('does not match when policy utils source differs', () => {
    const fixture = `
const { buildForbiddenUsageMessage } = require('./local-utils')
buildForbiddenUsageMessage({ subject: 'x', forbidden: [], remediation: 'y' })
`
    expect(policyUtilsRequirePattern.test(fixture)).toBe(false)
    expect(builderImportPattern.test(fixture)).toBe(false)
    expect(builderCallPattern.test(fixture)).toBe(true)
  })

  it('matches noisy multiline import formatting', () => {
    const fixture = `
const {
  // policy helpers
  ensure,
  buildForbiddenUsageMessage, // shared diagnostics
}   =   require("./policy-test-utils")

const msg = buildForbiddenUsageMessage(
  { subject: 'x', forbidden: ['a.ts'], remediation: 'use helper' },
)
`
    expect(policyUtilsRequirePattern.test(fixture)).toBe(true)
    expect(builderImportPattern.test(fixture)).toBe(true)
    expect(builderCallPattern.test(fixture)).toBe(true)
  })

  it('does not match noisy multiline import when source differs', () => {
    const fixture = `
const {
  // policy helpers
  ensure,
  buildForbiddenUsageMessage, // shared diagnostics
}   =   require("./local-utils")

const msg = buildForbiddenUsageMessage(
  { subject: 'x', forbidden: ['a.ts'], remediation: 'use helper' },
)
`
    expect(policyUtilsRequirePattern.test(fixture)).toBe(false)
    expect(builderImportPattern.test(fixture)).toBe(false)
    // Call detection is intentionally source-agnostic; source checks are handled by import patterns.
    expect(builderCallPattern.test(fixture)).toBe(true)
  })
})
