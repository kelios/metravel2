/**
 * @jest-environment node
 *
 * #2125 — в react-native-web `Alert.alert` — пустая функция
 * (`node_modules/react-native-web/dist/exports/Alert/index.js`: `static alert() {}`):
 * сообщение, отправленное через него на сайте, молча теряется. Сообщения идут
 * через `showToast` (`@/utils/toast`), вопросы — через `confirmAction`/`ConfirmDialog`.
 *
 * 1. Файлы печати и экспорта не зовут `Alert.alert` совсем — без исключений.
 * 2. Ратчет по всему продакшн-коду: файлы с `Alert.alert` — только из BASELINE,
 *    новый файл роняет тест; файл, из которого вызов ушёл, обязан уйти из
 *    BASELINE (список только сокращается — до пустого в #2127).
 *
 * Страж судит КОД, а не прозу (комментарии срезаны), на реальных файлах, и сам
 * проверен негативными пробами на реальном исходнике.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIRS = ['app', 'components', 'screens', 'hooks', 'context', 'utils', 'services', 'stores', 'api'];

export const ALERT_CALL = /\bAlert\s*\.\s*alert\b/;

/** Файлы печати и экспорта (#2102/#2125): Alert.alert запрещён без исключений. */
const PRINT_EXPORT_FILES = [
  'components/listTravel/ListTravelExportControls.tsx',
  'components/travel/ShareButtonsPdfExportBridge.tsx',
  'components/travel/hooks/useSingleTravelExport.ts',
  'components/quests/QuestPrintable.tsx',
  'utils/openBookPreviewWindow.ts',
];
const PRINT_EXPORT_DIRS = ['components/export', 'components/trips/planning/print', 'components/quests/printable'];

/**
 * Долг: web-достижимость вызова не установлена или вызов в native-only ветке —
 * разбор и перевод на showToast/confirmAction ведёт #2127 (инвентаризация 49 вызовов).
 * `components/travel/TravelPdfExportControl.tsx` — native-ветка экспорта, до #2119.
 */
const BASELINE = [
  'api/auth.ts',
  'components/article/ArticleEditor.ios.tsx',
  'components/article/ArticleEditor.web.effects.ts',
  'components/article/articleEditorMediaHelpers.ts',
  'components/article/articleEditorQuillHelpers.ts',
  'components/article/articleEditorUiHelpers.ts',
  'components/listTravel/hooks/useListTravelDelete.ts',
  'components/messages/MessageBubble.tsx',
  'components/messages/ThreadList.tsx',
  'components/quests/QuestFullMap.native.tsx',
  'components/quests/QuestFullMap.tsx',
  'components/quests/questWizardHelpers.ts',
  'components/screens/calendar/CalendarScreen.tsx',
  'components/travel/CompactSideBarTravel.tsx',
  'components/travel/ImageGalleryComponent.ios.tsx',
  'components/travel/TravelPdfExportControl.tsx',
  'components/travel/details/hooks/useTravelDetailsMapSectionModel.ts',
  'components/travel/stepRoute/NativePointList.tsx',
  'stores/authStore.ts',
  'utils/confirmAction.ts',
];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name.startsWith('.')) continue;
      walk(rel, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(rel);
    }
  }
  return out;
}

export function hasAlertCall(source: string): boolean {
  return ALERT_CALL.test(stripComments(source));
}

const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function printExportFiles(): string[] {
  const hooks = fs
    .readdirSync(path.join(ROOT, 'hooks'))
    .filter((f) => /^usePdfExport.*\.tsx?$/.test(f))
    .map((f) => `hooks/${f}`);
  const printAdapters = fs
    .readdirSync(path.join(ROOT, 'utils'))
    .filter((f) => /^printHtml.*\.tsx?$/.test(f))
    .map((f) => `utils/${f}`);
  const underDirs = PRINT_EXPORT_DIRS.flatMap((dir) => walk(dir));
  return [...new Set([...PRINT_EXPORT_FILES, ...hooks, ...printAdapters, ...underDirs])].sort();
}

describe('Web Alert governance (#2125)', () => {
  const printExport = printExportFiles();
  const withAlert = SRC_DIRS.flatMap((dir) => walk(dir)).filter((f) => hasAlertCall(read(f))).sort();

  it('охват: все входы в книгу, план и квест под стражем', () => {
    for (const f of [
      'hooks/usePdfExport.ts',
      'hooks/usePdfExportRuntime.ts',
      'utils/printHtml.web.ts',
      'utils/printHtml.native.ts',
      'components/export/BookSettingsModal.tsx',
      'components/trips/planning/print/printTripPlan.ts',
      ...PRINT_EXPORT_FILES,
    ]) {
      expect(fs.existsSync(path.join(ROOT, f))).toBe(true);
      expect(printExport).toContain(f);
    }
  });

  it.each(printExport)('%s: без Alert.alert (на web — пустая функция)', (file) => {
    expect(hasAlertCall(read(file))).toBe(false);
  });

  it('ратчет: новых файлов с Alert.alert нет', () => {
    expect(withAlert.filter((f) => !BASELINE.includes(f))).toEqual([]);
  });

  it('ратчет: в BASELINE нет мёртвых строк — переведённый файл уходит из списка', () => {
    expect(BASELINE.filter((f) => !withAlert.includes(f))).toEqual([]);
    expect(BASELINE.length).toBeLessThanOrEqual(20);
  });

  it('негативная проба: реальный usePdfExportRuntime.ts с возвращённым Alert.alert падает', () => {
    const real = read('hooks/usePdfExportRuntime.ts');
    expect(hasAlertCall(real)).toBe(false);
    expect(hasAlertCall(`${real}\nAlert.alert('Ошибка', 'x');`)).toBe(true);
    expect(hasAlertCall(`${real}\nAlert . alert('Ошибка');`)).toBe(true);
  });

  it('негативная проба: новый файл вне BASELINE с Alert.alert ловится ратчетом', () => {
    const synthetic = 'components/ui/NewScreen.tsx';
    const source = "import { Alert } from 'react-native';\nexport const f = () => Alert.alert('Готово');\n";
    expect(hasAlertCall(source)).toBe(true);
    expect(BASELINE).not.toContain(synthetic);
  });

  it('комментарий про Alert.alert не считается нарушением', () => {
    expect(hasAlertCall('// раньше Alert.alert(...)\nconst a = 1')).toBe(false);
    expect(hasAlertCall('/* Alert.alert на web пуст */ showToast({})')).toBe(false);
  });
});
