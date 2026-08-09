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
})
