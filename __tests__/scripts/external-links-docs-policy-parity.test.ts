const { readFileSync } = require('fs')
const path = require('path')
const { ensure } = require('./policy-test-utils')

const repoRoot = process.cwd()
const read = (file) => readFileSync(path.resolve(repoRoot, file), 'utf8')

describe('external links docs policy parity', () => {
  it('keeps PR/release checklists aligned to guard:external-links alias', () => {
    const prTemplate = read('.github/pull_request_template.md')
    const productionChecklist = read('docs/PRODUCTION_CHECKLIST.md')
    const releaseGuide = read('docs/RELEASE.md')
    const readme = read('docs/README.md')
    const index = read('docs/INDEX.md')
    const rules = read('docs/RULES.md')
    const summary = read('docs/EXTERNAL_LINK_GOVERNANCE_PR_SUMMARY.md')
    const prBody = read('docs/EXTERNAL_LINK_GOVERNANCE_PR_BODY.md')
    const testing = read('docs/TESTING.md')

    ensure(
      prTemplate.includes('`yarn guard:external-links`'),
      'PR template must include `yarn guard:external-links`.',
    )
    ensure(
      productionChecklist.includes('npm run guard:external-links'),
      'Production checklist must include `npm run guard:external-links`.',
    )
    ensure(
      releaseGuide.includes('guard:external-links'),
      'Release guide must reference guard:external-links policy.',
    )
    ensure(
      rules.includes('`yarn guard:external-links`'),
      'Rules must reference `yarn guard:external-links` as CI enforcement command.',
    )
    ensure(
      testing.includes('docs/RULES.md') && testing.includes('Canonical policy reference'),
      'Testing guide must reference docs/RULES.md as canonical policy source.',
    )
    ensure(
      readme.includes('EXTERNAL_LINK_GOVERNANCE_PR_SUMMARY.md'),
      'docs/README.md must reference EXTERNAL_LINK_GOVERNANCE_PR_SUMMARY.md.',
    )
    ensure(
      index.includes('docs/EXTERNAL_LINK_GOVERNANCE_PR_SUMMARY.md'),
      'docs/INDEX.md must reference docs/EXTERNAL_LINK_GOVERNANCE_PR_SUMMARY.md.',
    )
    ensure(
      summary.includes('EXTERNAL_LINK_GOVERNANCE_PR_BODY.md'),
      'Summary doc must reference EXTERNAL_LINK_GOVERNANCE_PR_BODY.md.',
    )
    ensure(
      prBody.includes('## Validation') && prBody.includes('## Explicit Exclusions'),
      'PR body doc must include validation and explicit exclusions sections.',
    )

    ensure(
      !prTemplate.includes('guard:no-direct-linking-openurl') &&
      !prTemplate.includes('guard:no-direct-window-open'),
      'PR template must not require legacy per-guard commands directly.',
    )
    ensure(
      !productionChecklist.includes('guard:no-direct-linking-openurl') &&
      !productionChecklist.includes('guard:no-direct-window-open'),
      'Production checklist must not use legacy per-guard commands directly.',
    )
  })
})
