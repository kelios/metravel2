'use strict'

/**
 * Единый список стражей, обязательных до `git push origin main` (#3371,
 * REVIEW-GATE-LINT-COVERAGE-001).
 *
 * До этой карточки список жил в трёх местах и не совпадал: безусловные стражи
 * `check:fast`, набор роли `code-review-gate` и `npm run lint`; `guard:env-secrets`
 * стоял только в `governance:verify`. Красное уходило в `main` через щель между
 * ними: `guard:unimported-modules` (коммит `4c8a9f7eb`), тестовые токены #3354.
 *
 * Кто читает список:
 *   - `scripts/run-fast-scope-checks.js` — стадию `fast` (`check:fast`, pre-commit);
 *   - `scripts/run-pre-push-guards.js`   — стадию `pre-push` как шаг `check:preflight`
 *     (pre-push хук) и весь список по `npm run guard:pre-push` (роль `code-review-gate`);
 *     тем же шагом идут Jest-тесты, связанные с diff'ом (`RELATED_TESTS_RULE`, #3468).
 *
 * Состав определён замером 21.11.2026 (MacBook, 15 ядер, холостой CPU): весь
 * `npm run lint` — 44,4 с, `governance:verify` — 8,2 с, прежний preflight без
 * изменённых файлов — 11,9 с. Поэтому в список входят ОБА набора целиком, а не
 * подмножество, и сверх них `typecheck` (`tsc --noEmit`, 11,2 с на тёплом
 * кэше): ошибка типов в `main` стоит дороже, а Jest через babel типы не видит
 * (решение координатора поезда #3371). Страж, добавленный в `npm run lint` или `governance:verify` мимо
 * списка, краснит `__tests__/scripts/pre-push-guards.test.ts`.
 *
 * Стадия `fast` — то, что `check:fast` запускал и раньше: дёшево и безусловно,
 * потому что нарушение приносит НОВЫЙ файл, а не изменённый. Всё остальное —
 * `pre-push`: внутренний цикл разработки эти ~40 с не платит.
 */

const STAGE_FAST = 'fast'
const STAGE_PRE_PUSH = 'pre-push'

const SOURCE_LINT = 'lint'
const SOURCE_GOVERNANCE = 'governance:verify'
const SOURCE_FAST = 'check:fast'
// Добавлено сверх двух наборов: `tsc` нет ни в `npm run lint`, ни в `governance:verify`.
const SOURCE_TYPECHECK = 'typecheck'

const guard = (stage, script, sources, why) => Object.freeze({
  id: script,
  script,
  stage,
  sources: Object.freeze(sources),
  why,
})

const fast = (script, sources, why) => guard(STAGE_FAST, script, sources, why)
const prePush = (script, sources, why) => guard(STAGE_PRE_PUSH, script, sources, why)

const PRE_PUSH_GUARDS = Object.freeze([
  // ── Стадия fast: порядок сохранён с прежней рукописной цепочки check:fast ──
  fast('guard:root-scratch-artifacts', [SOURCE_LINT],
    'Первым: одно чтение `git ls-files`. #1846 — `lint` ловил одноразовый артефакт в корне уже на origin/main.'),
  fast('guard:public-files', [SOURCE_LINT],
    'Читает реальное дерево public/, в том числе Git-ignored лишний файл.'),
  fast('guard:external-links', [SOURCE_LINT, SOURCE_GOVERNANCE],
    'Внешние ссылки только через chokepoint `utils/externalLinks.ts`.'),
  fast('guard:travel-links', [SOURCE_LINT],
    '#3242: адрес статьи в коде устаревает от переименования в другом файле — scope изменённых файлов тут ничего не говорит.'),
  fast('guard:rich-text-sinks', [SOURCE_LINT],
    '#3202: новый сток rich-text появляется в новом файле.'),
  fast('guard:web-deferred-loading', [SOURCE_LINT],
    '#1475, #818, #2010, #2012: новая отложенная загрузка секции сверяется с реестром в RULES.md.'),
  fast('guard:web-style-channels', [SOURCE_LINT],
    '#1642, #2024, #2032: сырой `data-*` и `.css` рядом с компонентом приходят в новом файле.'),
  fast('guard:screen-header', [SOURCE_LINT],
    '#2099: поимённый список экранов-владельцев шапки (`SCREEN_HEADER_OWNERS`).'),
  fast('guard:screen-actions', [SOURCE_LINT],
    '#2101: полноширинное «Удалить» и безымянная корзина в теле экрана деталей.'),
  fast('guard:bottom-chrome-inset', [SOURCE_LINT],
    'Нижний отступ под системный хром.'),
  fast('guard:query-retry-policy', [SOURCE_LINT],
    'Единая политика повторов запросов.'),
  fast('guard:type-debt', [SOURCE_LINT],
    'Счётчики `as any` и подавлений не растут относительно baseline.'),
  fast('guard:no-inline-page-fetch-loop', [SOURCE_FAST],
    '#1710, API-PAGE-SIZE-CAP-001: очередная копия правила докачки страниц появляется в новом файле.'),
  fast('guard:no-inline-back-navigation', [SOURCE_FAST],
    '#1727: рукописная развилка «вернуться назад или заменить экран» появляется в новом экране, а не в изменённом.'),
  fast('guard:quest-answer-eval', [SOURCE_FAST],
    'Контур оценки ответов квеста.'),
  fast('guard:quest-review-snapshots', [SOURCE_FAST],
    'Снимки ревью квестов.'),
  fast('guard:quest-data-sources', [SOURCE_FAST],
    '#1554: один quest_id — один локальный файл-источник; дубль появляется вместе с новым файлом. Сетевая половина — `npm run quest:scan-prod-drift` (#1489).'),
  fast('guard:prod-write-mode', [SOURCE_FAST],
    '#3304: скрипт, пишущий на прод, не пишет без `--apply`; нарушение приносит новый файл-копия.'),

  // ── Стадия pre-push: остаток `npm run lint` и `governance:verify` ──
  prePush('guard:metravel-token', [SOURCE_LINT], 'Токен борда не попадает в tracked-файлы.'),
  prePush('guard:no-direct-osm-tiles', [SOURCE_LINT], 'Тайлы OSM только через прокси.'),
  prePush('guard:locale-number-format', [SOURCE_LINT], 'LOCALE-NUMBER-FORMAT-001: числа через `i18n/format.ts`.'),
  prePush('guard:query-keys', [SOURCE_LINT], 'Ключи запросов только из фабрики.'),
  prePush('guard:e2e-wait-for-timeout', [SOURCE_LINT, SOURCE_GOVERNANCE], 'Без `waitForTimeout` в e2e.'),
  prePush('guard:e2e-fake-web-session', [SOURCE_LINT], 'Подставная web-сессия только через общий хелпер.'),
  prePush('guard:web-automation', [SOURCE_LINT], 'Признак автоматизации читается из одного места.'),
  prePush('guard:text-row-sizing', [SOURCE_LINT, SOURCE_GOVERNANCE], 'NATIVE-TEXT-ROW-001.'),
  prePush('guard:themed-colors', [SOURCE_LINT], 'Цвет тематической поверхности — через `useThemedColors()`.'),
  prePush('guard:tab-roles', [SOURCE_LINT], 'Роли вкладок.'),
  prePush('guard:sheet-backdrop', [SOURCE_LINT], 'Подложка нижних листов.'),
  prePush('guard:modal-safe-area', [SOURCE_LINT], 'Safe area модальных окон.'),
  prePush('guard:touch-targets', [SOURCE_LINT], 'Минимальный размер тач-таргета.'),
  prePush('guard:ugc-actions', [SOURCE_LINT], 'Действия над пользовательским контентом.'),
  prePush('guard:unimported-modules', [SOURCE_LINT],
    'DEAD-MODULE-NO-IMPORTER-001. Коммит `4c8a9f7eb` увёл в main красный страж: `import()` по шаблонной строке прячет модуль от графа (починено `305d4238b`).'),
  prePush('sync:agent-skills:check', [SOURCE_LINT], '`.agents/skills` совпадает с источником `.claude/skills` и `.claude/commands`.'),
  prePush('sync:copilot-skills:check', [SOURCE_LINT], '`.github/skills` совпадает с источником.'),
  prePush('guard:advent-config', [SOURCE_LINT], 'Схема конфига адвент-календаря.'),
  prePush('guard:env-secrets', [SOURCE_GOVERNANCE],
    '#3354: тестовые hex-токены прошли `npm run lint` и ревью-аудит — страж стоял только в `governance:verify`.'),
  prePush('guard:cli-contract', [SOURCE_GOVERNANCE], 'SEO-OPS-001: аргументы операторских CLI через общий контракт.'),
  prePush('test:governance', [SOURCE_GOVERNANCE], 'Jest-контракты governance; сюда же входит тест этого списка.'),
  prePush('typecheck', [SOURCE_TYPECHECK],
    '`tsc --noEmit`: до #3371 не запускался до push нигде (только `release:check`), а Jest через babel ошибки типов пропускает.'),
  Object.freeze({
    id: 'eslint',
    command: 'eslint . --max-warnings=0',
    stage: STAGE_PRE_PUSH,
    sources: Object.freeze([SOURCE_LINT]),
    why: 'Весь репозиторий, как в `npm run lint`: `check:fast` линтит только изменённые файлы и не видит ошибку в импортёре удалённого или переименованного модуля.',
  }),
])

/**
 * Что осознанно НЕ запускается на каждый push — с замером и местом, где оно
 * всё же выполняется. Молчаливых пропусков нет: чего нет ни в списке выше, ни
 * здесь, то в общую цепочку не подключено.
 */
const NOT_BEFORE_EVERY_PUSH = Object.freeze([
  Object.freeze({
    id: 'prod-build-probe',
    what: 'страж бюджета бандла и числа eager-запросов (`guard:bundle-budget`, `guard:eager-web`) на настоящей прод-сборке',
    cost: '0,5–2 минуты при тёплом кэше Metro',
    why: 'Дороже всего остального preflight вместе взятого; нужен только диффу, который двигает состав чанков.',
    runsAt: 'условное правило BUNDLE_PROBE_RULE до push; безусловно — `scripts/deploy-prod.sh` при выкате и `release:check`',
  }),
  Object.freeze({
    id: 'e2e-changed',
    what: 'выборочный Playwright',
    cost: 'минуты, нужен браузер и живой бэкенд',
    why: 'До `testing` browser-level проверки запрещены (`AGENTS.md` §4.6, §5).',
    runsAt: 'шаг `e2e-changed` того же preflight без `PREFLIGHT_SKIP_E2E=1`, в `testing`',
  }),
  Object.freeze({
    id: 'test:run',
    what: 'полный Jest',
    cost: 'минуты',
    why: 'До push идут тесты, связанные с diff\'ом (RELATED_TESTS_RULE): остальной набор от diff\'а не зависит, а ломается он от того, что выборка не достала.',
    runsAt: 'ночной `npm run test:nightly` на снимке `origin/main` (#3468); `npm run test:run` для крупного diff (`AGENTS.md` §5), `release:check`',
  }),
])

/**
 * Jest-тесты, связанные с diff'ом (#3468, RED-TEST-ON-MAIN-OUTSIDE-GATE-001).
 * Отбор — `scripts/related-jest-tests.js`, запуск — тот же шаг `pre-push-guards`.
 *
 * До карточки шаг подбирал тесты только по документам (литерал пути), а
 * выборочные наборы `check:fast` — по рукописным спискам областей
 * (`scripts/run-app-contract-tests-if-needed.js`): `utils/tripPlan*` попадал в
 * одну категорию с одним тестом. Коммит `8791989d1` ушёл в `main` с красным
 * `__tests__/app/tripCreateScreen.authGate.test.tsx`: тест подменял
 * `@/utils/tripPlanLinks` целиком, а импортёр начал брать из него новые имена.
 *
 * Замер 22.11.2026 (MacBook, 15 ядер, 24 ГБ), граф зависимостей Jest
 * (`--findRelatedTests`) без локалей: медиана по 60 коммитам `main` — 0 тестов,
 * p90 — 146, максимум — 820. Четыре воркера: 93 теста — 18 с, 337 — 26 с,
 * 820 — 50 с при пике памяти 5,3 ГБ (14 воркеров — 11,3 ГБ, один процесс
 * втрое-вчетверо дольше).
 */
const RELATED_TESTS_RULE = Object.freeze({
  id: 'related-jest-tests',
  // ≈55 с на четырёх воркерах: шаг не удлиняет push больше чем на ¾ прежнего
  // (~77 с). Выше потолка — только ядро (`i18n/index.ts`, `i18n/resources.ts`,
  // `constants/designSystem.ts`: 953–1465 тестов из 2412), то есть почти полный Jest.
  ceiling: 900,
  maxWorkers: 4,
  // Данные со своим набором: в граф не раскрываются, вместо графа идёт набор.
  dataSuites: Object.freeze([
    Object.freeze({
      prefix: 'i18n/locales/',
      suite: '__tests__/i18n',
      why: 'любой файл локали — 1466 тестов графа (61 % набора): `i18n/resources.ts` импортирует почти каждый экран',
    }),
  ]),
  // Конфигурация, setup, зависимости и корневые ручные моки Jest: граф по ним пуст
  // (замер 22.11.2026: `__tests__/setup.ts`, `jest.config.js`, `babel.config.js`,
  // `__mocks__/react-native-svg.js` — 0 тестов), а затрагивают они весь набор.
  // Такой diff называет весь остальной набор незапущенным; `--full` запускает его целиком.
  wholeSuiteInputs: Object.freeze([
    'jest.config.js',
    'babel.config.js',
    'jest.expo-globals.js',
    '__tests__/setup.ts',
    'scripts/jest-resolver.js',
    'scripts/jest-quality-gate-setup.js',
    'scripts/jest-quality-gate-teardown.js',
    'yarn.lock',
    '__mocks__/',
  ]),
  // Обязательный ручной шаг, когда шаг сообщил о незапущенных тестах.
  fullCommand: 'npm run test:related -- --full',
  fullCost: '1526 тестов (diff `39cb12a1f` с локалями) — 123 с на четырёх воркерах',
})

// Preflight выставляет переменную своим шагам: выборочные наборы `fast-scope-checks`
// для этого scope уже выполнены, шаг связанных тестов их не повторяет.
const PREFLIGHT_SELECTIVE_TESTS_ENV = 'MT_PREFLIGHT_SELECTIVE_TESTS'

/**
 * Условное правило пробной прод-сборки. Автоматика знает только дешёвый признак
 * (строки импорта, добавленные в рантайм-модули, — `findImportAdditions`) и
 * печатает предупреждение; принадлежность модуля eager-графу без сборки не
 * вычислить, поэтому решение «нужна проба» остаётся за ревью-гейтом.
 */
const BUNDLE_PROBE_RULE = Object.freeze({
  id: 'prod-build-probe',
  when: 'diff добавляет или меняет импорты в модулях eager-графа или общих чанков (их грузят страницы статьи, каталога, главной: `utils/*`, `hooks/*`, общие компоненты), трогает именованный чанк из `config/bundle-budget.json` или включает флаг на проде',
  command: 'DEPLOY=0 DEPLOY_QUIET=1 scripts/deploy-prod.sh <снимок>',
  snapshot: [
    'GIT_INDEX_FILE="$PWD/.git/index.probe" git read-tree HEAD',
    'GIT_INDEX_FILE="$PWD/.git/index.probe" git update-index --add <изменённые файлы>',
    'TREE=$(GIT_INDEX_FILE="$PWD/.git/index.probe" git write-tree)',
    'PROBE=$(git commit-tree "$TREE" -p HEAD -m "probe"); rm -f .git/index.probe',
  ],
  evidence: 'коммит `86702b04c` (#3298) прошёл аудит, гейт и lint и остановил выкат: `EAGER (requests, travels/[param].html): 19 > 18`; #3292 — чанк +72 байта gzip сверх допуска',
})

/** Каталоги, чьи модули попадают в web-бандл: `CANDIDATE_DIRS` стража `guard:unimported-modules` без стираемых `types`. */
const RUNTIME_SOURCE_DIRS = Object.freeze([
  'api', 'app', 'components', 'constants', 'context', 'hooks', 'screens', 'services', 'stores', 'styles', 'utils',
])
const RUNTIME_SOURCE_PATTERN = /\.(?:ts|tsx|js|jsx)$/
const NON_RUNTIME_PATTERN = /(?:^|\/)__tests__\/|\.(?:test|spec)\.[jt]sx?$|\.d\.ts$|\.(?:native|ios|android)\.[jt]sx?$/
// `import type` и `export type` веса не добавляют: TypeScript стирает их до сборки.
const IMPORT_LINE_PATTERNS = Object.freeze([
  /^\s*import\s+(?!type\b)/,
  /^\s*export\s+(?!type\b)[^;]*\sfrom\s+['"]/,
  /^\s*\}\s*from\s+['"]/,
  /\b(?:require|import)\s*\(/,
])

const normalizePath = (filePath) => String(filePath || '').replace(/\\/g, '/')

const isRuntimeSourcePath = (filePath) => {
  const normalized = normalizePath(filePath)
  const [top] = normalized.split('/')
  return RUNTIME_SOURCE_DIRS.includes(top)
    && RUNTIME_SOURCE_PATTERN.test(normalized)
    && !NON_RUNTIME_PATTERN.test(normalized)
}

/**
 * Рантайм-модули, в которые unified diff добавляет строку импорта. Чистое
 * удаление импорта не считается: вес оно не добавляет. Изменённый импорт в
 * diff'е — это пара «−/+», то есть тоже добавленная строка.
 */
const findImportAdditions = (unifiedDiff) => {
  const files = new Map()
  let current = ''
  for (const line of String(unifiedDiff || '').split('\n')) {
    if (line.startsWith('+++ ')) {
      const target = line.slice(4).trim()
      current = target === '/dev/null' ? '' : normalizePath(target.replace(/^b\//, ''))
      continue
    }
    if (!current || !line.startsWith('+') || !isRuntimeSourcePath(current)) continue
    const added = line.slice(1)
    if (/^\s*(?:\/\/|\*|\/\*)/.test(added) || !IMPORT_LINE_PATTERNS.some((pattern) => pattern.test(added))) continue
    files.set(current, (files.get(current) || 0) + 1)
  }
  return [...files].map(([file, added]) => ({ file, added })).sort((a, b) => a.file.localeCompare(b.file))
}

const guardsForStage = (stage) => PRE_PUSH_GUARDS.filter((item) => item.stage === stage)

/** Командная строка в том виде, в каком страж записан в package.json. */
const guardSegment = (item) => (item.script ? `npm run ${item.script}` : item.command)

/** `a && b && c` из package.json → отдельные команды цепочки. */
const parseScriptChain = (scriptValue) => String(scriptValue || '')
  .split('&&')
  .map((segment) => segment.trim())
  .filter(Boolean)

module.exports = {
  STAGE_FAST,
  STAGE_PRE_PUSH,
  SOURCE_LINT,
  SOURCE_GOVERNANCE,
  SOURCE_FAST,
  SOURCE_TYPECHECK,
  PRE_PUSH_GUARDS,
  NOT_BEFORE_EVERY_PUSH,
  RELATED_TESTS_RULE,
  PREFLIGHT_SELECTIVE_TESTS_ENV,
  BUNDLE_PROBE_RULE,
  RUNTIME_SOURCE_DIRS,
  guardsForStage,
  guardSegment,
  parseScriptChain,
  isRuntimeSourcePath,
  findImportAdditions,
}
