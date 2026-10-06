import type { Page } from '@playwright/test'

import { test, expect } from './fixtures'
import { createQuestFixture } from './helpers/questWizardFixture'

/**
 * #2324: первый кадр карты квеста = итоговая геометрия.
 *
 * Дефект: `QuestFullMap` монтировал движок Leaflet, не дождавшись применения
 * leaflet.css (`ensureLeafletCss()` синхронно вставлял `<link>` и сразу
 * возвращал boolean, а `useLeafletLoader` намеренно не ждал CSS). Первые кадры
 * рисовали тайлы, SVG-слой маршрута и контролы в обычном потоке — тайлы
 * столбиком под контейнером; приход стиля переставлял их в `position:absolute`,
 * и браузер записывал layout shift 0,11 на каждой перезагрузке (desktop 1280).
 *
 * Контракт держит `loadLeafletRuntime` (общий для всех web-карт): движок
 * отдаётся только после `whenLeafletCssReady`. Чтобы проверка не зависела от
 * удачного кэша, leaflet.css здесь намеренно задерживается.
 */

const LEAFLET_CSS_DELAY_MS = 1500

// 1×1 PNG: тайлы должны получить содержимое, иначе пустые <img> не участвуют в
// расчёте сдвигов, и регрессия прошла бы незамеченной.
const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

const quest = createQuestFixture({
  questId: 'e2e-quest-map-css-first-frame',
  questTitle: 'E2E-квест карты: первый кадр',
  questNumericId: 91_724,
  progressId: 90_724,
  points: [
    { id: 'css-step-1', lat: 53.9023, lng: 27.5619 },
    { id: 'css-step-2', lat: 53.9041, lng: 27.5652 },
    { id: 'css-step-3', lat: 53.9062, lng: 27.5598 },
  ],
})

type MapFrameProbe = {
  /** `position` первого тайла в момент его вставки в DOM. */
  firstTilePosition: string | null
  /** Сдвиги, хотя бы один источник которых лежит внутри `.leaflet-container`. */
  mapShifts: Array<{ value: number; sources: string[] }>
}

const readProbe = (page: Page) =>
  page.evaluate(() => (window as unknown as { __questMapCssProbe: MapFrameProbe }).__questMapCssProbe)

test.describe('@perf quest map: Leaflet CSS before the first map frame (#2324)', () => {
  test('desktop map panel mounts tiles absolutely positioned and does not shift', async ({ page }) => {
    await page.route('**/vendor/leaflet.css', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, LEAFLET_CSS_DELAY_MS))
      await route.continue()
    })
    await page.route('**/proxy/tiles/osm/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TILE_PNG }),
    )
    await page.addInitScript(() => {
      const probe: MapFrameProbe = { firstTilePosition: null, mapShifts: [] }
      ;(window as unknown as { __questMapCssProbe: MapFrameProbe }).__questMapCssProbe = probe

      const insideMap = (node: Node | null | undefined) => {
        for (let el = node && node.nodeType === 1 ? (node as Element) : node?.parentElement; el; el = el.parentElement) {
          if (el.classList?.contains('leaflet-container')) return true
        }
        return false
      }

      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<PerformanceEntry & {
            value: number
            hadRecentInput: boolean
            sources?: Array<{ node?: Node | null }>
          }>) {
            if (entry.hadRecentInput) continue
            const sources = (entry.sources || []).filter((source) => insideMap(source.node))
            if (!sources.length) continue
            probe.mapShifts.push({
              value: Number(entry.value.toFixed(4)),
              sources: sources.map((source) => source.node?.nodeName || '?'),
            })
          }
        }).observe({ type: 'layout-shift', buffered: true })
      } catch {
        // layout-shift есть в Chromium; без него проверка тайлов ниже всё равно держит контракт.
      }

      new MutationObserver((records) => {
        if (probe.firstTilePosition !== null) return
        for (const record of records) {
          for (const node of Array.from(record.addedNodes)) {
            if (node.nodeType !== 1) continue
            const tile = (node as Element).matches?.('img.leaflet-tile')
              ? (node as Element)
              : (node as Element).querySelector?.('img.leaflet-tile')
            if (tile) {
              probe.firstTilePosition = getComputedStyle(tile).position
              return
            }
          }
        }
      }).observe(document, { childList: true, subtree: true })
    })

    await quest.open(page)

    const check = async (label: string) => {
      await expect(page.locator('.leaflet-container img.leaflet-tile').first()).toBeAttached({ timeout: 60_000 })
      // Окно, в котором раньше приходил CSS и переставлял слои.
      await page.waitForTimeout(LEAFLET_CSS_DELAY_MS + 1000)
      const probe = await readProbe(page)
      expect(probe.firstTilePosition, `${label}: первый тайл вставлен до применения leaflet.css`).toBe('absolute')
      expect(probe.mapShifts, `${label}: layout shift от узлов карты`).toEqual([])
    }

    await check('после старта квеста')
    // Холодный старт страницы на шаге — сценарий из карточки.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await check('после перезагрузки')
  })
})
