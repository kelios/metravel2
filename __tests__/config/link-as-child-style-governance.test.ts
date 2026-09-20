/**
 * @jest-environment node
 *
 * Прямой ребёнок `<Link asChild>` получает ОДИН плоский объект стиля.
 *
 * `expo-router` рендерит такого ребёнка через Radix `Slot`, а тот сливает стили
 * спредом (`node_modules/@radix-ui/react-slot/dist/index.js:118`:
 * `overrideProps.style = { ...slotPropValue, ...childPropValue }`). Спред
 * функции `({ pressed }) => [...]` даёт `{}`, спред массива — `{0: …, 1: …}`:
 * в обоих случаях от вёрстки не остаётся ничего. Массив ещё и падает шумно —
 * шим `expo-router` бросает на него в dev (`node_modules/expo-router/build/ui/
 * Slot.js:57`), а вот функция умирает молча: сборка зелёная, тесты с наивным
 * моком `Link` тоже.
 *
 * Так на проде 21.09.2026 выглядел список городов на `/quests/country/belarus`:
 * `getComputedStyle(a).flexDirection === 'column'`, `borderWidth: 0px`,
 * `padding: 0px` — название, счётчик и стрелка шли в столбик без карточки.
 *
 * Разрешённые формы: `style` плоским объектом на самом ребёнке ИЛИ `style` на
 * `<Link>` (его `expo-router` прогоняет через `StyleSheet.flatten`,
 * `node_modules/expo-router/build/ui/Slot.js:56`). Состояние нажатия живёт на
 * внутреннем узле через `children`-функцию `Pressable`.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
/** Все каталоги приложения с `.tsx`, кроме самих тестов: иначе у стража слепая зона. */
const SRC_DIRS = ['app', 'components', 'context', 'hooks', 'i18n', 'screens', 'ui'];

/** Стиль ребёнка, который переживёт спред, — только объект: не функция и не массив. */
const CHILD_STYLE_NOT_FLAT = /style=\{\s*[([]/;
/** Тот же стиль, спрятанный за именем: `style={cardStyle}`. */
const CHILD_STYLE_IDENTIFIER = /style=\{\s*([A-Za-z_$][\w$]*)\s*\}/;

/**
 * Объявление имени, за которым прячется не-объект: стрелка `= (`, массив `= [` и
 * `useMemo(() => [...])`. `StyleSheet.flatten([...])` — законная плоская форма и сюда не попадает.
 */
function declaredNotFlat(source: string, name: string): boolean {
  return new RegExp(
    String.raw`\b(?:const|let|var)\s+${name}\s*(?::[^=\n]+)?=\s*(?:[([]|useMemo\(\s*\(\s*\)\s*=>\s*\[)`,
  ).test(source);
}
/** Начало JSX-тега; тип-аргументы вроде `useState<Item>()` отсекаются проверкой на `asChild`. */
const TAG_OPEN = /<[A-Za-z][\w.]*/g;

/**
 * Вырезает комментарии, СОХРАНЯЯ переводы строк: схлопывание блочного
 * комментария в пробел сдвигало бы `path:line` в отчёте на число его строк.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walkSourceFiles(full, out);
    } else if (/\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Индекс `>`, закрывающего открывающий тег: считаем только символы вне строк и
 * вне `{}`. Поэтому тег не обрывают ни `({ pressed }) => [`, ни шаблонная
 * строка `href={`/quests/${alias}`}`, ни JSX внутри пропса `icon={<Feather />}`.
 */
function findTagEnd(source: string, from: number): number {
  let depth = 0;
  let quote = '';
  for (let index = from; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') quote = char;
    else if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    else if (char === '>' && depth === 0) return index;
  }
  return -1;
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

type Scan = { links: number; offenders: string[] };

/**
 * Читаем ровно открывающий тег ПРЯМОГО ребёнка: стили внутренних узлов
 * (`<View style={[styles.row, pressed && …]}>`) законны и в область не попадают.
 */
function scanSource(rawSource: string, relative: string): Scan {
  const source = stripComments(rawSource);
  const scan: Scan = { links: 0, offenders: [] };

  TAG_OPEN.lastIndex = 0;
  let opener: RegExpExecArray | null = TAG_OPEN.exec(source);
  for (; opener; opener = TAG_OPEN.exec(source)) {
    const linkTagEnd = findTagEnd(source, opener.index);
    if (linkTagEnd < 0) continue;
    if (!/\basChild\b/.test(source.slice(opener.index, linkTagEnd + 1))) continue;

    const offset = source.slice(linkTagEnd + 1).search(/\S/);
    if (offset < 0) continue;
    const childStart = linkTagEnd + 1 + offset;
    // Ребёнком может быть выражение (`{condition ? <A /> : <B />}`) — такой стиль не прочитать.
    if (!/^<[A-Za-z]/.test(source.slice(childStart, childStart + 2))) continue;
    const childTagEnd = findTagEnd(source, childStart);
    if (childTagEnd < 0) continue;

    scan.links += 1;
    const childTag = source.slice(childStart, childTagEnd + 1);
    const named = CHILD_STYLE_IDENTIFIER.exec(childTag);
    if (CHILD_STYLE_NOT_FLAT.test(childTag) || (named && declaredNotFlat(source, named[1]))) {
      scan.offenders.push(`${relative}:${lineOf(source, childStart)}`);
    }
  }

  return scan;
}

function scanFile(file: string): Scan {
  const relative = path.relative(ROOT, file).split(path.sep).join('/');
  return scanSource(fs.readFileSync(file, 'utf8'), relative);
}

const scans = SRC_DIRS.flatMap((dir) => walkSourceFiles(path.join(ROOT, dir))).map(scanFile);

describe('Link asChild — стиль прямого ребёнка', () => {
  it('ни один ребёнок не отдаёт стиль функцией или массивом', () => {
    expect(scans.flatMap((scan) => scan.offenders)).toEqual([]);
  });

  it('видит стиль, спрятанный за именем переменной', () => {
    // Спред в Slot одинаково схлопывает и литерал, и значение переменной, поэтому
    // `const cardStyle = ({ pressed }) => [...]` обязан падать так же, как литерал.
    const hidden = [
      'const cardStyle = ({ pressed }: { pressed: boolean }) => [styles.card, pressed && styles.on]',
      'const memoStyle = useMemo(() => [styles.card, extra], [extra])',
      '<Link href="/x" asChild>',
      '  <Pressable style={cardStyle}>{null}</Pressable>',
      '</Link>',
      '<Link href="/y" asChild>',
      '  <Pressable style={memoStyle}>{null}</Pressable>',
      '</Link>',
    ].join('\n');
    expect(scanSource(hidden, 'fixture.tsx').offenders).toEqual(['fixture.tsx:4', 'fixture.tsx:7']);

    // Плоские формы страж не трогает: объект стилей у ребёнка и массив у самой `<Link>`.
    const flat = [
      'const flatStyle = StyleSheet.flatten([styles.card, { borderColor }])',
      '<Link href="/x" asChild style={[styles.card, extra]}>',
      '  <Pressable style={flatStyle}>{null}</Pressable>',
      '</Link>',
      '<Link href="/y" asChild>',
      '  <Pressable style={styles.card}>{null}</Pressable>',
      '</Link>',
    ].join('\n');
    expect(scanSource(flat, 'fixture.tsx').offenders).toEqual([]);
  });

  it('страж действительно читает разметку ссылок', () => {
    // Пустая область молча красит страж зелёным: если обход перестанет находить
    // `asChild`, тест обязан упасть здесь, а не притвориться пройденным.
    expect(scans.reduce((total, scan) => total + scan.links, 0)).toBeGreaterThanOrEqual(10);
  });
});
