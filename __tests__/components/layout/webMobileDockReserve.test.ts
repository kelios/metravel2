import * as fs from 'node:fs'
import * as path from 'node:path'
import { parse, type AtRule, type Container, type Document } from 'postcss'

import { METRICS } from '@/constants/layout'
import { BOTTOM_DOCK_HEIGHT } from '@/components/layout/bottomDockItemDefs'
import { WEB_MOBILE_DOCK_LAYOUT } from '@/components/layout/webMobileDockLayout'
import { buildCriticalCSS } from '@/utils/criticalCSSBuilder'

// Resolve the emitted declaration, including its media/route conditions. jsdom
// does not resolve CSS variables or env(), so it cannot check this producer.
function dockReserveDeclaration(css: string, width: number, dockOff = false): string {
  let value = ''
  parse(css).walkRules((rule) => {
    if (rule.selector !== ':root' && !(dockOff && rule.selector === 'body:has([data-mt-dock="off"])')) return
    let parent: Container | Document | undefined = rule.parent
    while (parent) {
      if (parent.type === 'atrule' && (parent as AtRule).name === 'media') {
        const params = (parent as AtRule).params
        const max = params.match(/max-width:\s*([\d.]+)px/)
        const min = params.match(/min-width:\s*([\d.]+)px/)
        if ((max && width > Number(max[1])) || (min && width < Number(min[1]))) return
      }
      parent = parent.parent
    }
    rule.walkDecls('--mt-dock-h', (declaration) => { value = declaration.value })
  })
  return value
}

describe('canonical web dock reserve (#2305)', () => {
  const globalCss = fs.readFileSync(path.resolve(__dirname, '../../../app/global.css'), 'utf8')
  const producers = [['startup CSS', globalCss], ['first-frame CSS', buildCriticalCSS()]] as const
  const visibleReserve = `calc(${BOTTOM_DOCK_HEIGHT}px + env(safe-area-inset-bottom, 0px))`

  it.each(producers)('%s reserves the visible dock on both sides of the old and actual breakpoint', (_, css) => {
    expect(WEB_MOBILE_DOCK_LAYOUT.minWidth).toBe(METRICS.breakpoints.desktop)
    for (const width of [390, 820, 1023, 1024, 1180, 1279, 1280, 1440]) {
      const visible = width < WEB_MOBILE_DOCK_LAYOUT.minWidth
      expect(dockReserveDeclaration(css, width)).toBe(visible ? visibleReserve : '0px')
      expect(dockReserveDeclaration(css, width, true)).toBe('0px')
    }
  })

  it('detects the old tablet-only reserve instead of accepting numeric consumer mocks', () => {
    const regression = globalCss.replace('max-width: 1279.98px', 'max-width: 1023px')
    expect(dockReserveDeclaration(regression, 1180)).toBe('0px')
    expect(dockReserveDeclaration(globalCss, 1180)).toBe(visibleReserve)
  })
})
