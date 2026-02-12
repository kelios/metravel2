const fs = require('fs')
const path = require('path')
const { ACTION_HINT_RULES } = require('@/scripts/summarize-ci-smoke-workflow-contract-validation')

const docsPath = path.resolve(process.cwd(), 'docs', 'TESTING.md')

describe('workflow hint rules docs contract', () => {
  it('keeps hint rules section present with stable order and source-of-truth reference', () => {
    const markdown = fs.readFileSync(docsPath, 'utf8')

    expect(markdown).toContain('Workflow Hint Rules Contract (stable order):')
    expect(markdown).toContain('Source of truth: `scripts/summarize-ci-smoke-workflow-contract-validation.js` (`ACTION_HINT_RULES`).')

    const expectedOrder = [
      '`missingSummarySettings` -> `[P1]`',
      '`missingOutputRefs` -> `[P1]`',
      '`missingStepIds` -> `[P2]`',
      '`missingArtifactNames` -> `[P2]`',
      '`missingArtifactPaths` -> `[P3]`',
    ]

    const positions = expectedOrder.map((entry) => markdown.indexOf(entry))
    positions.forEach((position, index) => {
      expect(position).toBeGreaterThan(-1)
      if (index > 0) {
        expect(position).toBeGreaterThan(positions[index - 1])
      }
    })
  })

  it('stays in strict sync with ACTION_HINT_RULES key/severity order', () => {
    const markdown = fs.readFileSync(docsPath, 'utf8')
    const marker = 'Workflow Hint Rules Contract (stable order):'
    const start = markdown.indexOf(marker)
    expect(start).toBeGreaterThan(-1)

    const tail = markdown.slice(start)
    const extracted = [...tail.matchAll(/`(missing[A-Za-z]+)`\s*->\s*`\[(P\d)\]`/g)]
      .map((match) => `${match[1]}:${match[2]}`)
      .slice(0, ACTION_HINT_RULES.length)

    const expected = ACTION_HINT_RULES.map((rule) => `${rule.key}:${rule.severity}`)
    expect(extracted).toEqual(expected)
  })
})
