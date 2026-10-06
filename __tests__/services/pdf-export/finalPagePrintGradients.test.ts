// #2275: печать WebKit (iOS, Safari) теряет альфу у цветов CSS-градиентов —
// подложка финальной страницы с `rgba(255,255,255,0.08) → transparent`
// печаталась непрозрачным белым кругом на чёрной странице. Градиенты финальной
// страницы обязаны состоять из непрозрачных цветов; полупрозрачность — через
// `mix-blend-mode: screen`.
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

  it('светлые слои наложены через screen, а карточка без z-index не изолирует их', () => {
    const html = new RuntimeFinalRenderer({ theme: PDF_THEMES.minimal }).render(12, travels, quote)

    expect((html.match(/mix-blend-mode: screen;/g) ?? []).length).toBe(3)
    expect(html).not.toMatch(/z-index/)
  })

  it('регулярка ловит прежнюю подложку', () => {
    expect(NON_OPAQUE_STOP.test('circle at 50% 25%, rgba(255,255,255,0.08), transparent 36%')).toBe(true)
    expect(NON_OPAQUE_STOP.test('90deg, #000, rgb(140,140,140), #000')).toBe(false)
    expect(NON_OPAQUE_STOP.test('135deg, #8b6b5d 0%, #5c4f4d 100%')).toBe(false)
  })
})
