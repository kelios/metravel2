const fs = require('fs')
const path = require('path')

const docsPath = path.resolve(process.cwd(), 'docs', 'TESTING.md')

describe('QG-009 docs contract', () => {
  it('keeps incident template and troubleshooting docs in sync for config_contract', () => {
    const markdown = fs.readFileSync(docsPath, 'utf8')

    expect(markdown).toContain(
      '- Failure Class: <infra_artifact|inconsistent_state|lint_only|smoke_only|mixed|performance_budget|selective_contract|validator_contract|config_contract>'
    )
    expect(markdown).toContain('- Recommendation ID: <QG-001..QG-009>')
    expect(markdown).toContain('- Runtime config diagnostics artifact: <optional artifact URL; recommended for config_contract>')

    const anchorIndex = markdown.indexOf('<a id="qg-009"></a>')
    const titleIndex = markdown.indexOf('- `config_contract` (`QG-009`)')
    const meaningIndex = markdown.indexOf('Meaning: runtime config diagnostics report failed/missing while lint+smoke are otherwise green.')
    const knownPeerHeaderIndex = markdown.indexOf('## Known peer dependency warnings')
    expect(knownPeerHeaderIndex).toBeGreaterThan(titleIndex)
    const qg009Section = markdown.slice(titleIndex, knownPeerHeaderIndex)

    expect(anchorIndex).toBeGreaterThan(-1)
    expect(titleIndex).toBeGreaterThan(anchorIndex)
    expect(meaningIndex).toBeGreaterThan(titleIndex)
    expect(qg009Section).toContain('- `yarn config:diagnostics:json`')
    expect(qg009Section).toContain('- `yarn config:diagnostics:strict`')
  })
})
