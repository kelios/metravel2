import type { Page, Route } from '@playwright/test'

import type { ApiQuestMeta } from '../api/quests'
import { expect, test } from './fixtures'
import { preacceptCookies } from './helpers/navigation'
import { LOCALE_PREFERENCE_STORAGE_KEY } from '../i18n/localeStorage'

/**
 * #2170: кадр до гидратации. Его рисует браузер из статического HTML, и на
 * медленной сети он держится десятки секунд (замер прода 04.10.2026,
 * 250 кбит/с: 23 с до исполнения скриптов). В этом кадре обязаны быть логотип
 * и настоящие иконки, а каталог — показывать каркас на месте контента.
 *
 * Кадр без JS снимается детерминированно: чанки приложения блокируются, сеть
 * не эмулируется, поэтому проверка не зависит от нагрузки хоста.
 */

const PHONE = { width: 390, height: 844 } as const
const APP_SCRIPTS = '**/_expo/static/js/**'
// После `waitUntil: 'commit'` документа ещё может не быть — предикаты обязаны это переживать.
const ICON_FONT_READY = () =>
  Boolean(document.documentElement?.classList.contains('icon-font-ready'))
const APP_HYDRATED = () =>
  Boolean(document.documentElement?.classList.contains('app-hydrated'))

/** Квест каталога: достаточно, чтобы каркас сменился контентом. */
const QUEST = {
  id: 990_170,
  quest_id: 'e2e-first-frame-quest',
  title: 'E2E: кадр до гидратации',
  points: 5,
  city_id: '990170',
  city_name: 'Минск',
  country_id: '3',
  country_name: 'Беларусь',
  country_code: 'BY',
  lat: 53.9,
  lng: 27.56,
  duration_min: 60,
  difficulty: 'easy',
  tags: { urban: true },
  pet_friendly: true,
  cover_url: null,
  rating_avg: null,
  rating_count: 0,
  user_rating: null,
  // Двух квестов с двумя прохождениями хватает, чтобы каталог предложил сортировку
  // «Популярные» — как на проде; именно её чип резервирует каркас шапки.
  completions_count: 3,
  is_completed_by_me: false,
  first_completer: null,
} satisfies ApiQuestMeta

const CATALOG: ApiQuestMeta[] = [
  QUEST,
  {
    ...QUEST,
    id: 990_171,
    quest_id: 'e2e-first-frame-quest-2',
    title: 'E2E: второй квест каталога',
    completions_count: 2,
  },
]

const fulfillJson = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })

type StaticFrame = {
  hydrated: boolean
  logoLoaded: boolean
  controls: { label: string | null; drawn: boolean }[]
  icons: {
    visible: boolean
    fontSize: number
    glyph: boolean
    width: number
    minWidth: number
  }[]
  fontLoaded: boolean
  skeletonCells: { width: number; height: number; animated: boolean }[]
  countRow: boolean
}

const readStaticFrame = (page: Page): Promise<StaticFrame> =>
  page.evaluate(() => {
    const logo = document.querySelector<HTMLImageElement>(
      '[data-header-logo-image] img',
    )
    const icons = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="main-header"] [data-icon-font], [data-testid="quests-content-header"] [data-icon-font]',
      ),
    )
      // Иконку, скрытую вместе с родителем (шеврон переключателя языка на телефоне),
      // не считаем: проверяется именно показ глифа после загрузки шрифта.
      .filter(
        (node) =>
          node.parentElement &&
          getComputedStyle(node.parentElement).visibility === 'visible',
      )
      .filter((node) => node.getBoundingClientRect().width > 0)
      .map((node) => {
        const style = getComputedStyle(node)
        return {
          visible: style.visibility === 'visible',
          fontSize: parseFloat(style.fontSize),
          glyph:
            (node.textContent || '').length > 0 &&
            /feather/i.test(style.fontFamily),
          width: node.getBoundingClientRect().width,
          minWidth: parseFloat(node.style.minWidth),
        }
      })
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        // Кнопки шапки (#2314): «карта» и «город» — в ряду поиска, фильтры —
        // в горизонтальной ленте чипов.
        '[data-testid="quests-mobile-controls"] button, [data-testid="quests-mobile-chips"] button',
      ),
    ).map((button) => {
      const glyph = button.querySelector<HTMLElement>('[data-icon-font]')
      return {
        label: button.getAttribute('aria-label'),
        drawn:
          Boolean(button.querySelector('svg')) ||
          Boolean(glyph && glyph.textContent),
      }
    })
    const skeletonCells = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="quests-grid-skeleton"] > div',
      ),
    ).map((cell) => {
      const plate = cell.firstElementChild as HTMLElement | null
      const style = plate ? getComputedStyle(plate) : null
      const rect = cell.getBoundingClientRect()
      return {
        width: rect.width,
        height: rect.height,
        animated: Boolean(
          style &&
          style.animationName !== 'none' &&
          style.animationPlayState === 'running',
        ),
      }
    })
    return {
      hydrated: document.documentElement.classList.contains('app-hydrated'),
      logoLoaded: Boolean(logo && logo.complete && logo.naturalWidth > 0),
      controls,
      icons,
      fontLoaded: document.fonts.check('17px feather'),
      skeletonCells,
      countRow: Boolean(
        document.querySelector('[data-testid="quests-count-row"]'),
      ),
    }
  })

test.describe('кадр до гидратации (#2170)', () => {
  test('каталог квестов без JS: логотип, иконки и каркас карточек на месте', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    await preacceptCookies(page)
    await page.route(APP_SCRIPTS, (route) => route.abort())

    await page.goto('/quests', { waitUntil: 'load' })
    await page.waitForFunction(ICON_FONT_READY, null, { timeout: 30_000 })
    // Разметку приложения открывает класс `rnw-styles-ready` (два кадра после
    // таблицы стилей): локально шрифт успевает раньше, и корень ещё скрыт.
    await page.waitForFunction(
      () => document.documentElement.classList.contains('rnw-styles-ready'),
      null,
      { timeout: 30_000 },
    )

    const frame = await readStaticFrame(page)

    // Скрипты приложения не исполнялись: всё ниже нарисовано из статического HTML.
    expect(frame.hydrated).toBe(false)
    expect(
      frame.logoLoaded,
      'логотип бренд-строки загружен до гидратации',
    ).toBe(true)

    // Пять кнопок шапки каталога (две в ряду поиска, три чипа фильтров): ни
    // одной пустой клетки.
    expect(frame.controls.length).toBeGreaterThanOrEqual(5)
    expect(frame.controls.filter((control) => !control.drawn)).toEqual([])

    // Иконки — настоящие глифы своей гарнитуры, а не код запасного шрифта.
    expect(frame.fontLoaded).toBe(true)
    expect(frame.icons.length).toBeGreaterThanOrEqual(6)
    for (const icon of frame.icons) {
      expect(icon).toMatchObject({ visible: true, glyph: true })
      expect(icon.fontSize).toBeGreaterThan(0)
      // Глиф Feather занимает ровно свою клетку: резерв места совпал с итогом.
      expect(Math.abs(icon.width - icon.minWidth)).toBeLessThanOrEqual(0.5)
    }

    // Каркас: клетки в пропорции карточки каталога (380:260), плашка пульсирует.
    expect(frame.skeletonCells).toHaveLength(6)
    for (const cell of frame.skeletonCells) {
      expect(cell.animated).toBe(true)
      expect(
        Math.abs(cell.height - (cell.width * 260) / 380),
      ).toBeLessThanOrEqual(1)
    }
    // Чипы сортировки на телефоне дописываются в конец горизонтальной ленты и
    // по вертикали ничего не сдвигают — резервировать под них место не нужно.
    expect(frame.countRow, 'строка счётчика зарезервирована').toBe(true)
  })

  test('медленная сеть: логотип и шрифт иконок готовы раньше гидратации', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'эмуляция сети идёт через CDP')
    await page.setViewportSize(PHONE)
    await preacceptCookies(page)

    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 600,
      downloadThroughput: (250 * 1000) / 8,
      uploadThroughput: (250 * 1000) / 8,
    })

    await page.goto('/quests', { waitUntil: 'commit' })
    await page.waitForFunction(ICON_FONT_READY, null, { timeout: 60_000 })
    await page.waitForFunction(
      () => {
        const logo = document.querySelector<HTMLImageElement>(
          '[data-header-logo-image] img',
        )
        return Boolean(logo && logo.complete && logo.naturalWidth > 0)
      },
      null,
      { timeout: 60_000 },
    )

    // Скрипты приложения (сотни килобайт) на этом канале ещё в пути: иконки и
    // логотип не ждут ни их, ни гидратации. Запись о ресурсе появляется только
    // по окончании загрузки, поэтому её отсутствие и есть «бандл ещё не пришёл».
    expect(await page.evaluate(APP_HYDRATED)).toBe(false)
    const entryBundleLoaded = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .some((entry) => /\/_expo\/static\/js\/web\/entry-/.test(entry.name)),
    )
    expect(entryBundleLoaded, 'entry-бандл приложения ещё загружается').toBe(
      false,
    )
  })

  // Широкий экран здесь не для галочки: серверная разметка всегда узкая, и каркас,
  // зависящий от ширины из JS, перекладывался на desktop при гидратации (CLS 0,034
  // на 1280, 0,057 на 1440 — замер прода 05.10.2026).
  for (const viewport of [
    PHONE,
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    test(`каталог квестов ${viewport.width}: гидратация и ответ API не двигают каркас и тело каталога`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await preacceptCookies(page)
      await page.addInitScript(() => {
        ;(window as any).__firstFrameCls = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput)
              (window as any).__firstFrameCls += entry.value
          }
        }).observe({ type: 'layout-shift', buffered: true })
      })

      // Ответ каталога задержан: каркас успевает отрисоваться, и смена каркаса
      // контентом происходит уже на живом экране.
      let releaseCatalog: () => void = () => {}
      const catalogGate = new Promise<void>((resolve) => {
        releaseCatalog = resolve
      })
      await page.route(
        (url) => url.pathname === '/api/quests/',
        async (route) => {
          await catalogGate
          await fulfillJson(route, CATALOG)
        },
      )

      await page.goto('/quests', { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('quests-grid-skeleton')).toBeVisible({
        timeout: 30_000,
      })
      await page.waitForFunction(APP_HYDRATED, null, { timeout: 60_000 })

      const body = page.getByTestId('quests-content-body')
      const topBefore = (await body.boundingBox())?.y

      releaseCatalog()
      await expect(page.getByTestId('quests-grid')).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByTestId('quests-sort-popular')).toBeVisible()
      await expect(page.getByTestId('quests-grid-skeleton')).toHaveCount(0)

      const topAfter = (await body.boundingBox())?.y
      expect(topAfter, 'тело каталога не сдвигается при ответе API').toBe(
        topBefore,
      )
      expect(
        await page.evaluate(() => (window as any).__firstFrameCls),
      ).toBeLessThanOrEqual(0.01)
    })
  }
})

/**
 * #2257: на главной (`travel-route`) оболочка приложения видна с первого кадра,
 * а класс `rnw-styles-ready` встаёт только через два кадра. Состояние «между»
 * снимается детерминированно: чанки приложения заблокированы, а сам класс
 * запрещён init-скриптом. SSG-двойник «Городских квестов» вставляется в
 * документ настоящим генератором, даже если локальная сборка шла без каталога.
 */
const HOME_SSG_QUESTS = [
  { quest_id: 'e2e-home-ssg-1', city_id: '990170', title: 'E2E: квест главной', city_name: 'Минск' },
  { quest_id: 'e2e-home-ssg-2', city_id: '990171', title: 'E2E: второй квест главной', city_name: 'Гродно' },
]

test.describe('главная до гидратации (#2257)', () => {
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    PHONE,
  ]) {
    test(`${viewport.width}: SSG-блок квестов не сжимает оболочку в первом кадре`, async ({
      page,
    }) => {
      const { injectHomeQuestsSection } = require('../scripts/generate-seo-pages.js') as {
        injectHomeQuestsSection: (html: string, quests: unknown[]) => string
      }
      await page.setViewportSize(viewport)
      await preacceptCookies(page)
      await page.route(APP_SCRIPTS, (route) => route.abort())
      await page.route(
        (url) => url.pathname === '/',
        async (route) => {
          const response = await route.fetch()
          const body = await response.text()
          await route.fulfill({
            response,
            body: body.includes('data-ssg-home-quests')
              ? body
              : injectHomeQuestsSection(body, HOME_SSG_QUESTS),
          })
        },
      )
      await page.addInitScript(() => {
        const add = DOMTokenList.prototype.add
        DOMTokenList.prototype.add = function (...tokens: string[]) {
          return add.apply(this, tokens.filter((token) => token !== 'rnw-styles-ready'))
        }
      })

      await page.goto('/', { waitUntil: 'load' })

      const frame = await page.evaluate(() => {
        const main = document.getElementById('main-content')
        const block = document.querySelector('[data-ssg-home-quests]')
        const rect = main?.getBoundingClientRect()
        return {
          travelRoute: document.documentElement.classList.contains('travel-route'),
          stylesReady: document.documentElement.classList.contains('rnw-styles-ready'),
          mainX: rect?.x ?? -1,
          mainWidth: rect?.width ?? 0,
          rootWidth: document.getElementById('root')?.getBoundingClientRect().width ?? 0,
          blockDisplay: block ? getComputedStyle(block).display : null,
          blockInRoot: Boolean(block?.closest('#root')),
          blockLinks: block ? block.querySelectorAll('a[href^="/quests/"]').length : 0,
        }
      })

      expect(frame.travelRoute).toBe(true)
      expect(frame.stylesReady, 'состояние до rnw-styles-ready').toBe(false)
      // Ссылки для краулера на месте, но блок не в ряду #root и не нарисован.
      expect(frame.blockLinks).toBeGreaterThanOrEqual(2)
      expect(frame.blockInRoot).toBe(false)
      expect(frame.blockDisplay).toBe('none')
      // Оболочка с первого кадра во всю ширину (было 840,0 425×800 на 1280).
      expect(frame.mainX).toBe(0)
      expect(frame.rootWidth).toBeGreaterThan(0)
      expect(Math.abs(frame.mainWidth - frame.rootWidth)).toBeLessThanOrEqual(1)
    })
  }
})

/**
 * #2258 (механизм #2112): раскладка «от ширины» на статической странице /app.
 * Первый кадр снимается без скриптов приложения, итог — после гидратации; узлы,
 * зависящие от ширины (кегль `Heading`, карточки возможностей), обязаны стоять
 * там же. Было на 1280: `h1` 31 → 38 px, всё ниже съезжало на 7 px (CLS 0,095).
 */
test.describe('/app до и после гидратации (#2258)', () => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    PHONE,
  ]) {
    test(`${viewport.width}: заголовки и карточки не перекладываются гидратацией`, async ({
      browser,
    }) => {
      const measure = (page: Page) =>
        page.evaluate(() =>
          // h4 — заголовки карточек возможностей и шагов: их ширина — ширина карточки.
          [...document.querySelectorAll('#main-content h1, #main-content h2, #main-content h4')].map(
              (node) => {
              const rect = node.getBoundingClientRect()
              const main = document.getElementById('main-content')!.getBoundingClientRect()
              return [node.tagName, Math.round(rect.x - main.x), Math.round(rect.width), Math.round(rect.height)].join(':')
            },
          ),
        )

      const staticContext = await browser.newContext({ viewport })
      const staticPage = await staticContext.newPage()
      await preacceptCookies(staticPage)
      await staticPage.route(APP_SCRIPTS, (route) => route.abort())
      await staticPage.goto('/app', { waitUntil: 'load' })
      await staticPage.waitForFunction(
        () => document.documentElement.classList.contains('rnw-styles-ready'),
        null,
        { timeout: 30_000 },
      )
      const firstFrame = await measure(staticPage)
      await staticContext.close()

      const liveContext = await browser.newContext({ viewport })
      const livePage = await liveContext.newPage()
      await preacceptCookies(livePage)
      await livePage.goto('/app', { waitUntil: 'load' })
      await livePage.waitForFunction(APP_HYDRATED, null, { timeout: 60_000 })
      const hydrated = await measure(livePage)
      await liveContext.close()

      expect(firstFrame.length).toBeGreaterThanOrEqual(7)
      expect(hydrated).toEqual(firstFrame)
    })
  }
})

/**
 * #2320: сохранённый срез каталога (`quests_selected_city_v2`) React применяет
 * после гидратации, а статический HTML один для всех и несёт SEO-вводку над
 * сеткой. Скрипт головы ставит класс до первого кадра, и CSS прячет вводку —
 * снятие её React-ом ничего не двигает (было: сетка 645 → 234 на 390, CLS 0,32).
 */
test.describe('каталог квестов с сохранённым срезом (#2320)', () => {
  for (const viewport of [PHONE, { width: 1280, height: 800 }]) {
    test(`${viewport.width}: восстановленный срез не сдвигает сетку`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await preacceptCookies(page)
      await page.addInitScript((cityId) => {
        window.localStorage.setItem('quests_selected_city_v2', cityId)
        ;(window as any).__firstFrameCls = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) (window as any).__firstFrameCls += entry.value
          }
        }).observe({ type: 'layout-shift', buffered: true })
      }, QUEST.city_id)

      let releaseCatalog: () => void = () => {}
      const catalogGate = new Promise<void>((resolve) => {
        releaseCatalog = resolve
      })
      await page.route(
        (url) => url.pathname === '/api/quests/',
        async (route) => {
          await catalogGate
          await fulfillJson(route, CATALOG)
        },
      )

      await page.goto('/quests', { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('quests-grid-skeleton')).toBeVisible({ timeout: 30_000 })
      await page.waitForFunction(APP_HYDRATED, null, { timeout: 60_000 })

      releaseCatalog()
      await expect(page.getByTestId('quests-grid')).toBeVisible({ timeout: 30_000 })
      // Срез восстановлен и отрисован: класс первого кадра снят, вводки нет.
      await page.waitForFunction(
        () => !document.documentElement.classList.contains('quests-slice-restored'),
        null,
        { timeout: 30_000 },
      )
      await expect(page.locator('[data-quests-seo-slot]')).toHaveCount(0)
      expect(await page.evaluate(() => (window as any).__firstFrameCls)).toBeLessThanOrEqual(0.01)
    })
  }
})

// #2216: inspect real static hrefs while application chunks never execute.
test.describe('eager mobile navigation without application JS', () => {
  for (const route of ['/quests', '/']) {
    test(`${route}:5 real no-JS dock destinations and working More fallback on mobile390`, async ({ page }) => {
      await page.setViewportSize(PHONE)
      await preacceptCookies(page)
      await page.addInitScript(key => window.localStorage.setItem(key, JSON.stringify({ version: 1, mode: 'explicit', locale: 'ru' })), LOCALE_PREFERENCE_STORAGE_KEY)
      await page.route(APP_SCRIPTS, route => route.abort('blockedbyclient'))
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      const dock = page.getByTestId('footer-dock-row')
      await expect(dock).toBeVisible()
      const anchors = dock.locator('a')
      await expect(anchors).toHaveCount(5)
      expect(await anchors.evaluateAll(nodes => nodes.map(a => a.getAttribute('href')))).toEqual(['/search', '/map', '/quests', '/profile', '/more'])
      await expect(page.getByTestId('header-more-fallback')).toBeVisible()
      expect(await anchors.evaluateAll(nodes => nodes.every(node => {
        const rect = node.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        return rect.width > 0 && rect.height >= 44 && !!hit && node.contains(hit) && getComputedStyle(node).pointerEvents !== 'none'
      }))).toBe(true)
      expect(await page.evaluate(APP_HYDRATED)).toBe(false)
      await page.getByTestId(route === '/' ? 'header-more-fallback' : 'footer-item-more').click()
      await expect(page).toHaveURL(/\/more(?:[?#]|$)/)
      await expect(page.getByTestId('more-navigation-page')).toBeVisible()
      const links = page.getByTestId('more-navigation-page').locator('a')
      await expect(links).toHaveCount(8)
      await expect(links.first()).toBeVisible()
      expect(await page.evaluate(APP_HYDRATED)).toBe(false)
      expect(await links.evaluateAll(nodes => nodes.every(a => a.getAttribute('href')?.startsWith('/') && a.getAttribute('href') !== '/more'))).toBe(true)
    })
  }
})
