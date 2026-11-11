#!/usr/bin/env node
/**
 * PostToolUse-хук: сжимает ответы MCP-борда до того, как они осядут в контексте.
 *
 * Зачем. Счёт сессии — это контекст × ходы: всё, что вернул инструмент,
 * перечитывается на каждом следующем ходу. Сервер борда на `update`/`create`
 * отдаёт карточку целиком (10–27 КБ), а в списках — по ~600 байт на запись с
 * дублями `*_display`. Замер 05.10.2026: одна смена статуса #2236 = 15 КБ эха,
 * список из 59 карточек `todo` = 35 КБ.
 *
 * Что делает:
 * - `metravel_task_update` / `metravel_task_create` → одна строка-квитанция
 *   (id, статус, срочность, связи, размер описания). Текст описания агент только
 *   что отправил сам — возвращать его незачем;
 * - `metravel_tasks_list` / `metravel_task_board` → одна строка на карточку;
 * - `metravel_task_get` → описание целиком, служебные поля без дублей, связи
 *   одной строкой на карточку.
 *
 * Fail-open: любой сбой разбора, ответ-ошибка или `BOARD_COMPACT=0` — исходный
 * ответ остаётся как есть. Хук ничего не блокирует и на борд не ходит.
 */
import { readFileSync } from 'node:fs';

const TOOL_PREFIX = 'mcp__metravel-task-board__';
const TITLE_MAX = 110;

export function parseResponse(response) {
  if (response == null) return null;
  if (typeof response === 'string') {
    try {
      return parseResponse(JSON.parse(response));
    } catch {
      return null;
    }
  }
  if (Array.isArray(response)) {
    if (response.length > 0 && response.every(isContentBlock)) return parseBlocks(response);
    return response;
  }
  if (typeof response === 'object') {
    if (response.isError === true || response.is_error === true) return null;
    if (Array.isArray(response.content) && response.content.every(isContentBlock)) {
      return parseBlocks(response.content);
    }
    return response;
  }
  return null;
}

function isContentBlock(block) {
  return block && typeof block === 'object' && typeof block.type === 'string' && 'text' in block;
}

function parseBlocks(blocks) {
  const text = blocks.map((block) => (typeof block.text === 'string' ? block.text : '')).join('');
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isTask(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Number.isInteger(value.id) &&
    typeof value.title === 'string' &&
    typeof value.status === 'string'
  );
}

function clip(text, max) {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function taskLine(task) {
  const flags = [];
  if (task.needs_human) flags.push('needs_human');
  if (task.blocked_by) flags.push(`blocked_by #${task.blocked_by}`);
  if (task.sprint != null) flags.push(`sprint ${task.sprint}`);
  const head = `#${task.id} ${task.status} ${task.urgency ?? '-'} ${task.area ?? '-'} ${task.kind ?? '-'}`;
  return `${head}${flags.length ? ` [${flags.join(', ')}]` : ''} | ${clip(task.title, TITLE_MAX)}`;
}

function relationLines(label, details, ids) {
  if (Array.isArray(details) && details.length > 0) {
    return [
      `${label}:`,
      ...details.map(
        (item) => `  #${item.id} ${item.status ?? '-'} ${item.urgency ?? '-'} ${item.area ?? '-'} | ${clip(item.title ?? '', 80)}`,
      ),
    ];
  }
  if (Array.isArray(ids) && ids.length > 0) return [`${label}: ${ids.map((id) => `#${id}`).join(', ')}`];
  return [];
}

function idList(ids) {
  return Array.isArray(ids) && ids.length > 0 ? ids.map((id) => `#${id}`).join(', ') : '—';
}

export function compactReceipt(task) {
  const chars = (task.description ?? '').length;
  return [
    taskLine(task),
    `depends_on: ${idList(task.depends_on)}; related_to: ${idList(task.related_to)}; assignee: ${task.assignee || '—'}; ` +
      `описание ${(chars / 1000).toFixed(1)} тыс. символов; updated_at ${task.updated_at ?? '—'}`,
    '[board-compact] запись принята; эхо карточки сжато хуком, полный текст — metravel_task_get.',
  ].join('\n');
}

export function compactCard(task) {
  return [
    taskLine(task),
    `reporter: ${task.reporter || '—'}; assignee: ${task.assignee || '—'}; epic: ${task.epic ?? '—'}; story: ${task.story ?? '—'}; ` +
      `created_at ${task.created_at ?? '—'}; updated_at ${task.updated_at ?? '—'}`,
    ...relationLines('depends_on', task.depends_on_details, task.depends_on),
    ...relationLines('related_to', task.related_to_details, task.related_to),
    '',
    task.description ?? '',
  ].join('\n');
}

function collectTasks(value, out, depth = 0) {
  if (depth > 4 || value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isTask(item)) out.push(item);
      else collectTasks(item, out, depth + 1);
    }
    return;
  }
  for (const nested of Object.values(value)) collectTasks(nested, out, depth + 1);
}

export function compactList(data) {
  const tasks = [];
  collectTasks(data, tasks);
  if (tasks.length === 0) {
    // Пустой список — честный ответ; иную форму не трогаем.
    return Array.isArray(data) && data.length === 0 ? 'Карточек: 0' : null;
  }
  return [`Карточек: ${tasks.length}`, ...tasks.map(taskLine)].join('\n');
}

export function compactOutput(toolName, response) {
  if (typeof toolName !== 'string' || !toolName.startsWith(TOOL_PREFIX)) return null;
  const data = parseResponse(response);
  if (data == null) return null;
  if (!Array.isArray(data) && data.status === 'error') return null;
  const tool = toolName.slice(TOOL_PREFIX.length);
  if (tool === 'metravel_task_update' || tool === 'metravel_task_create') {
    return isTask(data) ? compactReceipt(data) : null;
  }
  if (tool === 'metravel_task_get') return isTask(data) ? compactCard(data) : null;
  if (tool === 'metravel_tasks_list' || tool === 'metravel_task_board') return compactList(data);
  return null;
}

function main() {
  if (process.env.BOARD_COMPACT === '0') return;
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return;
  }
  let output = null;
  try {
    output = compactOutput(input.tool_name, input.tool_response);
  } catch {
    return;
  }
  if (typeof output !== 'string' || output.length === 0) return;
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', updatedToolOutput: output } }),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
