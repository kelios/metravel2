const { assertDocCommandsSync } = require('./doc-command-contract-utils')

describe('baseline docs commands contract', () => {
  it('keeps documented smoke baseline helper commands in sync with package scripts', () => {
    assertDocCommandsSync({
      expectedCommands: [
        'smoke:baseline:recommend',
        'smoke:suite-baseline:recommend',
        'smoke:suite-baseline:validate',
        'smoke:suite-baseline:validate:json',
      ],
      scopeStart: 'Smoke trend baseline (`SMOKE_DURATION_PREVIOUS_SECONDS`):',
      scopeEnd: 'Common `gh` errors:',
      commandTemplate: (command) => `yarn ${command}`,
    })
  })
})
