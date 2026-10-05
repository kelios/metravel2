// src/services/pdf-export/themes/headingLevels.ts
// ✅ АРХИТЕКТУРА: Уровни заголовков, для которых тема описывает стиль

/**
 * Уровни заголовков со своим стилем в теме, по возрастанию. Единственный
 * источник: из списка выводятся ключи типографики темы (`h1`–`h4`) и уровень,
 * которым печатается заголовок без своего стиля.
 */
export const PDF_THEME_HEADING_LEVELS = [1, 2, 3, 4] as const;

export type PdfThemeHeadingLevel = (typeof PDF_THEME_HEADING_LEVELS)[number];

export type PdfThemeHeadingStyle = {
  size: string;
  weight: number;
  lineHeight: number;
  marginBottom: string;
};

/**
 * Стили заголовков в типографике темы
 */
export type PdfThemeHeadingTypography = Record<`h${PdfThemeHeadingLevel}`, PdfThemeHeadingStyle>;

const SMALLEST_THEME_HEADING_LEVEL = PDF_THEME_HEADING_LEVELS[PDF_THEME_HEADING_LEVELS.length - 1];

const isThemeHeadingLevel = (level: number): level is PdfThemeHeadingLevel =>
  (PDF_THEME_HEADING_LEVELS as readonly number[]).includes(level);

/**
 * Уровень, которым заголовок печатается в книге. Разметка описаний допускает
 * h1–h6, темы описывают меньше: уровень без стиля в теме печатается самым
 * мелким описанным (h5 и h6 — как h4).
 */
export function resolveThemeHeadingLevel(level: number): PdfThemeHeadingLevel {
  return isThemeHeadingLevel(level) ? level : SMALLEST_THEME_HEADING_LEVEL;
}
