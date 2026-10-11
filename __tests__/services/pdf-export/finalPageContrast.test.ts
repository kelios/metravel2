import { RuntimeFinalRenderer } from '@/services/pdf-export/generators/v2/runtime/renderers/FinalPageRenderer'
import { PDF_THEMES } from '@/services/pdf-export/themes/PdfThemeConfig'
import type { TravelForBook } from '@/types/pdf-export'
import { i18n, translate } from '@/i18n'

const travels = [{ countryName: 'Беларусь', number_days: 3, gallery: [{}, {}] }] as unknown as TravelForBook[]
const headingKey = 'export:services.pdf_export.generators.v2.runtime.renderers.FinalPageRenderer.section_class_pdf_page_final_page_style_padd_473b31a3.text01'

const luminance = (hex: string): number => {
  const channels = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

const contrast = (foreground: string, background: string): number => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

function expectReadableFinal(html: string): void {
  const root = new DOMParser().parseFromString(html, 'text/html').querySelector('section')!
  const background = root.getAttribute('style')!.match(/background:\s*linear-gradient\(([^;]*)/i)![1]
  const backgrounds = background.match(/#[0-9a-f]{6}/gi)!
  expect(backgrounds.length).toBeGreaterThanOrEqual(2)
  for (const element of [root, ...Array.from(root.querySelectorAll('[style]'))]) {
    const color = element.getAttribute('style')?.match(/(?:^|;)\s*color:\s*(#[0-9a-f]{6})\s*;/i)?.[1]
    if (!color) continue
    for (const stop of backgrounds) expect(contrast(color, stop)).toBeGreaterThanOrEqual(4.5)
  }
  expect(root.querySelector('h2')?.textContent).toBe(translate(headingKey))
  expect(root.textContent).not.toMatch(/services\.pdf_export|undefined|NaN/)
  expect(html).not.toContain('mix-blend-mode')
  expect(html).not.toContain('background-blend-mode')
}

describe('final postcard contrast', () => {
  const originalLocale = i18n.resolvedLanguage || 'ru'
  afterAll(async () => { await i18n.changeLanguage(originalLocale) })

  it.each(Object.entries(PDF_THEMES).flatMap(([name, theme]) =>
    ['ru', 'be', 'uk', 'pl', 'en'].map((locale) => [name, locale, theme] as const)
  ))('%s/%s: every informational color contrasts with the final background', async (_name, locale, theme) => {
    await i18n.changeLanguage(locale)
    expectReadableFinal(new RuntimeFinalRenderer({ theme }).render(12, travels))
  })

  it('is independent of arbitrary near-white cover colors', () => {
    const theme = { ...PDF_THEMES.dark, colors: {
      ...PDF_THEMES.dark.colors,
      cover: { ...PDF_THEMES.dark.colors.cover, text: '#fefdfa', textSecondary: '#f5f4f1' },
    } }
    expectReadableFinal(new RuntimeFinalRenderer({ theme }).render(12, travels))
  })

  it('preserves pinned statistics, escaped quote, year and optional absence', () => {
    const renderer = new RuntimeFinalRenderer({ theme: PDF_THEMES.dark })
    const html = renderer.render(12, [], { text: '<quoted> & safe', author: 'Author <one>' }, {
      summary: { travels: 7, countries: 3, days: 12, photos: 29 }, generatedAt: '2024-12-31T22:00:00Z',
    })
    const root = new DOMParser().parseFromString(html, 'text/html')
    expect(root.querySelectorAll('.final-summary-tile')).toHaveLength(4)
    for (const value of [7, 3, 12, 29]) expect(root.body.textContent).toContain(String(value))
    expect(html).toContain('&lt;quoted&gt; &amp; safe')
    expect(html).toContain('Author &lt;one&gt;')
    expect(html).toContain('© 2024')
    expect(html).toContain('height: 285mm;')
    const empty = renderer.render(1)
    expect(empty).not.toContain('final-summary-tile')
    expect(empty).not.toContain('<blockquote')
    expectReadableFinal(empty)
  })
})
