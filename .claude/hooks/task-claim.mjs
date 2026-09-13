#!/usr/bin/env node
/**
 * task-claim — гейт «одну карточку борда ведёт одна сессия».
 *
 * Зачем: 13.09.2026 две параллельные сессии одновременно вели #1923 и с разницей
 * в пятнадцать секунд применили на прод РАЗНЫЙ текст одного и того же шага квеста
 * через `apply-quest-patches.js`. Ни борд, ни API, ни скрипт не возразили: последний
 * писатель выиграл молча. Столкновение заметили случайно — по чужому mtime общего
 * data-файла. Статус `in_progress` с проставленным `assignee` читался как «работа
 * брошена, доделывай», хотя означал живую сессию прямо сейчас.
 *
 * Правило WIP=1 («одна задача за раз») было прозой, а проза этого не удержала:
 * взять карточку можно было, ни разу не спросив, кто её уже держит.
 *
 * Что делает:
 *   PreToolUse  `metravel_task_update` со `status=in_progress`
 *       — блокирует взятие карточки, которую держит ЖИВАЯ чужая сессия, и называет
 *         её имя: дальше разговор через SendMessage, а не молчаливый перехват.
 *   PostToolUse `metravel_task_update`
 *       — `in_progress` пишет/обновляет claim этой сессии;
 *         `done`/`wont_do`/`todo`/`backlog` снимают claim.
 *   PostToolUse `metravel_task_get`
 *       — читающая сторона: открыл карточку в работе, которую держит чужая живая
 *         сессия (или claim'а нет, но в проекте есть другие живые сессии) — получаешь
 *         предупреждение ДО того, как начал править. Это и есть дыра, в которую
 *         провалился #1923: карточка уже была `in_progress`, своего `task_update`
 *         сессия не делала, и пишущий гейт бы не сработал.
 *
 * Живость сессии определяется по её транскрипту (`~/.claude/projects/<slug>/<id>.jsonl`):
 * файл дописывается на каждом ходу, поэтому свежий mtime = сессия работает. Протухший
 * claim (сессия молчит дольше TASK_CLAIM_IDLE_MINUTES) перехватывается свободно и с
 * записью в systemMessage — брошенная карточка не должна блокировать борд.
 *
 * Claim'ы живут в `.codex-temp/task-claim/<task_id>.json` (ignored-папка): это состояние
 * машины, а не репозитория — на другой машине чужих сессий нет по определению.
 *
 * Режимы:
 *   (stdin JSON)               хук PreToolUse/PostToolUse.
 *   show [--task <id>]         показать claim (без задачи — все).
 *   release --task <id>        снять claim вручную.
 *
 * Аварийный обход: TASK_CLAIM_BYPASS=1 (пишется в systemMessage, чтобы обход был видимым).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CLAIM_DIR_REL = '.codex-temp/task-claim';
const UPDATE_TOOL = 'mcp__metravel-task-board__metravel_task_update';
const GET_TOOL = 'mcp__metravel-task-board__metravel_task_get';

/** Статусы, в которых карточку кто-то ведёт: claim держится. */
const WORKING_STATUSES = new Set(['in_progress', 'review', 'testing']);
/** Единственный статус, вход в который гейт блокирует: это и есть момент «взял карточку». */
const CLAIMING_STATUS = 'in_progress';
/** Карточка вышла из работы — claim снимается, кто бы его ни держал. */
const RELEASING_STATUSES = new Set(['done', 'wont_do', 'todo', 'backlog']);

/**
 * Сколько сессия может молчать, оставаясь «живой». Ход агента редко длится дольше
 * нескольких минут, но между ходами сессия ждёт человека — поэтому окно щедрое.
 */
const IDLE_MINUTES = Number(process.env.TASK_CLAIM_IDLE_MINUTES || 45);

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function allow(systemMessage) {
  if (systemMessage) emit({ systemMessage, suppressOutput: true });
  process.exit(0);
}

function repoRoot() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function claimPath(root, taskId) {
  return path.join(root, CLAIM_DIR_REL, `${taskId}.json`);
}

function readClaim(root, taskId) {
  try {
    return JSON.parse(readFileSync(claimPath(root, taskId), 'utf8'));
  } catch {
    return null;
  }
}

function writeClaim(root, claim) {
  const file = claimPath(root, claim.task_id);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(claim, null, 2)}\n`);
}

function dropClaim(root, taskId) {
  try {
    rmSync(claimPath(root, taskId));
    return true;
  } catch {
    return false;
  }
}

const minutesSince = (ms) => (Date.now() - ms) / 60000;

/**
 * Живость сессии по её транскрипту. Транскрипт дописывается на каждом ходу, поэтому
 * его mtime — прямой сигнал «сессия ещё работает», а не догадка по времени claim'а.
 * Транскрипт мог быть удалён (или хук пришёл без пути) — тогда падаем на возраст claim'а,
 * чтобы недостаток данных не превращался ни в вечную блокировку, ни в свободный перехват.
 */
function claimIsLive(claim) {
  const transcript = claim?.transcript;
  if (transcript && existsSync(transcript)) {
    try {
      return minutesSince(statSync(transcript).mtimeMs) <= IDLE_MINUTES;
    } catch {
      /* падаем на возраст claim'а ниже */
    }
  }
  const stamp = Date.parse(claim?.refreshed_at || claim?.claimed_at || '');
  if (!Number.isFinite(stamp)) return false;
  return minutesSince(stamp) <= IDLE_MINUTES;
}

/** Короткое имя сессии для человека: полный uuid в сообщении бесполезен. */
const shortId = (sessionId) => String(sessionId || 'неизвестная').slice(0, 8);

/** Русское склонение по числу: 1 сессия, 2 сессии, 5 сессий (11–14 — тоже родительный). */
function plural(count, one, few, many) {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/**
 * Другие живые сессии этого проекта — по свежим транскриптам рядом со своим.
 * Нужны там, где claim'а нет вовсе: карточка могла быть взята сессией, которая
 * стартовала до появления гейта (ровно случай #1923).
 */
function livePeerSessions(transcriptPath, ownSessionId) {
  if (!transcriptPath) return [];
  const dir = path.dirname(transcriptPath);
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const peers = [];
  for (const entry of entries) {
    if (!entry.endsWith('.jsonl')) continue;
    const id = entry.slice(0, -'.jsonl'.length);
    if (id === ownSessionId) continue;
    try {
      if (minutesSince(statSync(path.join(dir, entry)).mtimeMs) <= IDLE_MINUTES) peers.push(id);
    } catch {
      /* файл исчез между readdir и stat — не наша забота */
    }
  }
  return peers;
}

function denyReason(taskId, claim) {
  return [
    `Карточку #${taskId} уже ведёт другая живая сессия (${shortId(claim.session_id)}, последняя активность ${claim.refreshed_at || claim.claimed_at}).`,
    '',
    'Статус `in_progress` — это не «работа брошена, доделывай», а «кто-то работает прямо сейчас».',
    'Две сессии на одной карточке пишут в общее дерево и в прод одновременно: последний писатель',
    'выигрывает молча, и по `GET` этого не видно (#1923).',
    '',
    'Что сделать вместо перехвата:',
    `1. \`ListAgents\` — найди сессию ${shortId(claim.session_id)} в списке.`,
    '2. `SendMessage` ей: что она держит по этой карточке, что уже применено наружу, кто доводит.',
    '3. Договорились, что карточка твоя — пусть та сессия её отпустит, либо сними claim вручную:',
    `   \`node .claude/hooks/task-claim.mjs release --task ${taskId}\``,
    '4. Не договорились — возьми другую карточку, эта занята.',
    '',
    'Если та сессия уже мертва, а claim протух, гейт пропустит сам через',
    `${IDLE_MINUTES} минут её молчания. Аварийный обход: TASK_CLAIM_BYPASS=1.`,
  ].join('\n');
}

function peerHoldsItWarning(taskId, claim, status) {
  return [
    `ВНИМАНИЕ: карточку #${taskId} (${status}) держит другая живая сессия — ${shortId(claim.session_id)}.`,
    '',
    'Не начинай по ней работу и НИЧЕГО не применяй наружу (прод-контент, деплой, правки общих',
    'файлов), пока не поговоришь с той сессией: `ListAgents`, затем `SendMessage` — что она',
    'держит, что уже ушло на прод, кто доводит карточку до конца.',
    '',
    'Если пользователь просил именно эту задачу — сначала выясни у соседней сессии её состояние,',
    'потом договоритесь, кто продолжает. Молчаливый параллельный прогон стоил переписанного',
    'прод-контента в #1923.',
  ].join('\n');
}

function unclaimedWarning(taskId, status, peers) {
  return [
    `Карточка #${taskId} уже в статусе \`${status}\`, но claim'а на неё нет, а в проекте сейчас`,
    `${peers.length} ${plural(peers.length, 'другая живая сессия', 'другие живые сессии', 'других живых сессий')}: ${peers.map(shortId).join(', ')}.`,
    '',
    'Статус «в работе» без claim означает одно из двух: карточку взяли до появления гейта, либо её',
    'бросили. Различить можно только спросив.',
    '',
    'Перед тем как править код или применять что-либо наружу:',
    '1. `ListAgents` — посмотри живые сессии.',
    '2. Если какая-то ведёт эту карточку — `SendMessage` ей и договорись, кто продолжает.',
    `3. Карточка твоя — застолби её: \`metravel_task_update(task_id=${taskId}, status="in_progress")\`,`,
    '   это и запишет claim, и закроет её от перехвата.',
  ].join('\n');
}

/** PreToolUse: стережём ровно момент «взял карточку». */
function runPreUpdate(input, toolInput, taskId) {
  if (toolInput.status !== CLAIMING_STATUS) allow();

  const root = repoRoot();
  const claim = readClaim(root, taskId);
  if (!claim) allow();
  if (claim.session_id === input.session_id) allow();

  if (!claimIsLive(claim)) {
    allow(
      `task-claim: claim на #${taskId} от сессии ${shortId(claim.session_id)} протух (молчит дольше ${IDLE_MINUTES} мин) — карточка перехвачена`,
    );
  }

  if (process.env.TASK_CLAIM_BYPASS === '1') {
    allow(
      `task-claim: ОБХОД (TASK_CLAIM_BYPASS=1) — #${taskId} взята мимо живого claim'а сессии ${shortId(claim.session_id)}`,
    );
  }

  emit({
    systemMessage: `task-claim: #${taskId} занята живой сессией ${shortId(claim.session_id)} — взятие заблокировано`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: denyReason(taskId, claim),
    },
  });
  process.exit(0);
}

function toolFailed(response) {
  if (!response || typeof response !== 'object') return false;
  return response.isError === true || response.is_error === true || response.status === 'error' || Boolean(response.error);
}

/** PostToolUse: ставим и снимаем claim по фактически применённому статусу. */
function runPostUpdate(input, toolInput, taskId) {
  if (toolFailed(input.tool_response)) allow();
  const status = toolInput.status;
  if (!status) allow();

  const root = repoRoot();

  if (RELEASING_STATUSES.has(status)) {
    dropClaim(root, taskId);
    allow();
  }

  if (!WORKING_STATUSES.has(status)) allow();

  const existing = readClaim(root, taskId);
  writeClaim(root, {
    task_id: taskId,
    session_id: input.session_id || null,
    transcript: input.transcript_path || null,
    cwd: input.cwd || repoRoot(),
    claimed_at: existing?.session_id === input.session_id ? existing.claimed_at : new Date().toISOString(),
    refreshed_at: new Date().toISOString(),
  });
  allow();
}

/**
 * Статус из ответа MCP: сервер отдаёт то объект задачи, то текстовый JSON в `content`.
 * Гейт не должен зависеть от формы конкретной сборки сервера.
 */
function statusFromResponse(response) {
  if (!response || typeof response !== 'object') return null;
  if (typeof response.status === 'string' && response.status !== 'error') return response.status;
  const blocks = Array.isArray(response.content) ? response.content : [];
  for (const block of blocks) {
    if (typeof block?.text !== 'string') continue;
    try {
      const parsed = JSON.parse(block.text);
      if (typeof parsed?.status === 'string') return parsed.status;
    } catch {
      /* не JSON — следующий блок */
    }
  }
  return null;
}

/** PostToolUse на чтение карточки: предупреждаем ДО начала работы, а не после коллизии. */
function runPostGet(input, toolInput) {
  if (toolFailed(input.tool_response)) allow();

  const taskId = toolInput.task_id;
  if (!taskId) allow();

  const status = statusFromResponse(input.tool_response);
  if (!status || !WORKING_STATUSES.has(status)) allow();

  const root = repoRoot();
  const claim = readClaim(root, taskId);

  if (claim && claim.session_id === input.session_id) allow();

  if (claim && claimIsLive(claim)) {
    emit({
      systemMessage: `task-claim: #${taskId} ведёт сессия ${shortId(claim.session_id)} — сначала SendMessage, потом работа`,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: peerHoldsItWarning(taskId, claim, status),
      },
    });
    process.exit(0);
  }

  if (claim) allow();

  const peers = livePeerSessions(input.transcript_path, input.session_id);
  if (!peers.length) allow();

  emit({
    systemMessage: `task-claim: #${taskId} в статусе ${status} без claim'а, рядом ${peers.length} ${plural(peers.length, 'живая сессия', 'живые сессии', 'живых сессий')} — проверь ListAgents`,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: unclaimedWarning(taskId, status, peers),
    },
  });
  process.exit(0);
}

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

  const toolInput = input.tool_input || {};

  if (input.tool_name === GET_TOOL) {
    if (input.hook_event_name !== 'PostToolUse') allow();
    runPostGet(input, toolInput);
  }

  if (input.tool_name !== UPDATE_TOOL) allow();

  const taskId = toolInput.task_id;
  if (!taskId) allow();

  if (input.hook_event_name === 'PostToolUse') runPostUpdate(input, toolInput, taskId);
  runPreUpdate(input, toolInput, taskId);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq !== -1) out[arg.slice(2, eq)] = arg.slice(eq + 1);
    else out[arg.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : true;
  }
  return out;
}

function describe(claim) {
  const live = claimIsLive(claim) ? 'живая' : `протухла (>${IDLE_MINUTES} мин молчания)`;
  return `#${claim.task_id}: сессия ${shortId(claim.session_id)} — ${live}, обновлён ${claim.refreshed_at || claim.claimed_at}`;
}

function runCli(argv) {
  const [command] = argv;
  const args = parseArgs(argv.slice(1));
  const root = repoRoot();

  if (command === 'show') {
    if (args.task) {
      const claim = readClaim(root, args.task);
      if (!claim) {
        console.log(`#${args.task}: claim'а нет`);
        process.exit(0);
      }
      console.log(describe(claim));
      process.exit(claimIsLive(claim) ? 1 : 0);
    }
    let files = [];
    try {
      files = readdirSync(path.join(root, CLAIM_DIR_REL)).filter((f) => f.endsWith('.json'));
    } catch {
      /* папки ещё нет */
    }
    if (!files.length) {
      console.log('Активных claim\'ов нет');
      process.exit(0);
    }
    for (const file of files) {
      const claim = readClaim(root, path.basename(file, '.json'));
      if (claim) console.log(describe(claim));
    }
    process.exit(0);
  }

  if (command === 'release') {
    if (!args.task) {
      console.error('Нужен --task <id>');
      process.exit(2);
    }
    console.log(dropClaim(root, args.task) ? `#${args.task}: claim снят` : `#${args.task}: claim'а не было`);
    process.exit(0);
  }

  console.error('Режимы: show [--task <id>] | release --task <id> | (stdin JSON) как хук');
  process.exit(2);
}

try {
  if (process.argv.length > 2) runCli(process.argv.slice(2));
  else runHook();
} catch (error) {
  // Гейт не имеет права уронить работу с бордом: молча пропускаем, но говорим, что не проверили.
  emit({ systemMessage: `task-claim: хук упал (${error?.message || error}); занятость карточки НЕ проверена` });
  process.exit(0);
}
