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
