import { test, expect } from './fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

// [FE-635-T2/T3] Карта мира v2: зум/пан + клик по стране → маршруты страны.
const COUNTRY_PROGRESS = {
  total_count: 234, visited_count: 3, remaining_count: 231,
  countries: [
    { country_id: 1, country_code: 'BY', region: 'europe', title_ru: 'Беларусь', visited: true, visited_travels_count: 5, first_visited_date: '2018-05-01' },
    { country_id: 2, country_code: 'FR', region: 'europe', title_ru: 'Франция', visited: true, visited_travels_count: 2, first_visited_date: '2019-07-10' },
    { country_id: 3, country_code: 'JP', region: 'asia', title_ru: 'Япония', visited: true, visited_travels_count: 1, first_visited_date: '2020-01-03' },
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

  // Симуляция двух пальцев: два pointerdown с разными pointerId на контейнере
  // карты (div c нашими onPointerDown/Move), затем «разведение» → пинч-зум.
  const res = await page.evaluate(() => {
    const svg = document.getElementById('wc-BY')?.closest('svg') as SVGSVGElement | null
    const node = svg?.parentElement as HTMLElement | null
    if (!node) return { err: 'no container' }
    const r = node.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const fire = (type: string, id: number, x: number, y: number) =>
      node.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: id,
          pointerType: 'touch',
          clientX: x,
          clientY: y,
        })
      )
    // Два пальца на расстоянии 80px.
    fire('pointerdown', 1, cx - 40, cy)
    fire('pointerdown', 2, cx + 40, cy)
    // Разводим до 200px (factor ≈ 2.5) в два шага.
    fire('pointermove', 2, cx + 90, cy)
    fire('pointermove', 2, cx + 160, cy)
    fire('pointerup', 1, cx - 40, cy)
    fire('pointerup', 2, cx + 160, cy)
    return { rectW: r.width }
  })
  console.log('PINCH res', JSON.stringify(res))

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
