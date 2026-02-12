const { assertDocCommandsSync } = require('./doc-command-contract-utils')

describe('validator docs commands contract', () => {
  it('keeps documented validator helper commands in sync with package scripts', () => {
    assertDocCommandsSync({
      expectedCommands: [
        'validator:error-codes:docs:check',
        'validator:error-codes:docs:update',
        'validator:contracts:check',
        'validator:contracts:summary',
        'validator:contracts:summary:validate',
      ],
    })
  })
})
