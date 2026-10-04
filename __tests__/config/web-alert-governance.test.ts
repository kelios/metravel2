/**
 * @jest-environment node
 *
 * #2125/#2127 — в react-native-web `Alert.alert` — пустая функция
 * (`node_modules/react-native-web/dist/exports/Alert/index.js`: `static alert() {}`):
 * сообщение, отправленное через него на сайте, молча теряется. Один канал на все
 * платформы: сообщение — `showToast` (`@/utils/toast`), вопрос — `confirmAction`
 * (`utils/confirmAction.ts`: web `ConfirmDialog`, native системный Alert), меню
 * действий — `ActionListSheet`.
 *
 * 1. `Alert.alert` в продакшн-коде — только внутри `confirmAction` (его native-ветка).
 * 2. Блокирующие окна браузера `window.alert(`, `window.confirm(` и голый `alert(`
 *    запрещены без исключений (тот же класс, что #1555/#1556).
 * 3. Слой `api/**` не импортирует `Alert`: интерфейс показывает экран, api
 *    возвращает причину (#1944, #2127).
 *
 * Baseline долга пуст (#2127 перевёл 49 вызовов в 20 файлах). Страж судит КОД, а
 * не прозу (комментарии срезаны), на реальных файлах, и сам проверен
 * негативными пробами на реальном исходнике.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIRS = ['app', 'components', 'screens', 'hooks', 'context', 'utils', 'services', 'stores', 'api'];

export const ALERT_CALL = /\bAlert\s*\.\s*alert\b/;
export const BROWSER_DIALOG = /\b(?:window|globalThis|self)\s*\.\s*(?:alert|confirm)\b|(?<![\w$])(?<!\.\s*)alert\s*\(/;
export const ALERT_IMPORT = /import\s*\{[^}]*\bAlert\b[^}]*\}\s*from\s*['"]react-native['"]/;

/** Единственный владелец системного Alert: native-ветка вопроса с выбором. */
const ALERT_OWNERS: Record<string, string> = {
  'utils/confirmAction.ts': 'native-ветка confirmAction — системный Alert с двумя кнопками',
};

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

export function findAlertViolations(file: string, source: string): string[] {
  const code = stripComments(source);
  const found: string[] = [];
  if (ALERT_CALL.test(code) && !ALERT_OWNERS[file]) found.push('Alert.alert вне confirmAction');
  if (BROWSER_DIALOG.test(code)) found.push('блокирующее окно браузера (window.alert / window.confirm / alert)');
  if (file.startsWith('api/') && ALERT_IMPORT.test(code)) found.push('api/** импортирует Alert');
  return found;
}

const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Web Alert governance (#2125, #2127)', () => {
  const files = SRC_DIRS.flatMap((dir) => walk(dir)).sort();

  it('охват: печать, экспорт, auth, сообщения и владелец confirmAction под стражем', () => {
    for (const f of [
      'hooks/usePdfExport.ts',
      'hooks/usePdfExportRuntime.ts',
      'api/auth.ts',
      'stores/authStore.ts',
      'components/messages/MessageBubble.tsx',
      'components/quests/QuestFullMap.native.tsx',
      'components/travel/ImageGalleryComponent.ios.tsx',
      'utils/confirmAction.ts',
    ]) {
      expect(files).toContain(f);
    }
  });

  it('в продакшн-коде нет Alert.alert вне confirmAction, окон браузера и Alert в api/**', () => {
    const violations = files
      .map((file) => ({ file, found: findAlertViolations(file, read(file)) }))
      .filter((entry) => entry.found.length > 0);
    expect(violations).toEqual([]);
  });

  it('владелец исключения существует и действительно зовёт Alert.alert (нет мёртвых исключений)', () => {
    for (const file of Object.keys(ALERT_OWNERS)) {
      expect(ALERT_CALL.test(stripComments(read(file)))).toBe(true);
    }
  });

  it('негативная проба: Alert.alert в реальном экране и window.alert в реальном хуке ловятся', () => {
    const screen = 'components/messages/ThreadList.tsx';
    const realScreen = read(screen);
    expect(findAlertViolations(screen, realScreen)).toEqual([]);
    expect(findAlertViolations(screen, `${realScreen}\nAlert.alert('Готово');`)).toEqual(['Alert.alert вне confirmAction']);
    expect(findAlertViolations(screen, `${realScreen}\nAlert . alert('Готово');`)).toEqual(['Alert.alert вне confirmAction']);

    const hook = 'hooks/usePdfExport.ts';
    const realHook = read(hook);
    expect(findAlertViolations(hook, realHook)).toEqual([]);
    expect(findAlertViolations(hook, `${realHook}\nwindow.alert('x');`)).toHaveLength(1);
    expect(findAlertViolations(hook, `${realHook}\nwindow.confirm?.('x');`)).toHaveLength(1);
    expect(findAlertViolations(hook, `${realHook}\nalert('x');`)).toHaveLength(1);
  });

  it('негативная проба: новый файл с Alert.alert и api с импортом Alert ловятся', () => {
    expect(
      findAlertViolations('components/ui/NewScreen.tsx', "import { Alert } from 'react-native';\nAlert.alert('x');"),
    ).toEqual(['Alert.alert вне confirmAction']);
    const api = 'api/auth.ts';
    expect(findAlertViolations(api, `import { Alert, Platform } from 'react-native';\n${read(api)}`)).toEqual([
      'api/** импортирует Alert',
    ]);
  });

  it('комментарии и похожие имена не считаются нарушением', () => {
    const file = 'components/ui/Probe.tsx';
    expect(findAlertViolations(file, '// раньше Alert.alert(...) и window.alert(...)\nconst a = 1')).toEqual([]);
    expect(findAlertViolations(file, '/* Alert.alert на web пуст */ showToast({})')).toEqual([]);
    expect(findAlertViolations(file, 'showAlert(1); toast.alert; const isAlert = (x) => x')).toEqual([]);
  });
});
