// __tests__/services/pdf-export/themes/themeFontsInLink.test.ts
// Dev-guard (#302 BOOK-Q4): каждая тема обязана объявлять основной шрифт,
// который реально подключён в Google Fonts <link> документа печати.
// Иначе браузер молча подставляет fallback (Georgia/system) и кириллица ломается.
import { PDF_THEMES } from '../../../../services/pdf-export/themes/PdfThemeConfig';
import type { PdfThemeName } from '../../../../services/pdf-export/themes/types';
import { buildPdfHtmlDocument } from '../../../../services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup/htmlDocument';

// Семейства, которые НЕ грузятся через Google Fonts (системные / web-safe / mono).
// Их присутствие в <link> не требуется.
const SYSTEM_FAMILIES = new Set<string>([
  'system-ui',
  '-apple-system',
  'blinkmacsystemfont',
  'segoe ui',
  'arial',
  'arial black',
  'helvetica',
  'georgia',
  'times new roman',
  'impact',
  'courier new',
  'jetbrains mono',
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'noto sans',
]);

/** Берёт первое (приоритетное) семейство из CSS font-family стека, без кавычек. */
function primaryFamily(fontStack: string): string {
  const first = fontStack.split(',')[0] ?? '';
  return first.replace(/['"]/g, '').trim();
}

function extractFontLinkHref(html: string): string {
  const match = html.match(
    /<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"[^>]*>/,
  );
  if (!match) throw new Error('Google Fonts <link> не найден в документе печати');
  return decodeURIComponent(match[1]);
}

/** Имена семейств, объявленные в CSS2 URL (family=Foo+Bar -> "foo bar"). */
function familiesInLink(href: string): Set<string> {
  const families = new Set<string>();
  const re = /family=([^:&]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(href)) !== null) {
    families.add(m[1].replace(/\+/g, ' ').toLowerCase());
  }
  return families;
}

function renderDocument(themeName: PdfThemeName): string {
  return buildPdfHtmlDocument({
    pages: ['<section class="pdf-page"></section>'],
    settings: { title: 'Test' } as never,
    theme: PDF_THEMES[themeName],
    isPremium: true,
    escapeHtml: (v) => String(v ?? ''),
  });
}

describe('BOOK-Q4 dev-guard: основной шрифт каждой темы подключён в <link>', () => {
  const themeNames = Object.keys(PDF_THEMES) as PdfThemeName[];
  const linkFamilies = familiesInLink(extractFontLinkHref(renderDocument('light')));

  it.each(themeNames)('тема "%s": headingFont и bodyFont в Google Fonts <link>', (themeName) => {
    const theme = PDF_THEMES[themeName];
    const fields: Array<['headingFont' | 'bodyFont', string]> = [
      ['headingFont', theme.typography.headingFont],
      ['bodyFont', theme.typography.bodyFont],
    ];

    const missing: string[] = [];
    for (const [field, stack] of fields) {
      const family = primaryFamily(stack);
      if (SYSTEM_FAMILIES.has(family.toLowerCase())) continue;
      if (!linkFamilies.has(family.toLowerCase())) {
        missing.push(`${field}="${family}"`);
      }
    }
    // Если падает: добавь семейство в htmlDocument.ts <link> или замени
    // на подключённое (с кириллицей). См. #302 BOOK-Q4.
    expect({ theme: themeName, missing }).toEqual({ theme: themeName, missing: [] });
  });

  it('<link> не зависит от выбранной темы (общий набор шрифтов)', () => {
    const fromAnother = familiesInLink(extractFontLinkHref(renderDocument('watercolor')));
    expect([...fromAnother].sort()).toEqual([...linkFamilies].sort());
  });
});
