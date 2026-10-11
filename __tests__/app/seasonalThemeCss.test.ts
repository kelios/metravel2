import fs from 'node:fs'
import path from 'node:path'
import { parse, type Rule } from 'postcss'

describe('seasonal header decoration layers', () => {
  const stylesheet = parse(fs.readFileSync(path.join(process.cwd(), 'app/global.css'), 'utf8'))

  it('lights the visible brand row and paints the canopy above the opaque header wrapper', () => {
    // CustomHeader's wrapper has an opaque themed background. Decorations on
    // its parent cannot show through it; the absolute canopy needs a higher layer.
    const glowRules: Rule[] = []
    const canopyRules: Rule[] = []
    stylesheet.walkRules((rule) => {
      rule.walkDecls('background-image', (declaration) => {
        if (declaration.value.includes('var(--season-header-glow)')) glowRules.push(rule)
        if (declaration.value.includes('var(--season-canopy-image)')) canopyRules.push(rule)
      })
    })

    const page = document.implementation.createHTMLDocument()
    page.documentElement.dataset.season = 'halloween'
    page.body.innerHTML = '<div data-testid="main-header"><div><div data-testid="main-header-row"></div></div></div>'
    const row = page.querySelector('[data-testid="main-header-row"]')!

    expect(glowRules).toHaveLength(1)
    expect(row.matches(glowRules[0].selector)).toBe(true)
    expect(canopyRules).toHaveLength(1)
    expect(canopyRules[0].selector).toContain('::before')
    const declarations = Object.fromEntries(
      canopyRules[0].nodes
        .filter((node) => node.type === 'decl')
        .map((node) => [node.prop, node.value]),
    )
    expect(Number(declarations['z-index'])).toBeGreaterThan(0)
    expect(declarations['pointer-events']).toBe('none')
  })
})
