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
// CSS paints the first background image on top. Combining the maximum opacity
// of each gradient gives a conservative bound, including intersecting lights.
const artBackgrounds = (gradient: string): number[][] => {
  const overlays = [...gradient.matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g)].reverse()
  return gradient.match(/#[0-9a-f]{6}/g)!.flatMap(hex => {
    const base = rgb(hex)
    return [base, overlays.reduce((color, match) => composite(color, match.slice(1, 4).map(Number), Number(match[4])), base)]
  })
}

describe('base artistic theme safety', () => {
  it.each(['light', 'dark'] as const)('keeps header and small hero text readable over the composed %s art', scheme => {
    const art = rootValues(`html:not([data-season])${scheme === 'dark' ? '[data-theme="dark"]' : ''}`)
    const colors = { ...rootValues(':root'), ...(scheme === 'dark' ? rootValues('html[data-theme="dark"]') : {}) }
    const relief = new DOMParser().parseFromString(decodeURIComponent(art['--base-atlas-relief'].match(/^url\("data:image\/svg\+xml,(.*)"\)$/)![1]), 'image/svg+xml')
    const groups = [...relief.querySelectorAll('svg > g')]
    const surfaces = [
      { backgrounds: artBackgrounds(art['--base-atlas-header']), foregrounds: ['text', 'textMuted', 'primaryText', 'brandText'] },
      {
        backgrounds: artBackgrounds(art['--base-atlas-horizon']).flatMap(background => [background, groups.reduce((color, group) => {
          const stroke = group.getAttribute('stroke')
          const paint = stroke && stroke !== 'none' ? stroke : group.getAttribute('fill')!
          const alpha = Number(group.getAttribute('stroke-opacity') ?? group.getAttribute('opacity') ?? 1)
          return composite(color, rgb(paint), alpha)
        }, background)]),
        // The 10px chapter label uses textSubtle directly on the hero, while
        // the subtitle and title accent use textMuted and brandText.
        foregrounds: ['text', 'textMuted', 'textSubtle', 'brandText'],
      },
    ]
    for (const { backgrounds, foregrounds } of surfaces) for (const background of backgrounds) for (const foreground of foregrounds) {
      const values = [luminance(background), luminance(rgb(colors[`--color-${foreground}`]))].sort((a, b) => a - b)
      expect((values[1] + 0.05) / (values[0] + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
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
    page.body.innerHTML = '<div data-testid="main-header"><div data-testid="main-header-row"></div></div><div data-testid="home-hero"></div><div data-header-logo-frame></div><div data-header-logo-travel></div><div data-testid="travel-details-description"></div><div data-testid="map-container"></div>'
    for (const rule of baseRules) for (const selector of rule.selectors) {
      const target = selector.replace(/::(before|after)$/, '')
      for (const season of SEASONAL_THEME_IDS) {
        page.documentElement.dataset.season = season
        expect(page.querySelector(target)).toBeNull()
      }
      delete page.documentElement.dataset.season
      for (const testId of ['travel-details-description', 'map-container']) {
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
    for (const suffix of ['[data-testid="main-header-row"]', '[data-testid="home-hero"]', '[data-testid="main-header"]::before', '[data-header-logo-frame]::before', '[data-header-logo-frame]::after']) {
      expect(hidden.has(`html:not([data-season]) ${suffix}`)).toBe(true)
    }
  })
})
