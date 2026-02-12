const fs = require('fs')
const path = require('path')
const { ensure } = require('./policy-test-utils')

const packageJsonPath = path.resolve(process.cwd(), 'package.json')

describe('governance verify script contract', () => {
  it('keeps governance:verify wired to external-link guards and governance tests', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const scripts = packageJson?.scripts || {}

    const guardExternalLinks = scripts['guard:external-links']
    const testGovernance = scripts['test:governance']
    const governanceVerify = scripts['governance:verify']

    ensure(typeof guardExternalLinks === 'string' && guardExternalLinks.length > 0, 'Missing scripts.guard:external-links.')
    ensure(typeof testGovernance === 'string' && testGovernance.length > 0, 'Missing scripts.test:governance.')
    ensure(typeof governanceVerify === 'string' && governanceVerify.length > 0, 'Missing scripts.governance:verify.')

    ensure(
      governanceVerify.includes('guard:external-links'),
      'scripts.governance:verify must invoke scripts.guard:external-links.',
    )
    ensure(
      governanceVerify.includes('test:governance'),
      'scripts.governance:verify must invoke scripts.test:governance.',
    )
  })
})
