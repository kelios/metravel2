import type { Page } from '@playwright/test'

import { test, expect } from './fixtures'
import { createQuestFixture } from './helpers/questWizardFixture'

/**
 * #2324 / #2332: actual map first-frame positioning and late CSS geometry.
 * Quest/auth responses and 1px tiles are deterministic infrastructure fixtures;
 * this suite is not the real production map/CLS acceptance gate.
 */
const LEAFLET_CSS_DELAY_MS = 3500
const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

type Rect = { x: number; y: number; width: number; height: number }
type MapFrameProbe = {
  firstTilePosition: string | null
  mapShifts: Array<{ value: number; sources: string[] }>
  controlFrames: Array<Record<string, Rect>>
}
const readProbe = (page: Page) =>
  page.evaluate(() => (window as unknown as { __questMapCssProbe: MapFrameProbe }).__questMapCssProbe)

// Exercise the installed control markup/CSS without reaching into a React or
// Leaflet private map instance. This is an explicitly synthetic geometry fixture,
// including layers states which the quest's real map does not enable by default.
// Suppress only this synthetic toggle's raster: measuring its box must not fetch
// the absent vendor image; real application controls/requests stay untouched.
const readControlCssFixture = (page: Page) => page.evaluate(() => {
  const host = document.createElement('div')
  host.className = 'leaflet-container leaflet-touch'
  Object.assign(host.style, { position: 'fixed', top: '0', left: '0', width: '320px', height: '240px' })
  host.dataset.cssGeometryFixture = 'true'
  host.innerHTML = '<div class="leaflet-control-container">' +
    '<div class="leaflet-top leaflet-left"><div class="leaflet-control-zoom leaflet-bar leaflet-control">' +
    '<a class="leaflet-control-zoom-in">+</a><a class="leaflet-control-zoom-out">−</a></div></div>' +
    '<div class="leaflet-top leaflet-right"><div class="leaflet-control-layers leaflet-control">' +
    '<a class="leaflet-control-layers-toggle" style="background-image:none"></a><section class="leaflet-control-layers-list">' +
    '<label><input class="leaflet-control-layers-selector" type="checkbox"> Fixture layer</label></section></div></div>' +
    '<div class="leaflet-bottom leaflet-right"><div class="leaflet-control-attribution leaflet-control">' +
    '<a href="https://leafletjs.com">Leaflet</a></div></div></div>'
  document.body.appendChild(host)
  const read = (element: Element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      margin: style.margin, padding: style.padding, border: style.border,
      fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight,
      boxSizing: style.boxSizing, position: style.position,
    }
  }
  try {
    const selectors = ['.leaflet-control-zoom', '.leaflet-control-zoom-in', '.leaflet-control-zoom-out',
      '.leaflet-control-layers', '.leaflet-control-layers-toggle', '.leaflet-control-attribution']
    const collapsed = Object.fromEntries(selectors.map((selector) => [selector, read(host.querySelector(selector)!)]))
    const layers = host.querySelector('.leaflet-control-layers')!
    layers.classList.add('leaflet-control-layers-expanded')
    const expanded = read(layers)
    layers.classList.remove('leaflet-control-layers-expanded')
    const credit = host.querySelector<HTMLElement>('.leaflet-control-attribution')!
    const reservations = [180, 320, 390, 1280].map((width) => {
      host.style.width = `${width}px`
      credit.innerHTML = '<a href="https://leafletjs.com">Leaflet</a>'
      const prefix = read(credit)
      // Standard public Leaflet prefix includes a flag; retain it in the full credit.
      credit.innerHTML = '<a href="https://leafletjs.com"><svg class="leaflet-attribution-flag" viewBox="0 0 12 8" aria-hidden="true"></svg> Leaflet</a> | ' +
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      const complete = read(credit)
      const textVisible = getComputedStyle(credit).overflow === 'visible' &&
        getComputedStyle(credit).textOverflow !== 'ellipsis' && credit.scrollWidth <= credit.clientWidth
      credit.append(document.createTextNode(' | Additional overlay attribution retained in full'))
      const overlay = read(credit)
      return { width, prefix, complete, overlay, textVisible }
    })
    return { collapsed, expanded, reservations }
  } finally {
    host.remove()
  }
})

test.describe('@perf quest map: Leaflet CSS before the first map frame (#2324, #2332)', () => {
  for (const width of [390, 1280]) {
    for (const cssMode of ['immediate', 'late', 'failed'] as const) {
      test(`${width}px ${cssMode} CSS: first tiles and complete controls keep their geometry`, async ({ page }, testInfo) => {
        const quest = createQuestFixture({
          questId: 'e2e-quest-map-css-first-frame', questTitle: 'E2E-квест карты: первый кадр',
          questNumericId: 91_724, progressId: 90_724, viewport: { width, height: 900 },
          points: [{ id: 'css-step-1', lat: 53.9023, lng: 27.5619 },
            { id: 'css-step-2', lat: 53.9041, lng: 27.5652 },
            { id: 'css-step-3', lat: 53.9062, lng: 27.5598 }],
        })
        const raw = {
          requestFailures: [] as Array<{ url: string; error: string | null }>,
          consoleErrors: [] as Array<{ text: string; url: string }>, pageErrors: [] as string[],
          badResponses: [] as Array<{ url: string; status: number }>,
          controlledCssFailures: [] as string[],
          observations: [] as unknown[],
        }
        page.on('requestfailed', (request) => raw.requestFailures.push({ url: request.url(), error: request.failure()?.errorText ?? null }))
        page.on('console', (message) => {
          if (message.type() === 'error') raw.consoleErrors.push({ text: message.text(), url: message.location().url })
        })
        page.on('pageerror', (error) => raw.pageErrors.push(error.message))
        page.on('response', (response) => {
          if (response.status() >= 400) raw.badResponses.push({ url: response.url(), status: response.status() })
        })
        let releaseCss: () => void = () => undefined
        const resetCssGate = () => new Promise<void>((resolve) => { releaseCss = resolve })
        let cssGate = resetCssGate()
        await page.route('**/vendor/leaflet.css', async (route) => {
          if (cssMode === 'failed') {
            raw.controlledCssFailures.push(route.request().url())
            await route.abort('failed')
          } else {
            if (cssMode === 'late') {
              await new Promise((resolve) => setTimeout(resolve, LEAFLET_CSS_DELAY_MS))
              await cssGate
            }
            await route.continue()
          }
        })
        await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', async (route) => {
          if (cssMode !== 'failed') return route.continue()
          raw.controlledCssFailures.push(route.request().url())
          await route.abort('failed')
        })
        await page.route('**/proxy/tiles/osm/**', (route) =>
          route.fulfill({ status: 200, contentType: 'image/png', body: TILE_PNG }))
        await page.addInitScript(() => {
          const probe: MapFrameProbe = { firstTilePosition: null, mapShifts: [], controlFrames: [] }
          ;(window as unknown as { __questMapCssProbe: MapFrameProbe }).__questMapCssProbe = probe
          const insideMap = (node: Node | null | undefined) => {
            const element = node && node.nodeType === 1 ? node as Element : node?.parentElement
            return Boolean(element?.closest('.leaflet-container'))
          }
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as Array<PerformanceEntry & {
              value: number; hadRecentInput: boolean; sources?: Array<{ node?: Node | null }>
            }>) {
              if (entry.hadRecentInput) continue
              const sources = (entry.sources || []).filter((source) => insideMap(source.node))
              if (sources.length) probe.mapShifts.push({ value: Number(entry.value.toFixed(4)),
                sources: sources.map((source) => source.node?.nodeName || '?') })
            }
          }).observe({ type: 'layout-shift', buffered: true })
          new MutationObserver((records) => {
            if (probe.firstTilePosition !== null) return
            for (const record of records) for (const node of Array.from(record.addedNodes)) {
              if (node.nodeType !== 1) continue
              const element = node as Element
              const tile = element.matches('img.leaflet-tile') ? element : element.querySelector('img.leaflet-tile')
              if (tile) { probe.firstTilePosition = getComputedStyle(tile).position; return }
            }
          }).observe(document, { childList: true, subtree: true })
          const sample = () => {
            const map = document.querySelector('.leaflet-container')
            const controls: Record<string, Rect> = {}
            for (const selector of ['.leaflet-control-zoom', '.leaflet-control-attribution']) {
              const control = map?.querySelector(selector)
              if (!control) continue
              const rect = control.getBoundingClientRect()
              controls[selector] = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            }
            if (Object.keys(controls).length === 2 &&
                JSON.stringify(controls) !== JSON.stringify(probe.controlFrames.at(-1))) probe.controlFrames.push(controls)
            requestAnimationFrame(sample)
          }
          requestAnimationFrame(sample)
        })
        try {
          await quest.open(page)
          const check = async (label: string) => {
            expect(page.viewportSize()?.width).toBe(width)
            await expect(page.locator('.leaflet-container img.leaflet-tile').first()).toBeAttached({ timeout: 60_000 })
            if (cssMode !== 'immediate') await expect(page.locator('style[data-leaflet-fallback="true"]')).toBeAttached()
            await page.waitForFunction(() => {
              const tiles = Array.from(document.querySelectorAll<HTMLImageElement>('.leaflet-container img.leaflet-tile'))
              return tiles.length > 0 && tiles.every((tile) => tile.complete) &&
                (window as unknown as { __questMapCssProbe: MapFrameProbe }).__questMapCssProbe.controlFrames.length > 0
            })
            const before = await readControlCssFixture(page)
            for (const reservation of before.reservations) {
              expect(reservation.complete, `${label}: full default credit box at ${reservation.width}px`).toEqual(reservation.prefix)
              expect(reservation.textVisible, `${label}: default credit must fit without truncation`).toBe(true)
              expect(reservation.complete.width).toBeLessThanOrEqual(reservation.width)
              expect(reservation.overlay.height).toBeGreaterThanOrEqual(reservation.complete.height)
            }
            releaseCss()
            if (cssMode !== 'failed') await page.waitForFunction(() =>
              document.getElementById('metravel-leaflet-css')?.getAttribute('data-css-state') === 'loaded')
            await page.evaluate(() => new Promise<void>((resolve) => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            }))
            const after = await readControlCssFixture(page)
            expect(after, `${label}: vendor CSS changed zoom/layers/credit box, font or margins`).toEqual(before)
            const probe = await readProbe(page)
            raw.observations.push({ label, before, after, probe })
            expect(probe.firstTilePosition, `${label}: first tile inserted before layout CSS`).toBe('absolute')
            expect(probe.mapShifts, `${label}: layout shift from map nodes`).toEqual([])
            expect(probe.controlFrames, `${label}: controls changed between painted frames`).toHaveLength(1)
            await expect(page.locator('.leaflet-control-attribution a[href="https://www.openstreetmap.org/copyright"]').first()).toBeAttached()
          }
          await check('quest start')
          await page.waitForLoadState('networkidle')
          cssGate = resetCssGate()
          await page.reload({ waitUntil: 'domcontentloaded' })
          await check('cold reload')
          await page.waitForLoadState('networkidle')
          const isControlled = (url: string) => raw.controlledCssFailures.includes(url)
          // Preserve every raw failure; only the exact two deliberately aborted
          // CSS URLs in this fail scenario are controlled infrastructure evidence.
          expect(raw.requestFailures.filter((entry) => !(isControlled(entry.url) && entry.error === 'net::ERR_FAILED'))).toEqual([])
          expect(raw.consoleErrors.filter((entry) => !(isControlled(entry.url) && entry.text === 'Failed to load resource: net::ERR_FAILED'))).toEqual([])
          expect(raw.pageErrors).toEqual([])
          expect(raw.badResponses).toEqual([])
        } finally {
          releaseCss()
          await testInfo.attach('raw-map-css-first-frame.json', { body: JSON.stringify(raw, null, 2), contentType: 'application/json' })
        }
      })
    }
  }
})
