const fs = require('fs')
const path = require('path')
const { ensure } = require('./policy-test-utils')

const packageJsonPath = path.resolve(process.cwd(), 'package.json')

describe('external links guard script contract', () => {
  it('keeps external links guard alias and lint wiring stable', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const scripts = packageJson?.scripts || {}

    const guardLinking = scripts['guard:no-direct-linking-openurl']
    const guardWindow = scripts['guard:no-direct-window-open']
    const guardExternalLinks = scripts['guard:external-links']
    const lint = scripts['lint']
    const lintCi = scripts['lint:ci']

    ensure(typeof guardLinking === 'string' && guardLinking.length > 0, 'Missing scripts.guard:no-direct-linking-openurl.')
    ensure(typeof guardWindow === 'string' && guardWindow.length > 0, 'Missing scripts.guard:no-direct-window-open.')
    ensure(typeof guardExternalLinks === 'string' && guardExternalLinks.length > 0, 'Missing scripts.guard:external-links.')
    ensure(typeof lint === 'string' && lint.length > 0, 'Missing scripts.lint.')
    ensure(typeof lintCi === 'string' && lintCi.length > 0, 'Missing scripts.lint:ci.')

    ensure(
      guardExternalLinks.includes('guard:no-direct-linking-openurl') &&
      guardExternalLinks.includes('guard:no-direct-window-open'),
      'scripts.guard:external-links must invoke both external-link guard scripts.',
    )

    ensure(
      lint.includes('guard:external-links'),
      'scripts.lint must invoke scripts.guard:external-links.',
    )
    ensure(
      lintCi.includes('guard:external-links'),
      'scripts.lint:ci must invoke scripts.guard:external-links.',
    )
  })
})
