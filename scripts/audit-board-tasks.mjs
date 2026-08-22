#!/usr/bin/env node
/**
 * audit-board-tasks — аудит оформления карточек общего MCP task board.
 *
 * Проверяет каждую открытую карточку (`backlog`/`todo`/`blocked_by`/`in_progress`/`review`/`testing`)
 * по контракту из `scripts/lib/boardTaskContract.mjs`: семь обязательных разделов описания,
 * `Problem History`, `Task Contract`, поля-идентификаторы, спринт, согласованность `needs_human`
 * и `blocked_by`. Тот же модуль применяется хуком `.claude/hooks/task-quality-gate.mjs`,
 * поэтому аудит и гейт не могут разойтись в трактовке правила.
 *
 * Использование:
 *   node scripts/audit-board-tasks.mjs                 # сводка + список дефектных карточек
 *   node scripts/audit-board-tasks.mjs --json          # машинный вывод
 *   node scripts/audit-board-tasks.mjs --task 1526     # одна карточка
 *   node scripts/audit-board-tasks.mjs --status todo   # только один статус
 *   node scripts/audit-board-tasks.mjs --strict        # exit 1, если есть хоть один `error`
 *
 * Токен читается из окружения `METRAVEL_TASK_BOARD_API_TOKEN` или из `.secrets/metravel-task-board.env`
 * и никогда не печатается.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { validateBoardTask } from './lib/boardTaskContract.mjs';

const API_BASE = process.env.METRAVEL_TASK_BOARD_API_BASE || 'https://metravel.by/api/tasks/';
const OPEN_STATUSES = ['backlog', 'todo', 'blocked_by', 'in_progress', 'review', 'testing'];

function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function readToken() {
  if (process.env.METRAVEL_TASK_BOARD_API_TOKEN) return process.env.METRAVEL_TASK_BOARD_API_TOKEN;
  const envPath = path.join(projectRoot(), '.secrets/metravel-task-board.env');
  try {
    const raw = readFileSync(envPath, 'utf8');
    const match = raw.match(/^\s*(?:export\s+)?METRAVEL_TASK_BOARD_API_TOKEN\s*=\s*["']?([^"'\n]+)/m);
    if (match) return match[1].trim();
  } catch {
    /* нет файла — обработаем ниже */
  }
  return null;
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Запрос к борду с повтором: прод периодически отдаёт разовый 502, и падать из-за него всем
 * аудитом неправильно. Карточку, недоступную после повторов, аудит называет явно — молча
 * выкидывать её из выборки нельзя, иначе «проверено 79 из 80» читается как «всё чисто».
 */
async function api(pathname, token, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}${pathname}`, { headers: { Authorization: `Token ${token}` } });
      if (response.ok) return await response.json();
      lastError = new Error(`HTTP ${response.status} на ${pathname || 'списке задач'}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await sleep(attempt * 750);
  }
  throw lastError;
}

function parseArgs(argv) {
  const args = { json: false, strict: false, task: null, status: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--strict') args.strict = true;
    else if (arg === '--task') args.task = Number(argv[++i]);
    else if (arg === '--status') args.status = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = readToken();
  if (!token) {
    console.error(
      'Нет токена борда. Задай METRAVEL_TASK_BOARD_API_TOKEN или положи его в .secrets/metravel-task-board.env ' +
        '(инструкция — docs/TASK_BOARD_MCP.md → Setup).',
    );
    process.exit(2);
  }

  let tasks;
  let unreachable = [];
  if (args.task) {
    tasks = [await api(`${args.task}/`, token)];
  } else {
    const list = await api('?limit=1000', token);
    const open = list.filter((t) => OPEN_STATUSES.includes(t.status) && (!args.status || t.status === args.status));
    // Списочный эндпоинт не отдаёт `description`, поэтому карточки догружаются поштучно.
    // Пачками по 8, чтобы не выстраивать сотню последовательных запросов и не бить по API залпом.
    tasks = [];
    const BATCH = 8;
    for (let i = 0; i < open.length; i += BATCH) {
      const chunk = await Promise.all(
        open.slice(i, i + BATCH).map((item) =>
          api(`${item.id}/`, token).catch((error) => ({ __unreachable: item.id, __reason: error.message })),
        ),
      );
      tasks.push(...chunk);
    }
    unreachable = tasks.filter((t) => t.__unreachable);
    tasks = tasks.filter((t) => !t.__unreachable);
  }

  const report = tasks.map((task) => {
    const { errors, warnings } = validateBoardTask(task);
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      area: task.area,
      kind: task.kind,
      needs_human: task.needs_human,
      sprint: task.sprint,
      errors: errors.map((e) => ({ code: e.code, message: e.message })),
      warnings: warnings.map((w) => ({ code: w.code, message: w.message })),
    };
  });

  const broken = report.filter((r) => r.errors.length || r.warnings.length);
  const withErrors = report.filter((r) => r.errors.length);

  if (args.json) {
    console.log(JSON.stringify({
      checked: report.length,
      withErrors: withErrors.length,
      unreachable: unreachable.map((u) => ({ id: u.__unreachable, reason: u.__reason })),
      tasks: report,
    }, null, 2));
  } else {
    const share = report.length ? Math.round((withErrors.length / report.length) * 100) : 0;
    console.log(`Проверено карточек: ${report.length}`);
    if (unreachable.length) {
      console.log(`НЕ ПРОВЕРЕНО (борд не отдал карточку): ${unreachable.map((u) => `#${u.__unreachable} — ${u.__reason}`).join('; ')}`);
    }
    console.log(`С нарушением контракта (error): ${withErrors.length} (${share}%)`);
    console.log(`С замечаниями качества (warn): ${broken.length - withErrors.length}\n`);

    const frequency = {};
    for (const row of report) for (const item of [...row.errors, ...row.warnings]) frequency[item.code] = (frequency[item.code] || 0) + 1;
    if (Object.keys(frequency).length) {
      console.log('Частота дефектов:');
      for (const [code, count] of Object.entries(frequency).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(count).padStart(3)}  ${code}`);
      }
      console.log('');
    }

    for (const row of broken) {
      const flags = `${row.status}/${row.area}/${row.kind}${row.needs_human ? '/HUMAN' : ''}`;
      console.log(`#${row.id} [${flags}] ${row.title.slice(0, 70)}`);
      for (const e of row.errors) console.log(`   ✗ ${e.message}`);
      for (const w of row.warnings) console.log(`   • ${w.message}`);
    }
  }

  if (args.strict && withErrors.length) process.exit(1);
}

main().catch((error) => {
  console.error(`Аудит борда не выполнен: ${error.message}`);
  process.exit(2);
});
