import { expect, type CDPSession, type Page } from '@playwright/test'

/**
 * #2116: сердечко «Хочу поехать» в углу hero детали путешествия. Пока страница
 * держит усыновлённый SSG-hero (`useTravelSsgHeroHandoff`), слайдер поднят на
 * `TRAVEL_HERO_LAYERS.sliderDuringSsgHandoff`; сердечко обязано лежать выше —
 * иначе центр кнопки отдаёт `slider-slide-0` и клик уходит в галерею.
 */

export const HERO_FAVORITE_VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844, isMobile: true },
  { name: 'desktop-1440', width: 1440, height: 900, isMobile: false },
] as const

const HERO_CONTAINER = '[data-testid="travel-details-hero-slider-container"]'
const SLIDER_UNDER = '[data-travel-hero-slider-under="true"]'

export const heroFavoriteButton = (page: Page) =>
  page.locator(HERO_CONTAINER).getByRole('button', { name: /«?Хочу поехать»?/ })

/**
 * Generic `[param].html` локального стенда не несёт SSG-hero. Вставка той же
 * разметки, что пишет `scripts/ssg-skeletons.js`, переводит страницу в
 * SSG-handoff — состояние, в котором сердечко и перекрывалось.
 */
export async function injectSsgTravelHero(page: Page, pathname: string): Promise<void> {
  const image =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#706a57"/></svg>')
  const markup =
    `<div id="ssg-skeleton"><div class="ssg-travel-hero">` +
    `<picture><img class="ssg-travel-hero-img" alt="" src="${image}"></picture>` +
    `</div></div>`
  await page.route(
    (url) => url.pathname === pathname,
    async (route) => {
      if (route.request().resourceType() !== 'document') {
        await route.fallback()
        return
      }
      const response = await route.fetch()
      const html = await response.text()
      await route.fulfill({ response, body: html.replace(/<body([^>]*)>/, `<body$1>${markup}`) })
    },
  )
}

/** Слайдер в SSG-handoff поднят над оверлеем (z=6) — предусловие регрессии. */
export async function expectSsgHandoffActive(page: Page): Promise<void> {
  await expect(page.locator('[data-ssg-travel-hero-adopted="true"]')).toHaveCount(1, { timeout: 30_000 })
  await expect
    .poll(() => page.locator(SLIDER_UNDER).evaluate((el) => getComputedStyle(el).zIndex), {
      timeout: 15_000,
    })
    .toBe('6')
}

/** `elementFromPoint` в центре сердечка — сама кнопка или её потомок, зона ≥ 44×44. */
export async function expectHeroFavoriteOnTop(page: Page): Promise<void> {
  const button = heroFavoriteButton(page)
  await expect(button).toBeVisible({ timeout: 30_000 })
  const probe = await button.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      onTop: !!hit && el.contains(hit),
      hit: hit ? `${hit.tagName.toLowerCase()}#${hit.getAttribute('data-testid') ?? ''}` : null,
    }
  })
  expect(probe.onTop, `hero favorite center is covered by ${probe.hit}`).toBe(true)
  expect(probe.width).toBeGreaterThanOrEqual(44)
  expect(probe.height).toBeGreaterThanOrEqual(44)
}

async function touchSwipe(
  page: Page,
  cdp: CDPSession,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 12,
) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps, id: 1 },
      ],
    })
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))))
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/** Свайп влево по hero (CDP-touch) меняет счётчик «1/N» на «2/N». */
export async function expectHeroSwipeAdvances(page: Page): Promise<void> {
  const counter = page.locator(HERO_CONTAINER).getByText(/^1\/\d+$/).first()
  await expect(counter).toBeVisible({ timeout: 30_000 })
  const total = ((await counter.textContent()) ?? '').split('/')[1]
  const slider = page.locator(`${HERO_CONTAINER} [data-testid="slider-scroll"]`).first()
  const box = await slider.boundingBox()
  expect(box).toBeTruthy()
  const midY = box!.y + box!.height / 2
  const cdp = await page.context().newCDPSession(page)
  const second = page.locator(HERO_CONTAINER).getByText(`2/${total}`, { exact: true }).first()
  // Слушатели жестов навешиваются после гидратации: повтор только пока счётчик на 1/N.
  await expect(async () => {
    if ((await second.count()) === 0) {
      await touchSwipe(page, cdp, { x: box!.x + box!.width - 30, y: midY }, { x: box!.x + 30, y: midY })
    }
    await expect(second).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
}
