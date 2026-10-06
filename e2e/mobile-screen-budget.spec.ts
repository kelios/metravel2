import type { Locator, Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { webAuthTokenFromCookies } from './helpers/auth'
import {
  MOBILE_SCREEN_BUDGET,
  MOBILE_VIEWPORTS,
  SCREENS,
  type ScreenDef,
  measureEmptyCtaDockGap,
  measureScreenAllCombos,
  printResultsTable,
  resolveScreenTarget,
  sampleDarkBottomColor,
  seedTheme,
  assertWithinBudget,
} from './helpers/mobileScreenBudget'
import { preacceptCookies } from './helpers/navigation'

/**
 * #2094: замер мобильного бюджета экрана — все 13 экранов без мутации
 * бэкенда и экран прохождения квеста в трёх состояниях (#2147, гостем;
 * `/trips/plan/:id` со своей тестовой поездкой живёт отдельно в
 * `mobile-screen-budget-trip-plan.live.spec.ts`, тот же набор метрик и общий
 * JSON). Дефолтный suite — этот файл НЕ входит ни в `LIVE_CONTRACT_SPECS`,
 * ни в `PRODUCTION_SMOKE_SPECS` (`scripts/e2e-suite-classification.js`), это
 * и есть контракт «дефолтный прогон не мутирует бэкенд, но видит все
 * экраны». Публичная подмножина повторяется в
 * `mobile-screen-budget-production-smoke.spec.ts` против прода.
 *
 * Один тест = один экран = одна навигация, все 4 комбинации (390×844 и
 * 402×874 × light/dark) снимаются поверх неё (`measureScreenAllCombos`) —
 * было 52 теста по ~9 с (7,9 мин на одном воркере), стало 13.
 *
 * Авторизованные экраны используют storageState `global-setup.ts` — нужен
 * `E2E_AUTH_MODE=required` (иначе экраны откроются гостем и упадут на
 * собственных редиректах, а не дадут тихий ложный успех).
 */

/**
 * Авторизованному экрану нужна живая веб-сессия на ЭТОМ origin. В полном прогоне
 * release:check сессия из storageState global-setup терялась по ходу (токен e2e-
 * аккаунта удаляется любым logout), и экран открывался гостем — метрики молча
 * снимались с заглушки входа. Поэтому сначала проверяем сессию, и только если
 * она мертва — входим тем же путём, что global-setup: `context.request` на origin
 * прогона (e2e-прокси ставит HttpOnly-cookie на этот хост) + витрина `userId`.
 * Вход ограничен бэкендом (`auth_login` 5/min) — отсюда проверка и повтор на 429.
 */
async function ensureLiveSession(page: Page, baseURL: string | undefined): Promise<void> {
  const base = String(baseURL || '').replace(/\/+$/, '')
  const request = page.context().request
  // Сессия из storageState: токен — заголовком, банк cookie на 127.0.0.1
  // Playwright из Node не отправит, и проба отвечала бы 401 (#2173).
  const token = webAuthTokenFromCookies(await page.context().cookies(), base)
  const probe = token
    ? await request.get(`${base}/api/user/me/verifications/`, { headers: { Authorization: `Token ${token}` } })
    : null
  if (probe?.ok()) return

  const email = String(process.env.E2E_EMAIL || '').trim()
  const password = String(process.env.E2E_PASSWORD || '').trim()
  if (!email || !password || !base) {
    throw new Error('Авторизованный экран без e2e-учётки: нужны E2E_AUTH_MODE=required и E2E_EMAIL/E2E_PASSWORD')
  }
  let response = await request.post(`${base}/api/user/login/`, { data: { email, password } })
  for (let attempt = 1; response.status() === 429 && attempt <= 2; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 30_000 * attempt))
    response = await request.post(`${base}/api/user/login/`, { data: { email, password } })
  }
  expect(response.ok(), `вход e2e-аккаунта: ${response.status()}`).toBeTruthy()
  const json = (await response.json().catch(() => null)) as { id?: number | string } | null
  const userId = json?.id != null ? String(json.id) : ''
  expect(userId, 'вход не вернул id пользователя').toBeTruthy()
  await page.addInitScript((value: string) => {
    try {
      window.localStorage.setItem('userId', value)
    } catch {
      // ignore
    }
  }, userId)
}

async function measureScreen(page: Page, screen: ScreenDef): Promise<void> {
  const target = await resolveScreenTarget(page, screen)
  await measureScreenAllCombos(page, {
    screenKey: screen.key,
    path: target.path,
    title: target.title,
    viewports: MOBILE_VIEWPORTS,
    ctaTestId: screen.ctaTestId,
    budget: MOBILE_SCREEN_BUDGET[screen.key],
    prepare: screen.prepare,
  })
}

test.describe('Mobile screen budget (#2094)', () => {
  test('dark bottom rejects a white underlay behind the unchanged dock @ 390x844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await preacceptCookies(page)
    await seedTheme(page, 'dark')
    await page.goto('/')
    const dock = page.getByTestId('footer-dock-wrapper')
    await expect(dock).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    const natural = await sampleDarkBottomColor(page)
    expect(natural.matchesThemeBackground, JSON.stringify(natural)).toBe(true)
    const frostBackground = await dock.evaluate((el) => getComputedStyle(el).backgroundColor)
    const previous = await dock.evaluate((el) => {
      if (!el.parentElement) throw new Error('Dock underlay owner missing')
      const old = el.parentElement.style.backgroundColor
      el.parentElement.style.backgroundColor = '#fff'
      return old
    })
    try {
      const injected = await sampleDarkBottomColor(page)
      expect(await dock.evaluate((el) => getComputedStyle(el).backgroundColor), 'frost panel CSS stays unchanged').toBe(frostBackground)
      console.log('[mobile-screen-budget] injected white underlay', JSON.stringify(injected))
      expect(injected.matchesThemeBackground, 'the same pixel gate must reject an actual white underlay').toBe(false)
      expect(injected.failures.length).toBeGreaterThan(0)
      // Isolate the injected color metric through the production budget assertion.
      const budget = MOBILE_SCREEN_BUDGET.home
      expect(assertWithinBudget({
        screen: 'home', path: '/', viewport: '390x844', theme: 'dark',
        firstContentTopRatio: null, pinnedChromeRatio: null,
        titleOccurrences: 0, searchboxCount: budget.searchboxCountExpected,
        ctaOccluded: null, darkBottomMatchesTheme: injected.matchesThemeBackground,
        unlabeledInteractive: 0, emptyCtaDockGap: null, brandRowVisible: budget.brandRowExpected,
      }, budget)).toEqual(['home @ 390x844/dark: darkBottomMatchesTheme было true, стало false'])
    } finally {
      await dock.evaluate((el, old) => {
        if (el.parentElement) el.parentElement.style.backgroundColor = old
      }, previous)
    }
    expect((await sampleDarkBottomColor(page)).matchesThemeBackground, 'control restored').toBe(true)
  })
  for (const screen of SCREENS.filter((s) => !s.guest)) {
    test(screen.key, async ({ page, baseURL }) => {
      if (screen.requiresAuth) await ensureLiveSession(page, baseURL)
      await measureScreen(page, screen)
    })
  }

  // #2147: экран прохождения квеста — гостем даже в авторизованном прогоне
  // (`E2E_AUTH_MODE=required`): вошедшему тот же адрес отдаёт экран согласия.
  test.describe('guest', () => {
    test.use({ storageState: { cookies: [], origins: [] } })
    for (const screen of SCREENS.filter((s) => s.guest)) {
      test(screen.key, async ({ page }) => {
        // Состояние доводится действием и повторяется после перезагрузки при
        // смене темы (на вложенном экране нет живого переключателя) — две
        // полные загрузки квеста не укладываются в стандартные 120 с.
        test.setTimeout(240_000)
        await measureScreen(page, screen)
      })
    }
  })

  // #2104: пустая вкладка профиля — компактная заглушка `ui/EmptyState`, кнопка
  // «Создать маршрут» целиком выше дока без прокрутки. Вкладка «Опубл.»: у
  // e2e-аккаунта опубликованных маршрутов нет (черновики есть — «Маршруты» не пуста).
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`profile empty tab CTA above dock @ ${viewport.name}`, async ({ page, baseURL }) => {
      await ensureLiveSession(page, baseURL)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/profile')
      const publishedTab = page.getByRole('tab', { name: /Опубл/ }).first()
      await expect(publishedTab, 'профиль открыт гостем — нет веб-сессии на этом origin').toBeVisible({ timeout: 60_000 })
      await publishedTab.click()
      const cta = page.locator('[data-testid="empty-state-action"]').first()
      await expect(cta).toBeVisible()
      const gap = await measureEmptyCtaDockGap(page)
      console.log(`[mobile-screen-budget] profile-published-empty @ ${viewport.name}: emptyCtaDockGap=${gap}`)
      expect(gap, 'низ кнопки заглушки над доком без прокрутки').not.toBeNull()
      expect(gap as number).toBeGreaterThanOrEqual(0)
    })
  }

  // #2141: узкий экран 320×640. До правки вкладки профиля шли desktop-веткой
  // (по одной в строку, tablist 464 px), быстрые действия — отдельным рядом, и
  // заголовок заглушки стоял на 909 px (прод 04.10.2026, зазор кнопки −497).
  test('profile empty tab fits the first screen @ 320x640', async ({ page, baseURL }) => {
    await ensureLiveSession(page, baseURL)
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto('/profile')
    const publishedTab = page.getByRole('tab', { name: /Опубл/ }).first()
    await expect(publishedTab, 'профиль открыт гостем — нет веб-сессии на этом origin').toBeVisible({ timeout: 60_000 })
    await publishedTab.click()
    const cta = page.locator('[data-testid="empty-state-action"]').first()
    await expect(cta).toBeVisible()
    const tablistHeight = await page.locator('[role="tablist"]').first().evaluate((el) => el.getBoundingClientRect().height)
    const gap = await measureEmptyCtaDockGap(page)
    console.log(`[mobile-screen-budget] profile-published-empty @ 320x640: tablistHeight=${Math.round(tablistHeight)} emptyCtaDockGap=${gap}`)
    expect(tablistHeight, 'вкладки профиля одной строкой, а не столбиком').toBeLessThan(100)
    expect(gap, 'низ кнопки заглушки над доком без прокрутки').not.toBeNull()
    expect(gap as number).toBeGreaterThanOrEqual(0)
  })

  // #2114: /trips/my без сдвигов при подгрузке данных — блок «Обновления по
  // поездкам» монтируется под устоявшимся списком, счётчики сегментов держат слот.
  // Прод до правки: 390 — 0,027; 800 — 0,035–0,045; 1024 — 0,045 (источник
  // `my-trips-updates`). CLS считается с начала навигации, авторизация — живая сессия.
  for (const viewport of [
    { name: '390x844', width: 390, height: 844 },
    { name: '800x1024', width: 800, height: 1024 },
    { name: '1024x768', width: 1024, height: 768 },
  ]) {
    test(`trips-my CLS while data loads @ ${viewport.name}`, async ({ page, baseURL }) => {
      await ensureLiveSession(page, baseURL)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.addInitScript(() => {
        type Shift = { hadRecentInput: boolean; value: number; sources?: Array<{ node?: Element; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }> }
        const w = window as unknown as { __mtCls: number; __mtShifts: string[] }
        w.__mtCls = 0
        w.__mtShifts = []
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as Shift[]) {
            if (entry.hadRecentInput) continue
            w.__mtCls += entry.value
            const sources = (entry.sources ?? [])
              .slice(0, 3)
              .map((src) => `${src.node?.getAttribute?.('data-testid') ?? src.node?.nodeName ?? '?'}:${Math.round(src.previousRect.top)}>${Math.round(src.currentRect.top)}`)
            w.__mtShifts.push(`${entry.value.toFixed(4)} ${sources.join(' ')}`)
          }
        }).observe({ type: 'layout-shift', buffered: true })
      })
      await page.goto('/trips/my')
      // Страница под живой сессией: после ответа списка у сегмента всегда есть «(N)».
      // Гостю запросы выключены, блок монтируется сразу и CLS ≈ 0 — это не замер.
      // Невидимый резерв «(0)» (countPending) тоже текст — сначала он должен уйти.
      await expect(page.getByTestId('my-trips-segment-organized-count-pending')).toHaveCount(0, { timeout: 60_000 })
      await expect(page.getByTestId('my-trips-segment-organized')).toContainText(/\(\d+\)/, { timeout: 60_000 })
      await expect(page.getByTestId('my-trips-updates')).toBeVisible({ timeout: 60_000 })
      // Дать догрузиться уведомлениям и картинкам карточек.
      await page.waitForLoadState('networkidle').catch(() => null)
      const { cls, shifts } = await page.evaluate(() => {
        const w = window as unknown as { __mtCls: number; __mtShifts: string[] }
        return { cls: w.__mtCls, shifts: w.__mtShifts }
      })
      console.log(`[mobile-screen-budget] trips-my @ ${viewport.name}: cls=${cls.toFixed(4)} shifts=${JSON.stringify(shifts)}`)
      expect(cls).toBeLessThanOrEqual(0.05)
      // Механизм #2114 не вернулся: ни блок «Обновления», ни сегменты не сдвигаются
      // (до правки они и были источником; один порог 0,05 этого не отличал).
      expect(shifts.filter((line) => /my-trips-updates/.test(line))).toEqual([])
      // #2157: иконка сегмента «от планшета» стоит в разметке с первого кадра
      // (CHIP_LAYOUT + critical CSS) — появление иконки не расширяет чип и не сдвигает соседей.
      expect(shifts.filter((line) => /my-trips-segment-/.test(line))).toEqual([])
    })
  }

  // #2176: вкладка «Маршруты» своего профиля — каркас списка стоит на месте
  // карточек. Прод до правки (05.10.2026): каркас был собран отдельно от сетки
  // (две плашки с `marginTop: 16`), и узел списка переезжал на 16 px вверх в
  // момент ответа API — CLS 0,017 на 320, 0,029 на 390, 0,007 на 1280.
  for (const viewport of [
    { name: '320x640', width: 320, height: 640 },
    { name: '390x844', width: 390, height: 844 },
    { name: '1280x900', width: 1280, height: 900 },
  ]) {
    test(`profile travels skeleton holds the cards' place @ ${viewport.name}`, async ({ page, baseURL }) => {
      await ensureLiveSession(page, baseURL)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.addInitScript(() => {
        type Shift = { hadRecentInput: boolean; value: number; sources?: Array<{ node?: Element; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }> }
        const w = window as unknown as { __mtShifts: string[] }
        w.__mtShifts = []
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as Shift[]) {
            if (entry.hadRecentInput) continue
            const sources = (entry.sources ?? []).map(
              (src) => `${src.node?.getAttribute?.('data-testid') ?? src.node?.nodeName ?? '?'}:${Math.round(src.previousRect.top)}>${Math.round(src.currentRect.top)}`,
            )
            w.__mtShifts.push(`${entry.value.toFixed(4)} ${sources.join(' ')}`)
          }
        }).observe({ type: 'layout-shift', buffered: true })
      })
      // Список придерживается, пока каркас не измерен: на быстрой сети он живёт ~200 мс.
      let releaseTravels = () => {}
      const travelsHeld = new Promise<void>((resolve) => {
        releaseTravels = resolve
      })
      await page.route(/\/api\/travels\/\?/, async (route) => {
        await travelsHeld
        await route.continue()
      })
      const profileList = page.getByTestId('profile-travel-list')
      const rectOf = (target: Locator) =>
        target.first().evaluate((el) => {
          const { top, left, width, height } = el.getBoundingClientRect()
          return { top, left, width, height }
        })

      await page.goto('/profile')
      await expect(page.getByRole('tab', { name: /Опубл/ }).first(), 'профиль открыт гостем — нет веб-сессии на этом origin').toBeVisible({ timeout: 60_000 })
      await expect(page.getByTestId('profile-travel-grid-skeleton')).toBeVisible()
      const skeletonList = await rectOf(profileList)
      const skeletonCell = await rectOf(profileList.getByTestId('travel-list-item-skeleton'))

      releaseTravels()
      // У e2e-аккаунта есть черновики, поэтому «Маршруты» не пуста.
      await expect(profileList.getByTestId('travel-card-link').first()).toBeVisible({ timeout: 60_000 })
      await expect(page.getByTestId('profile-travel-grid-skeleton')).toHaveCount(0)
      const list = await rectOf(profileList)
      const card = await rectOf(profileList.getByTestId('travel-card-link'))
      const shifts = await page.evaluate(() => (window as unknown as { __mtShifts: string[] }).__mtShifts)
      console.log(
        `[mobile-screen-budget] profile-travels @ ${viewport.name}: skeletonTop=${Math.round(skeletonCell.top)} cardTop=${Math.round(card.top)} ` +
          `skeleton=${Math.round(skeletonCell.width)}x${Math.round(skeletonCell.height)} card=${Math.round(card.width)}x${Math.round(card.height)} shifts=${JSON.stringify(shifts)}`,
      )

      expect(Math.abs(list.top - skeletonList.top), 'верх списка не двигается при замене каркаса карточками').toBeLessThanOrEqual(0.5)
      expect(Math.abs(card.top - skeletonCell.top)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(card.left - skeletonCell.left)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(card.width - skeletonCell.width), 'ячейка каркаса — той же ширины, что карточка').toBeLessThanOrEqual(0.5)
      // Высота: медиа-слот у обоих квадратный, текстовый блок каркаса — карточка без
      // значков; чип «Черновик» добавляет карточке 4 px.
      expect(Math.abs(card.height - skeletonCell.height)).toBeLessThanOrEqual(6)
      // Узел списка один и тот же до и после ответа: его сдвиг браузер записал бы сюда.
      expect(shifts.filter((line) => /profile-travel-list/.test(line))).toEqual([])
    })
  }

  test.afterAll(() => {
    printResultsTable(SCREENS.map((s) => s.key))
  })
})
