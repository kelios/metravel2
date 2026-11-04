import { readFileSync } from 'node:fs'
import postcss from 'postcss'

const PANEL_MARKERS = [
  'search-sidebar',
  'places-sidebar',
  'quests-desktop-sidebar-slot',
  'catalog-filter-panel-aside',
  'quest-filter-frame-aside',
  '.ssg-search-aside',
]

function panelWidthOverrides(css: string) {
  const overrides: string[] = []
  postcss.parse(css).walkRules((rule) => {
    if (!PANEL_MARKERS.some((marker) => rule.selector.includes(marker))) return
    rule.walkDecls(/^(width|min-width|max-width|flex|flex-basis)$/i, (declaration) => {
      overrides.push(`${rule.selector} { ${declaration.prop}: ${declaration.value} }`)
    })
  })
  return overrides
}

it('keeps migrated panel widths in the shared geometry and its generated CSS', () => {
  expect(panelWidthOverrides(readFileSync('app/global.css', 'utf8'))).toEqual([])
})

it.each([
  ['[data-testid="search-sidebar"]', 'width'],
  ['[data-testid="places-sidebar"]', 'max-width'],
  ['[data-testid="quests-desktop-sidebar-slot"]', 'flex-basis'],
  ['[data-bp-layout="catalog-filter-panel-aside"]', 'width'],
  ['[data-bp-layout="quest-filter-frame-aside"]', 'width'],
  ['.ssg-search-aside', 'width'],
])('catches a separate width in %s', (selector, property) => {
  expect(panelWidthOverrides(`@media (min-width:1024px){${selector}{${property}:333px!important}}`))
    .toEqual([`${selector} { ${property}: 333px }`])
})

it('permits paint and visibility rules and the independent fullscreen map geometry', () => {
  const css = `
    [data-testid="places-sidebar"] { display:none; background:transparent; }
    .ssg-map-sidebar-shell { width:360px; }
  `
  expect(panelWidthOverrides(css)).toEqual([])
})
