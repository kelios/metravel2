/**
 * boardTaskContract — машинная проверка описания карточки MCP task board.
 *
 * Зачем: правила оформления карточки жили только прозой в `docs/TASK_BOARD_MCP.md`,
 * `.claude/agents/ticket-board.md` и `.codex/skills/metravel-*`. Ни один гейт не смотрел
 * на текст описания, поэтому соответствие зависело от того, вспомнит ли агент сорок правил
 * из трёх файлов. Замер 2026-08-22 по 80 открытым карточкам: 46 (58%) не соответствуют
 * собственному контракту проекта. Этот модуль превращает прозу в проверяемый инвариант.
 *
 * Один модуль на две точки применения, чтобы правило не разъехалось:
 *   - `scripts/audit-board-tasks.mjs` — аудит борда (пост-фактум);
 *   - `.claude/hooks/task-quality-gate.mjs` — PreToolUse гейт (не даёт создать плохую карточку).
 *
 * Уровни находок:
 *   `error` — объективный дефект контракта, гейт блокирует создание/перевод в работу;
 *   `warn`  — дефект качества, который не блокирует, но виден в аудите.
 */

/** Семь обязательных разделов описания, в каноническом порядке. */
export const REQUIRED_SECTIONS = [
  'Простыми словами',
  'В чём проблема',
  'Из-за чего возникла',
  'Что должно быть сделано',
  'Что уже сделано',
  'Что блокирует',
  'Как протестировать',
];

/** Подполя раздела «Простыми словами». */
export const LEAD_FIELDS = ['Что сейчас', 'Как должно быть', 'Кого задевает'];

/** Поля блока `## Problem History`. */
export const PROBLEM_HISTORY_FIELDS = [
  'Problem key',
  'Historical matches',
  'Verdict',
  'Canonical task',
  'Root-cause delta',
];

/** Поля блока `## Task Contract`. */
export const TASK_CONTRACT_FIELDS = [
  'Scope',
  'User-visible result',
  'Data/API contract',
  'Platform impact',
  'Localization impact',
  'Dependencies',
  'Fallback/mock policy',
  'Validation',
  'Regression control',
  'Done gate',
];

/** Разделы карточки `needs_human=true` (шаблон `.claude/skills/metravel-issue/human-task.md`). */
export const HUMAN_SECTIONS = ['Что нужно сделать', 'Зачем', 'Шаги', 'Где', 'Готово когда'];

const AREAS_WITH_CONTRACT = ['front', 'back'];
const PLATFORM_KEYWORDS = /(desktop web|mobile web|android|ios|iphone|ipados|shared|none)/i;
const LOCALE_KEYWORDS = /(\bRU\b|\bBE\b|\bUK\b|\bPL\b|\bEN\b|none|локал)/i;
/**
 * Заглушка, а не значение. `none`/`нет` сюда НЕ входят: доки прямо разрешают
 * `Localization impact: none`, `Platform impact: none` (с обоснованием) и
 * `Regression control: none` для контента и разовых операций.
 */
const PLACEHOLDER_VALUES = /^(—|-|–|n\/a|tbd|todo|\?+|\.\.\.|…|xxx)\.?$/i;
/** Значение «ничего не затронуто» — легально, но для части полей требует обоснования. */
const EXPLICIT_NONE = /^(none|нет)\.?$/i;

/** Нормализация заголовка: неразрывные пробелы и «ё» не должны создавать ложных расхождений. */
const norm = (value) => String(value).replace(/\u00A0/g, ' ').replace(/ё/g, 'е').toLowerCase().trim();

const escapeRe = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Заголовки уровня `##` в порядке появления. */
export function listHeadings(description) {
  return [...String(description).matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1].trim());
}

/** Тело одного точного `##`-раздела до следующего заголовка того же уровня. */
function readSection(description, heading) {
  const source = String(description);
  const match = new RegExp(`^##\\s+${escapeRe(heading)}\\s*$`, 'im').exec(source);
  if (!match) return null;
  const tail = source.slice(match.index + match[0].length);
  const nextHeading = tail.search(/^##\s+/m);
  return (nextHeading >= 0 ? tail.slice(0, nextHeading) : tail).trim();
}

/**
 * Значение поля контракта в каноническом формате `Имя:` с начала строки.
 * Возвращает `null`, если поля в каноническом формате нет, и строку (возможно пустую) — если есть.
 */
export function readFieldValue(description, field) {
  const re = new RegExp(`^${escapeRe(field)}\\s*:(.*)$`, 'm');
  const match = String(description).match(re);
  if (!match) return null;

  const tail = String(description).slice(match.index + match[0].length).split('\n');
  // Первый элемент — остаток той же строки после `$`, то есть всегда пустая строка.
  const rest = tail[0] === '' ? tail.slice(1) : tail;
  let value = match[1].trim();
  for (const line of rest) {
    if (/^\s*$/.test(line)) break;
    if (/^##\s/.test(line)) break;
    if (/^[A-ZА-Я][A-Za-zА-Яа-я/ -]{2,30}\s*:/.test(line)) break;
    value += ` ${line.trim()}`;
  }
  return value.trim();
}

/**
 * Поле присутствует, но записано не как идентификатор (`**Scope.**`, `- Scope:`, `__Scope__:`).
 * Это отдельный класс дефекта: содержимое есть, а гейты и приёмка ищут `Scope:` и не находят.
 */
export function hasNonCanonicalField(description, field) {
  const re = new RegExp(`(^|\\n)\\s*(\\*\\*|__|- |\\* )+${escapeRe(field)}\\s*(\\*\\*|__)?\\s*[.:]`, 'i');
  return re.test(String(description));
}

/**
 * Английские абзацы. Правило проекта: описание пишется по-русски, а имена полей контракта,
 * пути, команды и URL остаются идентификаторами. Поэтому из проверки вырезаются код-блоки
 * и inline-код, а строка считается нарушением только если в ней нет ни одного кириллического
 * слова и не меньше восьми латинских слов подряд.
 */
export function findEnglishProse(description) {
  const body = String(description)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '');
  const hits = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('|') || line.startsWith('>')) continue;
    const stripped = line.replace(/^[-*\d.\s]+/, '');
    const words = stripped.split(/\s+/).filter((w) => /[A-Za-zА-Яа-я]/.test(w));
    if (words.length < 8) continue;
    const latin = words.filter((w) => /^[A-Za-z][A-Za-z'’-]*$/.test(w) && !/[/._:#]/.test(w)).length;
    const cyrillic = words.filter((w) => /[А-Яа-я]/.test(w)).length;
    if (cyrillic === 0 && latin >= 8) hits.push(stripped.slice(0, 120));
  }
  return hits;
}

/**
 * `scope` разделяет два класса дефектов:
 *   `text`  — чинится правкой описания;
 *   `field` — чинится правкой поля карточки (спринт, блокер, исполнитель).
 * Разделение нужно, чтобы дефект поля не запрещал улучшать текст: карточка со
 * `status=blocked_by` без блокера иначе навсегда остаётся с плохим описанием,
 * потому что любая запись текста упирается в ошибку, которую текст не исправляет.
 */
const problem = (level, code, message, scope = 'text') => ({ level, code, message, scope });

/**
 * Проверить карточку.
 *
 * @param {object} task — поля борда: description, area, kind, status, sprint, needs_human,
 *                        blocked_by, depends_on, assignee, title.
 * @param {object} [options]
 * @param {boolean} [options.creating] — проверка на создании (спринт и area обязательны сразу).
 * @returns {{errors: object[], warnings: object[], problems: object[]}}
 */
export function validateBoardTask(task, options = {}) {
  const { creating = false } = options;
  const description = String(task?.description ?? '');
  const area = task?.area ?? null;
  const status = task?.status ?? null;
  const kind = task?.kind ?? 'task';
  const isHuman = task?.needs_human === true;
  const found = [];

  const contractRequired = AREAS_WITH_CONTRACT.includes(area) && !isHuman;

  if (!task?.sprint && !['done', 'wont_do'].includes(status)) {
    found.push(problem('error', 'no-sprint', 'нет спринта: задача выпадает из планирования (`sprint_id` обязателен)', 'field'));
  }
  if (area && !AREAS_WITH_CONTRACT.includes(area)) {
    found.push(problem('error', 'legacy-area', `area=${area} — в активном workflow допустимы только front и back`, 'field'));
  }
  if (creating && !area) {
    found.push(problem('error', 'no-area', 'не указан area (front | back)', 'field'));
  }
  if (status === 'blocked_by' && !task?.blocked_by && !(task?.depends_on || []).length) {
    found.push(problem('error', 'blocked-without-link', 'status=blocked_by без blocked_by_id/depends_on: блокер не назван', 'field'));
  }
  if (['in_progress', 'review', 'testing'].includes(status) && !task?.assignee) {
    found.push(problem('warn', 'no-assignee', `status=${status} без assignee: непонятно, кто ведёт задачу`, 'field'));
  }

  if (isHuman) {
    // Карточка человека: инструкция по `human-task.md`, без агент-механики и без контракта.
    if (/^##\s*Task Contract/m.test(description)) {
      found.push(
        problem(
          'error',
          'human-with-contract',
          'needs_human=true и при этом есть `## Task Contract`: карточка одновременно объявляет себя ' +
            'чисто человеческой инструкцией и агентским контрактом. Либо снять флаг (работа владельца ' +
            'по своей области — не human-only действие), либо расщепить на две связанные карточки.',
        ),
      );
    }
    const headings = listHeadings(description).map(norm);
    const missing = HUMAN_SECTIONS.filter((s) => !headings.includes(norm(s)));
    if (missing.length) {
      found.push(problem('error', 'human-sections', `needs_human=true, но нет разделов шаблона human-task.md: ${missing.join(', ')}`));
    }
  } else if (contractRequired) {
    const headingsRaw = listHeadings(description);
    const headings = headingsRaw.map(norm);

    if (!headings.length) {
      found.push(problem('error', 'no-sections', 'в описании нет ни одного раздела `##`'));
    } else if (headings[0] !== norm(REQUIRED_SECTIONS[0])) {
      found.push(
        problem(
          'error',
          'lead-not-first',
          `описание начинается с «${headingsRaw[0]}»: первым разделом обязан быть «## Простыми словами»`,
        ),
      );
    }

    const missing = REQUIRED_SECTIONS.filter((s) => !headings.includes(norm(s)));
    if (missing.length) {
      found.push(problem('error', 'missing-sections', `нет обязательных разделов: ${missing.join(', ')}`));
    }

    const order = REQUIRED_SECTIONS.map((s) => headings.indexOf(norm(s))).filter((i) => i >= 0);
    if (order.length > 1 && order.some((v, i, arr) => i > 0 && v < arr[i - 1])) {
      found.push(problem('error', 'section-order', 'обязательные разделы идут не в каноническом порядке'));
    }

    const leadSection = readSection(description, REQUIRED_SECTIONS[0]);
    if (leadSection !== null) {
      const missingLead = LEAD_FIELDS.filter((f) => !new RegExp(`^${escapeRe(f)}\\s*:`, 'im').test(leadSection));
      if (missingLead.length) {
        found.push(problem('error', 'lead-fields', `в «Простыми словами» нет строк: ${missingLead.map((f) => `${f}:`).join(', ')}`));
      }
    }

    const checkBlock = (blockName, fields, code) => {
      const block = readSection(description, blockName);
      if (block === null) {
        found.push(problem('error', `${code}-missing`, `нет блока \`## ${blockName}\``));
        return;
      }
      const absent = [];
      const nonCanonical = [];
      const empty = [];
      for (const field of fields) {
        const value = readFieldValue(block, field);
        if (value === null) {
          if (hasNonCanonicalField(block, field)) nonCanonical.push(field);
          else absent.push(field);
          continue;
        }
        if (value === '' || PLACEHOLDER_VALUES.test(value)) empty.push(field);
      }
      if (absent.length) found.push(problem('error', `${code}-fields`, `в \`${blockName}\` нет полей: ${absent.join(', ')}`));
      if (nonCanonical.length) {
        found.push(
          problem(
            'error',
            `${code}-format`,
            `в \`${blockName}\` поля записаны не как идентификаторы (например \`**Scope.**\` вместо \`Scope:\`): ` +
              `${nonCanonical.join(', ')}. Гейты и приёмка ищут строку \`Имя:\` с начала строки.`,
          ),
        );
      }
      if (empty.length) found.push(problem('error', `${code}-empty`, `в \`${blockName}\` пустые поля или заглушки: ${empty.join(', ')}`));
    };

    checkBlock('Problem History', PROBLEM_HISTORY_FIELDS, 'ph');
    checkBlock('Task Contract', TASK_CONTRACT_FIELDS, 'tc');

    const taskContract = readSection(description, 'Task Contract') ?? '';
    const regression = readFieldValue(taskContract, 'Regression control');
    if (kind === 'bug' && regression !== null && (EXPLICIT_NONE.test(regression) || PLACEHOLDER_VALUES.test(regression))) {
      found.push(
        problem(
          'error',
          'bug-without-regression-control',
          'kind=bug и `Regression control: none`: для дефекта нужен постоянный контроль (guard/тест/прод-проба), ' +
            'разовая ручная проверка не считается',
        ),
      );
    }

    const platform = readFieldValue(taskContract, 'Platform impact');
    if (platform !== null && platform !== '' && !PLATFORM_KEYWORDS.test(platform)) {
      found.push(problem('error', 'platform-impact', '`Platform impact` не называет поверхность (desktop web | mobile web | Android | iOS | shared | none)'));
    }
    if (platform !== null && EXPLICIT_NONE.test(platform)) {
      found.push(problem('warn', 'platform-none-unjustified', '`Platform impact: none` без обоснования: правило требует объяснить, почему ни одна поверхность не затронута'));
    }

    const localization = readFieldValue(taskContract, 'Localization impact');
    if (localization !== null && localization !== '' && !LOCALE_KEYWORDS.test(localization)) {
      found.push(problem('error', 'localization-impact', '`Localization impact` не называет локали RU/BE/UK/PL/EN или `none`'));
    }

    const blockSection = readSection(description, 'Что блокирует');
    if (blockSection && status === 'blocked_by' && /ничего|не блокир|нет блок/i.test(blockSection)) {
      found.push(
        problem(
          'error',
          'blocked-contradiction',
          'status=blocked_by, а раздел «Что блокирует» говорит, что ничего не блокирует: статус и описание противоречат друг другу',
        ),
      );
    }
  }

  const english = findEnglishProse(description);
  if (english.length) {
    const fieldNames = [...PROBLEM_HISTORY_FIELDS, ...TASK_CONTRACT_FIELDS];
    const inFields = english.filter((line) => fieldNames.some((f) => line.startsWith(`${f}:`)));
    const inBody = english.filter((line) => !fieldNames.some((f) => line.startsWith(`${f}:`)));
    if (inBody.length) {
      found.push(problem('warn', 'english-body', `английские абзацы в теле (${inBody.length}): «${inBody[0].slice(0, 70)}…»`));
    }
    if (inFields.length) {
      found.push(problem('warn', 'english-contract', `значения полей контракта по-английски (${inFields.length}): «${inFields[0].slice(0, 70)}…»`));
    }
  }

  if (contractRequired && description.length < 400) {
    found.push(problem('warn', 'too-short', `описание ${description.length} символов: для контракта архитекторского уровня это заглушка`));
  }

  return {
    problems: found,
    errors: found.filter((p) => p.level === 'error'),
    warnings: found.filter((p) => p.level === 'warn'),
    /** Ошибки, которые действительно чинятся правкой описания. */
    textErrors: found.filter((p) => p.level === 'error' && p.scope === 'text'),
    /** Ошибки полей карточки: их правит смена поля, а не текст. */
    fieldErrors: found.filter((p) => p.level === 'error' && p.scope === 'field'),
  };
}
