import { PDF_THEME_HEADING_LEVELS, resolveThemeHeadingLevel } from '@/services/pdf-export/themes/headingLevels'

describe('уровни заголовков темы', () => {
  it.each([...PDF_THEME_HEADING_LEVELS])('h%d описан темой и печатается своим уровнем', (level) => {
    expect(resolveThemeHeadingLevel(level)).toBe(level)
  })

  // 7 — не уровень разметки: его даёт понижение h6 на ступень в описании путешествия.
  it.each([5, 6, 7])('уровень %d без стиля в теме печатается самым мелким описанным', (level) => {
    expect(resolveThemeHeadingLevel(level)).toBe(Math.max(...PDF_THEME_HEADING_LEVELS))
  })
})
