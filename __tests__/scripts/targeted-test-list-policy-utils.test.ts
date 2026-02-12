const {
  validateSelectiveRunnerPolicyContent,
  buildScopeUnexpectedMessage,
} = require('./targeted-test-list-policy-utils')

const validFixture = `
const {
  expectTargetedTestsListUnique,
  expectTargetedTestsListResolvable,
} = require('./targeted-test-list-contract-utils')

describe('fixture', () => {
  it('uses helper', () => {
    expectTargetedTestsListUnique([])
    expectTargetedTestsListResolvable([])
  })
})
`

describe('targeted-test-list-policy-utils', () => {
  it('passes for policy-compliant fixture', () => {
    expect(() => validateSelectiveRunnerPolicyContent({
      file: 'fixture.test.ts',
      content: validFixture,
    })).not.toThrow()
  })

  it('fails when helper import is missing', () => {
    const broken = validFixture.replace(
      "require('./targeted-test-list-contract-utils')",
      "require('./another-helper')",
    )
    expect(() => validateSelectiveRunnerPolicyContent({
      file: 'broken-import.test.ts',
      content: broken,
    })).toThrow('broken-import.test.ts: missing')
  })

  it('fails when local fs/path checks are added', () => {
    const broken = `${validFixture}\nconst fs = require('fs')\n`
    expect(() => validateSelectiveRunnerPolicyContent({
      file: 'broken-fs.test.ts',
      content: broken,
    })).toThrow('broken-fs.test.ts: forbidden')
  })

  it('builds scope mismatch message with subset-semantics hint', () => {
    const message = buildScopeUnexpectedMessage(['rogue.test.ts'])
    expect(message).toContain('subset semantics')
    expect(message).toContain('Only unexpected helper consumers are failures')
    expect(message).toContain('Unexpected: [rogue.test.ts].')
  })
})
