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

/**
 * Страж обязан судить КОД, а не прозу. Без этого комментарий, который честно
 * называет прежний хук, валит тест — и объяснение миграции приходится писать
 * эвфемизмами («прежний хук размеров окна из react-native»), то есть страж
 * начинает портить документацию вместо того, чтобы ловить дефект.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    // `[^:]` перед `//` бережёт протокол в строковых литералах: `https://…`
    // не комментарий, и срезать его хвост незачем.
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

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

  it('«Мои точки» читают ширину из ОДНОГО источника (регрессия #1814)', () => {
    // #1814: родитель уже сидел на `useBreakpoints({ clientOnly: true })`, а
    // `PointsListGrid` и `PointCard` остались на `useWindowDimensions` — живой
    // ширине без гидратационной защёлки. На первом web-кадре части одного экрана
    // могли оказаться в разных режимах. Область чтения ограничена ровно фичей,
    // чтобы страж не молчал из-за широкого поиска и не ловил чужие экраны.
    const featureDir = path.join(ROOT, 'components/UserPoints');
    const featureFiles = walkSourceFiles(featureDir);
    expect(featureFiles.length).toBeGreaterThan(0);

    // Второй источник — это не только прежний хук: прямое чтение `Dimensions`
    // даёт ровно тот же дефект другим синтаксисом, поэтому ловим обе формы.
    const SECOND_VIEWPORT_SOURCE = /\buseWindowDimensions\b|\bDimensions\.get\s*\(/;
    const withOwnViewportSource = featureFiles
      .filter((file) => SECOND_VIEWPORT_SOURCE.test(stripComments(fs.readFileSync(file, 'utf8'))))
      .map((file) => path.relative(ROOT, file).split(path.sep).join('/'));

    expect(withOwnViewportSource).toEqual([]);

    // Мало перевести на общий хук: без `clientOnly` первый web-кадр этих узлов
    // приходит с width=0 (`hooks/useHydrationReady.ts`) и десктоп мигает узкой
    // раскладкой (#1282). Читаем по точному пути: файл, уехавший из фичи, роняет
    // страж на чтении, а не выпадает из области молча. Сверяем смысл, а не
    // форматирование: перенос аргумента и висячая запятая — не регрессия.
    const HYDRATION_LATCHED = /useResponsiveWidth\(\s*\{[^}]*\bclientOnly\s*:\s*true\b/;
    const MIGRATED_TO_SHARED_SOURCE = [
      'components/UserPoints/PointsListGrid.tsx',
      'components/UserPoints/PointCard.tsx',
    ];
    const withoutHydrationLatch = MIGRATED_TO_SHARED_SOURCE.filter(
      (relative) =>
        !HYDRATION_LATCHED.test(fs.readFileSync(path.join(ROOT, ...relative.split('/')), 'utf8')),
    );

    expect(withoutHydrationLatch).toEqual([]);
  });

  it('унаследованный список не разрастается молча', () => {
    // Строки из списка обязаны существовать: исчезнувший файл — повод убрать
    // запись, а не держать мёртвый allowlist.
    expect(offenders.filter((file) => LEGACY_ALLOWLIST.has(file)).sort()).toEqual(
      [...LEGACY_ALLOWLIST].sort(),
    );
  });
});
