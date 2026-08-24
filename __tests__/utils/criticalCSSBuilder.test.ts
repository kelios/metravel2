import { Platform, StyleSheet } from 'react-native'

import { getThemedColors } from '@/constants/designSystem'
import { createStyles } from '@/screens/tabs/PlacesScreen.styles'
import { buildCriticalCSS } from '@/utils/criticalCSSBuilder'

// Регресс #1: широкое правило `[data-testid="travel-details-hero"] img{max-width:720px}`
// ловило каждый слой галереи. Резкий слой и blur-подложка обходят его инлайновым
// `max-width:none`, а blurhash-слой рисует expo-image — своих стилей у него нет,
// поэтому на desktop (контейнер 990-1400px) он зажимался в 720px, прижимался к левому
// краю и вместо кадра оставлял пустую полосу справа.
describe('buildCriticalCSS: правила hero не зажимают слои галереи', () => {
  const css = buildCriticalCSS()
  const heroImgRules = css
    .split('\n')
    .filter((line) => line.includes('[data-testid="travel-details-hero"]') && line.includes('img'))

  it('ограничивает ширину только LCP-картинке, а не всем img внутри hero', () => {
    expect(heroImgRules).not.toHaveLength(0)

    for (const rule of heroImgRules) {
      const selector = rule.slice(0, rule.indexOf('{'))
      // Селектор обязан быть прицельным: либо LCP-картинка, либо не про ширину вовсе.
      if (/max-width/.test(rule)) {
        expect(selector).toContain('img[data-lcp]')
      }
    }
  })

  it('не задаёт hero-картинкам max-width уже́ контейнера', () => {
    for (const rule of heroImgRules) {
      const maxWidth = rule.match(/max-width:\s*([^;}]+)/)?.[1]?.trim()
      if (!maxWidth) continue
      // `720px` и любой другой фиксированный потолок обрезает слой на широком экране.
      expect(maxWidth).not.toMatch(/^\d+px$/)
    }
  })

  it('возвращает blurhash-слою полную ширину контейнера', () => {
    expect(css).toContain(
      '[data-hero-data-placeholder="true"] img{width:100%;height:100%;max-width:none;aspect-ratio:auto;object-fit:cover}',
    )
  })
})

// #1298: шапка есть в статическом HTML, поэтому её первый кадр рисует браузер, а
// не React. `CustomHeader` отдаёт до гидратации desktop-геометрию строки, и
// единственное, что приводит её к мобильному виду раньше единого кадра React, —
// этот блок. Если он потеряется или разъедется с хуками `dataSet`, вернётся
// сдвиг логотипа 44x44 -> 115x44 и переключателя языка 624 -> 1167.
describe('buildCriticalCSS: до-гидрационная раскладка шапки', () => {
  const css = buildCriticalCSS()
  const block = css.slice(css.indexOf('@media (max-width:1279.98px){'))
  const mediaBlock = block.slice(0, block.indexOf('\n}') + 2)

  it('содержит media-блок мобильной шапки', () => {
    expect(css).toContain('@media (max-width:1279.98px){')
  })

  it('фиксирует desktop-высоту строки до регистрации атомарных стилей RNW', () => {
    expect(css).toContain('[data-header-inner="true"]{height:64px !important}')
  })

  it.each([
    ['[data-header-logo-wordmark="true"]', 'display:none'],
    ['[data-header-logo-image="true"]', 'width:26px'],
    ['[data-header-slot="nav"]', 'display:none'],
    ['[data-header-slot="account"]', 'flex:1 1 0%'],
    ['[data-header-lang-chevron="true"]', 'display:none'],
    ['[data-testid="header-language-switcher"]', 'min-width:54px'],
    ['[data-header-inner="true"]', 'height:56px'],
    ['[data-header-inner="true"]', 'padding:6px'],
    ['[data-testid="main-header"]', 'padding-bottom:6px'],
  ])('приводит %s к мобильной ветке (%s)', (selector, declaration) => {
    const rule = mediaBlock.split('\n').find((line) => line.trim().startsWith(selector))
    expect(rule).toBeDefined()
    expect(rule).toContain(declaration)
  })

  it('помечает каждое правило !important — иначе его перебьют атомарные классы RNW', () => {
    const rules = mediaBlock
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('[') && line.includes('{'))

    expect(rules).not.toHaveLength(0)
    for (const rule of rules) {
      expect(rule).toContain('!important')
    }
  })
})

// #1334: `/places` до гидратации не знает ширину и рисует обе шапки каталога.
// Выбор между ними делает только этот блок; без него компактная панель
// появлялась после гидратации и опускала каталог на 115 px (CLS 0,537).
describe('buildCriticalCSS: до-гидрационная раскладка /places', () => {
  const css = buildCriticalCSS()
  const mobileBlockStart = css.indexOf('@media (max-width:759.98px){')
  const mobileBlockTail = css.slice(mobileBlockStart)
  const mobileBlock = mobileBlockTail.slice(0, mobileBlockTail.indexOf('\n}') + 2)

  it.each([
    ['@media (max-width:759.98px){', '[data-testid="places-topbar"]{display:none !important}'],
    ['@media (min-width:760px){', '[data-testid="places-compact-bar"]{display:none !important}'],
  ])('в %s прячет вторую шапку (%s)', (media, rule) => {
    const block = css.slice(css.indexOf(media))
    const mediaBlock = block.slice(0, block.indexOf('\n}') + 2)

    expect(css).toContain(media)
    expect(mediaBlock).toContain(rule)
  })

  // Порог обязан совпадать с `isCompact = width < 760` в PlacesScreen: разъезд
  // вернёт кадр, где видны обе шапки или ни одной.
  it('держит порог 760 px в обеих ветках', () => {
    expect(css).toContain('@media (max-width:759.98px){')
    expect(css).toContain('@media (min-width:760px){')
  })

  it.each([
    ['[data-testid="places-layout"][data-places-prehydration="true"]', 'min-height:calc(100vh - 179px)'],
    ['[data-places-prehydration="true"] [data-testid="places-sidebar"]', 'display:none'],
    ['[data-places-prehydration="true"] [data-testid="places-main"]', 'padding:12px 24px 32px'],
    ['[data-places-prehydration="true"] [data-testid="places-results-title"]', 'font-size:17px'],
    ['[data-places-prehydration="true"] [data-testid="places-sort-select"]', 'min-height:44px'],
    ['[data-places-prehydration="true"] [data-testid="places-cards-grid"]', 'flex-direction:column'],
    ['[data-places-prehydration="true"] [data-testid^="places-skeleton-card-"]', 'flex-basis:auto'],
  ])('фиксирует mobile first-paint геометрию %s (%s)', (selector, declaration) => {
    const rule = mobileBlock
      .split('\n')
      .find((line) => line.trim().startsWith(selector))

    expect(rule).toBeDefined()
    expect(rule).toContain(declaration)
    expect(rule).toContain('!important')
  })

  it('не оставляет sidebar скрытым после гидратации', () => {
    expect(mobileBlock).not.toContain('\n  [data-testid="places-sidebar"]{display:none')
    expect(mobileBlock).toContain(
      '[data-places-prehydration="true"] [data-testid="places-sidebar"]{display:none !important}',
    )
  })
})

// #1334 (регресс-контроль). Правила выше — это ручная копия мобильной ветки
// `PlacesScreen.styles`. Пока значения совпадают, первый кадр статического HTML
// и кадр после гидратации имеют одну геометрию, и CLS `/places` держится на
// 0,0025 (замер прода 2026-08-10, 5/5 прогонов, mobile 412x823, CPU 4x).
// Разъезд любого числа возвращает исходный дефект: каталог 412x628 -> 412x444 и
// CLS 0,519. Ассерты ниже сравнивают CSS не с литералом, а с реальным стилем —
// иначе правка `PlacesScreen.styles` проходит CI молча.
describe('buildCriticalCSS: до-гидрационные размеры /places равны мобильным стилям экрана', () => {
  const css = buildCriticalCSS()
  const mobileBlockTail = css.slice(css.indexOf('@media (max-width:759.98px){'))
  const mobileBlock = mobileBlockTail.slice(0, mobileBlockTail.indexOf('\n}') + 2)

  const originalOS = Platform.OS
  beforeAll(() => {
    // `layout.minHeight` живёт под `Platform.OS === 'web'`: на других платформах
    // резервации нет и сравнивать было бы нечего.
    ;(Platform as unknown as { OS: string }).OS = 'web'
  })
  afterAll(() => {
    ;(Platform as unknown as { OS: string }).OS = originalOS
  })

  const compactStyles = () => createStyles(getThemedColors(false), true, false)
  const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>
  /** `margin-top:0` и `0px` — одно и то же значение, сравнивать их как строки нельзя. */
  const px = (value: unknown) => (Number(value) === 0 ? '0' : `${value}px`)
  const asPx = (declared: string) => (Number.parseFloat(declared) === 0 ? '0' : declared)

  /** Разбирает объявления одного правила критического CSS в карту свойств. */
  const declarationsOf = (selector: string): Record<string, string> => {
    const line = mobileBlock.split('\n').find((entry) => entry.trim().startsWith(selector))
    if (!line) throw new Error(`критический CSS потерял правило «${selector}»`)
    const body = line.slice(line.indexOf('{') + 1, line.lastIndexOf('}'))
    return Object.fromEntries(
      body
        .split(';')
        .filter(Boolean)
        .map((declaration) => {
          const colon = declaration.indexOf(':')
          return [
            declaration.slice(0, colon).trim(),
            declaration.slice(colon + 1).replace('!important', '').trim(),
          ]
        }),
    ) as Record<string, string>
  }

  it('резервирует ту же высоту каталога, что и мобильная ветка стилей', () => {
    const declared = declarationsOf('[data-testid="places-layout"][data-places-prehydration="true"]')
    const layout = flat(compactStyles().layout)

    expect(declared['min-height']).toBe(layout.minHeight)
    expect(declared['flex-direction']).toBe(layout.flexDirection)
    expect(asPx(declared['margin-top'])).toBe(px(layout.marginTop))
  })

  it('повторяет отступы и шаг колонки результатов', () => {
    const declared = declarationsOf('[data-places-prehydration="true"] [data-testid="places-main"]')
    const main = flat(compactStyles().main)

    expect(declared.padding).toBe(
      `${main.paddingTop}px ${main.paddingHorizontal}px ${main.paddingBottom}px`,
    )
    expect(declared.gap).toBe(`${main.gap}px`)
  })

  it('повторяет типографику заголовка результатов', () => {
    const declared = declarationsOf(
      '[data-places-prehydration="true"] [data-testid="places-results-title"]',
    )
    const title = flat(compactStyles().resultsTitle)

    expect(declared['font-size']).toBe(`${title.fontSize}px`)
    expect(declared['line-height']).toBe(`${title.lineHeight}px`)
    expect(declared['letter-spacing']).toBe(`${title.letterSpacing}px`)
    expect(declared['font-weight']).toBe(String(title.fontWeight))
  })

  it('повторяет размер контрола сортировки', () => {
    const declared = declarationsOf(
      '[data-places-prehydration="true"] [data-testid="places-sort-select"]',
    )
    const sortSelect = flat(compactStyles().sortSelect)

    expect(declared['min-height']).toBe(`${sortSelect.minHeight}px`)
    expect(declared['padding-left']).toBe(`${sortSelect.paddingHorizontal}px`)
    expect(declared['padding-right']).toBe(`${sortSelect.paddingHorizontal}px`)
  })

  it('повторяет раскладку сетки карточек и ширину слота', () => {
    const grid = declarationsOf('[data-places-prehydration="true"] [data-testid="places-cards-grid"]')
    const gridStyle = flat(compactStyles().cardsGrid)

    expect(grid['flex-direction']).toBe(gridStyle.flexDirection)
    expect(grid['flex-wrap']).toBe(gridStyle.flexWrap)
    expect(grid.gap).toBe(`${gridStyle.gap}px`)

    const slot = declarationsOf(
      '[data-places-prehydration="true"] [data-testid^="places-skeleton-card-"]',
    )
    const card = flat(compactStyles().card)

    expect(slot.width).toBe(card.width)
    expect(slot['flex-grow']).toBe(String(card.flexGrow))
    expect(slot['flex-shrink']).toBe(String(card.flexShrink))
    expect(slot['flex-basis']).toBe(card.flexBasis)
  })
})

// #1479: `content-visibility:auto` на блоке ПЕРВОГО экрана travel-detail —
// единственный источник CLS на странице статьи. Пропускать рендер там нечего
// (mobile 412x823: блок на y=675, то есть в стартовом вьюпорте), а вот
// перещёлкивание между `contain-intrinsic-size` и реальной высотой двигает всё
// нижележащее. Замер на живом проде: с правилом CLS 0.01110 и два сдвига по
// 0.005551 в 3/3 итерациях, без правила — 0.00000 и ноль сдвигов в 3/3.
describe('buildCriticalCSS: первый экран travel-detail не пропускает рендер', () => {
  const css = buildCriticalCSS()

  const declarationsFor = (selector: string) =>
    css
      .split('\n')
      .filter((line) => line.trim().startsWith(`${selector}{`))
      .join(' ')

  it('не вешает content-visibility на quick-facts', () => {
    const rule = declarationsFor('[data-testid="travel-details-quick-facts"]')

    expect(rule).not.toMatch(/content-visibility/)
    expect(rule).not.toMatch(/contain-intrinsic-size/)
  })

  it('оставляет content-visibility только заведомо нижним секциям', () => {
    const skipped = css
      .split('\n')
      .filter((line) => line.includes('content-visibility:auto'))
      .map((line) => line.slice(0, line.indexOf('{')))

    // Регрессия ловится по составу списка: любой новый первый экран travel
    // должен попасть сюда осознанно, а не приехать вместе с чужой правкой.
    expect(skipped).toEqual(
      expect.arrayContaining([
        '[data-testid="travel-details-description"]',
        '[data-testid="travel-details-map"]',
        '[data-testid="travel-details-points"]',
      ]),
    )
    expect(skipped).not.toContain('[data-testid="travel-details-quick-facts"]')
  })
})
