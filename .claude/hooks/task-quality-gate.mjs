#!/usr/bin/env node
/**
 * task-quality-gate — PreToolUse-гейт на создание и переоформление карточки MCP task board.
 *
 * Зачем: правила оформления карточки («семь разделов», `Problem History`, `Task Contract`,
 * спринт, `needs_human`) существовали только прозой в `docs/TASK_BOARD_MCP.md`,
 * `.claude/agents/ticket-board.md` и `.codex/skills/metravel-*`. Ни один гейт не смотрел на текст
 * описания, поэтому соблюдение правила зависело от памяти агента. Замер 2026-08-22 по 80 открытым
 * карточкам: 46 (58%) нарушали контракт, причём дефектные карточки создавались и за три дня до замера.
 * Проза правило не удержала — держит проверка.
 *
 * Что делает:
 *   `metravel_task_create`                     — блокирует создание карточки с дефектным описанием.
 *   `metravel_task_update` с `description`     — блокирует запись дефектного описания.
 *   `metravel_task_update` со `status=todo`    — блокирует выдачу в работу карточки без контракта
 *                                                (правило: «не переводить в `todo` без проверяемой приёмки»).
 * Остальные обновления (evidence, assignee, связи) не трогает: борд не должен вставать из-за
 * исторического долга в чужой карточке.
 *
 * Контракт проверки — `scripts/lib/boardTaskContract.mjs`, общий с `scripts/audit-board-tasks.mjs`,
 * поэтому гейт и аудит не могут разойтись в трактовке.
 *
 * Режимы:
 *   (stdin JSON)                    хук PreToolUse.
 *   check --task <id>               проверить карточку на борде (exit 0 = чисто, 1 = есть error).
 *   check --file <path.md>          проверить черновик описания из файла.
 *
 * Аварийный обход: BOARD_TASK_GATE_BYPASS=1 (пишется в systemMessage, чтобы обход был видимым).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { validateBoardTask } from '../../scripts/lib/boardTaskContract.mjs';

const CREATE_TOOL = 'mcp__metravel-task-board__metravel_task_create';
const UPDATE_TOOL = 'mcp__metravel-task-board__metravel_task_update';
const API_BASE = process.env.METRAVEL_TASK_BOARD_API_BASE || 'https://metravel.by/api/tasks/';
const GUARDED_UPDATE_STATUSES = ['todo'];

function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function allow(systemMessage) {
  if (systemMessage) emit({ systemMessage, suppressOutput: true });
  process.exit(0);
}

function readToken() {
  if (process.env.METRAVEL_TASK_BOARD_API_TOKEN) return process.env.METRAVEL_TASK_BOARD_API_TOKEN;
  try {
    const raw = readFileSync(path.join(projectRoot(), '.secrets/metravel-task-board.env'), 'utf8');
    const match = raw.match(/^\s*(?:export\s+)?METRAVEL_TASK_BOARD_API_TOKEN\s*=\s*["']?([^"'\n]+)/m);
    if (match) return match[1].trim();
  } catch {
    /* токена нет — работаем только по тому, что пришло в вызове */
  }
  return null;
}

/** Read-only догрузка карточки: нужна, когда апдейт двигает статус, не трогая описание. */
async function fetchTask(taskId) {
  const token = readToken();
  if (!token) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`${API_BASE}${taskId}/`, {
      headers: { Authorization: `Token ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function denyReason(kindOfCall, taskLabel, errors, warnings) {
  const lines = [
    `Гейт качества карточки не пройден: ${kindOfCall} ${taskLabel} нарушает контракт описания.`,
    '',
    'Нарушения (их нужно закрыть, а не обойти):',
    ...errors.map((e, i) => `${i + 1}. ${e.message}`),
  ];
  if (warnings.length) {
    lines.push('', 'Замечания качества (не блокируют, но исправляются тем же заходом):');
    for (const w of warnings) lines.push(`- ${w.message}`);
  }
  lines.push(
    '',
    'Как починить:',
    '1. Возьми шаблон: `.claude/skills/metravel-issue/bug-report.md` (баг), `feature-request.md` (фича),',
    '   `human-task.md` (карточка для человека, `needs_human=true` — без `Task Contract`).',
    '2. Семь разделов идут в каноническом порядке и начинаются с `## Простыми словами`:',
    '   Простыми словами → В чём проблема → Из-за чего возникла → Что должно быть сделано →',
    '   Что уже сделано → Что блокирует → Как протестировать, и только затем `## Problem History`',
    '   и `## Task Contract`.',
    '3. Поля контракта пишутся как идентификаторы — `Scope:` с начала строки, не `**Scope.**`:',
    '   по ним ходят гейты, приёмка и governance-тесты.',
    '4. Причину не выдумывай: «не установлена, выяснить в ходе работы» — допустимый ответ, догадка под видом факта — нет.',
    '5. Полное правило — `docs/TASK_BOARD_MCP.md` → «Правило: описание задачи — по-русски и человеческим языком».',
    '',
    'Проверить черновик до отправки: `node .claude/hooks/task-quality-gate.mjs check --file <путь.md>`.',
  );
  return lines.join('\n');
}

/**
 * @param {'text'|'all'} enforce — какие ошибки блокируют.
 *   `text` — только те, что чинятся правкой описания. Нужен для правки текста: дефект поля
 *   (например `status=blocked_by` без блокера) правкой описания не устраняется, и блокировать
 *   им улучшение текста значит навсегда запереть карточку в плохом описании.
 *   `all` — плюс дефекты полей. Нужен при создании и при переводе в `todo`.
 */
function decide(kindOfCall, taskLabel, result, enforce = 'all') {
  const blocking = enforce === 'text' ? result.textErrors : result.errors;
  const informational = enforce === 'text' ? [...result.warnings, ...result.fieldErrors] : result.warnings;

  if (!blocking.length) {
    const note = informational.length
      ? `task-quality-gate: ${taskLabel} принята, есть ${informational.length} замечани(я) качества`
      : `task-quality-gate: ${taskLabel} соответствует контракту описания`;
    allow(note);
  }

  emit({
    systemMessage: `task-quality-gate: ${kindOfCall} ${taskLabel} заблокирован(а) — ${blocking.length} нарушени(я) контракта описания`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: denyReason(kindOfCall, taskLabel, blocking, informational),
    },
  });
  process.exit(0);
}

async function runHook() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    allow();
  }

  const tool = input.tool_name;
  if (tool !== CREATE_TOOL && tool !== UPDATE_TOOL) allow();

  if (process.env.BOARD_TASK_GATE_BYPASS === '1') {
    allow('task-quality-gate: обход по BOARD_TASK_GATE_BYPASS=1 — карточка записывается без проверки контракта');
  }

  const toolInput = input.tool_input || {};

  if (tool === CREATE_TOOL) {
    const result = validateBoardTask(
      {
        description: toolInput.description,
        area: toolInput.area,
        kind: toolInput.kind || 'task',
        status: toolInput.status || 'backlog',
        sprint: toolInput.sprint_id ?? null,
        needs_human: toolInput.needs_human === true,
        blocked_by: toolInput.blocked_by_id ?? null,
        depends_on: toolInput.depends_on_ids || [],
        assignee: toolInput.assignee || null,
        title: toolInput.title,
      },
      { creating: true },
    );
    decide('создание карточки', `«${String(toolInput.title || 'без заголовка').slice(0, 60)}»`, result);
  }

  const taskId = toolInput.task_id;
  const touchesDescription = typeof toolInput.description === 'string';
  const movesToGuardedStatus = GUARDED_UPDATE_STATUSES.includes(toolInput.status);
  if (!taskId || (!touchesDescription && !movesToGuardedStatus)) allow();

  const current = await fetchTask(taskId);
  if (!current && !touchesDescription) {
    // Карточку не удалось прочитать (нет токена/сети). Тихо пропускать нельзя — сообщаем явно.
    allow(`task-quality-gate: карточку #${taskId} прочитать не удалось, контракт описания НЕ проверен`);
  }

  const merged = {
    description: touchesDescription ? toolInput.description : current?.description,
    area: toolInput.area ?? current?.area ?? null,
    kind: toolInput.kind ?? current?.kind ?? 'task',
    status: toolInput.status ?? current?.status ?? null,
    sprint: toolInput.sprint_id ?? current?.sprint ?? null,
    needs_human: toolInput.needs_human ?? current?.needs_human ?? false,
    blocked_by: toolInput.blocked_by_id ?? current?.blocked_by ?? null,
    depends_on: toolInput.depends_on_ids ?? current?.depends_on ?? [],
    assignee: toolInput.assignee ?? current?.assignee ?? null,
    title: toolInput.title ?? current?.title ?? '',
  };

  decide(
    movesToGuardedStatus ? 'перевод в `todo`' : 'обновление описания',
    `#${taskId}`,
    validateBoardTask(merged),
    movesToGuardedStatus ? 'all' : 'text',
  );
}

async function runCheck(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }

  let task;
  if (args.file) {
    task = {
      description: readFileSync(path.resolve(String(args.file)), 'utf8'),
      area: String(args.area || 'front'),
      kind: String(args.kind || 'task'),
      status: 'backlog',
      sprint: args.sprint ? Number(args.sprint) : 1,
      needs_human: args.human === true,
      depends_on: [],
    };
  } else if (args.task) {
    task = await fetchTask(Number(args.task));
    if (!task) {
      process.stderr.write(`Карточку #${args.task} прочитать не удалось (нет токена или сети)\n`);
      process.exit(2);
    }
  } else {
    process.stderr.write('usage: task-quality-gate.mjs check --task <id> | --file <путь.md> [--area front|back] [--kind bug|feature|task] [--human]\n');
    process.exit(2);
  }

  const { errors, warnings } = validateBoardTask(task);
  const label = args.file ? String(args.file) : `#${args.task}`;
  if (!errors.length && !warnings.length) {
    process.stdout.write(`${label}: контракт описания соблюдён\n`);
    process.exit(0);
  }
  for (const e of errors) process.stdout.write(`✗ ${e.message}\n`);
  for (const w of warnings) process.stdout.write(`• ${w.message}\n`);
  process.exit(errors.length ? 1 : 0);
}

const [mode, ...rest] = process.argv.slice(2);
try {
  if (mode === 'check') await runCheck(rest);
  else await runHook();
} catch (error) {
  if (mode === 'check') {
    process.stderr.write(`task-quality-gate error: ${error?.message || error}\n`);
    process.exit(2);
  }
  // Внутренняя ошибка гейта не должна вешать борд: пропускаем вызов, но громко об этом сообщаем.
  emit({ systemMessage: `task-quality-gate: хук упал (${error?.message || error}); контракт описания НЕ проверен` });
  process.exit(0);
}
