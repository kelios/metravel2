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

  it.each([
    ['[data-header-logo-wordmark="true"]', 'display:none'],
    ['[data-header-logo-image="true"]', 'width:26px'],
    ['[data-header-slot="nav"]', 'display:none'],
    ['[data-header-slot="account"]', 'flex:1 1 0%'],
    ['[data-header-lang-chevron="true"]', 'display:none'],
    ['[data-testid="header-language-switcher"]', 'min-width:54px'],
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
