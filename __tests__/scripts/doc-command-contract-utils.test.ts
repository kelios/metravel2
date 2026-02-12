const {
  DEFAULT_DOC_COMMAND_TEMPLATE,
  assertDocCommandsSync,
} = require('./doc-command-contract-utils')

describe('doc command contract utils', () => {
  it('keeps the legacy default bullet command template', () => {
    expect(DEFAULT_DOC_COMMAND_TEMPLATE('ci:workflow:contract:validate')).toBe(
      '- `yarn ci:workflow:contract:validate`'
    )
  })

  it('keeps default template compatible with bullet-list docs sections', () => {
    expect(() =>
      assertDocCommandsSync({
        expectedCommands: ['ci:workflow:contract:validate'],
      })
    ).not.toThrow()
  })

  it('supports custom template for code-block docs sections', () => {
    expect(() =>
      assertDocCommandsSync({
        expectedCommands: ['ci:incident:template'],
        scopeStart: 'Generator helper:',
        scopeEnd: 'Expected `Incident Payload Validation` summary snippets:',
        commandTemplate: (command) => `yarn ${command}`,
      })
    ).not.toThrow()
  })
})
