import fs from 'node:fs'
import path from 'node:path'
import { list, parse, type Rule } from 'postcss'
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
    expect(svg.querySelector('script, style, foreignObject, image, animate, animateTransform, set, [href], [xlink\\:href]')).toBeNull()
    for (const node of svg.querySelectorAll('*')) {
      expect([...node.attributes].some(attribute => /^on/i.test(attribute.name))).toBe(false)
    }
  })

  it.each(['light', 'dark'] as const)('keeps winter scenes self-contained and snow below header labels in %s', scheme => {
    const colors = palette('christmas', scheme)
    for (const token of ['tree-image', 'village-image', 'header-snow']) {
      const image = colors[`--christmas-${token}`].match(/^url\("data:image\/svg\+xml,(.*)"\)$/)!
      const svg = new DOMParser().parseFromString(decodeURIComponent(image[1]), 'image/svg+xml')
      expect(svg.querySelector('parsererror')).toBeNull()
      expect(svg.querySelector('script, style, foreignObject, image, animate, animateTransform, set, [href], [xlink\\:href]')).toBeNull()
      for (const node of svg.querySelectorAll('*')) {
        expect([...node.attributes].some(attribute => /^on/i.test(attribute.name))).toBe(false)
      }
      if (token === 'header-snow') {
        expect(Number(svg.querySelector('#header-snow-band rect')!.getAttribute('y'))).toBeGreaterThanOrEqual(54)
        expect([...svg.querySelectorAll('svg > g')].every(group => group.getAttribute('clip-path') === 'url(#header-snow-band)')).toBe(true)
      } else {
        expect(svg.documentElement.getAttribute('viewBox')).toBe('0 0 320 420')
        expect(svg.querySelector(token === 'tree-image' ? '#festive-fir' : '#warm-cottage')).not.toBeNull()
      }
    }
  })

  it.each(['light', 'dark'] as const)('keeps small text legible under partial winter glows in %s', scheme => {
    const colors = palette('christmas', scheme)
    const rgb = (hex: string): number[] => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16))
    const composite = (background: number[], paint: number[], alpha: number): number[] =>
      background.map((channel, index) => Math.round(channel * (1 - alpha) + paint[index] * alpha))
    // Ordered subsets include bright partial overlaps without darker neighbours.
    const layers = [...`${colors['--season-header-glow']}, ${colors['--season-edge-glow']}`.matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g)].reverse()
    for (const surface of ['background', 'backgroundSecondary', 'surface']) {
      const backgrounds = layers.reduce((values, layer) => values.flatMap(value => [value, composite(value, layer.slice(1, 4).map(Number), Number(layer[4]))]), [rgb(colors[`--color-${surface}`])])
      for (const background of backgrounds) {
        const hex = '#' + background.map(channel => channel.toString(16).padStart(2, '0')).join('')
        for (const foreground of ['text', 'textMuted', 'textSubtle', 'primaryText']) {
          expect(contrast(colors[`--color-${foreground}`], hex)).toBeGreaterThanOrEqual(4.5)
        }
        expect(contrast(colors['--season-logo-wordmark'], hex)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('keeps complete desktop winter scenes above the fixed footer on the first frame', () => {
    const hero = declarations(rulesFor('html[data-season="christmas"] [data-testid="home-hero"]')[0])
    const positions = list.comma(hero['background-position']).slice(0, 2)
    const maximumWidth = Number(hero['--christmas-scene-width'].match(/,\s*(\d+)px\)$/)![1])
    const colors = palette('christmas', 'light')
    for (const [index, token] of ['tree-image', 'village-image'].entries()) {
      // Bottom anchoring hid the cottage windows under the footer when the book
      // was taller than the first frame. Reserve header/footer in a short desktop.
      expect(positions[index]).toMatch(/^(left|right) \d+px top \d+px$/)
      const top = Number(positions[index].match(/top (\d+)px$/)![1])
      const image = colors[`--christmas-${token}`].match(/^url\("data:image\/svg\+xml,(.*)"\)$/)!
      const svg = new DOMParser().parseFromString(decodeURIComponent(image[1]), 'image/svg+xml')
      const [, , width, height] = svg.documentElement.getAttribute('viewBox')!.split(' ').map(Number)
      expect(top + maximumWidth * height / width).toBeLessThan(640 - 80 - 56)
    }
  })

  it('keeps winter scenes on the home background, isolates seasons and clears them for print', () => {
    const selector = 'html[data-season="christmas"] [data-testid="home-hero"]'
    const hero = declarations(rulesFor(selector)[0])
    // A scrollbar narrows the hero without narrowing 100vw. Percentages size
    // the scenes from the actual background area, preserving the book gutters.
    expect(hero['--christmas-scene-width']).toContain('100%')
    expect(hero['--christmas-scene-width']).not.toContain('vw')
    expect(hero['background-repeat']).toBe('no-repeat')
    expect(hero['background-image']).toContain('var(--christmas-tree-image)')
    expect(hero['background-image']).toContain('var(--christmas-village-image)')
    const colors = palette('christmas', 'light')
    const images = list.comma(hero['background-image'].replace(/var\((--[\w-]+)\)/g, (_, token: string) => colors[token]))
    // Edge glow expands to two gradients: shorter lists would repeat a scene's
    // geometry onto the final gradient, shrinking it and moving it into a gutter.
    expect(images).toHaveLength(4)
    for (const property of ['background-position', 'background-size']) {
      expect(list.comma(hero[property])).toHaveLength(images.length)
    }
    expect(list.comma(hero['background-position']).slice(2)).toEqual(['center top', 'center top'])
    expect(list.comma(hero['background-size']).slice(2)).toEqual(['100% 100%', '100% 100%'])
    const page = document.implementation.createHTMLDocument()
    page.body.innerHTML = '<div data-testid="home-hero"></div><div data-testid="travel-details-description"></div><div data-testid="map-container"></div>'
    for (const season of SEASONAL_THEME_IDS.filter(id => id !== 'christmas')) {
      page.documentElement.dataset.season = season
      expect(page.querySelector(selector)).toBeNull()
    }
    delete page.documentElement.dataset.season
    expect(page.querySelector(selector)).toBeNull()
    page.documentElement.dataset.season = 'christmas'
    expect(page.querySelector(selector)).not.toBeNull()
    for (const id of ['travel-details-description', 'map-container']) expect(page.querySelector(`[data-testid="${id}"]`)!.matches(selector)).toBe(false)
    let crest: Record<string, string> | undefined
    let print: Record<string, string> = {}
    stylesheet.walkAtRules('media', media => media.walkRules(rule => {
      if (!rule.selectors.includes(selector)) return
      if (media.params === '(max-width: 1279.98px)') crest = declarations(rule)
      if (media.params === 'print') print = { ...print, ...declarations(rule) }
    }))
    // The two 126px illustrations fit above the content's 136px top padding.
    expect(crest?.['background-size']).toBe('96px 126px, 96px 126px, 100% 100%, 100% 100%')
    expect(list.comma(crest!['background-position'])).toHaveLength(images.length)
    expect(crest?.['padding-top']).toBe('136px')
    expect(print['background-image']).toBe('none')
    expect(print['padding-top']).toBe('0')
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
