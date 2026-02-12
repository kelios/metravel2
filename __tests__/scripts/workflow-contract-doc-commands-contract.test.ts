const { assertDocCommandsSync } = require('./doc-command-contract-utils')

describe('workflow contract docs commands contract', () => {
  it('keeps documented workflow contract helper commands in sync with package scripts', () => {
    assertDocCommandsSync({
      expectedCommands: [
        'ci:workflow:contract:validate',
        'ci:workflow:contract:validate:json',
        'ci:workflow:contract:summarize',
      ],
    })
  })
})
