import fs from 'node:fs'
import path from 'node:path'
import { parse, type Rule } from 'postcss'
import { SEASONAL_THEME_IDS } from '@/constants/seasonalThemes'

const stylesheet = parse(fs.readFileSync(path.join(process.cwd(), 'app/global.css'), 'utf8'))
const baseRules: Rule[] = []
// Selectors use the presence of the seasonal attribute; custom properties carry the art.
stylesheet.walkRules(rule => {
  if (rule.selector.includes('html:not([data-season])')) baseRules.push(rule)
})
const declarations = (rule: Rule): Record<string, string> => Object.fromEntries(
  rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]),
)
const rootValues = (selector: string): Record<string, string> => {
  const result: Record<string, string> = {}
  stylesheet.walkRules(rule => {
    if (rule.selector === selector && rule.parent?.type === 'root') Object.assign(result, declarations(rule))
  })
  return result
}
const rgb = (hex: string): number[] => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16))
const luminance = (color: number[]): number => {
  const channels = color.map(value => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
const composite = (background: number[], foreground: number[], alpha: number): number[] =>
  background.map((channel, index) => channel * (1 - alpha) + foreground[index] * alpha)
// Enumerate ordered subsets: a darkening layer may be absent at a bright
// overlap. Full-stack composition alone can hide that contrast failure.
const paintSubsets = (background: number[], layers: { color: number[]; alpha: number }[]): number[][] =>
  layers.reduce((backgrounds, layer) => backgrounds.flatMap(color => [color, composite(color, layer.color, layer.alpha)]), [background])
// CSS paints the first background image on top. Endpoints of every overlay
// also bound partial gradient opacity and intersecting lights conservatively.
const artBackgrounds = (gradient: string): number[][] => {
  const overlays = [...gradient.matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g)].reverse()
  return gradient.match(/#[0-9a-f]{6}/g)!.flatMap(hex => paintSubsets(rgb(hex),
    overlays.map(match => ({ color: match.slice(1, 4).map(Number), alpha: Number(match[4]) })),
  ))
}

describe('base artistic theme safety', () => {
  it.each(['light', 'dark'] as const)('keeps header and small hero text readable over the composed %s art', scheme => {
    const art = rootValues(`html:not([data-season])${scheme === 'dark' ? '[data-theme="dark"]' : ''}`)
    const colors = { ...rootValues(':root'), ...(scheme === 'dark' ? rootValues('html[data-theme="dark"]') : {}) }
    const relief = new DOMParser().parseFromString(decodeURIComponent(art['--base-atlas-relief'].match(/^url\("data:image\/svg\+xml,(.*)"\)$/)![1]), 'image/svg+xml')
    const groups = [...relief.querySelectorAll('svg > g')]
    const landscape = new DOMParser().parseFromString(decodeURIComponent(art['--base-atlas-landscape'].match(/^url\("data:image\/svg\+xml,(.*)"\)$/)![1]), 'image/svg+xml')
    const ridges = [...landscape.querySelectorAll('svg > g[fill]:not([fill="none"])')]
    expect(ridges).toHaveLength(4)
    const headerBackgrounds = artBackgrounds(art['--base-atlas-header']).flatMap(background => paintSubsets(background,
      ridges.map(group => ({ color: rgb(group.getAttribute('fill')!), alpha: Number(group.getAttribute('opacity') ?? 1) })),
    ))
    // Bright trail marks are clipped below the header label band.
    const trailBand = landscape.querySelector('#trail-band rect')!
    expect(Number(trailBand.getAttribute('y'))).toBeGreaterThanOrEqual(54)
    const surfaces = [
      { name: 'header', backgrounds: headerBackgrounds, foregrounds: ['text', 'textMuted', 'primaryText', 'brandText'] },
      {
        name: 'hero',
        backgrounds: artBackgrounds(art['--base-atlas-horizon']).flatMap(background => paintSubsets(background, groups.map(group => {
          const stroke = group.getAttribute('stroke')
          const paint = stroke && stroke !== 'none' ? stroke : group.getAttribute('fill')!
          const alpha = Number(group.getAttribute('stroke-opacity') ?? group.getAttribute('opacity') ?? 1)
          return { color: rgb(paint), alpha }
        }))),
        // The 10px chapter label uses textSubtle directly on the hero, while
        // the subtitle and title accent use textMuted and brandText.
        foregrounds: ['text', 'textMuted', 'textSubtle', 'brandText'],
      },
    ]
    for (const { name, backgrounds, foregrounds } of surfaces) for (const background of backgrounds) for (const foreground of foregrounds) {
      const values = [luminance(background), luminance(rgb(colors[`--color-${foreground}`]))].sort((a, b) => a - b)
      const contrast = (values[1] + 0.05) / (values[0] + 0.05)
      // Keep the full failing surface in Jest output instead of only a ratio.
      expect(contrast >= 4.5 ? null : { scheme, surface: name, foreground, background, contrast }).toBeNull()
    }
  })

  it.each(['light', 'dark'] as const)('keeps both summit ridges inside their mountain in %s relief', scheme => {
    const art = rootValues(`html:not([data-season])${scheme === 'dark' ? '[data-theme="dark"]' : ''}`)
    const relief = new DOMParser().parseFromString(decodeURIComponent(art['--base-atlas-relief'].match(/^url\("data:image\/svg\+xml,(.*)"\)$/)![1]), 'image/svg+xml')
    const ridge = relief.querySelector('g[stroke] path')!.getAttribute('d')!
    const subpaths: number[][][] = []
    let point = [0, 0]
    for (const segment of ridge.matchAll(/([mMlL])([^mMlL]*)/g)) {
      const relative = segment[1] === segment[1].toLowerCase()
      if (segment[1].toLowerCase() === 'm') subpaths.push([])
      const numbers = segment[2].match(/-?\d+(?:\.\d+)?/g)!.map(Number)
      for (let i = 0; i < numbers.length; i += 2) {
        point = relative ? [point[0] + numbers[i], point[1] + numbers[i + 1]] : [numbers[i], numbers[i + 1]]
        subpaths[subpaths.length - 1].push(point)
      }
    }
    expect(subpaths).toHaveLength(2)
    // An absolute negative coordinate after M sends the right ridge across the
    // entire hero instead of tracing a small snowy summit at its right edge.
    for (const [x, y] of subpaths[0]) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(300)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThan(200)
    }
    for (const [x, y] of subpaths[1]) {
      expect(x).toBeGreaterThan(1200)
      expect(x).toBeLessThanOrEqual(1440)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThan(200)
    }
  })

  it('puts navigation marker frames behind glyphs without changing their slot or hit target', () => {
    const slot = baseRules.find(rule => rule.selector === 'html:not([data-season]) [data-travel-nav-icon]' && rule.parent?.type === 'root')!
    const frame = baseRules.find(rule => rule.selector === 'html:not([data-season]) [data-travel-nav-icon]::before' && rule.parent?.type === 'root')!
    expect(declarations(slot)).toMatchObject({ position: 'relative', isolation: 'isolate' })
    expect(declarations(frame)).toMatchObject({ position: 'absolute', inset: '-3px', 'z-index': '-1', 'pointer-events': 'none' })
    for (const geometryKey of ['width', 'height', 'padding']) expect(declarations(slot)).not.toHaveProperty(geometryKey)
  })

  it('uses self-contained static vector art without external media or executable SVG', () => {
    const images = new Set<string>()
    for (const rule of baseRules) rule.walkDecls(decl => {
      if (decl.value.startsWith('url(')) images.add(decl.value)
      expect(decl.prop).not.toMatch(/^(animation|will-change|filter|backdrop-filter)(-|$)/)
      expect(decl.prop).not.toMatch(/^--color-/)
    })
    expect(images.size).toBeGreaterThan(0)
    for (const value of images) {
      const encoded = value.match(/^url\("data:image\/svg\+xml,(.*)"\)$/)
      expect(encoded).not.toBeNull()
      const svg = new DOMParser().parseFromString(decodeURIComponent(encoded![1]), 'image/svg+xml')
      expect(svg.querySelector('parsererror')).toBeNull()
      expect(svg.querySelector('script, style, foreignObject, image, animate, animateTransform, set, [href], [xlink\\:href]')).toBeNull()
      for (const node of svg.querySelectorAll('*')) {
        expect([...node.attributes].some(attribute => /^on/i.test(attribute.name))).toBe(false)
      }
    }
  })

  it('excludes all seasonal appearances and leaves article/map surfaces undecorated', () => {
    const page = document.implementation.createHTMLDocument()
    page.body.innerHTML = '<div data-testid="main-header"><div data-testid="main-header-row"><div data-travel-nav-active="true"><div data-travel-nav-icon="map-pin"><span></span><svg><path stroke="currentColor" fill="currentColor"></path></svg></div></div></div></div><div data-testid="home-hero"></div><div data-header-logo-frame></div><div data-header-logo-travel></div><div data-testid="travel-details-description"></div><div data-testid="map-container"></div><div data-testid="account-icon"></div>'
    for (const rule of baseRules) for (const selector of rule.selectors) {
      const target = selector.replace(/::(before|after)$/, '')
      for (const season of SEASONAL_THEME_IDS) {
        page.documentElement.dataset.season = season
        expect(page.querySelector(target)).toBeNull()
      }
      delete page.documentElement.dataset.season
      for (const testId of ['travel-details-description', 'map-container', 'account-icon']) {
        expect(page.querySelector(`[data-testid="${testId}"]`)!.matches(target)).toBe(false)
      }
      if (/::(before|after)$/.test(selector) && rule.parent?.type === 'root') {
        expect(declarations(rule)['pointer-events']).toBe('none')
        expect(declarations(rule).position).toBe('absolute')
      }
    }
  })

  it('removes art in print and respects the system dark first frame', () => {
    const dark = rootValues('html:not([data-season])[data-theme="dark"]')
    let fallback: Record<string, string> | undefined
    const hidden = new Set<string>()
    stylesheet.walkAtRules('media', media => {
      media.walkRules(rule => {
        if (media.params === '(prefers-color-scheme: dark)' && rule.selector === 'html:not([data-season]):not([data-theme])') fallback = declarations(rule)
        if (media.params === 'print' && (declarations(rule).display === 'none' || declarations(rule)['background-image'] === 'none')) {
          rule.selectors.forEach(selector => hidden.add(selector))
        }
      })
    })
    expect(fallback).toEqual(dark)
    for (const suffix of ['[data-testid="main-header-row"]', '[data-testid="home-hero"]', '[data-testid="main-header"]::before', '[data-header-logo-frame]::before', '[data-header-logo-frame]::after', '[data-travel-nav-icon]::before']) {
      expect(hidden.has(`html:not([data-season]) ${suffix}`)).toBe(true)
    }
  })
})
