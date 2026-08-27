import fs from 'node:fs'
import Module from 'node:module'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { JSDOM } from 'jsdom'

import { applySmartImageLayout } from '../utils/richTextImageLayout'

const OUTPUT_DIR = path.resolve('.codex-temp/task-1602')
const WEB_RICH_TEXT_CLASS = 'travel-rich-text'
const WEB_RICH_TEXT_FULL_WIDTH_CLASS = 'travel-rich-text--full-width'
const PORTRAIT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAeCAYAAAAsEj5rAAAARUlEQVR4Aa3BMQEAIAzAsK6aEIdyXmaiyZz7PiGJSUxiEpOYxCQmMYlJTGISk5jEJCYxiUlMYhKTmMQkJjGJSUxiEpPYAhQEAt2j2+xUAAAAAElFTkSuQmCC'
const WIDE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAPCAYAAADzun+cAAAAMElEQVR4AcXBAQEAIAyAME4EUxvEnj4G25x3PwGJSEQiEpGIRCQiEYlEFkntAlvZqP7zAAAAAElFTkSuQmCC'

const wrapText = (side: string) =>
  Array.from(
    { length: 60 },
    (_, index) => `${side}-${index + 1} текст продолжает естественно обтекать фотографию`,
  ).join(' ')

const descriptionFixture = `
  <h2>Проверка журнального потока</h2>
  <p>Вводный абзац на всю ширину до первой фотографии.</p>
  <figure class="img-float-right figure-portrait">
    <img src="${PORTRAIT}" width="600" height="900" alt="Портрет справа" />
    <figcaption>Подпись справа остаётся вместе с фотографией</figcaption>
  </figure>
  <p>${wrapText('right')}</p>
  <h3>Заголовок после правого фото</h3>
  <p>Маркер после правого фото.</p>
  <p class="img-float-left figure-portrait"><img src="${PORTRAIT}" width="600" height="900" alt="Портрет слева" /></p>
  <p>${wrapText('left')}</p>
  <h3>Заголовок после левого фото</h3>
  <p>Маркер после левого фото.</p>
  <p class="img-single-wide figure-landscape"><img src="${WIDE}" width="1200" height="600" alt="Широкое фото" /></p>
  <p>Маркер после широкого фото.</p>
`

type ModuleLoader = (request: string, parent: NodeModule | null, isMain: boolean) => unknown
const moduleInternals = Module as unknown as { _load: ModuleLoader }
const originalModuleLoad = moduleInternals._load

function loadWithReactNativeWebPlatform<T>(load: () => T): T {
  moduleInternals._load = function loadWithWebPlatform(request, parent, isMain) {
    if (request === 'react-native') {
      return {
        Platform: {
          OS: 'web',
          select: <TChoice,>(choices: { web?: TChoice; default?: TChoice }) =>
            choices.web ?? choices.default,
        },
      }
    }
    return originalModuleLoad.call(this, request, parent, isMain)
  }

  try {
    return load()
  } finally {
    moduleInternals._load = originalModuleLoad
  }
}

const {
  baseStyles,
  floatStyles,
  typographyStyles,
  responsiveStyles,
  buildPdfHtmlDocument,
  BlockRenderer,
  minimalTheme,
} = loadWithReactNativeWebPlatform(() => ({
  ...(require('../components/travel/stableContent/webStyles/base') as typeof import('../components/travel/stableContent/webStyles/base')),
  ...(require('../components/travel/stableContent/webStyles/floats') as typeof import('../components/travel/stableContent/webStyles/floats')),
  ...(require('../components/travel/stableContent/webStyles/typography') as typeof import('../components/travel/stableContent/webStyles/typography')),
  ...(require('../components/travel/stableContent/webStyles/responsive') as typeof import('../components/travel/stableContent/webStyles/responsive')),
  ...(require('../services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup/htmlDocument') as typeof import('../services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup/htmlDocument')),
  ...(require('../services/pdf-export/renderers/BlockRenderer') as typeof import('../services/pdf-export/renderers/BlockRenderer')),
  ...(require('../services/pdf-export/themes/PdfThemeConfig') as typeof import('../services/pdf-export/themes/PdfThemeConfig')),
}))

const WEB_THEME_COLORS = {
  light: {
    background: '#f7f5f0',
    backgroundSecondary: '#ebe8e1',
    border: '#cbc6bb',
    borderLight: '#dedad1',
    focusStrong: '#196b50',
    primary: '#33735d',
    primaryText: '#275c4b',
    surface: '#ffffff',
    text: '#282723',
    textMuted: '#595750',
    boxShadows: { light: '0 6px 20px rgba(25, 24, 20, 0.12)' },
  },
  dark: {
    background: '#171816',
    backgroundSecondary: '#252724',
    border: '#555a53',
    borderLight: '#41463f',
    focusStrong: '#8dd4b6',
    primary: '#83c5a8',
    primaryText: '#a6dec6',
    surface: '#222421',
    text: '#f1f0ec',
    textMuted: '#c5c6c0',
    boxShadows: { light: '0 6px 20px rgba(0, 0, 0, 0.35)' },
  },
} as const

const transformedDescriptionFixture = applySmartImageLayout(descriptionFixture)

function buildWebFixtureHtml(theme: keyof typeof WEB_THEME_COLORS): string {
  const colors = WEB_THEME_COLORS[theme] as never
  const richTextStyles =
    baseStyles(colors, WEB_RICH_TEXT_CLASS, WEB_RICH_TEXT_FULL_WIDTH_CLASS) +
    floatStyles(colors, WEB_RICH_TEXT_CLASS) +
    typographyStyles(colors, WEB_RICH_TEXT_CLASS) +
    responsiveStyles(colors, WEB_RICH_TEXT_CLASS)

  return `<!doctype html>
    <html lang="ru" data-theme="${theme}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          *, *::before, *::after { box-sizing: border-box; }
          html { color-scheme: ${theme}; background: ${WEB_THEME_COLORS[theme].background}; }
          body { margin: 0; min-width: 0; background: ${WEB_THEME_COLORS[theme].background}; }
          .fixture-shell { min-width: 0; padding: 24px; }
          @media (max-width: 768px) { .fixture-shell { padding: 10px; } }
          ${richTextStyles}
        </style>
      </head>
      <body>
        <main class="fixture-shell">
          <article class="${WEB_RICH_TEXT_CLASS}">${transformedDescriptionFixture}</article>
        </main>
      </body>
    </html>`
}

type BrowserProblems = {
  consoleErrors: string[]
  pageErrors: string[]
  failedRequests: string[]
  badResponses: string[]
}

function collectBrowserProblems(page: Page): BrowserProblems {
  const problems: BrowserProblems = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
  }
  page.on('console', (message) => {
    if (message.type() === 'error') problems.consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => problems.pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    problems.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      problems.badResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  return problems
}

async function openWebFixture(page: Page, theme: keyof typeof WEB_THEME_COLORS): Promise<void> {
  await page.setContent(buildWebFixtureHtml(theme), { waitUntil: 'load' })
  const richText = page.locator('.travel-rich-text').first()
  await expect(richText).toBeVisible()
  await expect(richText.locator('figure.img-float-right figcaption')).toContainText('Подпись справа')
  await expect(richText.locator('img')).toHaveCount(3)
  await richText.locator('img').evaluateAll(async (images) => {
    await Promise.all(images.map((image) => (image as HTMLImageElement).decode()))
  })
  expect(
    await richText.locator('img').evaluateAll((images) =>
      images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
    ),
  ).toBe(true)
}

type Rect = { top: number; right: number; bottom: number; left: number; width: number; height: number }
type FlowProof = {
  floatRect: Rect
  alongside: Rect[]
  below: Rect[]
  gap: number
  widestAlongside: number
  widestBelow: number
  clearTop: number
  wideBottom: number
  afterWideTop: number
  captionBottom?: number
}

async function readFlowProof(page: Page, side: 'right' | 'left'): Promise<FlowProof> {
  return page.evaluate((floatSide) => {
    const root = document.querySelector('.travel-rich-text')
    if (!root) throw new Error('rich-text root missing')
    const float = root.querySelector(
      floatSide === 'right' ? 'figure.img-float-right' : 'p.img-float-left',
    ) as HTMLElement | null
    if (!float) throw new Error(`${floatSide} float missing`)
    const paragraph = float.nextElementSibling as HTMLElement | null
    if (!paragraph?.matches('p')) throw new Error(`${floatSide} wrapping paragraph missing`)
    const heading = Array.from(root.querySelectorAll('h3')).find((node) =>
      node.textContent?.includes(floatSide === 'right' ? 'правого' : 'левого'),
    ) as HTMLElement | undefined
    const wide = root.querySelector('.img-single-wide') as HTMLElement | null
    const afterWide = wide?.nextElementSibling as HTMLElement | null
    if (!heading || !wide || !afterWide) throw new Error('clear controls missing')

    const roundRect = (rect: DOMRect): Rect => ({
      top: Number(rect.top.toFixed(2)),
      right: Number(rect.right.toFixed(2)),
      bottom: Number(rect.bottom.toFixed(2)),
      left: Number(rect.left.toFixed(2)),
      width: Number(rect.width.toFixed(2)),
      height: Number(rect.height.toFixed(2)),
    })
    const floatRect = float.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(paragraph)
    const lines = Array.from(range.getClientRects()).filter((rect) => rect.width > 1 && rect.height > 1)
    const alongside = lines.filter((rect) => rect.top < floatRect.bottom && rect.bottom > floatRect.top)
    const below = lines.filter((rect) => rect.top >= floatRect.bottom - 1)
    const gap = floatSide === 'right'
      ? floatRect.left - Math.max(...alongside.map((rect) => rect.right))
      : Math.min(...alongside.map((rect) => rect.left)) - floatRect.right
    const caption = float.querySelector('figcaption') as HTMLElement | null
    return {
      floatRect: roundRect(floatRect),
      alongside: alongside.slice(0, 4).map(roundRect),
      below: below.slice(-4).map(roundRect),
      gap: Number(gap.toFixed(2)),
      widestAlongside: Number(Math.max(...alongside.map((rect) => rect.width)).toFixed(2)),
      widestBelow: Number(Math.max(...below.map((rect) => rect.width)).toFixed(2)),
      clearTop: Number(heading.getBoundingClientRect().top.toFixed(2)),
      wideBottom: Number(wide.getBoundingClientRect().bottom.toFixed(2)),
      afterWideTop: Number(afterWide.getBoundingClientRect().top.toFixed(2)),
      ...(caption ? { captionBottom: Number(caption.getBoundingClientRect().bottom.toFixed(2)) } : {}),
    }
  }, side)
}

function expectDesktopFlow(proof: FlowProof): void {
  expect(proof.alongside.length).toBeGreaterThan(0)
  expect(proof.below.length).toBeGreaterThan(0)
  expect(proof.gap).toBeGreaterThanOrEqual(15)
  expect(proof.widestBelow).toBeGreaterThan(proof.widestAlongside + 70)
  expect(proof.clearTop).toBeGreaterThanOrEqual(proof.floatRect.bottom - 1)
  expect(proof.afterWideTop).toBeGreaterThanOrEqual(proof.wideBottom - 1)
}

type MobileGeometry = {
  rootOuterWidth: number
  rootContentWidth: number
  rightWidth: number
  leftWidth: number
  wideWidth: number
  rightBottom: number
  rightTextTop: number
  leftBottom: number
  leftTextTop: number
  wideBottom: number
  wideTextTop: number
  floatRight: string
  floatLeft: string
  mediaEdgeOverflow: number
  pageOverflow: number
}

async function readMobileGeometry(page: Page): Promise<MobileGeometry> {
  return page.evaluate(() => {
    const root = document.querySelector('.travel-rich-text') as HTMLElement | null
    const right = root?.querySelector('figure.img-float-right') as HTMLElement | null
    const left = root?.querySelector('p.img-float-left') as HTMLElement | null
    const wide = root?.querySelector('.img-single-wide') as HTMLElement | null
    if (!root || !right || !left || !wide) throw new Error('mobile controls missing')

    const firstLineTop = (paragraph: Element | null) => {
      if (!paragraph) return NaN
      const range = document.createRange()
      range.selectNodeContents(paragraph)
      return Number((range.getClientRects()[0]?.top ?? NaN).toFixed(2))
    }
    const rootRect = root.getBoundingClientRect()
    const rootStyle = getComputedStyle(root)
    const contentLeft = rootRect.left + Number.parseFloat(rootStyle.paddingLeft)
    const contentRight = rootRect.right - Number.parseFloat(rootStyle.paddingRight)
    const mediaRects = [right, left, wide].map((element) => element.getBoundingClientRect())
    const round = (value: number) => Number(value.toFixed(2))

    return {
      rootOuterWidth: round(rootRect.width),
      rootContentWidth: round(contentRight - contentLeft),
      rightWidth: round(mediaRects[0].width),
      leftWidth: round(mediaRects[1].width),
      wideWidth: round(mediaRects[2].width),
      rightBottom: round(mediaRects[0].bottom),
      rightTextTop: firstLineTop(right.nextElementSibling),
      leftBottom: round(mediaRects[1].bottom),
      leftTextTop: firstLineTop(left.nextElementSibling),
      wideBottom: round(mediaRects[2].bottom),
      wideTextTop: firstLineTop(wide.nextElementSibling),
      floatRight: getComputedStyle(right).float,
      floatLeft: getComputedStyle(left).float,
      mediaEdgeOverflow: round(
        Math.max(
          0,
          contentLeft - Math.min(...mediaRects.map((rect) => rect.left)),
          Math.max(...mediaRects.map((rect) => rect.right)) - contentRight,
        ),
      ),
      pageOverflow: round(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    }
  })
}

function expectMobileStack(geometry: MobileGeometry): void {
  expect(geometry.rootContentWidth).toBeGreaterThan(0)
  expect(geometry.rootOuterWidth).toBeGreaterThan(geometry.rootContentWidth)
  expect(geometry.floatRight).toBe('none')
  expect(geometry.floatLeft).toBe('none')
  expect(geometry.rightTextTop).toBeGreaterThanOrEqual(geometry.rightBottom - 1)
  expect(geometry.leftTextTop).toBeGreaterThanOrEqual(geometry.leftBottom - 1)
  expect(geometry.wideTextTop).toBeGreaterThanOrEqual(geometry.wideBottom - 1)
  expect(geometry.rightWidth).toBeGreaterThanOrEqual(geometry.rootContentWidth * 0.9)
  expect(geometry.leftWidth).toBeGreaterThanOrEqual(geometry.rootContentWidth * 0.9)
  expect(geometry.wideWidth).toBeGreaterThanOrEqual(geometry.rootContentWidth * 0.9)
  expect(geometry.mediaEdgeOverflow).toBeLessThanOrEqual(1)
  expect(geometry.pageOverflow).toBeLessThanOrEqual(1)
}

function expectNoBrowserProblems(problems: BrowserProblems): void {
  expect(problems.consoleErrors).toEqual([])
  expect(problems.pageErrors).toEqual([])
  expect(problems.failedRequests).toEqual([])
  expect(problems.badResponses).toEqual([])
}

test.describe('#1602 rich-text single-image flow', () => {
  test.beforeAll(() => fs.mkdirSync(OUTPUT_DIR, { recursive: true }))

  test('desktop 1440 wraps left/right, clears headings and keeps wide media block', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const problems = collectBrowserProblems(page)
    await openWebFixture(page, 'light')

    const right = await readFlowProof(page, 'right')
    const left = await readFlowProof(page, 'left')
    expectDesktopFlow(right)
    expectDesktopFlow(left)
    expect(right.captionBottom).toBeLessThanOrEqual(right.floatRect.bottom)
    expect(await page.locator('.travel-rich-text figure.img-float-right').evaluate((node) => getComputedStyle(node).float)).toBe('right')
    expect(await page.locator('.travel-rich-text p.img-float-left').evaluate((node) => getComputedStyle(node).float)).toBe('left')

    await page.locator('.travel-rich-text').first().screenshot({ path: path.join(OUTPUT_DIR, 'desktop-1440-light.png') })
    fs.writeFileSync(path.join(OUTPUT_DIR, 'desktop-geometry.json'), JSON.stringify({ right, left }, null, 2))
    console.log(`[task-1602 desktop] ${JSON.stringify({ right, left })}`)
    expectNoBrowserProblems(problems)
  })

  test('mobile 390 stacks floats and text without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const problems = collectBrowserProblems(page)
    await openWebFixture(page, 'light')

    const geometry = await readMobileGeometry(page)
    expectMobileStack(geometry)

    await page.locator('.travel-rich-text').first().screenshot({ path: path.join(OUTPUT_DIR, 'mobile-390-light.png') })
    fs.writeFileSync(path.join(OUTPUT_DIR, 'mobile-geometry.json'), JSON.stringify(geometry, null, 2))
    console.log(`[task-1602 mobile] ${JSON.stringify(geometry)}`)
    expectNoBrowserProblems(problems)
  })

  test('dark theme preserves desktop and fresh mobile layout', async ({ context, page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const desktopProblems = collectBrowserProblems(page)
    await openWebFixture(page, 'dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expectDesktopFlow(await readFlowProof(page, 'right'))
    expectDesktopFlow(await readFlowProof(page, 'left'))
    await page.locator('.travel-rich-text').first().screenshot({ path: path.join(OUTPUT_DIR, 'desktop-1440-dark.png') })
    expectNoBrowserProblems(desktopProblems)

    const mobilePage = await context.newPage()
    try {
      await mobilePage.setViewportSize({ width: 390, height: 844 })
      const mobileProblems = collectBrowserProblems(mobilePage)
      await openWebFixture(mobilePage, 'dark')
      await expect(mobilePage.locator('html')).toHaveAttribute('data-theme', 'dark')
      expectMobileStack(await readMobileGeometry(mobilePage))
      await mobilePage.locator('.travel-rich-text').first().screenshot({
        path: path.join(OUTPUT_DIR, 'mobile-390-dark.png'),
      })
      expectNoBrowserProblems(mobileProblems)
    } finally {
      await mobilePage.close()
    }
  })

  test('print A4 uses ContentParser to BlockRenderer output without overlap or data loss', async ({ page }) => {
    const previousGlobals = {
      DOMParser: globalThis.DOMParser,
      Node: globalThis.Node,
      HTMLElement: globalThis.HTMLElement,
      document: globalThis.document,
    }
    const dom = new JSDOM('<!doctype html><html lang="ru"><body></body></html>')
    Object.assign(globalThis, {
      DOMParser: dom.window.DOMParser,
      Node: dom.window.Node,
      HTMLElement: dom.window.HTMLElement,
      document: dom.window.document,
    })
    let rendered = ''
    try {
      const renderer = new BlockRenderer(minimalTheme)
      const tail = Array.from(
        { length: 34 },
        (_, index) => `<p>Печатный хвост ${index + 1}: ${wrapText(`page-${index + 1}`).slice(0, 240)}</p>`,
      ).join('')
      rendered = renderer.renderRichText(`${descriptionFixture}${tail}<p>КОНЕЦ-ПЕЧАТНОГО-КОНТЕНТА</p>`)
    } finally {
      Object.assign(globalThis, previousGlobals)
      dom.window.close()
    }

    expect(rendered).toContain('class="pdf-rich-image img-float-right"')
    expect(rendered).toContain('class="pdf-rich-image img-float-left"')
    expect(rendered).toContain('class="pdf-rich-image img-single-wide"')
    expect(rendered).toContain('Подпись справа остаётся вместе с фотографией')
    expect(rendered).toContain('КОНЕЦ-ПЕЧАТНОГО-КОНТЕНТА')

    const html = buildPdfHtmlDocument({
      pages: [`<section class="pdf-page travel-content-page"><div class="description-block" style="padding:18mm 20mm">${rendered}</div></section>`],
      settings: { title: 'Task 1602 print proof' } as never,
      theme: minimalTheme,
      isPremium: true,
      escapeHtml: (value) =>
        String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;'),
    })
    const problems = collectBrowserProblems(page)
    await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
    await page.emulateMedia({ media: 'print' })
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    await page.locator('img').evaluateAll(async (images) => {
      await Promise.all(
        images
          .filter((image) => (image as HTMLElement).getAttribute('aria-hidden') !== 'true')
          .map((image) => (image as HTMLImageElement).decode()),
      )
    })
    expect(
      await page.locator('img:not([aria-hidden="true"])').evaluateAll((images) =>
        images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
      ),
    ).toBe(true)

    const right = await page.evaluate(() => {
      const float = document.querySelector('.description-block > .img-float-right') as HTMLElement | null
      const paragraph = float?.nextElementSibling as HTMLElement | null
      const heading = Array.from(document.querySelectorAll('.description-block > h3, .description-block > h4')).find((node) => node.textContent?.includes('правого')) as HTMLElement | undefined
      if (!float || !paragraph || !heading) throw new Error('print right flow missing')
      const range = document.createRange()
      range.selectNodeContents(paragraph)
      const imageRect = float.getBoundingClientRect()
      const lines = Array.from(range.getClientRects()).filter((rect) => rect.width > 1)
      const beside = lines.filter((rect) => rect.top < imageRect.bottom && rect.bottom > imageRect.top)
      const below = lines.filter((rect) => rect.top >= imageRect.bottom - 1)
      return {
        float: {
          top: Number(imageRect.top.toFixed(2)), left: Number(imageRect.left.toFixed(2)),
          right: Number(imageRect.right.toFixed(2)), bottom: Number(imageRect.bottom.toFixed(2)),
          width: Number(imageRect.width.toFixed(2)), height: Number(imageRect.height.toFixed(2)),
        },
        besideCount: beside.length,
        belowCount: below.length,
        gap: Number((imageRect.left - Math.max(...beside.map((rect) => rect.right))).toFixed(2)),
        widestBeside: Number(Math.max(...beside.map((rect) => rect.width)).toFixed(2)),
        widestBelow: Number(Math.max(...below.map((rect) => rect.width)).toFixed(2)),
        headingTop: Number(heading.getBoundingClientRect().top.toFixed(2)),
        caption: float.querySelector('figcaption')?.textContent?.trim() || '',
        contentPresent: document.body.textContent?.includes('КОНЕЦ-ПЕЧАТНОГО-КОНТЕНТА') || false,
        pageWidth: Number(document.querySelector('.pdf-page')!.getBoundingClientRect().width.toFixed(2)),
      }
    })
    expect(right.besideCount).toBeGreaterThan(0)
    expect(right.belowCount).toBeGreaterThan(0)
    expect(right.gap).toBeGreaterThanOrEqual(14.5)
    expect(right.widestBelow).toBeGreaterThan(right.widestBeside + 60)
    expect(right.headingTop).toBeGreaterThanOrEqual(right.float.bottom - 1)
    expect(right.caption).toContain('Подпись справа')
    expect(right.contentPresent).toBe(true)
    expect(right.pageWidth).toBeGreaterThan(790)
    expect(right.pageWidth).toBeLessThan(800)

    await page.screenshot({ path: path.join(OUTPUT_DIR, 'print-a4-preview.png'), fullPage: true })
    await page.pdf({ path: path.join(OUTPUT_DIR, 'print-a4.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true })
    fs.writeFileSync(path.join(OUTPUT_DIR, 'print-geometry.json'), JSON.stringify(right, null, 2))
    console.log(`[task-1602 print] ${JSON.stringify(right)}`)
    expectNoBrowserProblems(problems)
  })
})
