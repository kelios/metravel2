const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const ALLOW_EXPO_IMAGE_FILES = new Set([
  path.join(ROOT, 'components', 'ui', 'OptimizedImage.tsx'),
  path.join(ROOT, 'components', 'ui', 'ImageCardMedia.tsx'),
]);

const ALLOW_OPTIMIZED_IMAGE_IMPORT_FILES = new Set([
  path.join(ROOT, 'components', 'ui', 'ImageCardMedia.tsx'),
]);

/**
 * #1221: `optimizeWeb={false}` запрещает `ImageCardMedia` и ресайзить URL, и строить
 * srcSet, поэтому в `<img>` уходит адрес из API как есть. Ownership-роуты идут мимо
 * кэша nginx (`X-Cache-Status: BYPASS`), и на запрос без `?w=` бэкенд отвечает
 * МАСТЕРОМ с `no-store`: замер прода 2026-08-03 на `/places` — 12 из 12 запросов
 * голыми, 615 714 B, все `stored-master`; те же ключи со ступенью под слот —
 * 468 260 B и `immutable`. Это уже третий эпизод одного семейства (#1115, #1221),
 * поэтому правило переехало из ревью в гейт.
 *
 * Исключение возможно ровно одно: вызывающий код САМ построил URL через
 * `optimizeImageUrl` и передаёт готовый вариант, а `optimizeWeb={false}` мешает
 * `ImageCardMedia` пересобрать его от неизвестной ему геометрии слота.
 */
const ALLOW_OPTIMIZE_WEB_FALSE_FILES = new Set([
  // `coverSrc` = optimizeImageUrl(cover, { width: cardWidth * dpr }).
  path.join(ROOT, 'screens', 'tabs', 'QuestCard.tsx'),
  // `heroSrc` = optimizeImageUrl(imageUrl, { width: heroWidth из usePopupLayout }).
  path.join(ROOT, 'components', 'MapPage', 'Map', 'PlacePopupCard', 'index.tsx'),
]);

const ALLOW_BLUR_DISABLED_FILES = new Set([
  // Full-bleed profile covers (fit="cover", borderRadius=0): the image fills the
  // whole area so there is no visible blur backdrop, and it must stay sharp
  // above the fold on iOS Safari.
  path.join(ROOT, 'components', 'profile', 'ProfileHeader.tsx'),
  path.join(ROOT, 'components', 'screens', 'profile', 'PublicProfileHeader.tsx'),
]);

const TEXT_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);

// #1161: правило «ширина обязательна» сканируется шире, чем components/ — иначе
// 27-й вызов легко появится в screens/ или utils/ мимо гейта.
const WIDTH_RULE_ROOTS = ['components', 'screens', 'app', 'hooks', 'utils', 'services'];

// Функции, у которых отсутствие ширины означает «отдай мастер целиком».
// `optimizeImageUrl` без `width` возвращает голый URL без единого параметра, а прокси
// на запрос без `w` отвечает исходником: замер прода 2026-07-30 на
// `travel-image/682/conversions/10f0a8f2….webp` — 132 344 B без параметров против
// 17 738 B на `?w=320` и 2 582 B на `?w=96`.
// У `buildResponsiveImageProps` ширина не может отсутствовать физически (есть дефолт
// `maxWidth = 1920`), и это ровно та ловушка, которую надо ловить: молчаливый дефолт
// выдаёт лестницу до 1920 вместо ступени под измеренный слот.
const WIDTH_REQUIRED_CALLS = [
  { name: 'optimizeImageUrl', optionsIndex: 1, keys: ['width'] },
  { name: 'buildResponsiveImageProps', optionsIndex: 1, keys: ['widths', 'maxWidth'] },
  // Обёртка «манифест, иначе клиентская сборка»: ширина обязана прийти из её
  // вызывающего кода, поэтому правило действует и на неё. Опции у неё третьим
  // аргументом — (entry, baseUrl, options).
  { name: 'buildResponsiveImagePropsPreferringMedia', optionsIndex: 2, keys: ['widths', 'maxWidth'] },
];

/** `width` в объекте опций может быть и парой `width: x`, и shorthand `width,`. */
function optionsCarryKey(optionsText, key) {
  return new RegExp(`\\b${key}\\s*(?::|,|\\}|$)`).test(optionsText);
}

/** Возвращает текст аргументов вызова `name(` начиная с позиции открывающей скобки. */
function readCallArgs(content, openParenIndex) {
  let depth = 0;
  for (let i = openParenIndex; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return content.slice(openParenIndex + 1, i);
    }
  }
  return null;
}

/**
 * Аргументы передали переменной, а не литералом. Статически развернуть её нельзя,
 * поэтому принимаем вызов только если в этом же файле переменная объявлена объектом,
 * в котором ширина есть (случай `utils/imageSrcSet.ts`).
 */
function identifierCarriesWidth(content, identifier, keys) {
  // Явная forwarding-обёртка: параметр типизирован как опции самой проверяемой
  // функции, значит ширину обязан передать её вызывающий код — а он проверяется
  // отдельно, потому что обёртка тоже входит в WIDTH_REQUIRED_CALLS.
  if (new RegExp(`\\b${identifier}\\s*:\\s*Parameters<typeof `).test(content)) return true;

  const declaration = new RegExp(
    `\\b${identifier}\\b\\s*(?::[^=;]*)?=\\s*\\{[\\s\\S]*?\\}`,
    'm'
  ).exec(content);
  if (!declaration) return false;
  return keys.some((key) => optionsCarryKey(declaration[0], key));
}

/** `optimizeWeb={false}` в JSX и `optimizeWeb: false` в объекте `mediaProps`. */
const OPTIMIZE_WEB_DISABLED = /optimizeWeb\s*[=:]\s*\{?\s*false\s*\}?/;

/**
 * Номер первой строки КОДА (не комментария), где срабатывает `pattern`.
 *
 * Комментарии пропускаются: в местах, где правило уже применено, о прежнем коде
 * осталось объяснение («здесь стоял `optimizeWeb: false`», «поля заливает
 * dominant_color»), и гейт ловил бы собственную историю.
 */
function findCodeLineMatching(content, pattern) {
  let insideBlockComment = false;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (insideBlockComment) {
      if (trimmed.includes('*/')) insideBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('//')) continue;
    if (trimmed.startsWith('*')) continue;
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) insideBlockComment = true;
      continue;
    }

    const code = line.split('//')[0];
    if (pattern.test(code)) return i + 1;
  }

  return null;
}

function findOptimizeWebDisabledLine(content) {
  return findCodeLineMatching(content, OPTIMIZE_WEB_DISABLED);
}

/**
 * #1208: чтение `dominant_color` мимо канонического извлечения.
 *
 * Заливка полей letterbox раздавалась пропсом, и каждый экран доставал цвет из
 * манифеста сам. Экраны, которые этого не сделали, остались с прозрачными полями
 * (замер прода 2026-08-05 на `/map`: 7 `contain`-карточек, 0 слоёв заливки).
 * Теперь извлечение живёт в `getMediaPlaceholderData`, а раздача — в общем
 * индексе `utils/mediaPlaceholderIndex.ts`, и новая локальная копия этой логики
 * означает возврат того же дефекта.
 */
const DOMINANT_COLOR_READ = /\bdominant_color\b/;

const ALLOW_DOMINANT_COLOR_FILES = new Set([
  // Канонический извлекатель.
  path.join(ROOT, 'utils', 'travelMediaVariants.ts'),
]);

/**
 * `scripts/**` намеренно вне правила: SSG-генераторы (`ssg-skeletons.js`,
 * `generate-seo-pages.js`) пишут заливку прямо в HTML шелла на этапе сборки и
 * импортировать TS-индекс не могут — это отдельный, документированный путь.
 */
const DOMINANT_COLOR_RULE_ROOTS = [
  'components',
  'screens',
  'app',
  'hooks',
  'utils',
  'services',
  'api',
  'stores',
];

function findDominantColorReadLine(content) {
  return findCodeLineMatching(content, DOMINANT_COLOR_READ);
}

/**
 * #1264: вторая ступень заливки — усреднение кадра в канву 1×1. Своя копия этой
 * логики уже жила в `useWebEffects.ts` (#1233) параллельно с манифестной раздачей —
 * именно так «один механизм» превращается в два с разными правилами. Семплер живёт
 * в `utils/mediaPlaceholderIndex.ts` и кладёт результат в тот же общий индекс.
 */
const CANVAS_PIXEL_SAMPLING = /\bgetImageData\s*\(/;

const ALLOW_CANVAS_SAMPLING_FILES = new Set([
  path.join(ROOT, 'utils', 'mediaPlaceholderIndex.ts'),
  // Другие задачи, не заливка: средняя яркость кадра под контраст оверлея…
  path.join(ROOT, 'utils', 'imageAnalysis.ts'),
  // …и проверка «плитка карты пришла однотонной» при снимке DOM.
  path.join(ROOT, 'utils', 'mapSnapshot', 'domCapture.ts'),
]);

function findCanvasSamplingLine(content) {
  return findCodeLineMatching(content, CANVAS_PIXEL_SAMPLING);
}

function collectMissingWidthCalls(file, content) {
  const found = [];

  for (const { name, keys, optionsIndex } of WIDTH_REQUIRED_CALLS) {
    const callRe = new RegExp(`(?<![\\w.$])${name}\\s*\\(`, 'g');
    let match;
    while ((match = callRe.exec(content)) !== null) {
      const openParen = content.indexOf('(', match.index);
      const args = readCallArgs(content, openParen);
      if (args === null) continue;

      // Объявление самой функции, а не вызов.
      const before = content.slice(Math.max(0, match.index - 20), match.index);
      if (/\b(function|export function)\s*$/.test(before)) continue;

      // Режем аргументы по запятым верхнего уровня, считая скобки, чтобы не
      // порезать вложенный объект/вызов/тернарник.
      const parts = [];
      let depth = 0;
      let start = 0;
      for (let i = 0; i < args.length; i += 1) {
        const ch = args[i];
        if (ch === '(' || ch === '[' || ch === '{') depth += 1;
        else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
        else if (ch === ',' && depth === 0) {
          parts.push(args.slice(start, i));
          start = i + 1;
        }
      }
      parts.push(args.slice(start));

      const line = content.slice(0, match.index).split('\n').length;
      const optionsArg = (parts[optionsIndex] ?? '').trim();
      if (!optionsArg) {
        found.push({ file, line, name, reason: 'вызван без объекта опций' });
        continue;
      }
      // Spread скрывает ключи — доверяем ему, иначе гейт станет неприменимым.
      if (optionsArg.includes('...')) continue;

      if (optionsArg.startsWith('{')) {
        if (!keys.some((key) => optionsCarryKey(optionsArg, key))) {
          found.push({ file, line, name, reason: `в опциях нет ${keys.join('/')}` });
        }
        continue;
      }

      const identifier = optionsArg.match(/^[A-Za-z_$][\w$]*/)?.[0];
      if (identifier && !identifierCarriesWidth(content, identifier, keys)) {
        found.push({
          file,
          line,
          name,
          reason: `опции переданы через \`${identifier}\`, и ${keys.join('/')} там не найдены`,
        });
      }
    }
  }

  return found;
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'web-build') continue;
    if (e.name === 'coverage' || e.name === 'coverage-new') continue;
    if (e.name === '.expo') continue;
    if (e.name === 'playwright-report' || e.name === 'test-results') continue;
    if (e.name.startsWith('.')) continue;

    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function isTextFile(file) {
  return TEXT_EXTS.has(path.extname(file));
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function reportError(errors) {
  if (!errors.length) return;
  console.error('\nImage architecture check failed:\n');
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  console.error('\nRules:');
  console.error('- No direct imports of "expo-image" inside components/** except ui/OptimizedImage.tsx and ui/ImageCardMedia.tsx');
  console.error('- No direct imports of ui/OptimizedImage from feature components; use ui/ImageCardMedia instead');
  console.error('- Do not disable blurred same-image backdrops with blurBackground={false}; use the shared image primitives');
  console.error('- Do not pass blurSrc/blurSource: blur and sharp layers must share one effective source');
  console.error('- Always pass an explicit width to optimizeImageUrl / buildResponsiveImageProps (#1161):');
  console.error('  a media request without `w` makes the proxy return the full master (132 KB instead of 2.5 KB');
  console.error('  on a 132px tile). Derive the width from the measured slot, see docs/features/images.md.');
  console.error('- Do not read `dominant_color` outside utils/travelMediaVariants.ts (#1208): the letterbox fill');
  console.error('  is extracted by getMediaPlaceholderData and delivered by utils/mediaPlaceholderIndex.');
  process.exit(1);
}

function main() {
  const componentsDir = path.join(ROOT, 'components');
  const files = walk(componentsDir).filter(isTextFile);

  const errors = [];

  // #1161: правило ширины проверяется по более широкому набору директорий, чем
  // остальные (те исторически касаются только компонентов).
  const widthRuleFiles = WIDTH_RULE_ROOTS.flatMap((dirName) => {
    const dir = path.join(ROOT, dirName);
    return fs.existsSync(dir) ? walk(dir).filter(isTextFile) : [];
  });

  for (const file of widthRuleFiles) {
    const content = read(file);

    for (const miss of collectMissingWidthCalls(file, content)) {
      errors.push(
        `${path.relative(ROOT, miss.file)}:${miss.line} ${miss.name} ${miss.reason} — без ширины прокси отдаёт мастер целиком (#1161)`
      );
    }

    // #1221: правило проверяется по тем же директориям, что и ширина, — сам дефект
    // жил и в `components/**`, и в `screens/**`.
    const optimizeWebLine = ALLOW_OPTIMIZE_WEB_FALSE_FILES.has(file)
      ? null
      : findOptimizeWebDisabledLine(content);
    if (optimizeWebLine) {
      errors.push(
        `${path.relative(ROOT, file)}:${optimizeWebLine} отключает optimizeWeb — media-URL уйдёт без \`?w=\`, ownership-роут ответит мастером с no-store (#1221)`
      );
    }
  }

  // #1208: заливка полей letterbox извлекается только каноническим хелпером и
  // раздаётся общим индексом; локальная копия возвращает «экран без заливки».
  // Проверяется шире правила ширины: расшивать манифест по-своему одинаково легко
  // и в компоненте, и в `api/**`-нормализаторе.
  const dominantColorRuleFiles = DOMINANT_COLOR_RULE_ROOTS.flatMap((dirName) => {
    const dir = path.join(ROOT, dirName);
    return fs.existsSync(dir) ? walk(dir).filter(isTextFile) : [];
  });

  for (const file of dominantColorRuleFiles) {
    const content = read(file);

    if (!ALLOW_DOMINANT_COLOR_FILES.has(file)) {
      const dominantColorLine = findDominantColorReadLine(content);
      if (dominantColorLine) {
        errors.push(
          `${path.relative(ROOT, file)}:${dominantColorLine} читает dominant_color напрямую — используйте getMediaPlaceholderData + utils/mediaPlaceholderIndex (#1208)`
        );
      }
    }

    if (!ALLOW_CANVAS_SAMPLING_FILES.has(file)) {
      const samplingLine = findCanvasSamplingLine(content);
      if (samplingLine) {
        errors.push(
          `${path.relative(ROOT, file)}:${samplingLine} семплит пиксели сам — заливка полей строится только в utils/mediaPlaceholderIndex (#1264)`
        );
      }
    }
  }

  for (const file of files) {
    const content = read(file);

    // 1) forbid expo-image imports outside allowed low-level files
    if (content.includes("from 'expo-image'") || content.includes('from "expo-image"')) {
      if (!ALLOW_EXPO_IMAGE_FILES.has(file)) {
        errors.push(`${path.relative(ROOT, file)} imports expo-image directly`);
      }
    }

    // 2) forbid direct imports of ui/OptimizedImage outside ImageCardMedia
    if (
      content.includes("from '@/components/ui/OptimizedImage'") ||
      content.includes('from "@/components/ui/OptimizedImage"') ||
      content.includes("from '../ui/OptimizedImage'") ||
      content.includes('from "../ui/OptimizedImage"') ||
      content.includes("from './ui/OptimizedImage'") ||
      content.includes('from "./ui/OptimizedImage"')
    ) {
      if (!ALLOW_OPTIMIZED_IMAGE_IMPORT_FILES.has(file)) {
        errors.push(`${path.relative(ROOT, file)} imports ui/OptimizedImage directly (use ImageCardMedia)`);
      }
    }

    // 3) forbid disabling the shared blur backdrop in feature components
    if (content.includes('blurBackground={false}') && !ALLOW_BLUR_DISABLED_FILES.has(file)) {
      errors.push(`${path.relative(ROOT, file)} disables blurBackground explicitly`);
    }

    // 4) #1111: a blur-only prop makes it possible to create a second URL or a
    // distinct Glide source (for example through width/height decode overrides).
    // The low-level renderer derives both layers from the same active source.
    if (/\b(?:blurSrc|blurSource)\s*=/.test(content)) {
      errors.push(`${path.relative(ROOT, file)} supplies a separate blur source`);
    }
  }

  reportError(errors);
  console.log('Image architecture check passed.');
}

// #1161: правило ширины покрыто негативными тестами
// (`__tests__/scripts/image-architecture-width-rule.test.ts`), поэтому коллектор
// экспортируется, а `main()` запускается только при прямом вызове скрипта.
module.exports = {
  collectMissingWidthCalls,
  findOptimizeWebDisabledLine,
  findDominantColorReadLine,
  findCanvasSamplingLine,
};

if (require.main === module) {
  main();
}
