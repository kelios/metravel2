const fs = require('fs')
const path = require('path')

const docsPath = path.resolve(process.cwd(), 'docs', 'TESTING.md')

describe('incident artifact policy docs contract', () => {
  it('keeps artifact policy lines for selective, validator, and runtime incidents', () => {
    const markdown = fs.readFileSync(docsPath, 'utf8')

    const incidentTemplateMarker = 'Incident template (minimum):'
    const generatorHelperMarker = 'Generator helper:'

    const start = markdown.indexOf(incidentTemplateMarker)
    const end = markdown.indexOf(generatorHelperMarker)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)

    const section = markdown.slice(start, end)
    expect(section).toContain('- Selective decisions artifact: <optional artifact URL; recommended for selective_contract>')
    expect(section).toContain('- Validator contracts artifact: <optional artifact URL; recommended for validator_contract>')
    expect(section).toContain('- Runtime config diagnostics artifact: <optional artifact URL; recommended for config_contract>')
    expect(markdown).toContain('# - primaryArtifactKind: none | selective_decisions | validator_contracts | runtime_config_diagnostics')
  })
})
