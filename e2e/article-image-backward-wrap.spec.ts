import Module from 'node:module'

import { expect, test, type Page } from '@playwright/test'

import { applyBackwardFloatWrap, applySmartImageLayout } from '../utils/richTextImageLayout'

// #1623: a single portrait after a long paragraph with nothing wrappable
// after it (heading/end of content) must swap before that paragraph so the
// existing #1602 float CSS gets real text to wrap, instead of leaving the
// paragraph stranded full-width above an unwrapped photo. This spec is
// self-contained (`page.setContent`, no app server/API) — same technique as
// `e2e/article-image-text-wrap.spec.ts` (#1602), reused rather than
// duplicated as a second mechanism.
const WEB_RICH_TEXT_CLASS = 'travel-rich-text'
const WEB_RICH_TEXT_FULL_WIDTH_CLASS = 'travel-rich-text--full-width'
const PORTRAIT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAeCAYAAAAsEj5rAAAARUlEQVR4Aa3BMQEAIAzAsK6aEIdyXmaiyZz7PiGJSUxiEpOYxCQmMYlJTGISk5jEJCYxiUlMYhKTmMQkJjGJSUxiEpPYAhQEAt2j2+xUAAAAAElFTkSuQmCC'

const longWrapText = (marker: string) =>
  Array.from(
    { length: 55 },
    (_, index) => `${marker}-${index + 1} длинный абзац о съёмках, продолжающий заполнять колонку текстом`,
  ).join(' ')

const shortText = 'Короткая подпись.'

// Real-world shape: `travel` id 642 (`adrshpashskie-skaly-v-chekhii-gde-snimali-narniiu`,
// present in the local prod-snapshot DB) has this exact authored order in its
// `description`: long paragraph -> single portrait (no explicit float side) -> heading.
const textThenPhotoThenHeadingFixture = `
  <h2>Съёмки Нарнии</h2>
  <p>${longWrapText('long')}</p>
  <p><img src="${PORTRAIT}" width="600" height="900" alt="Готические ворота" /></p>
  <h2>Адршпашский скальный город</h2>
  <p>Абзац после заголовка не должен обтекать фото выше.</p>
`

// Negative control: short preceding text stays a stacked/unwrapped case —
// the Task Contract lists "short text" as a control that must NOT swap.
const shortTextThenPhotoThenHeadingFixture = `
  <p>${shortText}</p>
  <p><img src="${PORTRAIT}" width="600" height="900" alt="Портрет без обтекания" /></p>
  <h2>Заголовок</h2>
`

// #1623 code-review-gate P1/P2 (blocking): interleaved article
// [A][photo1][M][photo2][heading]. photo1 already has a real forward wrap
// target (M) via the unmodified, persisted `applySmartImageLayout` output;
// the render-only backward wrap must NOT also hand M to photo2 (that would
// place both floats adjacent, and on the very next SAVE-time
// `applySmartImageLayout` pass they would be re-grouped into a paired grid,
// destroying the author-assigned sides — see `richTextImageLayoutBackwardWrap.test.ts`
// for the string-level mutation proof of that exact corruption).
const interleavedFixture = `
  <p>${longWrapText('A')}</p>
  <p class="img-float-right figure-portrait"><img src="${PORTRAIT}" width="600" height="900" alt="Фото 1" /></p>
  <p>${longWrapText('M')}</p>
  <p class="img-float-left figure-portrait"><img src="${PORTRAIT}" width="600" height="900" alt="Фото 2" /></p>
  <h2>Заголовок раздела</h2>
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
          select: <TChoice,>(choices: { web?: TChoice; default?: TChoice }) => choices.web ?? choices.default,
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

const { baseStyles, floatStyles, typographyStyles, responsiveStyles } = loadWithReactNativeWebPlatform(() => ({
  ...(require('../components/travel/stableContent/webStyles/base') as typeof import('../components/travel/stableContent/webStyles/base')),
  ...(require('../components/travel/stableContent/webStyles/floats') as typeof import('../components/travel/stableContent/webStyles/floats')),
  ...(require('../components/travel/stableContent/webStyles/typography') as typeof import('../components/travel/stableContent/webStyles/typography')),
  ...(require('../components/travel/stableContent/webStyles/responsive') as typeof import('../components/travel/stableContent/webStyles/responsive')),
}))

const COLORS = {
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
} as never

function buildFixtureHtml(description: string): string {
  const richTextStyles =
    baseStyles(COLORS, WEB_RICH_TEXT_CLASS, WEB_RICH_TEXT_FULL_WIDTH_CLASS) +
    floatStyles(COLORS, WEB_RICH_TEXT_CLASS) +
    typographyStyles(COLORS, WEB_RICH_TEXT_CLASS) +
    responsiveStyles(COLORS, WEB_RICH_TEXT_CLASS)
  // #1623: two-step pipeline matching production — the persisted transform
  // (`applySmartImageLayout`) runs first, then the render-only backward wrap
  // (`applyBackwardFloatWrap`) is applied on top, exactly as
  // `components/travel/StableContent.web.tsx` wires it.
  const transformed = applyBackwardFloatWrap(applySmartImageLayout(description))

  return `<!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <style>
          *, *::before, *::after { box-sizing: border-box; }
          body { margin: 0; min-width: 0; }
          .fixture-shell { min-width: 0; padding: 24px; }
          ${richTextStyles}
        </style>
      </head>
      <body>
        <main class="fixture-shell">
          <article class="${WEB_RICH_TEXT_CLASS}">${transformed}</article>
        </main>
      </body>
    </html>`
}

function collectBrowserProblems(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const failedRequests: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => pageErrors.push(e.message))
  page.on('requestfailed', (r) => failedRequests.push(`${r.method()} ${r.url()}`))
  return { consoleErrors, pageErrors, failedRequests }
}

async function readBackwardWrapProof(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('.travel-rich-text')
    if (!root) throw new Error('rich-text root missing')
    const float = root.querySelector('p.img-float-right, p.img-float-left') as HTMLElement | null
    if (!float) throw new Error('float missing')
    const paragraph = float.nextElementSibling as HTMLElement | null
    if (!paragraph || paragraph.tagName !== 'P') throw new Error('wrapping paragraph missing (swap did not happen)')
    const heading = Array.from(root.querySelectorAll('h2')).find((node) =>
      node.textContent?.includes('Адршпашский'),
    ) as HTMLElement | undefined
    if (!heading) throw new Error('boundary heading missing')

    const floatRect = float.getBoundingClientRect()
    const paragraphRange = document.createRange()
    paragraphRange.selectNodeContents(paragraph)
    const lines = Array.from(paragraphRange.getClientRects()).filter((rect) => rect.width > 1 && rect.height > 1)
    const alongside = lines.filter((rect) => rect.top < floatRect.bottom && rect.bottom > floatRect.top)
    const below = lines.filter((rect) => rect.top >= floatRect.bottom - 1)
    const overlap = alongside.some((rect) => rect.left < floatRect.right && rect.right > floatRect.left)

    return {
      floatBottom: Number(floatRect.bottom.toFixed(2)),
      alongsideCount: alongside.length,
      belowCount: below.length,
      overlap,
      headingTop: Number(heading.getBoundingClientRect().top.toFixed(2)),
      paragraphBottom: Number(paragraph.getBoundingClientRect().bottom.toFixed(2)),
    }
  })
}

async function readNegativeControlProof(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('.travel-rich-text')
    if (!root) throw new Error('rich-text root missing')
    const float = root.querySelector('p.img-float-right, p.img-float-left') as HTMLElement | null
    if (!float) throw new Error('float missing')
    const previous = float.previousElementSibling as HTMLElement | null
    const next = float.nextElementSibling as HTMLElement | null
    return {
      // Short text must stay the ORIGINAL order: paragraph stays before the
      // float (no swap), heading stays right after the float.
      previousIsShortParagraph: previous?.tagName === 'P',
      nextIsHeading: next?.tagName === 'H2',
    }
  })
}

async function readMobileNoOverlapProof(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('.travel-rich-text') as HTMLElement | null
    if (!root) throw new Error('rich-text root missing')
    const float = root.querySelector('p.img-float-right, p.img-float-left') as HTMLElement | null
    if (!float) throw new Error('float missing')
    const children = Array.from(root.children) as HTMLElement[]
    let overlapFound = false
    for (let index = 1; index < children.length; index += 1) {
      const prevRect = children[index - 1].getBoundingClientRect()
      const currRect = children[index].getBoundingClientRect()
      if (currRect.top < prevRect.bottom - 1) overlapFound = true
    }
    return {
      floatComputed: getComputedStyle(float).float,
      overlapFound,
      pageOverflow: Number(
        (document.documentElement.scrollWidth - document.documentElement.clientWidth).toFixed(2),
      ),
    }
  })
}

async function readInterleavedProof(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('.travel-rich-text')
    if (!root) throw new Error('rich-text root missing')
    const floats = Array.from(root.querySelectorAll('p.img-float-right, p.img-float-left')) as HTMLElement[]
    if (floats.length !== 2) throw new Error(`expected 2 floats, found ${floats.length}`)
    const [photo1, photo2] = floats
    const photo1Next = photo1.nextElementSibling as HTMLElement | null
    const photo2Next = photo2.nextElementSibling as HTMLElement | null
    return {
      photo1HasRight: photo1.classList.contains('img-float-right'),
      photo2HasLeft: photo2.classList.contains('img-float-left'),
      // photo1 must still wrap M — its own real, unmoved next sibling.
      photo1NextIsParagraph: photo1Next?.tagName === 'P',
      photo1NextText: photo1Next?.textContent?.slice(0, 1) ?? '',
      // photo1 and photo2 must NOT be adjacent siblings (that shape is what
      // collapses into a paired grid on the next persisted pass).
      floatsAdjacent: photo1Next === photo2,
      // photo2's own next sibling must be the heading (unchanged from
      // `applySmartImageLayout`'s output — nothing eligible to reclaim).
      photo2NextIsHeading: photo2Next?.tagName === 'H2',
    }
  })
}

test.describe('#1623 backward float wrap (text -> single portrait -> heading)', () => {
  for (const viewport of [
    { width: 1280, height: 1000, label: '1280' },
    { width: 1440, height: 1000, label: '1440' },
  ]) {
    test(`desktop ${viewport.label}: long paragraph wraps the photo, heading clears below`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      const problems = collectBrowserProblems(page)
      await page.setContent(buildFixtureHtml(textThenPhotoThenHeadingFixture), { waitUntil: 'load' })
      await page.locator('.travel-rich-text').screenshot({ path: `.codex-temp/task-1623/desktop-${viewport.label}.png` })

      const proof = await readBackwardWrapProof(page)
      expect(proof.alongsideCount, JSON.stringify(proof)).toBeGreaterThan(0)
      expect(proof.belowCount, JSON.stringify(proof)).toBeGreaterThan(0)
      expect(proof.overlap, JSON.stringify(proof)).toBe(false)
      expect(proof.headingTop).toBeGreaterThanOrEqual(
        Math.max(proof.floatBottom, proof.paragraphBottom) - 1,
      )
      expect(problems.consoleErrors).toEqual([])
      expect(problems.pageErrors).toEqual([])
      expect(problems.failedRequests).toEqual([])
    })
  }

  test('desktop 1440: short preceding text is a negative control (no swap)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const problems = collectBrowserProblems(page)
    await page.setContent(buildFixtureHtml(shortTextThenPhotoThenHeadingFixture), { waitUntil: 'load' })

    const proof = await readNegativeControlProof(page)
    expect(proof.previousIsShortParagraph, JSON.stringify(proof)).toBe(true)
    expect(proof.nextIsHeading, JSON.stringify(proof)).toBe(true)
    expect(problems.consoleErrors).toEqual([])
    expect(problems.pageErrors).toEqual([])
  })

  test('desktop 1440: interleaved [A][photo1][M][photo2][heading] keeps both floats apart and sides intact', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const problems = collectBrowserProblems(page)
    await page.setContent(buildFixtureHtml(interleavedFixture), { waitUntil: 'load' })

    const proof = await readInterleavedProof(page)
    expect(proof.photo1HasRight, JSON.stringify(proof)).toBe(true)
    expect(proof.photo2HasLeft, JSON.stringify(proof)).toBe(true)
    expect(proof.floatsAdjacent, JSON.stringify(proof)).toBe(false)
    expect(proof.photo1NextIsParagraph, JSON.stringify(proof)).toBe(true)
    expect(proof.photo1NextText, JSON.stringify(proof)).toBe('M')
    expect(proof.photo2NextIsHeading, JSON.stringify(proof)).toBe(true)
    expect(problems.consoleErrors).toEqual([])
    expect(problems.pageErrors).toEqual([])
  })

  test('mobile 390: photo and text stay single-column with no overlap or overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const problems = collectBrowserProblems(page)
    await page.setContent(buildFixtureHtml(textThenPhotoThenHeadingFixture), { waitUntil: 'load' })
    await page.locator('.travel-rich-text').screenshot({ path: '.codex-temp/task-1623/mobile-390.png' })

    const geometry = await readMobileNoOverlapProof(page)
    expect(geometry.floatComputed).toBe('none')
    expect(geometry.overlapFound, JSON.stringify(geometry)).toBe(false)
    expect(geometry.pageOverflow).toBeLessThanOrEqual(1)
    expect(problems.consoleErrors).toEqual([])
    expect(problems.pageErrors).toEqual([])
  })
})
