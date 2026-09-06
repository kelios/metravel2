/**
 * @jest-environment node
 *
 * #1788 — режим раскладки (мобильный/десктопный) обязан браться из ВЬЮПОРТА.
 *
 * `docs/RULES.md`: mobile web, Android, iPhone и iPad реализуют один
 * responsive-UX — одна иерархия, порядок действий и геометрия при одинаковой
 * ширине. Значит `Platform.OS` не может РЕШАТЬ, мобильная раскладка или нет: он
 * различает возможности платформы (нативный мост, разрешения, safe area), а не
 * ширину экрана. Ловим ровно одну форму — «нативное приложение всегда
 * мобильное»: из-за неё «Мои точки» на mobile web 390px показывали десктопный
 * интерфейс, а iPhone на той же ширине — мобильный.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIRS = ['app', 'components', 'screens'];

/** Имя переменной, которая задаёт режим раскладки, а не признак платформы. */
const MODE_NAME = String.raw`is(?:Mobile|Desktop|Tablet|Phone|Narrow|Compact|Wide)[A-Za-z]*`;

/**
 * «Платформа решает режим»: значение либо буквально `Platform.OS !== 'web'`,
 * либо этот же признак принудительно включает мобильный режим через `||`/`? true`.
 * Комбинации вида `Platform.OS === 'web' && isMobile` (mobile web как отдельная
 * ПОВЕРХНОСТЬ) сюда намеренно не попадают — там решает вьюпорт.
 */
const PLATFORM_DECIDES_MODE = new RegExp(
  String.raw`\b(?:const|let)\s+(${MODE_NAME})\s*(?::[^=\n]+)?=\s*Platform\.OS\s*!==\s*['"]web['"]\s*(?:;|\|\||\?\s*true)`,
);

/**
 * Наследственный долг на момент заведения стража (#1788). Каждая строка — тот же
 * дефект, но в чужом scope: чинить их этой задачей нельзя, а расти списку —
 * запрещено. Убирая строку отсюда, убедись, что режим считается от ширины.
 */
const LEGACY_ALLOWLIST = new Set([
  'app/_layout.tsx',
  'components/ui/Typography.tsx',
  'components/layout/BottomDock.tsx',
]);

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walkSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = SRC_DIRS.flatMap((dir) => walkSourceFiles(path.join(ROOT, dir)));

// Дерево читается ОДИН раз на модуль: два прохода по app/components/screens —
// это лишние ~2300 синхронных чтений на каждый прогон стража.
const offenders: string[] = sourceFiles
  .filter((file) => PLATFORM_DECIDES_MODE.test(fs.readFileSync(file, 'utf8')))
  .map((file) => path.relative(ROOT, file).split(path.sep).join('/'));

describe('Layout mode governance (docs/RULES.md — один responsive-UX)', () => {
  it('режим раскладки не решается платформой вне унаследованного списка', () => {
    expect(offenders.filter((file) => !LEGACY_ALLOWLIST.has(file))).toEqual([]);
  });

  it('«Мои точки» берут режим из вьюпорта (регрессия #1788)', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'components/UserPoints/PointsList.tsx'),
      'utf8',
    );

    // Именно clientOnly-вариант: без него первый web-кадр приходит с width=0 и
    // десктоп мигает мобильной раскладкой (#1282). Сверяем смысл, а не
    // форматирование: перенос аргумента на новую строку — не регрессия.
    expect(source).toMatch(/useBreakpoints\(\s*\{\s*clientOnly:\s*true\s*\}\s*\)/);
    expect(PLATFORM_DECIDES_MODE.test(source)).toBe(false);
  });

  it('унаследованный список не разрастается молча', () => {
    // Строки из списка обязаны существовать: исчезнувший файл — повод убрать
    // запись, а не держать мёртвый allowlist.
    expect(offenders.filter((file) => LEGACY_ALLOWLIST.has(file)).sort()).toEqual(
      [...LEGACY_ALLOWLIST].sort(),
    );
  });
});
