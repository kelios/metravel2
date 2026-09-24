import fs from 'node:fs'
import path from 'node:path'
import { expect, type Page } from '@playwright/test'
import { gotoWithRetry, preacceptCookies } from './navigation'

/**
 * #2094: общий замер мобильного бюджета экрана. Делится между тремя спеками:
 *  - `e2e/mobile-screen-budget.spec.ts` — все 13 экранов без мутаций
 *    бэкенда, дефолтный suite;
 *  - `e2e/mobile-screen-budget-production-smoke.spec.ts` — тот же код, но
 *    только `SCREENS[].isPublic`, для `E2E_SUITE=production-smoke`;
 *  - `e2e/mobile-screen-budget-trip-plan.live.spec.ts` — `/trips/plan/:id`,
 *    создаёт и удаляет тестовую поездку, только `E2E_SUITE=live-contract`.
 * Один тест = один экран = одна навигация: `measureScreenAllCombos` снимает
 * все 4 комбинации (2 вьюпорта × 2 темы) поверх неё через
 * `page.setViewportSize`/клик по `ThemeToggle`, без перезагрузки страницы
 * (см. комментарий на месте). Каждая комбинация пишет свою строку отдельным
 * файлом (`writeScreenResult`) — без общего файла на запись гонка между
 * параллельными тестами невозможна. `printResultsTable`/`readAllResults`
 * собирают все строки в один `test-results/mobile-screen-budget.json` и
 * печатают таблицу.
 */

export type Theme = 'light' | 'dark'

export type Viewport = { name: string; width: number; height: number }

// Card #2094: 390×844 (iPhone 12/13/14 mini/SE-class logical width) и 402×874
// (iPhone 16 Pro, источник отчётов TestFlight 1.0.5 (10)).
export const MOBILE_VIEWPORTS: Viewport[] = [
  { name: '390x844', width: 390, height: 844 },
  { name: '402x874', width: 402, height: 874 },
]

export const THEMES: Theme[] = ['light', 'dark']

export type ScreenDef = {
  /** Стабильный ключ экрана для JSON/таблицы и порогов. */
  key: string
  /** Путь для `page.goto`. */
  path: string
  /**
   * Текст заголовка экрана — ровно тот, что рендерит сам экран (H1/шапка),
   * взят из того же i18n-ключа, который использует компонент. См. разбор в
   * задаче #2094: для экранов без собственного HeaderContextBar (top-level
   * разделы дока) это собственный H1 экрана, а не подпись раздела навигации —
   * иначе счётчик сравнивал бы два разных текста.
   */
  title: string
  requiresAuth: boolean
  /** Публичный экран — измеряется и в `E2E_SUITE=production-smoke`. */
  isPublic: boolean
  /**
   * testID существующего главного CTA экрана (не заводим новые testID —
   * карточка разрешает единственную правку продуктового кода, метку
   * `dataSet`). Если у экрана нет стабильного testID на CTA, поле опущено —
   * метрика `ctaOccluded` для него не считается (`null`), это отражено в
   * отчёте, а не подделывается.
   */
  ctaTestId?: string
}

export const SCREENS: ScreenDef[] = [
  { key: 'home', path: '/', title: 'Главная', requiresAuth: false, isPublic: true },
  {
    key: 'search',
    path: '/search',
    title: 'Поиск маршрутов и идей путешествий по Беларуси',
    requiresAuth: false,
    isPublic: true,
  },
  { key: 'quests', path: '/quests', title: 'Все квесты', requiresAuth: false, isPublic: true },
  {
    key: 'trips',
    path: '/trips',
    title: 'Поехали со мной',
    requiresAuth: false,
    isPublic: true,
    ctaTestId: 'public-trips-organize',
  },
  {
    key: 'trips-my',
    path: '/trips/my',
    title: 'Мои поездки',
    requiresAuth: true,
    isPublic: false,
    ctaTestId: 'my-trips-plan-cta',
  },
  {
    // Профиль открывается вкладкой «Маршруты» по умолчанию
    // (`ProfileScreen.tsx`: `useState<ProfileTabKey>('travels')`), отдельный
    // query-параметр не нужен.
    key: 'profile-routes',
    path: '/profile',
    title: 'Профиль',
    requiresAuth: true,
    isPublic: false,
  },
  { key: 'favorites', path: '/favorites', title: 'Хочу поехать', requiresAuth: true, isPublic: false },
  { key: 'history', path: '/history', title: 'Вы смотрели', requiresAuth: true, isPublic: false },
  { key: 'subscriptions', path: '/subscriptions', title: 'Подписки', requiresAuth: true, isPublic: false },
  { key: 'settings', path: '/settings', title: 'Настройки', requiresAuth: true, isPublic: false },
  {
    key: 'contact',
    path: '/contact',
    title: 'Контакты и обратная связь',
    requiresAuth: false,
    isPublic: true,
  },
  { key: 'about', path: '/about', title: 'О проекте', requiresAuth: false, isPublic: true },
  { key: 'userpoints', path: '/userpoints', title: 'Мои точки', requiresAuth: true, isPublic: false },
]

// `/trips/plan/:id` живёт в отдельной live-contract спеке (мутирует бэкенд —
// создаёт и удаляет тестовую поездку), но использует тот же набор метрик и
// тот же JSON. Ключ вынесен сюда, чтобы `MOBILE_SCREEN_BUDGET` был ровно один
// объект на все 14 экранов, как того требует карточка.
export const TRIP_PLAN_SCREEN_KEY = 'trips-plan-id'

export async function seedTheme(page: Page, theme: Theme) {
  await page.addInitScript((value: string) => {
    try {
      window.localStorage.setItem('theme', value)
    } catch {
      // ignore
    }
  }, theme)
}

export type FirstContentMeasurement = { top: number; viewportHeight: number; ratio: number } | null

/**
 * Верх первого элемента, помеченного `dataSet={{ screenContent: 'first' }}`,
 * относительно высоты вьюпорта. `boundingBox()` у Playwright уже
 * viewport-relative (учитывает текущий скролл), поэтому замер без ручного
 * скролла — это ровно «сколько высоты экрана съедено до начала контента».
 */
export async function measureFirstContentTop(page: Page): Promise<FirstContentMeasurement> {
  const locator = page.locator('[data-screen-content="first"]').first()
  if ((await locator.count()) === 0) return null
  const box = await locator.boundingBox()
  if (!box) return null
  const viewport = page.viewportSize()
  if (!viewport) return null
  return { top: box.y, viewportHeight: viewport.height, ratio: box.y / viewport.height }
}

/**
 * Сколько раз точный текст заголовка виден в первом экране (без скролла).
 * Считает только «листовые» совпадения (без родительских обёрток с тем же
 * текстом, иначе вложенные `View`/`Text` задвоили бы счёт) и отбрасывает
 * sr-only узлы (техника `search.tsx`: `position:absolute` + `clip-path:
 * inset(50%)` / `clip: rect(0,0,0,0)`, ширина/высота ~1px) — они не «видны»
 * в смысле бага из карточки.
 */
export async function countVisibleTitleOccurrences(page: Page, title: string): Promise<number> {
  const target = String(title || '').trim()
  if (!target) return 0
  return page.evaluate((needle) => {
    function isSrOnly(el: Element): boolean {
      const rect = el.getBoundingClientRect()
      if (rect.width > 4 && rect.height > 4) return false
      const cs = getComputedStyle(el)
      return (
        cs.position === 'absolute' &&
        (cs.clipPath.includes('inset(50%') || cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.overflow === 'hidden')
      )
    }
    function isVisible(el: Element): boolean {
      const rect = el.getBoundingClientRect()
      if (rect.top > window.innerHeight || rect.bottom < 0) return false
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false
      if (isSrOnly(el)) return false
      return rect.width > 0 && rect.height > 0
    }
    const all = Array.from(document.body.querySelectorAll<HTMLElement>('*'))
    const matches = all.filter((el) => (el.textContent || '').trim() === needle)
    const leaves = matches.filter((el) => !matches.some((other) => other !== el && el.contains(other)))
    return leaves.filter(isVisible).length
  }, target)
}

/** Playwright-роль `searchbox` — реальная accessibility-роль, а не сырой DOM-атрибут. */
export async function countSearchboxes(page: Page): Promise<number> {
  return page.getByRole('searchbox').count()
}

/**
 * `null` — на экране нет стабильного testID для главного CTA (метрика не
 * считается). `true` — центр CTA перекрыт другим элементом (доком и т. п.).
 */
export async function isCtaOccludedByDock(page: Page, ctaTestId: string | undefined): Promise<boolean | null> {
  if (!ctaTestId) return null
  const locator = page.locator(`[data-testid="${ctaTestId}"], [testID="${ctaTestId}"]`).first()
  if ((await locator.count()) === 0) return null
  const isTopmost = await locator.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    const hit = document.elementFromPoint(point.x, point.y)
    if (!hit) return false
    return el === hit || el.contains(hit) || hit.contains(el)
  })
  return !isTopmost
}

export type DarkBottomColorSample = { bodyBackground: string; bottomBackground: string; matchesThemeBackground: boolean }

/**
 * Только для тёмной темы: цвет фона в точке у нижнего края документа
 * (после скролла до конца) сравнивается с фоном `<body>` — тем самым цветом
 * темы, что виден в остальной части экрана. Несовпадение — это и есть «белая
 * полоса» из отчёта TestFlight.
 */
export async function sampleDarkBottomColor(page: Page): Promise<DarkBottomColorSample> {
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight)
    // Два кадра вместо фиксированной паузы (гейт `guard:e2e-wait-for-timeout`
    // запрещает новый `waitForTimeout`): достаточно, чтобы браузер применил
    // скролл-привязанные repaint (sticky/fixed элементы) перед сэмплом цвета.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  const sample = await page.evaluate(() => {
    function backgroundAt(el: Element | null): string {
      let node: Element | null = el
      while (node) {
        const bg = getComputedStyle(node).backgroundColor
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg
        node = node.parentElement
      }
      return getComputedStyle(document.body).backgroundColor
    }
    const bodyBackground = getComputedStyle(document.body).backgroundColor
    const point = { x: Math.floor(window.innerWidth / 2), y: Math.max(1, window.innerHeight - 4) }
    const hit = document.elementFromPoint(point.x, point.y)
    const bottomBackground = backgroundAt(hit)
    return { bodyBackground, bottomBackground, matchesThemeBackground: bodyBackground === bottomBackground }
  })
  await page.evaluate(() => window.scrollTo(0, 0))
  return sample
}

const INTERACTIVE_ROLES = ['button', 'link', 'checkbox', 'switch', 'tab', 'menuitem', 'searchbox', 'combobox', 'radio']

/**
 * Интерактивные элементы (по ARIA-роли или нативному тегу) без доступного
 * имени: нет `aria-label`, текста `aria-labelledby`, `title`, собственного
 * текста и `alt` вложенной картинки. Приближение accessible name computation
 * — не полная спецификация, но ловит «иконка без подписи» из #1774/#1776/#1789.
 */
export async function countUnlabeledInteractive(page: Page): Promise<number> {
  return page.evaluate((roles: string[]) => {
    function isVisible(el: Element): boolean {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return false
      const cs = getComputedStyle(el)
      return cs.display !== 'none' && cs.visibility !== 'hidden'
    }
    function hasAccessibleName(el: Element): boolean {
      const ariaLabel = (el.getAttribute('aria-label') || '').trim()
      if (ariaLabel) return true
      const labelledBy = el.getAttribute('aria-labelledby')
      if (labelledBy) {
        const text = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() || '')
          .join(' ')
          .trim()
        if (text) return true
      }
      const title = (el.getAttribute('title') || '').trim()
      if (title) return true
      const text = (el.textContent || '').trim()
      if (text) return true
      const img = el.querySelector('img[alt]')
      if (img && (img.getAttribute('alt') || '').trim()) return true
      return false
    }
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('[role], button, a[href]'))
    let count = 0
    for (const el of candidates) {
      const role = el.getAttribute('role') || (el.tagName === 'BUTTON' ? 'button' : el.tagName === 'A' ? 'link' : '')
      if (!roles.includes(role)) continue
      if (el.getAttribute('aria-hidden') === 'true') continue
      if (!isVisible(el)) continue
      if (!hasAccessibleName(el)) count += 1
    }
    return count
  }, INTERACTIVE_ROLES)
}

export type ScreenMetrics = {
  screen: string
  path: string
  viewport: string
  theme: Theme
  firstContentTopRatio: number | null
  titleOccurrences: number
  searchboxCount: number
  ctaOccluded: boolean | null
  darkBottomMatchesTheme: boolean | null
  unlabeledInteractive: number
}

const RESULTS_PATH = path.join(process.cwd(), 'test-results', 'mobile-screen-budget.json')
// Каждый тест пишет свою собственную строку сюда — по одному файлу на
// (экран, вьюпорт, тема). Один файл на тест исключает гонку записи в общий
// JSON: тесты этого файла НЕ идут `mode: 'serial'` (иначе провал одного
// экрана по бюджету останавливал бы измерение всех следующих — Playwright
// пропускает остаток serial-группы после первого failure), поэтому при
// `fullyParallel: true` из `playwright.config.ts` несколько тестов вполне
// могут писать результат одновременно.
const RESULTS_DIR = path.join(process.cwd(), 'test-results', 'mobile-screen-budget-entries')

function resultKey(m: Pick<ScreenMetrics, 'screen' | 'viewport' | 'theme'>): string {
  return `${m.screen}__${m.viewport}__${m.theme}`
}

export function writeScreenResult(metrics: ScreenMetrics): void {
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const file = path.join(RESULTS_DIR, `${resultKey(metrics)}.json`)
  fs.writeFileSync(file, JSON.stringify(metrics, null, 2))
}

/**
 * Собирает все файлы `RESULTS_DIR` в один объект и заодно перезаписывает
 * агрегат `test-results/mobile-screen-budget.json` — это и есть путь из
 * карточки #2094. Читает диск заново при каждом вызове (не кеширует),
 * поэтому безопасно вызывать и из `test.afterAll` каждой из трёх спек.
 */
export function readAllResults(): Record<string, ScreenMetrics> {
  const result: Record<string, ScreenMetrics> = {}
  let files: string[] = []
  try {
    files = fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json'))
  } catch {
    files = []
  }
  for (const file of files) {
    try {
      const metrics = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf8')) as ScreenMetrics
      result[resultKey(metrics)] = metrics
    } catch {
      // ignore a single corrupt entry, keep the rest
    }
  }
  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true })
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(result, null, 2))
  return result
}

export function printResultsTable(filterScreens?: string[]): void {
  const all = readAllResults()
  const rows = Object.values(all)
    .filter((r) => !filterScreens || filterScreens.includes(r.screen))
    .sort((a, b) => (a.screen + a.viewport + a.theme).localeCompare(b.screen + b.viewport + b.theme))
  const header = [
    'screen',
    'viewport',
    'theme',
    'firstContentTop',
    'titleCount',
    'searchbox',
    'ctaOccluded',
    'darkBottomOk',
    'unlabeled',
  ]
  const fmt = (r: ScreenMetrics) => [
    r.screen,
    r.viewport,
    r.theme,
    r.firstContentTopRatio == null ? 'n/a' : r.firstContentTopRatio.toFixed(3),
    String(r.titleOccurrences),
    String(r.searchboxCount),
    r.ctaOccluded == null ? 'n/a' : String(r.ctaOccluded),
    r.darkBottomMatchesTheme == null ? 'n/a' : String(r.darkBottomMatchesTheme),
    String(r.unlabeledInteractive),
  ]
  const lines = [header, ...rows.map(fmt)]
  const widths = header.map((_, col) => Math.max(...lines.map((line) => String(line[col]).length)))
  const printLine = (line: (string | number)[]) =>
    line.map((cell, i) => String(cell).padEnd(widths[i])).join(' | ')
  console.log('\n[mobile-screen-budget]')
  console.log(printLine(header))
  console.log(widths.map((w) => '-'.repeat(w)).join('-|-'))
  for (const row of lines.slice(1)) {
    console.log(printLine(row))
  }
}

/**
 * Пороги — «не хуже текущего». Числа взяты замером #2094 (см. отчёт задачи и
 * §9 `docs/features/mobile-screen-shell-mock.md`); каждая карточка эпика
 * #2105 ужесточает свой порог в собственном diff. `firstContentTopRatioMax` —
 * верхняя граница (меньше = контент начинается раньше, лучше). Счётчики
 * (`titleOccurrencesMax`, `searchboxCountMax`, `unlabeledInteractiveMax`) —
 * тоже верхняя граница. `ctaOccludedAllowed` — пока CTA не перекрыт нигде,
 * держим `false`; экран, где измерение вернуло `null` (нет стабильного
 * testID), в бюджет не входит и не проверяется.
 */
export type ScreenBudget = {
  firstContentTopRatioMax: number
  titleOccurrencesMax: number
  searchboxCountMax: number
  ctaOccludedAllowed: boolean
  /**
   * Текущее состояние «белой полосы» в тёмной теме (см. `sampleDarkBottomColor`):
   * `false` — известный текущий дефект (цвет у нижнего края НЕ совпадает с
   * фоном темы), запрет ухудшения не требует немедленного `true`. Если
   * значение уже `true`, откат до `false` роняет прогон.
   */
  darkBottomMatchesThemeExpected: boolean
  unlabeledInteractiveMax: number
}

// Числа взяты замером #2094 (390×844 и 402×874, light/dark, локальный
// бэкенд 24.09.2026) — максимум наблюдённых значений по всем
// вьюпорт/тема-комбинациям плюс ~10% запас на дрожание измерения
// (`firstContentTopRatioMax`; счётчики — точное наблюдённое значение, для них
// запас не нужен). darkBottomMatchesThemeExpected: false — текущий дефект
// «белая полоса» в тёмной теме воспроизводится почти на каждом экране (см.
// §9 `docs/features/mobile-screen-shell-mock.md`), эпик #2105 переводит его в
// `true` по экрану за экраном.
export const MOBILE_SCREEN_BUDGET: Record<string, ScreenBudget> = {
  home: { firstContentTopRatioMax: 0.09, titleOccurrencesMax: 0, searchboxCountMax: 0, ctaOccludedAllowed: false, darkBottomMatchesThemeExpected: false, unlabeledInteractiveMax: 0 },
  search: { firstContentTopRatioMax: 0.22, titleOccurrencesMax: 0, searchboxCountMax: 0, ctaOccludedAllowed: false, darkBottomMatchesThemeExpected: false, unlabeledInteractiveMax: 0 },
  // 0,304–0,315: `/quests` рендерит «N квестов» только при `dataLoaded`
  // (`screens/tabs/QuestsContentPanel.tsx:319`) — число сдвигает высоту
  // блока над меткой. Раньше замер снимал метрику ДО прихода данных
  // (0,26–0,27) — заниженное число, не «после». `waitForContentAttached`
  // теперь ждёт `networkidle`, поэтому верное значение — то, что сейчас.
  quests: { firstContentTopRatioMax: 0.35, titleOccurrencesMax: 1, searchboxCountMax: 0, ctaOccludedAllowed: false, darkBottomMatchesThemeExpected: false, unlabeledInteractiveMax: 0 },
  trips: { firstContentTopRatioMax: 0.53, titleOccurrencesMax: 2, searchboxCountMax: 0, ctaOccludedAllowed: false, darkBottomMatchesThemeExpected: false, unlabeledInteractiveMax: 0 },
  'trips-my': { firstContentTopRatioMax: 0.65, titleOccurrencesMax: 2, searchboxCountMax: 0, ctaOccludedAllowed: false, darkBottomMatchesThemeExpected: false, unlabeledInteractiveMax: 0 },
  'profile-routes': { firstContentTopRatioMax: 0.48, titleOccurrencesMax: 1, searchboxCountMax: 0, ctaOccludedAllowed: false, darkBottomMatchesThemeExpected: false, unlabeledInteractiveMax: 0 },
  favorites: { firstContentTopRatioMax: 0.24, titleOccurrencesMax: 1, searchboxCountMax: 0, ctaOccludedAllowed: false, darkBottomMatchesThemeExpected: false, unlabeledInteractiveMax: 0 },
  history: { firstContentTopRatioMax: 0.78, titleOccurrencesMax: 2, searchboxCountMax: 0, ctaOccludedAllowed: false, darkBottomMatchesThemeExpected: false, unlabeledInteractiveMax: 0 },
  subscriptions: { firstContentTopRatioMax: 0.44, titleOccurrencesMax: 2, searchboxCountMax: 0, ctaOccludedAllowed: false, darkBottomMatchesThemeExpected: false, unlabeledInteractiveMax: 0 },
  settings: { firstContentTopRatioMax: 0.16, titleOccurrencesMax: 1, searchboxCountMax: 0, ctaOccludedAllowed: false, darkBottomMatchesThemeExpected: false, unlabeledInteractiveMax: 0 },
  contact: { firstContentTopRatioMax: 0.66, titleOccurrencesMax: 1, searchboxCountMax: 0, ctaOccludedAllowed: false, darkBottomMatchesThemeExpected: false, unlabeledInteractiveMax: 0 },
  // `/about`: метка стоит на `AboutIntroCard isPageHeading` (H1 «О проекте»)
  // — первый смысловой текстовый блок ПОСЛЕ `HeroBanner`+`StatsBanner`+
  // `CategoriesShowcase`. Три секции-баннера перед H1 — честная причина
  // ~293%, см. §9 дока и разбор в отчёте задачи.
  about: { firstContentTopRatioMax: 3.22, titleOccurrencesMax: 0, searchboxCountMax: 0, ctaOccludedAllowed: false, darkBottomMatchesThemeExpected: false, unlabeledInteractiveMax: 0 },
  userpoints: { firstContentTopRatioMax: 0.25, titleOccurrencesMax: 1, searchboxCountMax: 0, ctaOccludedAllowed: false, darkBottomMatchesThemeExpected: false, unlabeledInteractiveMax: 0 },
  [TRIP_PLAN_SCREEN_KEY]: { firstContentTopRatioMax: 0.60, titleOccurrencesMax: 2, searchboxCountMax: 0, ctaOccludedAllowed: false, darkBottomMatchesThemeExpected: false, unlabeledInteractiveMax: 0 },
}

export function assertWithinBudget(metrics: ScreenMetrics, budget: ScreenBudget): string[] {
  const failures: string[] = []
  const label = `${metrics.screen} @ ${metrics.viewport}/${metrics.theme}`
  if (metrics.firstContentTopRatio != null && metrics.firstContentTopRatio > budget.firstContentTopRatioMax) {
    failures.push(
      `${label}: firstContentTopRatio было ≤${budget.firstContentTopRatioMax}, стало ${metrics.firstContentTopRatio.toFixed(3)}`
    )
  }
  if (metrics.titleOccurrences > budget.titleOccurrencesMax) {
    failures.push(`${label}: titleOccurrences было ≤${budget.titleOccurrencesMax}, стало ${metrics.titleOccurrences}`)
  }
  if (metrics.searchboxCount > budget.searchboxCountMax) {
    failures.push(`${label}: searchboxCount было ≤${budget.searchboxCountMax}, стало ${metrics.searchboxCount}`)
  }
  if (metrics.ctaOccluded != null && metrics.ctaOccluded !== budget.ctaOccludedAllowed) {
    failures.push(`${label}: ctaOccluded было ${budget.ctaOccludedAllowed}, стало ${metrics.ctaOccluded}`)
  }
  if (metrics.darkBottomMatchesTheme != null && metrics.darkBottomMatchesTheme !== budget.darkBottomMatchesThemeExpected) {
    failures.push(
      `${label}: darkBottomMatchesTheme было ${budget.darkBottomMatchesThemeExpected}, стало ${metrics.darkBottomMatchesTheme}`
    )
  }
  if (metrics.unlabeledInteractive > budget.unlabeledInteractiveMax) {
    failures.push(
      `${label}: unlabeledInteractive было ≤${budget.unlabeledInteractiveMax}, стало ${metrics.unlabeledInteractive}`
    )
  }
  return failures
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForContentAttached(page: Page): Promise<void> {
  // Непустая высота, а не просто "visible": список успевает смонтироваться
  // раньше, чем в него приходят данные, и "visible" проходит на нулевой
  // высоте на мгновение раньше настоящего первого кадра контента.
  await page
    .waitForFunction(
      () => {
        const el = document.querySelector('[data-screen-content="first"]')
        return !!el && el.getBoundingClientRect().height > 0
      },
      { timeout: 30_000 }
    )
    .catch(() => null)
  // `networkidle` целится точно в «данные экрана загружены» дешевле общего
  // опроса подписи в `waitForScreenSettled`: на `/quests` счётчик «N квестов»
  // ждёт ответа API квестов, а не изменения вёрстки само по себе. Только
  // после первой навигации — смена вьюпорта/темы ниже не бьёт по сети.
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => null)
}

/**
 * Ждёт устоявшееся состояние экрана вместо фиксированной паузы: положение
 * метки контента и число видимых заголовков не меняются между двумя
 * проверками подряд (~200 мс). Ловит гонку с догружающимися данными без
 * знания о конкретных скелетонах каждого экрана — замер #2094 поймал именно
 * так «заголовок то ×1, то ×2» на `/history` и `/subscriptions`: вторая
 * секция (сводка/список) домонтируется позже первого кадра, и снятие метрик
 * до этого момента честно, но недетерминированно фиксирует переходное
 * состояние. Не `page.waitForTimeout` (гейт `guard:e2e-wait-for-timeout`
 * запрещает новые вызовы) — обычный `setTimeout` в Node-коде теста.
 */
async function waitForScreenSettled(page: Page, title: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now()
  let previousSignature: string | null = null
  let stableReads = 0
  while (Date.now() - start < timeoutMs) {
    const content = await measureFirstContentTop(page)
    const titleOccurrences = await countVisibleTitleOccurrences(page, title)
    // `document.body.scrollHeight` — не только сама метка: на `/quests`
    // счётчик «N квестов» в шапке рендерится только при `dataLoaded` и не
    // меняет ни позицию метки, ни счёт заголовка сам по себе, но раздвигает
    // высоту блока НАД меткой уже ПОСЛЕ того, как метка успела «устояться» —
    // подпись без общей высоты страницы этого не ловит (замер #2094).
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight).catch(() => null)
    const signature = JSON.stringify([content?.top ?? null, content?.viewportHeight ?? null, titleOccurrences, scrollHeight])
    if (signature === previousSignature) {
      stableReads += 1
      // 2 подряд одинаковые подписи с разрывом ~150 мс — источник данных уже
      // отловлен `networkidle` в `waitForContentAttached` (один раз, после
      // навигации), здесь остаётся ловить только чисто раскладочный
      // домонтаж (скелетон → карточка) без сетевого запроса.
      if (stableReads >= 2) return
    } else {
      stableReads = 0
    }
    previousSignature = signature
    await sleep(150)
  }
}

/**
 * Переключает тему через реальную UI-кнопку (`mobile-menu-open` →
 * `theme-toggle-<light|dark>` → закрыть по `mobile-menu-overlay`) — без
 * перезагрузки страницы. Кнопка есть в глобальной шапке на всех измеряемых
 * экранах (`mobile-dark-theme.spec.ts` подтверждает: клик обновляет
 * `html[data-theme]` сразу, реальный `ThemeToggle` — не мок, `JEST_WORKER_ID`
 * в браузерном e2e не выставлен). Возвращает `false`, если что-то из цепочки
 * недоступно — тогда `ensureTheme` ниже перезагружает страницу с темой,
 * зашитой в `localStorage` до старта приложения (то же поведение, что было
 * до правки, но включается только при живом переключении темы, не на каждый
 * вьюпорт).
 */
async function toggleThemeViaMenu(page: Page, theme: Theme): Promise<boolean> {
  const menuOpen = page.getByTestId('mobile-menu-open')
  if ((await menuOpen.count()) === 0) return false
  await menuOpen.click().catch(() => null)
  const panel = page.getByTestId('mobile-menu-panel')
  const opened = await panel
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false)
  if (!opened) return false

  const toggle = page.getByTestId(`theme-toggle-${theme}`)
  if ((await toggle.count()) === 0) {
    await page.getByTestId('mobile-menu-overlay').click({ force: true }).catch(() => null)
    return false
  }
  await toggle.click()
  const switched = await page
    .waitForFunction(
      (value) => document.documentElement.getAttribute('data-theme') === value,
      theme,
      { timeout: 5_000 }
    )
    .then(() => true)
    .catch(() => false)
  await page.getByTestId('mobile-menu-overlay').click({ force: true }).catch(() => null)
  await panel.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => null)
  return switched
}

/** Меняет тему только если она реально отличается от текущей — 0 лишних кликов. */
async function ensureTheme(page: Page, theme: Theme, path: string): Promise<void> {
  const current = await page.evaluate(() => document.documentElement.getAttribute('data-theme')).catch(() => null)
  if (current === theme) return
  const switchedLive = await toggleThemeViaMenu(page, theme)
  if (switchedLive) return
  await seedTheme(page, theme)
  await gotoWithRetry(page, path)
  await waitForContentAttached(page)
}

async function collectMetrics(
  page: Page,
  opts: { screenKey: string; path: string; title: string; ctaTestId?: string },
  viewport: Viewport,
  theme: Theme
): Promise<ScreenMetrics> {
  const firstContent = await measureFirstContentTop(page)
  const titleOccurrences = await countVisibleTitleOccurrences(page, opts.title)
  const searchboxCount = await countSearchboxes(page)
  const ctaOccluded = await isCtaOccludedByDock(page, opts.ctaTestId)
  const unlabeledInteractive = await countUnlabeledInteractive(page)
  const darkBottom = theme === 'dark' ? await sampleDarkBottomColor(page) : null

  return {
    screen: opts.screenKey,
    path: opts.path,
    viewport: viewport.name,
    theme,
    firstContentTopRatio: firstContent?.ratio ?? null,
    titleOccurrences,
    searchboxCount,
    ctaOccluded,
    darkBottomMatchesTheme: darkBottom ? darkBottom.matchesThemeBackground : null,
    unlabeledInteractive,
  }
}

/**
 * Одна навигация на экран, все 4 комбинации (2 вьюпорта × 2 темы) поверх
 * неё: смена вьюпорта — `page.setViewportSize` (приложение слушает
 * `Dimensions`/`resize` живьём, `hooks/useResponsive.ts`), смена темы —
 * реальный клик по `ThemeToggle` (см. `toggleThemeViaMenu`). Порядок комбо
 * (v0,light)→(v1,light)→(v1,dark)→(v0,dark) — по одному изменению за шаг,
 * ни разу вьюпорт и тема не меняются одновременно. Было: 4 отдельных теста
 * с полной навигацией на комбо — на дефолтный suite (52 теста) это 7,9 мин
 * на одном воркере; после этой правки один и тот же прогон занимает 13
 * тестов с одной навигацией и кликом на экран.
 */
export async function measureScreenAllCombos(
  page: Page,
  opts: {
    screenKey: string
    path: string
    title: string
    viewports: Viewport[]
    ctaTestId?: string
    budget: ScreenBudget
  }
): Promise<void> {
  if (opts.viewports.length !== 2) {
    throw new Error(`measureScreenAllCombos expects exactly 2 viewports, got ${opts.viewports.length}`)
  }
  const [v0, v1] = opts.viewports
  const combos: Array<{ viewport: Viewport; theme: Theme }> = [
    { viewport: v0, theme: 'light' },
    { viewport: v1, theme: 'light' },
    { viewport: v1, theme: 'dark' },
    { viewport: v0, theme: 'dark' },
  ]

  await page.setViewportSize({ width: v0.width, height: v0.height })
  await preacceptCookies(page)
  await seedTheme(page, 'light')
  await gotoWithRetry(page, opts.path)
  await waitForContentAttached(page)

  const allFailures: string[] = []

  for (let index = 0; index < combos.length; index += 1) {
    const combo = combos[index]
    const previous = index > 0 ? combos[index - 1] : null

    if (!previous || previous.viewport.name !== combo.viewport.name) {
      await page.setViewportSize({ width: combo.viewport.width, height: combo.viewport.height })
    }
    if (!previous || previous.theme !== combo.theme) {
      await ensureTheme(page, combo.theme, opts.path)
    }
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => null)
    await waitForScreenSettled(page, opts.title)

    const metrics = await collectMetrics(page, opts, combo.viewport, combo.theme)
    writeScreenResult(metrics)
    allFailures.push(...assertWithinBudget(metrics, opts.budget))
  }

  expect(allFailures, allFailures.join('\n')).toEqual([])
}
