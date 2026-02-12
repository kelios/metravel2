const { assertDocCommandsSync } = require('./doc-command-contract-utils')

describe('incident docs commands contract', () => {
  it('keeps documented incident helper commands in sync with package scripts', () => {
    assertDocCommandsSync({
      expectedCommands: [
        'ci:incident:template',
        'ci:incident:publish',
        'ci:incident:publish:json',
        'ci:incident:validate',
        'ci:incident:validate:json',
        'ci:incident:payload:validate',
        'ci:incident:payload:validate:json',
      ],
      scopeStart: 'Generator helper:',
      scopeEnd: 'Expected `Incident Payload Validation` summary snippets:',
      commandTemplate: (command) => `yarn ${command}`,
    })
  })
})
