// #2275: финальные градиенты сохраняют только непрозрачные цветовые stops.
// #2368: пастельный финал использует свою палитру без screen-композитинга.
import { RuntimeFinalRenderer } from '@/services/pdf-export/generators/v2/runtime/renderers/FinalPageRenderer'
import { PDF_THEMES } from '@/services/pdf-export/themes/PdfThemeConfig'
import type { TravelForBook } from '@/types/pdf-export'

const travels = [
  { countryName: 'Беларусь', number_days: 3, gallery: [{}, {}] },
  { countryName: 'Польша', number_days: 2, gallery: [{}] },
] as unknown as TravelForBook[]

const quote = { text: 'Раз в году посещай место, где ты никогда раньше не был', author: 'Далай-лама' }

/** Тело каждого `*-gradient(...)` с учётом вложенных скобок. */
function gradientBodies(html: string): string[] {
  const bodies: string[] = []
  const re = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/g
  for (let match = re.exec(html); match; match = re.exec(html)) {
    let depth = 1
    let end = re.lastIndex
    while (end < html.length && depth > 0) {
      if (html[end] === '(') depth += 1
      else if (html[end] === ')') depth -= 1
      end += 1
    }
    bodies.push(html.slice(re.lastIndex, end - 1))
  }
  return bodies
}

const NON_OPAQUE_STOP = /\btransparent\b|rgba\(\s*[^)]*,\s*(?!1(?:\.0*)?\s*\))[\d.]+\s*\)|hsla\(|#[0-9a-f]{8}\b|#[0-9a-f]{4}\b/i

describe('финальная страница книги: градиенты без полупрозрачных цветов (#2275)', () => {
  it.each(Object.keys(PDF_THEMES))('тема %s', (themeName) => {
    const theme = PDF_THEMES[themeName as keyof typeof PDF_THEMES]
    const html = new RuntimeFinalRenderer({ theme }).render(12, travels, quote)

    const gradients = gradientBodies(html)
    expect(gradients.length).toBeGreaterThan(0)
    expect(gradients.filter((body) => NON_OPAQUE_STOP.test(body))).toEqual([])
  })

  it('пастельный финал не зависит от screen-композитинга', () => {
    const html = new RuntimeFinalRenderer({ theme: PDF_THEMES.minimal }).render(12, travels, quote)

    expect(html).not.toContain('mix-blend-mode')
    expect(html).not.toContain('background-blend-mode')
    expect(html).not.toMatch(/z-index/)
  })

  // #2368: проверка обрезки воркера книги меряет текстовые узлы, а `<svg>` по
  // умолчанию `overflow: hidden` — надписи декора живут в HTML, не в SVG.
  it.each(Object.keys(PDF_THEMES))('тема %s: в SVG декора нет текста', (themeName) => {
    const theme = PDF_THEMES[themeName as keyof typeof PDF_THEMES]
    const html = new RuntimeFinalRenderer({ theme }).render(12, travels, quote)

    for (const svg of html.match(/<svg[\s\S]*?<\/svg>/g) ?? []) {
      expect(svg).not.toMatch(/<text\b|<textPath\b/)
      expect(svg.replace(/<[^>]*>/g, '').trim()).toBe('')
    }
  })

  // #2368: переполнение финала роняет сборку закреплённой книги в воркере
  // (SEGMENT_REQUIRES_SINGLE_SOURCE_LAYOUT). Колонка страницы держит запас тем,
  // что сжимается только эмблема; текстовый блок и штемпель не сжимаются.
  it('в колонке страницы сжимается только эмблема', () => {
    const html = new RuntimeFinalRenderer({ theme: PDF_THEMES.minimal }).render(12, travels, quote)
    const style = (marker: string): string => {
      const at = html.indexOf(marker)
      expect(at).toBeGreaterThan(-1)
      return html.slice(at, html.indexOf('">', at))
    }

    expect(style('class="final-emblem"')).toMatch(/min-height: 0;[\s\S]*flex-shrink: 1;/)
    expect(style('position: relative;\n          width: 100%;\n          margin: auto 0;')).toContain('flex-shrink: 0;')
    expect(style('<footer')).toContain('flex-shrink: 0;')
  })

  // #2368: декор читается на пастельном листе независимо от палитры обложки.
  it('декор использует контрастный цвет самого финального листа', () => {
    const html = new RuntimeFinalRenderer({ theme: PDF_THEMES.illustrated }).render(12, travels, quote)

    expect(PDF_THEMES.illustrated.colors.cover.text).toBe('#2d2d2d')
    expect(html).not.toMatch(/rgba\(255,\s*255,\s*255/)
    expect(html).toContain('rgba(51,65,85,')
  })

  it('регулярка ловит прежнюю подложку', () => {
    expect(NON_OPAQUE_STOP.test('circle at 50% 25%, rgba(255,255,255,0.08), transparent 36%')).toBe(true)
    expect(NON_OPAQUE_STOP.test('90deg, #000, rgb(140,140,140), #000')).toBe(false)
    expect(NON_OPAQUE_STOP.test('135deg, #8b6b5d 0%, #5c4f4d 100%')).toBe(false)
  })
})
