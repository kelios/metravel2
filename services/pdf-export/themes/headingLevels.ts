// src/services/pdf-export/themes/headingLevels.ts
// ✅ АРХИТЕКТУРА: Уровни заголовков книги — шкала темы и понижение заголовков автора

/**
 * Уровни заголовков со своим стилем в теме, по возрастанию. Единственный
 * источник ключей типографики темы (`h1`–`h4`).
 */
export const PDF_THEME_HEADING_LEVELS = [1, 2, 3, 4] as const;

export type PdfThemeHeadingLevel = (typeof PDF_THEME_HEADING_LEVELS)[number];

/**
 * Печатная шкала книги: уровни темы и под ними две производные ступени (h5, h6)
 * для подзаголовков автора внутри блока, чьё название набрано уровнем h4.
 */
export const PDF_PRINT_HEADING_LEVELS = [...PDF_THEME_HEADING_LEVELS, 5, 6] as const;

export type PdfPrintHeadingLevel = (typeof PDF_PRINT_HEADING_LEVELS)[number];

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

type PdfHeadingStyleSource = PdfThemeHeadingTypography & {
  body: { size: string };
  small: { size: string };
};

const isThemeHeadingLevel = (level: number): level is PdfThemeHeadingLevel =>
  (PDF_THEME_HEADING_LEVELS as readonly number[]).includes(level);

/**
 * Стиль заголовка печатной шкалы. h1–h4 — из темы; h5 и h6 выводятся из неё же:
 * кегль основного и мелкого текста, насыщенность, интерлиньяж и отступ h4.
 * Поэтому производные ступени есть у любой темы без правки её конфига.
 */
export function resolveHeadingStyle(
  typography: PdfHeadingStyleSource,
  level: PdfPrintHeadingLevel
): PdfThemeHeadingStyle {
  if (isThemeHeadingLevel(level)) return typography[`h${level}`];
  const { h4 } = typography;
  const size = level === 5 ? typography.body.size : typography.small.size;
  return { size, weight: h4.weight, lineHeight: h4.lineHeight, marginBottom: h4.marginBottom };
}

/**
 * Rich-text блоки путешествия в книге и уровень, которым набрано название блока
 * (`travelContentPage.ts`): «Описание» и «Рекомендации» — h2, карточки «Плюсы» и
 * «Минусы» — стилем h4. Единственный список: по нему печатаются заголовки автора
 * и идут тесты; блок книги с заголовками автора вне списка не рендерится.
 */
export const PDF_RICH_TEXT_SECTION_TITLE_LEVELS = {
  description: 2,
  recommendation: 2,
  plus: 4,
  minus: 4,
} as const satisfies Record<string, PdfThemeHeadingLevel>;

export type PdfRichTextSection = keyof typeof PDF_RICH_TEXT_SECTION_TITLE_LEVELS;

export const PDF_RICH_TEXT_SECTIONS = Object.keys(
  PDF_RICH_TEXT_SECTION_TITLE_LEVELS
) as PdfRichTextSection[];

/**
 * Уровень, которым печатается заголовок автора внутри блока (#1296, #2255).
 * Ступень автора — h1 и h2 первая, h3–h6 вторая — отсчитывается вниз от
 * названия блока, поэтому заголовок автора всегда мельче названия своего блока.
 */
export function resolveSectionHeadingLevel(
  section: PdfRichTextSection,
  authorLevel: number
): PdfPrintHeadingLevel {
  const step = authorLevel <= 2 ? 1 : 2;
  return (PDF_RICH_TEXT_SECTION_TITLE_LEVELS[section] + step) as PdfPrintHeadingLevel;
}
