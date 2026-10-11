import fs from 'node:fs'
import path from 'node:path'
import { parse, type Rule } from 'postcss'
import { SEASONAL_THEME_IDS } from '@/constants/seasonalThemes'

describe('seasonal header decoration layers', () => {
  const stylesheet = parse(fs.readFileSync(path.join(process.cwd(), 'app/global.css'), 'utf8'))
  const rulesFor = (selector: string): Rule[] => {
    const matches: Rule[] = []
    stylesheet.walkRules((rule) => {
      if (rule.selector === selector && rule.parent?.type === 'root') matches.push(rule)
    })
    return matches
  }
  const declarations = (rule: Rule): Record<string, string> => Object.fromEntries(
    rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]),
  )
  const palette = (theme: string, scheme: 'light' | 'dark'): Record<string, string> => {
    const selectors = [
      ':root',
      ...(scheme === 'dark' ? ['html[data-theme="dark"]'] : []),
      `html[data-season="${theme}"]`,
      ...(scheme === 'dark' ? [`html[data-season="${theme}"][data-theme="dark"]`] : []),
    ]
    return Object.assign({}, ...selectors.flatMap((selector) => rulesFor(selector).map(declarations)))
  }
  const luminance = (color: string): number => {
    expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    const channels = [1, 3, 5].map((offset) => {
      const value = Number.parseInt(color.slice(offset, offset + 2), 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  const contrast = (foreground: string, background: string): number => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b)
    return (values[1] + 0.05) / (values[0] + 0.05)
  }
  const appearances = SEASONAL_THEME_IDS.flatMap((theme) =>
    (['light', 'dark'] as const).map((scheme) => ({ theme, scheme })),
  )

  it.each(appearances)('provides complete static brand art for $theme/$scheme', ({ theme, scheme }) => {
    const selector = `html[data-season="${theme}"]${scheme === 'dark' ? '[data-theme="dark"]' : ''}`
    expect(rulesFor(selector)).toHaveLength(1)
    const colors = palette(theme, scheme)
    for (const token of ['canopy-image', 'header-glow', 'edge-glow', 'logo-glow', 'logo-jewel', 'logo-wordmark']) {
      expect(colors[`--season-${token}`]).toBeTruthy()
    }
    const image = colors['--season-canopy-image'].match(/^url\("data:image\/svg\+xml,(.*)"\)$/)
    expect(image).not.toBeNull()
    const svg = new DOMParser().parseFromString(decodeURIComponent(image![1]), 'image/svg+xml')
    expect(svg.querySelector('parsererror')).toBeNull()
    expect(svg.documentElement.getAttribute('viewBox')).toBe('0 0 1200 48')
    expect(svg.querySelector('script, image, animate, animateTransform, set, [href], [xlink\\:href]')).toBeNull()
  })

  it.each(appearances)('keeps text, selected controls and focus legible for $theme/$scheme', ({ theme, scheme }) => {
    const colors = palette(theme, scheme)
    const backgrounds = [
      'background', 'backgroundSecondary', 'backgroundTertiary', 'surface', 'surfaceElevated',
      'card', 'cardMuted', 'dockBackground', 'primaryLight', 'accentLight',
    ]
    for (const background of backgrounds) {
      for (const foreground of ['text', 'textMuted', 'textSubtle', 'primaryText', 'accent', 'accentDark']) {
        expect(contrast(colors[`--color-${foreground}`], colors[`--color-${background}`])).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrast(colors['--season-logo-wordmark'], colors[`--color-${background}`])).toBeGreaterThanOrEqual(4.5)
      for (const foreground of ['primary', 'primaryDark', 'focus', 'focusStrong']) {
        expect(contrast(colors[`--color-${foreground}`], colors[`--color-${background}`])).toBeGreaterThanOrEqual(3)
      }
    }
    for (const background of ['primary', 'primaryDark']) {
      expect(contrast(colors['--color-textOnPrimary'], colors[`--color-${background}`])).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps decoration bounded, static, noninteractive and hidden in print', () => {
    const decorativeSelectors = [
      'html[data-season] body::after',
      'html[data-season] [data-testid="main-header"]::before',
      'html[data-season] [data-header-logo-frame]::before',
      'html[data-season] [data-header-logo-frame]::after',
    ]
    for (const selector of decorativeSelectors) {
      expect(declarations(rulesFor(selector)[0])['pointer-events']).toBe('none')
    }
    expect(declarations(rulesFor(decorativeSelectors[0])[0]).height).toBe('160px')
    stylesheet.walkRules((rule) => {
      if (!rule.selector.includes('data-season')) return
      rule.walkDecls((declaration) => {
        expect(declaration.prop).not.toMatch(/^(animation|will-change|filter|backdrop-filter)(-|$)/)
      })
    })
    const printHidden = new Set<string>()
    stylesheet.walkAtRules('media', (media) => {
      if (media.params !== 'print') return
      media.walkRules((rule) => {
        if (declarations(rule).display === 'none') {
          rule.selectors.forEach((selector) => printHidden.add(selector))
        }
      })
    })
    decorativeSelectors.forEach((selector) => expect(printHidden.has(selector)).toBe(true))
  })

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
