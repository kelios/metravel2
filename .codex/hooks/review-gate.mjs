#!/usr/bin/env node
/**
 * review-gate — автоматический код-ревью гейт на переходе задачи борда `review → testing`
 * и продолжение цепочки `testing → QA/deploy → done`.
 *
 * Гейт работает в две стороны:
 *   PostToolUse (толкает)  — как только задача переведена в `review`, требует немедленно
 *                            запустить агента `code-review-gate`; как только она оказалась
 *                            в `testing` — требует запустить QA/приёмку (`board-reviewer`).
 *                            Ревью и приёмка перестают быть «по требованию пользователя».
 *   PreToolUse  (держит)   — блокирует `status=testing` без свежего вердикта `pass`,
 *                            чтобы задачу нельзя было протащить в QA мимо ревью.
 *
 * Режимы:
 *   (stdin JSON)                       hook для `metravel_task_update` (Pre + Post).
 *   record --task <id> --verdict pass|changes_requested [--findings N] [--note "..."]
 *          [--paths <a,b,…> | --paths-file <файл>] [--base <rev>]
 *                                      Пишет вердикт агента `code-review-gate` с отпечатком diff'а.
 *   show --task <id>                   Печатает состояние вердикта (exit 0 = пропустит, 1 = нет).
 *
 * Вердикты живут в `.codex-temp/review-gate/<task_id>.json` (ignored-папка).
 * Scope вердикта — карта `path → blob-hash`. Отпечаток `fingerprint` считается по содержимому
 * ровно этих путей, а при проверке пересчитывается по той же карте, поэтому обязательные для
 * перехода в `testing` `git add`/`commit`/`push origin main` и `git pull --ff-only` чужих
 * коммитов вердикт НЕ ломают, а любая правка содержимого проверенных файлов — ломает.
 *
 * Два режима scope:
 *   paths (`--paths` / `--paths-file`, #3371) — scope = пути ЗАДАЧИ. Файл входит в отпечаток
 *     всегда; каталог раскрывается в свои изменённые и untracked файлы и запоминается: новый
 *     незакоммиченный файл в нём после ревью ломает вердикт. Незакоммиченные пути вне scope —
 *     чужие (соседняя сессия в общем дереве): вердикт их не видит и ими не ломается. Коммитить
 *     после `pass` надо тем же списком путей.
 *   tree (без флагов, прежнее поведение) — scope = всё, что отличается от базиса ревью (`base` =
 *     merge-base `origin/main` и HEAD на момент записи): изменённые tracked-файлы и untracked.
 *     Любой новый незакоммиченный файл вне scope после ревью ломает вердикт — в общем дереве
 *     это и чужие файлы (REVIEW-GATE-FINGERPRINT-FOREIGN-WORKTREE-001), поэтому режим оставлен
 *     только для совместимости и для чекаута с одной сессией.
 *
 * Явный базис (`record … --paths-file <список> --base <rev>`, #3371, доработка 21.11.2026): базис
 * по умолчанию — merge-base `origin/main` и HEAD. После `push` он равен HEAD, все пути задачи с
 * ним совпадают, и запись отклоняется защитой «ни один путь не отличается от базиса». Между тем
 * перезаписать вердикт бывает нужно именно тогда: слияние или rebase на ушедший `origin/main`
 * принесли чужие строки в файл из scope, blob изменился, вердикт `stale`. `--base <sha до коммита
 * задачи>` считает защиту и раскрытие каталогов от названного коммита, отпечаток — по содержимому
 * рабочего дерева, как всегда. Базис обязан быть коммитом-предком HEAD, и от него обязан
 * отличаться каждый путь списка; в вердикт пишутся `base_explicit: true` и `base_distance`.
 *
 * Аварийный обход: REVIEW_GATE_BYPASS=1 (пишется в systemMessage, чтобы обход был видимым).
 * Максимальный возраст вердикта: REVIEW_GATE_MAX_AGE_HOURS (по умолчанию 24).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const GATE_DIR_REL = '.codex-temp/review-gate';
const TARGET_TOOL = 'mcp__metravel-task-board__metravel_task_update';
const GUARDED_STATUS = 'testing';
const REVIEW_STATUS = 'review';
const MAX_AGE_HOURS = Number(process.env.REVIEW_GATE_MAX_AGE_HOURS || 24);
const REVIEWER_AGENT = 'code-review-gate';
const ACCEPTANCE_AGENT = 'board-reviewer';

function git(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function repoRoot() {
  const fromEnv = process.env.CLAUDE_PROJECT_DIR;
  if (fromEnv) return fromEnv;
  const top = git(['rev-parse', '--show-toplevel'], process.cwd()).trim();
  return top || process.cwd();
}

/** Верхняя граница scope: больше путей в одном вердикте не бывает (защита от мусорного дерева). */
const SCOPE_CAP = 2000;

/**
 * Базис ревью: merge-base `origin/main` и HEAD на момент записи вердикта (при HEAD == origin/main
 * это сам `origin/main`). Пинуется в вердикт, чтобы push задачи в `main` не сдвигал базис и не
 * «протухал» уже пройденное ревью.
 *
 * Почему не просто `origin/main`: если HEAD отстал от него (соседняя сессия запушила раньше),
 * diff с `origin/main` показывает «обратные» чужие коммиты, которых в дереве ещё нет, и
 * последующий `git pull --ff-only` менял отпечаток без единой правки задачи (#2456, 18.10.2026).
 */
function resolveBase(root) {
  const origin = git(['rev-parse', '--verify', '--quiet', 'origin/main'], root).trim();
  const head = git(['rev-parse', '--verify', '--quiet', 'HEAD'], root).trim();
  if (origin && head) {
    const common = git(['merge-base', origin, head], root).trim();
    if (common) return common;
  }
  return origin || head || 'empty';
}

/** Явный базис `record --base <rev>`: существующий коммит-предок HEAD, иначе запись отклоняется. */
function resolveExplicitBase(root, rev) {
  const sha = rev.startsWith('-') ? '' : git(['rev-parse', '--verify', '--quiet', `${rev}^{commit}`], root).trim();
  if (!sha) throw new Error(`--base ${rev}: такого коммита в репозитории нет`);
  const head = git(['rev-parse', '--verify', '--quiet', 'HEAD'], root).trim();
  if (!head || git(['merge-base', sha, head], root).trim() !== sha) {
    throw new Error(`--base ${rev} (${sha.slice(0, 12)}) не предок HEAD: базис — коммит, от которого задача ушла (sha до коммита задачи или merge-base с origin/main)`);
  }
  return sha;
}

function zList(output) {
  return output.split('\0').filter(Boolean);
}

/** Пути рабочего дерева, отличающиеся от базиса: изменённые и удалённые tracked-файлы плюс
 *  untracked (не ignored) — ровно тот набор, который видит ревьюер. */
function diffPaths(root, base) {
  const tracked = zList(git(['diff', '--no-renames', '--name-only', '-z', base, '--'], root));
  const untracked = zList(git(['ls-files', '--others', '--exclude-standard', '-z'], root));
  return [...new Set([...tracked, ...untracked])].sort();
}

/** Незакоммиченные пути: изменённые/удалённые относительно HEAD (индекс и дерево) плюс untracked. */
function uncommittedPaths(root) {
  const tracked = zList(git(['diff', 'HEAD', '--no-renames', '--name-only', '-z', '--'], root));
  const untracked = zList(git(['ls-files', '--others', '--exclude-standard', '-z'], root));
  return [...new Set([...tracked, ...untracked])].sort();
}

/** blob-id содержимого файла рабочего дерева (как `git hash-object` без фильтров): один и тот же
 *  и до, и после `git add`/`commit`. Симлинк хэшируется по цели, отсутствующий файл — `deleted`,
 *  каталог и прочее — `unreadable`. */
function blobHash(root, file) {
  const abs = path.join(root, file);
  let stat;
  try {
    stat = lstatSync(abs);
  } catch {
    return 'deleted';
  }
  let content;
  try {
    if (stat.isSymbolicLink()) content = Buffer.from(readlinkSync(abs));
    else if (stat.isFile()) content = readFileSync(abs);
    else return 'unreadable';
  } catch {
    return 'unreadable';
  }
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
}

/**
 * Отпечаток scope: sha256 над `base` и картой `path → blob-hash` для переданных путей.
 *
 * Считается по содержимому, поэтому `git add`, `commit`, `push origin main` и `pull --ff-only`
 * чужих коммитов отпечаток не меняют: тот же файл с тем же содержимым даёт тот же blob-hash.
 * Меняет отпечаток только новая правка проверенных файлов после ревью — ровно это гейт и ловит.
 */
function fingerprintScope(root, base, paths) {
  const entries = {};
  const lines = [`base:${base}`, `paths:${paths.length}`];
  for (const file of paths) {
    entries[file] = blobHash(root, file);
    lines.push(`${file}\t${entries[file]}`);
  }
  return {
    fingerprint: `sha256:${createHash('sha256').update(lines.join('\n')).digest('hex')}`,
    entries,
  };
}

/** Scope режима `tree` на момент записи вердикта: всё, что отличается от базиса. */
function recordScope(root, base) {
  return fingerprintScope(root, base, diffPaths(root, base).slice(0, SCOPE_CAP));
}

const SCOPE_MODE_PATHS = 'paths';

/** Путь задачи → posix-путь от корня репозитория; `null`, если он пустой или выходит за корень. */
function normalizeTaskPath(root, raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const relative = path.relative(root, path.resolve(root, text)).split(path.sep).join('/');
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) return null;
  return relative;
}

/** Список путей задачи из `--paths a,b` и/или `--paths-file <файл>` (по одному в строке, `#` — комментарий). */
function readTaskPaths(root, args) {
  const raw = [];
  if (typeof args.paths === 'string') raw.push(...args.paths.split(/[,\n]/));
  if (typeof args['paths-file'] === 'string') {
    const file = path.resolve(root, args['paths-file']);
    raw.push(...readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => !line.trim().startsWith('#')));
  }
  const cleaned = raw.map((item) => item.trim()).filter(Boolean);
  const invalid = cleaned.filter((item) => !normalizeTaskPath(root, item));
  if (invalid.length) throw new Error(`путь задачи вне репозитория: ${listPaths(invalid)}`);
  return [...new Set(cleaned.map((item) => normalizeTaskPath(root, item)))].sort();
}

function isDirectory(root, file) {
  try {
    return lstatSync(path.join(root, file)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Scope режима `paths`: объявленные файлы плюс раскрытые каталоги задачи.
 *
 * Опечатка в пути не должна давать пустой отпечаток, который «пройдёт» при любом коде, поэтому
 * путь обязан существовать в дереве либо в базисе (удалённый задачей файл), а каталог — содержать
 * хотя бы один изменённый или untracked файл.
 */
function recordTaskScope(root, base, declared, explicitBase = false) {
  const changed = diffPaths(root, base);
  const files = new Set();
  const dirs = [];
  const unknown = [];
  for (const item of declared) {
    // Тип в базисе нужен для удалённого задачей: каталога в дереве уже нет, а его файлы — в diff'е.
    const baseType = git(['cat-file', '-t', `${base}:${item}`], root).trim();
    if (isDirectory(root, item) || baseType === 'tree') {
      const inside = changed.filter((file) => file.startsWith(`${item}/`));
      if (!inside.length) unknown.push(`${item}/ (в каталоге нет изменений)`);
      dirs.push(item);
      for (const file of inside) files.add(file);
      continue;
    }
    if (blobHash(root, item) === 'deleted' && baseType !== 'blob') {
      unknown.push(item);
      continue;
    }
    files.add(item);
  }
  if (unknown.length) throw new Error(`путь задачи не найден ни в дереве, ни в базисе: ${listPaths(unknown)}`);
  if (!files.size) throw new Error('список путей задачи пуст');
  if (files.size > SCOPE_CAP) throw new Error(`в scope задачи больше ${SCOPE_CAP} путей`);
  // Список только из нетронутых файлов отпечатывает «ничего» и пропустил бы любой непроверенный diff.
  const changedSet = new Set(changed);
  if (![...files].some((file) => changedSet.has(file))) {
    // После push базис по умолчанию равен HEAD — выход из тупика называет само сообщение.
    const hint = explicitBase ? '' : '. Diff задачи уже закоммичен и запушен — передай базис явно: --base <sha до коммита задачи>';
    throw new Error(`ни один путь задачи не отличается от базиса ${base.slice(0, 12)}: ${listPaths([...files].sort())}${hint}`);
  }
  // Явный базис выбирает сам вызывающий: от далёкого предка «отличается» почти любой файл, поэтому
  // здесь каждый путь списка обязан быть изменён относительно него — иначе это не базис задачи.
  const unchanged = explicitBase ? [...files].filter((file) => !changedSet.has(file)).sort() : [];
  if (unchanged.length) {
    throw new Error(`с явным базисом ${base.slice(0, 12)} каждый путь задачи должен от него отличаться; совпадают: ${listPaths(unchanged)}`);
  }
  const scoped = [...files].sort();
  const outside = uncommittedPaths(root).filter((file) => !files.has(file));
  // Незакоммиченный сосед файла задачи по каталогу — самый частый забытый в списке путь.
  const parents = new Set(scoped.map((file) => path.posix.dirname(file)).filter((dir) => dir !== '.'));
  const neighbours = outside.filter((file) => parents.has(path.posix.dirname(file)));
  return { ...fingerprintScope(root, base, scoped), dirs: dirs.sort(), outside, neighbours };
}

function listPaths(paths, limit = 5) {
  const head = paths.slice(0, limit).join(', ');
  return paths.length > limit ? `${head} … (+${paths.length - limit})` : head;
}

function verdictPath(root, taskId) {
  return path.join(root, GATE_DIR_REL, `${taskId}.json`);
}

function readVerdict(root, taskId) {
  try {
    return JSON.parse(readFileSync(verdictPath(root, taskId), 'utf8'));
  } catch {
    return null;
  }
}

function ageHours(isoString) {
  const at = Date.parse(isoString || '');
  if (Number.isNaN(at)) return Infinity;
  return (Date.now() - at) / 3_600_000;
}

/** Решение гейта по записанному вердикту. */
function evaluate(root, taskId) {
  const verdict = readVerdict(root, taskId);
  if (!verdict) {
    return {
      ok: false,
      code: 'missing',
      detail: `вердикта код-ревью нет (${GATE_DIR_REL}/${taskId}.json отсутствует)`,
    };
  }
  if (verdict.verdict !== 'pass') {
    const findings = verdict.findings ?? '?';
    return {
      ok: false,
      code: 'changes_requested',
      detail: `последний вердикт — \`${verdict.verdict}\`, findings: ${findings}${verdict.note ? ` («${verdict.note}»)` : ''}`,
      verdict,
    };
  }
  const age = ageHours(verdict.recorded_at);
  if (age > MAX_AGE_HOURS) {
    return {
      ok: false,
      code: 'expired',
      detail: `вердикт \`pass\` устарел (${age.toFixed(1)} ч > ${MAX_AGE_HOURS} ч)`,
      verdict,
    };
  }
  const recordedBase = String(verdict.base || '');
  const base = recordedBase && git(['rev-parse', '--verify', '--quiet', `${recordedBase}^{commit}`], root).trim()
    ? recordedBase
    : resolveBase(root);
  // Вердикты до 18.10.2026 без карты `scope`: scope берётся по текущему diff'у с базисом (старый алгоритм).
  const legacy = !verdict.scope || typeof verdict.scope !== 'object';
  const scopePaths = legacy ? diffPaths(root, base).slice(0, SCOPE_CAP) : Object.keys(verdict.scope).sort();
  const { fingerprint: current, entries } = fingerprintScope(root, base, scopePaths);
  if (verdict.fingerprint !== current) {
    const changed = legacy ? [] : scopePaths.filter((file) => verdict.scope[file] !== entries[file]);
    return {
      ok: false,
      code: 'stale',
      detail: `код изменился после ревью (отпечаток diff'а не совпадает с проверенным${changed.length ? `: ${listPaths(changed)}` : ''})`,
      verdict,
      current,
    };
  }
  if (!legacy) {
    const scopeSet = new Set(scopePaths);
    const outside = uncommittedPaths(root).filter((file) => !scopeSet.has(file));
    if (verdict.scope_mode === SCOPE_MODE_PATHS) {
      // Scope по путям задачи (#3371): чужие незакоммиченные файлы общего дерева вердикт не
      // ломают. Ломает только новый файл в каталоге, который задача объявила своим.
      const dirs = Array.isArray(verdict.scope_dirs) ? verdict.scope_dirs : [];
      const extras = outside.filter((file) => dirs.some((dir) => file.startsWith(`${dir}/`)));
      if (extras.length) {
        return {
          ok: false,
          code: 'stale',
          detail: `после ревью в каталоге задачи появились незакоммиченные файлы вне проверенного scope: ${listPaths(extras)}`,
          verdict,
          current,
        };
      }
      return { ok: true, code: 'pass', verdict, current, outside: outside.filter((file) => !extras.includes(file)) };
    }
    if (outside.length) {
      return {
        ok: false,
        code: 'stale',
        detail: `после ревью в рабочем дереве появились незакоммиченные изменения вне проверенного scope: ${listPaths(outside)}. Если это файлы соседней сессии — перезапиши вердикт по путям задачи: \`record … --paths-file <список>\``,
        verdict,
        current,
      };
    }
  }
  return { ok: true, code: 'pass', verdict, current };
}

function denyReason(taskId, result) {
  const lines = [
    `Код-ревью гейт не пройден: задачу #${taskId} нельзя перевести в \`${GUARDED_STATUS}\`.`,
    `Причина: ${result.detail}.`,
    '',
    'Что сделать (по порядку):',
    `1. Запусти субагента \`${REVIEWER_AGENT}\` через Agent tool: subagent_type="${REVIEWER_AGENT}", в промпте передай id задачи #${taskId} и scope diff'а.`,
    '2. Если вердикт `changes_requested` — сначала исправь findings (дубли, неоптимальный код, нарушения правил проекта), задача остаётся/возвращается в `in_progress`.',
    `3. После \`pass\` агент сам запишет вердикт, закоммитит и запушит diff задачи в \`main\`, и только потом переведёт задачу в \`${GUARDED_STATUS}\` — повторять этот вызов вручную не нужно.`,
  ];
  if (result.code === 'changes_requested' && Array.isArray(result.verdict?.blocking)) {
    lines.push('', 'Незакрытые findings:');
    for (const item of result.verdict.blocking.slice(0, 10)) lines.push(`- ${item}`);
  }
  return lines.join('\n');
}

/** Директива оркестратору после того, как задача реально оказалась в `review`. */
function autoReviewDirective(taskId, result) {
  if (result.ok) {
    return [
      `АВТО-ГЕЙТ БОРДА: задача #${taskId} в \`${REVIEW_STATUS}\`, и свежий вердикт \`pass\` агента \`${REVIEWER_AGENT}\` для текущего diff'а уже есть.`,
      '',
      `1. Если задачу вернули в \`${REVIEW_STATUS}\` не из-за кода (неполный Task Contract, описание не по правилу, замечание приёмки) — сначала закрой причину возврата.`,
      `2. Затем закоммить и запушь diff задачи в \`main\` (\`git add <пути задачи>\` → \`git commit\` → \`git push origin main\`; \`git add -A\` в общем чекауте запрещён) и только после этого переведи задачу в \`${GUARDED_STATUS}\` (\`metravel_task_update\`) — повторное ревью того же diff'а не нужно.`,
    ].join('\n');
  }
  return [
    `АВТО-ГЕЙТ БОРДА: задача #${taskId} переведена в \`${REVIEW_STATUS}\`. Код-ревью на этом переходе запускается АВТОМАТИЧЕСКИ — не жди просьбы пользователя, не откладывай на конец сессии и не спрашивай разрешения (board pipeline, AGENTS.md §4).`,
    `Состояние гейта: ${result.code} — ${result.detail}.`,
    '',
    'Сделай это СЛЕДУЮЩИМ действием:',
    `1. Вызови Agent tool с subagent_type="${REVIEWER_AGENT}"; в промпте передай id #${taskId}, список путей задачи (он же уйдёт в \`record --paths-file\` и в \`git add\`) и что уже проверено.`,
    `2. Вердикт \`changes_requested\` → агент сам вернёт задачу в \`in_progress\` с findings. Почини их и снова поставь \`${REVIEW_STATUS}\` — ревью прогонится заново автоматически.`,
    `3. Вердикт \`pass\` → агент сам запишет вердикт, закоммитит и запушит diff задачи в \`main\` (\`git add <пути задачи>\` → \`git commit\` → \`git push origin main\`) и только потом переведёт задачу в \`${GUARDED_STATUS}\`. Коммит и push отпечаток ревью не ломают. Руками статус не двигай: PreToolUse-гейт всё равно откажет.`,
    `4. Задачу без своего diff'а (код уже закоммичен и задеплоен, чужой scope в дереве) не гоняй через агента: отметь это в тикете и закрывай по факту приёмки.`,
  ].join('\n');
}

/** Директива оркестратору после того, как задача реально оказалась в `testing`. */
function autoAcceptanceDirective(taskId) {
  return [
    `АВТО-ГЕЙТ БОРДА: задача #${taskId} прошла код-ревью и переведена в \`${GUARDED_STATUS}\`. QA-приёмка продолжается АВТОМАТИЧЕСКИ, тем же проходом — не жди отдельной просьбы пользователя.`,
    '',
    'Сделай это СЛЕДУЮЩИМ действием:',
    `1. Код задачи на этом шаге уже закоммичен и запушен в \`main\` (условие гейта). Выкати его на прод: Agent tool с subagent_type="frontend-deployer" и коротким промптом — одна команда \`DEPLOY_QUIET=1 scripts/deploy-prod.sh <sha коммита задачи>\`; изолированный worktree, общий лок и проверку параллельного выката делает сам скрипт (\`docs/WORKFLOW_OPERATIONS.md\` §3.5). Ручной preflight и сухой прогон не нужны, отчёт — итоговые строки вывода; бюджет выката ≤5 минут (#2013). Отдельной команды владельца на прод-деплой web-фронтенда не нужно (правило 20.09.2026). EAS и публикацию в стор без явной команды не запускай; dev-стенд — только по явному запросу.`,
    `2. Вызови Agent tool с subagent_type="${ACCEPTANCE_AGENT}" и id #${taskId}: он сверяет, что выкаченный sha (\`curl -s https://metravel.by/.build-source.json\`) содержит коммит задачи, и прогоняет тесты и браузер/API/устройство-пробы против прода \`https://metravel.by\` по \`Task Contract\`.`,
    `3. Done gate зелёный → \`${ACCEPTANCE_AGENT}\` сам ставит \`done\` с evidence. Найден дефект → задача возвращается в \`in_progress\`, и после фикса цикл \`${REVIEW_STATUS}\` → \`${GUARDED_STATUS}\` повторится сам.`,
    '4. `done` руками не ставь: закрывает только приёмка с доказательством (тест/браузер/устройство + target env).',
  ].join('\n');
}

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function allow(systemMessage) {
  if (systemMessage) emit({ systemMessage, suppressOutput: true });
  process.exit(0);
}

/** Обновление статуса не применилось — толкать цепочку дальше нельзя. */
function toolFailed(response) {
  if (!response || typeof response !== 'object') return false;
  return response.isError === true || response.is_error === true || response.status === 'error' || Boolean(response.error);
}

/** PostToolUse: статус уже изменён — сообщаем оркестратору, что делать дальше. */
function runPostHook(input, toolInput, taskId) {
  if (toolFailed(input.tool_response)) allow();

  const root = repoRoot();
  const status = toolInput.status;

  if (status === REVIEW_STATUS) {
    const result = evaluate(root, taskId);
    emit({
      systemMessage: result.ok
        ? `review-gate: #${taskId} в review, вердикт ${REVIEWER_AGENT} свежий — можно сразу в ${GUARDED_STATUS}`
        : `review-gate: #${taskId} в review — запускаю код-ревью (${REVIEWER_AGENT}) автоматически`,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: autoReviewDirective(taskId, result),
      },
    });
    process.exit(0);
  }

  emit({
    systemMessage: `review-gate: #${taskId} в ${GUARDED_STATUS} — дальше выкат на прод (frontend-deployer) и QA-приёмка на проде (${ACCEPTANCE_AGENT}) до \`done\``,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: autoAcceptanceDirective(taskId),
    },
  });
  process.exit(0);
}

/** PreToolUse: держим `testing` закрытым, пока нет свежего вердикта `pass`. */
function runPreHook(taskId) {
  if (process.env.REVIEW_GATE_BYPASS === '1') {
    allow(`review-gate: обход по REVIEW_GATE_BYPASS=1 (задача #${taskId} уходит в ${GUARDED_STATUS} без вердикта ревью)`);
  }

  const root = repoRoot();
  const result = evaluate(root, taskId);

  if (result.ok) {
    allow(`review-gate: код-ревью #${taskId} пройдено (${REVIEWER_AGENT}), переход в ${GUARDED_STATUS} разрешён`);
  }

  emit({
    systemMessage: `review-gate: переход #${taskId} → ${GUARDED_STATUS} заблокирован (${result.code}); нужен вердикт агента ${REVIEWER_AGENT}`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: denyReason(taskId, result),
    },
  });
  process.exit(0);
}

/** Общий вход хука: один скрипт обслуживает и PreToolUse, и PostToolUse. */
function runHook() {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    allow();
  }

  let input;
  try {
    input = JSON.parse(raw || '{}');
  } catch {
    allow();
  }

  if (input.tool_name !== TARGET_TOOL) allow();

  const toolInput = input.tool_input || {};
  const status = toolInput.status;
  if (status !== REVIEW_STATUS && status !== GUARDED_STATUS) allow();

  const taskId = toolInput.task_id;
  if (!taskId) allow();

  if (input.hook_event_name === 'PostToolUse') runPostHook(input, toolInput, taskId);

  // PreToolUse стережёт только вход в `testing`; переход в `review` не блокируется никогда.
  if (status !== GUARDED_STATUS) allow();
  runPreHook(taskId);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key.slice(2)] = true;
      continue;
    }
    out[key.slice(2)] = next;
    i += 1;
    // `--paths a b c` (например, `--paths $(cat список)`) — все значения до следующего флага.
    if (key === '--paths') {
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        out.paths += `,${argv[i + 1]}`;
        i += 1;
      }
    }
  }
  return out;
}

function runRecord(argv) {
  const args = parseArgs(argv);
  const taskId = Number(args.task);
  const verdict = String(args.verdict || '');
  if (!taskId || !['pass', 'changes_requested'].includes(verdict)) {
    process.stderr.write('usage: review-gate.mjs record --task <id> --verdict pass|changes_requested [--paths a,b | --paths-file <file>] [--base <rev>] [--findings N] [--note "..."] [--blocking "a;b"] [--reviewer name]\n');
    process.exit(2);
  }
  // Флаг без значения — ошибка вызова, а не тихий откат к отпечатку по всему дереву.
  for (const flag of ['paths', 'paths-file', 'base']) {
    if (args[flag] === true) throw new Error(`--${flag} требует значение`);
  }

  const root = repoRoot();
  const byPaths = args.paths !== undefined || args['paths-file'] !== undefined;
  // По всему дереву явный базис затянул бы в scope чужие коммиты между ним и HEAD.
  if (args.base !== undefined && !byPaths) throw new Error('--base работает только со списком путей задачи (--paths / --paths-file)');
  const explicitBase = args.base === undefined ? null : resolveExplicitBase(root, String(args.base));
  const base = explicitBase || resolveBase(root);
  const taskScope = byPaths ? recordTaskScope(root, base, readTaskPaths(root, args), Boolean(explicitBase)) : null;
  // Сколько коммитов между явным базисом и HEAD: далёкий предок виден в записи, а не только в sha.
  const baseDistance = explicitBase ? Number(git(['rev-list', '--count', `${explicitBase}..HEAD`], root).trim() || 0) : null;
  const { fingerprint, entries: scope } = taskScope || recordScope(root, base);
  const payload = {
    task_id: taskId,
    verdict,
    reviewer: String(args.reviewer || REVIEWER_AGENT),
    findings: args.findings === undefined ? (verdict === 'pass' ? 0 : null) : Number(args.findings),
    note: args.note ? String(args.note) : '',
    blocking: args.blocking ? String(args.blocking).split(';').map((s) => s.trim()).filter(Boolean) : [],
    base,
    // Базис назван в `record --base`, а не выведен из `origin/main` (перезапись после merge/rebase/push).
    ...(explicitBase ? { base_explicit: true, base_distance: baseDistance } : {}),
    // Вердикты без `scope_mode` записаны до #3371 и проверяются по всему дереву.
    ...(taskScope ? { scope_mode: SCOPE_MODE_PATHS, scope_dirs: taskScope.dirs } : {}),
    scope,
    fingerprint,
    recorded_at: new Date().toISOString(),
  };

  mkdirSync(path.join(root, GATE_DIR_REL), { recursive: true });
  writeFileSync(verdictPath(root, taskId), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  if (taskScope?.neighbours.length) {
    process.stderr.write(`review-gate: ВНИМАНИЕ — рядом с файлами задачи есть незакоммиченные пути вне scope (${taskScope.neighbours.length}): ${listPaths(taskScope.neighbours)}. Если они из задачи — допиши их в список и перезапиши вердикт; чужие оставь.\n`);
  }
  process.stdout.write(`${JSON.stringify({ recorded: verdictPath(root, taskId), verdict: payload.verdict, base: payload.base, ...(explicitBase ? { base_explicit: true, base_distance: baseDistance } : {}), scope_mode: taskScope ? SCOPE_MODE_PATHS : 'tree', paths: Object.keys(scope).length, ...(taskScope ? { outside_scope: taskScope.outside } : {}), fingerprint: payload.fingerprint })}\n`);
}

function runShow(argv) {
  const args = parseArgs(argv);
  const taskId = Number(args.task);
  if (!taskId) {
    process.stderr.write('usage: review-gate.mjs show --task <id>\n');
    process.exit(2);
  }
  const root = repoRoot();
  const result = evaluate(root, taskId);
  process.stdout.write(`${JSON.stringify({ task_id: taskId, gate: result.ok ? 'open' : 'closed', code: result.code, detail: result.detail || null, ...(result.outside ? { outside_scope: result.outside } : {}), verdict: result.verdict || null }, null, 2)}\n`);
  process.exit(result.ok ? 0 : 1);
}

const [mode, ...rest] = process.argv.slice(2);
try {
  if (mode === 'record') runRecord(rest);
  else if (mode === 'show' || mode === 'check') runShow(rest);
  else runHook();
} catch (error) {
  // Внутренняя ошибка гейта не должна вешать борд: пропускаем вызов, но громко об этом сообщаем.
  if (mode === 'record' || mode === 'show' || mode === 'check') {
    process.stderr.write(`review-gate error: ${error?.message || error}\n`);
    process.exit(2);
  }
  emit({ systemMessage: `review-gate: хук упал (${error?.message || error}); переход НЕ проверен` });
  process.exit(0);
}
