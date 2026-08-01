import { test, expect } from './fixtures'
import { devices } from '@playwright/test'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

// [FE-635-T2/T3] Карта мира v2: зум/пан + клик по стране → маршруты страны.
const COUNTRY_PROGRESS = {
  total_count: 234, visited_count: 4, remaining_count: 230,
  countries: [
    { country_id: 1, country_code: 'BY', region: 'europe', title_ru: 'Беларусь', visited: true, visited_travels_count: 5, first_visited_date: '2018-05-01' },
    { country_id: 2, country_code: 'FR', region: 'europe', title_ru: 'Франция', visited: true, visited_travels_count: 2, first_visited_date: '2019-07-10' },
    { country_id: 3, country_code: 'JP', region: 'asia', title_ru: 'Япония', visited: true, visited_travels_count: 1, first_visited_date: '2020-01-03' },
    // RU: маршруты приходят в visits[] (привязка по метаданным визита). Их primary
    // country_code — Египет/локальный, поэтому buildTravelsByCountryCode их НЕ кладёт
    // под RU. FE обязан показать карточки именно из visits[] — репро бага «2 маршрута,
    // но карточек нет».
    { country_id: 4, country_code: 'RU', region: 'europe', title_ru: 'Россия', visited: true, visited_travels_count: 2, first_visited_date: null,
      visits: [
        { travel_id: 210, travel_title: 'Египет. Хургада.', travel_url: '/travels/egipet', year: 2012 },
        { travel_id: 245, travel_title: 'Калининград зимой', travel_url: '/travels/kaliningrad', year: 2013 },
      ] },
  ],
}

const MY_TRAVELS = {
  data: [
    {
      id: 9001,
      slug: 'minsk-weekend',
      name: 'Минск за выходные',
      url: '/travels/minsk-weekend',
      countryName: 'Беларусь',
      country_code: 'BY',
      travel_image_thumb_url: 'https://metravel.by/media/test.jpg',
      travel_image_thumb_small_url: 'https://metravel.by/media/test-small.jpg',
      gallery: [],
      travelAddress: [],
    },
  ],
  total: 1,
}

async function openMapTab(page: import('@playwright/test').Page) {
  page.on('pageerror', (e) => console.log('PAGEERR:', e.message))
  await ensureAuthedStorageFallback(page)
  // Catch-all сначала, специфичные роуты после — Playwright прогоняет последний
  // зарегистрированный обработчик первым.
  await page.route('**/api/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await mockFakeAuthApis(page)
  await page.route('**/api/travels/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MY_TRAVELS) }))
  await page.route('**/api/user/*/country-progress/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(COUNTRY_PROGRESS) }))

  await preacceptCookies(page)
  await gotoWithRetry(page, '/profile')

  const tab = page.locator('[aria-label="Карта мира"]').first()
  await tab.waitFor({ state: 'visible', timeout: 30000 })
  await tab.click()
  await expect(page.getByText('Карта мира', { exact: true }).first()).toBeVisible({ timeout: 15000 })
  await page.waitForFunction(() => document.querySelectorAll('svg path').length >= 150, undefined, { timeout: 20000 })
}

test('T2: зум кнопками и колесом меняет transform <g>, сброс возвращает', async ({ page }) => {
  await openMapTab(page)

  // Анимируемая <G> карты = вложенная g с одноаргументным scale(N).
  // (внешняя g — это viewBox-фит react-native-svg с двумя аргументами scale).
  const getTransform = () =>
    page.evaluate(() => {
      const gs = Array.from(document.querySelectorAll('svg g'))
      const mine = gs.find((el) => /scale\([0-9.]+\)\s*$/.test(el.getAttribute('transform') || ''))
      return mine ? mine.getAttribute('transform') : null
    })

  // Кнопка «Приблизить».
  await page.locator('[aria-label="Приблизить карту"]').first().click()
  await page.waitForTimeout(400)
  const zoomed = await getTransform()
  console.log('AFTER_ZOOM', zoomed)
  expect(zoomed).toBeTruthy()
  const scaleMatch = /scale\(([0-9.]+)\)/.exec(zoomed || '')
  expect(scaleMatch && Number(scaleMatch[1])).toBeGreaterThan(1.1)

  // Сброс.
  await page.locator('[aria-label="Сбросить масштаб карты"]').first().click()
  await page.waitForTimeout(400)
  const afterReset = await getTransform()
  console.log('AFTER_RESET', afterReset)
  const resetScale = /scale\(([0-9.]+)\)/.exec(afterReset || '')
  expect(resetScale ? Number(resetScale[1]) : 1).toBeLessThanOrEqual(1.01)
})

test('wheel над картой зумит и гасит дефолт (страница не скроллит)', async ({ page }) => {
  await openMapTab(page)

  const getScale = () =>
    page.evaluate(() => {
      const gs = Array.from(document.querySelectorAll('svg g'))
      const mine = gs.find((el) => /scale\([0-9.]+\)\s*$/.test(el.getAttribute('transform') || ''))
      const m = /scale\(([0-9.]+)\)/.exec(mine?.getAttribute('transform') || '')
      return m ? Number(m[1]) : 1
    })

  // Дождаться реальной раскладки именно карты (svg с path'ами стран).
  await page.waitForFunction(
    () => {
      const svg = document.getElementById('wc-BY')?.closest('svg') as SVGSVGElement | null
      return (svg?.getBoundingClientRect().width ?? 0) > 200
    },
    undefined,
    { timeout: 15000 }
  )

  const before = await getScale()

  // Реальный wheel над картой: должен быть перехвачен нативным listener
  // ({ passive: false }) → defaultPrevented === true (страница не скроллится),
  // и scale <g> должен вырасти (zoom in при deltaY < 0).
  const res = await page.evaluate(() => {
    const svg = document.getElementById('wc-BY')?.closest('svg') as SVGSVGElement | null
    if (!svg) return { err: 'no map svg' }
    const r = svg.getBoundingClientRect()
    const ev = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -120,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
    })
    svg.dispatchEvent(ev)
    return { rectW: r.width, defaultPrevented: ev.defaultPrevented }
  })
  console.log('WHEEL res', JSON.stringify(res))

  expect(res.defaultPrevented).toBe(true)
  await page.waitForTimeout(300)
  const after = await getScale()
  console.log('WHEEL scale', before, '->', after)
  expect(after).toBeGreaterThan(before)
})

test('T3: клик по стране с маршрутами показывает мини-карточку со ссылкой', async ({ page }) => {
  await openMapTab(page)

  // Клик по Беларуси (BY) — у неё есть мок-маршрут.
  const clicked = await page.evaluate(() => {
    const el = document.getElementById('wc-BY')
    if (!el) return false
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return true
  })
  expect(clicked).toBe(true)

  await expect(page.locator('[aria-label="Закрыть"]').first()).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Минск за выходные').first()).toBeVisible({ timeout: 5000 })

  // Тап по мини-карточке → переход на /travels/<slug>.
  await page.locator('[aria-label="Минск за выходные"]').first().click()
  await page.waitForFunction(() => location.pathname.includes('/travels/minsk-weekend'), undefined, { timeout: 8000 })
  expect(page.url()).toContain('/travels/minsk-weekend')
})

test('пинч двумя пальцами зумит карту (mobile web)', async ({ page }) => {
  await openMapTab(page)

  const getScale = () =>
    page.evaluate(() => {
      const gs = Array.from(document.querySelectorAll('svg g'))
      const mine = gs.find((el) => /scale\([0-9.]+\)\s*$/.test(el.getAttribute('transform') || ''))
      const m = /scale\(([0-9.]+)\)/.exec(mine?.getAttribute('transform') || '')
      return m ? Number(m[1]) : 1
    })

  await page.waitForFunction(
    () => {
      const svg = document.getElementById('wc-BY')?.closest('svg') as SVGSVGElement | null
      return (svg?.getBoundingClientRect().width ?? 0) > 200
    },
    undefined,
    { timeout: 15000 }
  )

  const before = await getScale()

  // Raw touch-последовательность повторяет mobile Safari path: два пальца на
  // контейнере карты, затем «разведение» → пинч-зум.
  const res = await page.evaluate(() => {
    const svg = document.getElementById('wc-BY')?.closest('svg') as SVGSVGElement | null
    const node = svg?.parentElement as HTMLElement | null
    if (!node) return { err: 'no container' }
    const r = node.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    type TouchPoint = { identifier: number; clientX: number; clientY: number }
    let previousTouchList: Array<Record<string, unknown>> = []
    const fire = (type: 'touchstart' | 'touchmove' | 'touchend', points: TouchPoint[]) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      const touchList = points.map((touch) => ({
        ...touch,
        target: node,
        force: 1,
        radiusX: 1,
        radiusY: 1,
        rotationAngle: 0,
        pageX: touch.clientX,
        pageY: touch.clientY,
        screenX: touch.clientX,
        screenY: touch.clientY,
      }))
      Object.defineProperties(event, {
        touches: { value: touchList },
        targetTouches: { value: touchList },
        changedTouches: { value: type === 'touchend' ? previousTouchList : touchList },
      })
      const dispatched = node.dispatchEvent(event)
      previousTouchList = touchList
      return { dispatched, defaultPrevented: event.defaultPrevented }
    }
    // Два пальца на расстоянии 80px.
    fire('touchstart', [
      { identifier: 1, clientX: cx - 40, clientY: cy },
      { identifier: 2, clientX: cx + 40, clientY: cy },
    ])
    // Разводим до 200px (factor ≈ 2.5) в два шага.
    fire('touchmove', [
      { identifier: 1, clientX: cx - 40, clientY: cy },
      { identifier: 2, clientX: cx + 90, clientY: cy },
    ])
    const lastMove = fire('touchmove', [
      { identifier: 1, clientX: cx - 40, clientY: cy },
      { identifier: 2, clientX: cx + 160, clientY: cy },
    ])
    fire('touchend', [])
    return { rectW: r.width, defaultPrevented: lastMove.defaultPrevented }
  })
  console.log('PINCH res', JSON.stringify(res))

  expect(res.defaultPrevented).toBe(true)
  await page.waitForTimeout(300)
  const after = await getScale()
  console.log('PINCH scale', before, '->', after)
  expect(after).toBeGreaterThan(before * 1.3)
})

test('T3: страна без маршрутов → пустой стейт', async ({ page }) => {
  await openMapTab(page)

  const clicked = await page.evaluate(() => {
    const el = document.getElementById('wc-FR')
    if (!el) return false
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return true
  })
  expect(clicked).toBe(true)
  await expect(page.getByText('Нет маршрутов в этой стране').first()).toBeVisible({ timeout: 5000 })
})

test('T3: маршруты из backend visits[] показываются карточками (баг «N маршрутов, но карточек нет»)', async ({ page }) => {
  await openMapTab(page)

  const clicked = await page.evaluate(() => {
    const el = document.getElementById('wc-RU')
    if (!el) return false
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return true
  })
  expect(clicked).toBe(true)

  // Счётчик и карточки должны совпадать: обе карточки из visits[] видны, хотя их
  // primary-код страны — не RU (buildTravelsByCountryCode их бы пропустил).
  await expect(page.getByText('Посещено · 2 маршрута').first()).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Калининград зимой').first()).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Египет. Хургада.').first()).toBeVisible({ timeout: 5000 })
})

test('T3: маршруты страны видны и в полноэкранной карте', async ({ page }) => {
  await openMapTab(page)

  await page.locator('[aria-label="Открыть карту во весь экран"]').first().click()
  await expect(page.getByLabel('Закрыть полноэкранную карту')).toBeVisible({ timeout: 5000 })

  await page.evaluate(() => {
    document
      .getElementById('wc-RU')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  // Раньше полноэкранная инфо-карточка рендерила только «Посещено · N», без списка.
  await expect(page.getByText('Калининград зимой').first()).toBeVisible({ timeout: 5000 })
})

test('fullscreen mobile map fills viewport and keeps flag overlay anchored', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openMapTab(page)

  await page.locator('[aria-label="Открыть карту во весь экран"]').first().click()
  await expect(page.getByLabel('Закрыть полноэкранную карту')).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(700)

  const metrics = await page.evaluate(() => {
    const paths = Array.from(document.querySelectorAll<SVGGraphicsElement>('path[id^="wc-"]'))
    const byPath = document.getElementById('wc-BY') as SVGGraphicsElement | null
    const byFlag = document.querySelector('[data-testid="world-map-flag-BY"]') as HTMLElement | null
    if (!paths.length || !byPath || !byFlag) {
      return {
        error: 'missing-map-or-flag',
        innerHeight: 0,
        mapHeight: 0,
        flagDx: Number.POSITIVE_INFINITY,
        flagDy: Number.POSITIVE_INFINITY,
      }
    }

    const rects = paths.map((path) => path.getBoundingClientRect())
    const top = Math.min(...rects.map((rect) => rect.top))
    const bottom = Math.max(...rects.map((rect) => rect.bottom))
    const byRect = byPath.getBoundingClientRect()
    const flagRect = byFlag.getBoundingClientRect()
    const flagCenterX = flagRect.left + flagRect.width / 2
    const flagCenterY = flagRect.top + flagRect.height / 2
    const pathCenterX = byRect.left + byRect.width / 2
    const pathCenterY = byRect.top + byRect.height / 2

    return {
      innerHeight: window.innerHeight,
      mapHeight: bottom - top,
      flagDx: Math.abs(flagCenterX - pathCenterX),
      flagDy: Math.abs(flagCenterY - pathCenterY),
    }
  })

  expect(metrics.error).toBeUndefined()
  expect(metrics.mapHeight).toBeGreaterThan(metrics.innerHeight * 0.65)
  expect(metrics.flagDx).toBeLessThan(90)
  expect(metrics.flagDy).toBeLessThan(90)
})

test('fullscreen mobile map pans with a one-finger touch drag', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openMapTab(page)

  await page.locator('[aria-label="Открыть карту во весь экран"]').first().click()
  await expect(page.getByLabel('Закрыть полноэкранную карту')).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(700)

  const before = await page.evaluate(() => {
    const maps = Array.from(document.querySelectorAll<SVGSVGElement>('svg')).filter(
      (svg) => svg.querySelectorAll('path[id^="wc-"]').length >= 150,
    )
    const svg = maps.sort(
      (left, right) => right.getBoundingClientRect().height - left.getBoundingClientRect().height,
    )[0]
    const node = svg?.parentElement
    if (!svg || !node) return { error: 'missing-fullscreen-map', transform: '' }

    const getTransform = () =>
      Array.from(svg.querySelectorAll('g'))
        .map((group) => group.getAttribute('transform') || '')
        .find((transform) => /scale\([0-9.]+\)\s*$/.test(transform)) || ''
    let previousTouchList: Array<Record<string, unknown>> = []
    const fireTouch = (
      type: 'touchstart' | 'touchmove' | 'touchend',
      touches: Array<{ identifier: number; clientX: number; clientY: number }>,
    ) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      const touchList = touches.map((touch) => ({
        ...touch,
        target: node,
        force: 1,
        radiusX: 1,
        radiusY: 1,
        rotationAngle: 0,
        pageX: touch.clientX,
        pageY: touch.clientY,
        screenX: touch.clientX,
        screenY: touch.clientY,
      }))
      const changedTouches = type === 'touchend' ? previousTouchList : touchList
      Object.defineProperties(event, {
        touches: { value: touchList },
        targetTouches: { value: touchList },
        changedTouches: { value: changedTouches },
      })
      node.dispatchEvent(event)
      previousTouchList = touchList
    }

    const rect = node.getBoundingClientRect()
    const startX = rect.left + rect.width * 0.7
    const y = rect.top + rect.height * 0.45
    const transform = getTransform()
    fireTouch('touchstart', [{ identifier: 1, clientX: startX, clientY: y }])
    fireTouch('touchmove', [{ identifier: 1, clientX: startX - 70, clientY: y }])
    fireTouch('touchmove', [{ identifier: 1, clientX: startX - 140, clientY: y }])
    fireTouch('touchend', [])
    return { transform }
  })

  expect(before.error).toBeUndefined()
  await page.waitForTimeout(300)
  const after = await page.evaluate(() => {
    const maps = Array.from(document.querySelectorAll<SVGSVGElement>('svg')).filter(
      (svg) => svg.querySelectorAll('path[id^="wc-"]').length >= 150,
    )
    const svg = maps.sort(
      (left, right) => right.getBoundingClientRect().height - left.getBoundingClientRect().height,
    )[0]
    return Array.from(svg?.querySelectorAll('g') ?? [])
      .map((group) => group.getAttribute('transform') || '')
      .find((transform) => /scale\([0-9.]+\)\s*$/.test(transform)) || ''
  })
  expect(after).not.toBe(before.transform)
})

test.describe('fullscreen map on a touch phone', () => {
  const iphone = devices['iPhone 13']
  test.use({
    viewport: iphone.viewport,
    userAgent: iphone.userAgent,
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: iphone.deviceScaleFactor,
  })

  test('trusted finger swipe pans the map instead of being cancelled by the browser', async ({ page, context }) => {
    await openMapTab(page)
    await page.locator('[aria-label="Открыть карту во весь экран"]').first().click()
    await expect(page.getByLabel('Закрыть полноэкранную карту')).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(700)

    const readMap = () =>
      page.evaluate(() => {
        const maps = Array.from(document.querySelectorAll<SVGSVGElement>('svg')).filter(
          (svg) => svg.querySelectorAll('path[id^="wc-"]').length >= 150,
        )
        const svg = maps.sort(
          (left, right) => right.getBoundingClientRect().height - left.getBoundingClientRect().height,
        )[0]
        const node = svg?.parentElement
        const rect = node?.getBoundingClientRect()
        const transform = Array.from(svg?.querySelectorAll('g') ?? [])
          .map((group) => group.getAttribute('transform') || '')
          .find((value) => /scale\([0-9.]+\)\s*$/.test(value)) || ''
        return rect
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, transform }
          : null
      })

    const before = await readMap()
    expect(before).toBeTruthy()
    const startX = before!.x + before!.width * 0.72
    const endX = before!.x + before!.width * 0.28
    const y = before!.y + before!.height * 0.45
    const cdp = await context.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y, id: 1 }],
    })
    for (let step = 1; step <= 8; step += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX + ((endX - startX) * step) / 8, y, id: 1 }],
      })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(300)

    const after = await readMap()
    expect(after?.transform).not.toBe(before!.transform)
  })
})
