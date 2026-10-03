/**
 * @jest-environment node
 *
 * #2102 — печать в приложениях: одна точка `utils/printHtml`.
 *
 * Файлы печати (построители HTML, кнопки, хуки экспорта) не зовут `window.print`
 * и не прячутся проверкой `Platform.OS !== 'web'`: платформу решает адаптер
 * `utils/printHtml.web.ts` / `.native.ts`, а кнопка печати в документе помечается
 * `data-print-action`. Страж судит код (комментарии срезаны) и проверен на
 * реальном исходнике файла печати с внесённым нарушением.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

export const DIRECT_PRINT = /\b(?:window|self|globalThis)\s*\.\s*print\b|\bonclick\s*=\s*["'][^"']*\bprint\s*\(/i;
export const WEB_ONLY_GATE = /Platform\s*\.\s*OS\s*!==?\s*['"]web['"]/;

const SINGLE_FILES = [
  'components/quests/QuestPrintable.tsx',
  'components/listTravel/ListTravelExportControls.tsx',
];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

/** Файлы печати: components/**\/print/**, printable/, QuestPrintable, usePdfExport*, ListTravelExportControls. */
function printFiles(): string[] {
  const underPrintDir = walk('components').filter((f) => /\/(?:print|printable)\//.test(f));
  const hooks = fs.readdirSync(path.join(ROOT, 'hooks')).filter((f) => /^usePdfExport.*\.tsx?$/.test(f)).map((f) => `hooks/${f}`);
  return [...new Set([...underPrintDir, ...SINGLE_FILES, ...hooks])].sort();
}

export function findPrintViolations(source: string): string[] {
  const code = stripComments(source);
  const found: string[] = [];
  if (DIRECT_PRINT.test(code)) found.push('window.print вне utils/printHtml.web.ts');
  if (WEB_ONLY_GATE.test(code)) found.push("Platform.OS !== 'web' в файле печати");
  return found;
}

describe('Print governance (#2102)', () => {
  const files = printFiles();

  it('охват: все пять точек печати под стражем', () => {
    for (const f of [
      'components/trips/planning/print/TripPlanPrintButton.tsx',
      'components/trips/planning/print/printTripPlan.ts',
      'components/trips/planning/print/tripPlanPrintHtml.ts',
      'components/quests/QuestPrintable.tsx',
      'components/listTravel/ListTravelExportControls.tsx',
      'hooks/usePdfExport.ts',
      'hooks/usePdfExportRuntime.ts',
    ]) {
      expect(files).toContain(f);
    }
  });

  it.each(files)('%s: без window.print и Platform.OS !== web', (file) => {
    expect(findPrintViolations(fs.readFileSync(path.join(ROOT, file), 'utf8'))).toEqual([]);
  });

  it('негативная проба: реальный QuestPrintable.tsx с window.print() или платформенным запретом падает', () => {
    const real = fs.readFileSync(path.join(ROOT, 'components/quests/QuestPrintable.tsx'), 'utf8');
    expect(findPrintViolations(real)).toEqual([]);
    expect(findPrintViolations(`${real}\nwindow.print();`)).toEqual(['window.print вне utils/printHtml.web.ts']);
    expect(findPrintViolations(real.replace('data-print-action', 'onclick="window.print()"'))).toEqual([
      'window.print вне utils/printHtml.web.ts',
    ]);
    expect(findPrintViolations(`${real}\nif (Platform.OS !== 'web') return;`)).toEqual([
      "Platform.OS !== 'web' в файле печати",
    ]);
  });

  it('комментарий про window.print не считается нарушением, а адаптер — единственный владелец', () => {
    expect(findPrintViolations('// раньше window.print()\nconst a = 1')).toEqual([]);
    const web = fs.readFileSync(path.join(ROOT, 'utils/printHtml.web.ts'), 'utf8');
    expect(DIRECT_PRINT.test(stripComments(web))).toBe(true);
    const native = fs.readFileSync(path.join(ROOT, 'utils/printHtml.native.ts'), 'utf8');
    expect(DIRECT_PRINT.test(stripComments(native))).toBe(false);
  });
});
