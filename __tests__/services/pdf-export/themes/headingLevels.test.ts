import {
  PDF_THEME_HEADING_LEVELS,
  resolveHeadingStyle,
  resolveSectionHeadingLevel,
} from '@/services/pdf-export/themes/headingLevels'
import { minimalTheme } from '@/services/pdf-export/themes/PdfThemeConfig'

describe('уровни заголовков книги', () => {
  it.each([...PDF_THEME_HEADING_LEVELS])('h%d берёт стиль из темы', (level) => {
    expect(resolveHeadingStyle(minimalTheme.typography, level)).toBe(minimalTheme.typography[`h${level}`])
  })

  it('h5 и h6 выводятся из темы: кегль основного и мелкого текста, остальное — от h4', () => {
    const { h4, body, small } = minimalTheme.typography
    const fromH4 = { weight: h4.weight, lineHeight: h4.lineHeight, marginBottom: h4.marginBottom }

    expect(resolveHeadingStyle(minimalTheme.typography, 5)).toEqual({ size: body.size, ...fromH4 })
    expect(resolveHeadingStyle(minimalTheme.typography, 6)).toEqual({ size: small.size, ...fromH4 })
  })

  it('ступень автора отсчитывается от названия блока: h1–h2 — первая, h3–h6 — вторая', () => {
    expect([1, 2, 3, 6].map((level) => resolveSectionHeadingLevel('recommendation', level))).toEqual([3, 3, 4, 4])
    expect([1, 2, 3, 6].map((level) => resolveSectionHeadingLevel('plus', level))).toEqual([5, 5, 6, 6])
  })
})
