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
 *                                      Пишет вердикт агента `code-review-gate` с отпечатком diff'а.
 *   show --task <id>                   Печатает состояние вердикта (exit 0 = пропустит, 1 = нет).
 *
 * Вердикты живут в `.codex-temp/review-gate/<task_id>.json` (ignored-папка).
 * Отпечаток scope считается от `git diff origin/main` + содержимого untracked-файлов,
 * поэтому вердикт «протухает», если после ревью код доправили (и переживает автокоммит,
 * который не меняет содержимое дерева относительно origin/main).
 *
 * Аварийный обход: REVIEW_GATE_BYPASS=1 (пишется в systemMessage, чтобы обход был видимым).
 * Максимальный возраст вердикта: REVIEW_GATE_MAX_AGE_HOURS (по умолчанию 24).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Отпечаток текущего рабочего scope: закоммиченное локально + рабочее дерево + untracked. */
function scopeFingerprint(root) {
  const parts = [];
  const hasBase = git(['rev-parse', '--verify', '--quiet', 'origin/main'], root).trim();
  if (hasBase) {
    parts.push('base:origin/main');
    parts.push(git(['diff', 'origin/main', '--'], root));
  } else {
    parts.push(`base:HEAD@${git(['rev-parse', 'HEAD'], root).trim()}`);
    parts.push(git(['diff', 'HEAD', '--'], root));
  }

  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], root)
    .split('\0')
    .filter(Boolean)
    .sort();
  if (untracked.length) {
    const capped = untracked.slice(0, 400);
    parts.push(`untracked:${capped.length}${untracked.length > capped.length ? '+truncated' : ''}`);
    parts.push(capped.join('\n'));
    for (const files of chunk(capped, 40)) {
      parts.push(git(['hash-object', '--', ...files], root));
    }
  }

  return `sha256:${createHash('sha256').update(parts.join('\n--\n')).digest('hex')}`;
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
  const current = scopeFingerprint(root);
  if (verdict.fingerprint !== current) {
    return {
      ok: false,
      code: 'stale',
      detail: 'код изменился после ревью (отпечаток diff\'а не совпадает с проверенным)',
      verdict,
      current,
    };
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
    `3. После \`pass\` агент сам запишет вердикт и переведёт задачу в \`${GUARDED_STATUS}\` — повторять этот вызов вручную не нужно.`,
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
      `2. Затем сразу переведи задачу в \`${GUARDED_STATUS}\` (\`metravel_task_update\`) — повторное ревью того же diff'а не нужно.`,
    ].join('\n');
  }
  return [
    `АВТО-ГЕЙТ БОРДА: задача #${taskId} переведена в \`${REVIEW_STATUS}\`. Код-ревью на этом переходе запускается АВТОМАТИЧЕСКИ — не жди просьбы пользователя, не откладывай на конец сессии и не спрашивай разрешения (AGENTS.md §10.1: субагенты запускаются без подтверждения).`,
    `Состояние гейта: ${result.code} — ${result.detail}.`,
    '',
    'Сделай это СЛЕДУЮЩИМ действием:',
    `1. Вызови Agent tool с subagent_type="${REVIEWER_AGENT}"; в промпте передай id #${taskId}, scope diff'а (файлы/фича) и что уже проверено.`,
    `2. Вердикт \`changes_requested\` → агент сам вернёт задачу в \`in_progress\` с findings. Почини их и снова поставь \`${REVIEW_STATUS}\` — ревью прогонится заново автоматически.`,
    `3. Вердикт \`pass\` → агент сам запишет вердикт и переведёт задачу в \`${GUARDED_STATUS}\`. Руками статус не двигай: PreToolUse-гейт всё равно откажет.`,
    `4. Задачу без своего diff'а (код уже закоммичен и задеплоен, чужой scope в дереве) не гоняй через агента: отметь это в тикете и закрывай по факту приёмки.`,
  ].join('\n');
}

/** Директива оркестратору после того, как задача реально оказалась в `testing`. */
function autoAcceptanceDirective(taskId) {
  return [
    `АВТО-ГЕЙТ БОРДА: задача #${taskId} прошла код-ревью и переведена в \`${GUARDED_STATUS}\`. QA-приёмка продолжается АВТОМАТИЧЕСКИ, тем же проходом — не жди отдельной просьбы пользователя.`,
    '',
    'Сделай это СЛЕДУЮЩИМ действием:',
    `1. Если Done gate требует развёрнутой среды — сначала выложи изменения на dev (skill \`/dev-deploy\`, агент \`dev-deployer\`). Прод-деплой (\`build-prod.sh\`, \`frontend-deployer\`), EAS и публикацию в стор БЕЗ явной команды владельца не запускай.`,
    `2. Вызови Agent tool с subagent_type="${ACCEPTANCE_AGENT}" и id #${taskId}: он прогоняет тесты и браузер/API/устройство-пробы против target env по \`Task Contract\`.`,
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
    systemMessage: `review-gate: #${taskId} в ${GUARDED_STATUS} — дальше QA-приёмка (${ACCEPTANCE_AGENT}), прод-деплой только по явной команде`,
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
  }
  return out;
}

function runRecord(argv) {
  const args = parseArgs(argv);
  const taskId = Number(args.task);
  const verdict = String(args.verdict || '');
  if (!taskId || !['pass', 'changes_requested'].includes(verdict)) {
    process.stderr.write('usage: review-gate.mjs record --task <id> --verdict pass|changes_requested [--findings N] [--note "..."] [--blocking "a;b"] [--reviewer name]\n');
    process.exit(2);
  }

  const root = repoRoot();
  const payload = {
    task_id: taskId,
    verdict,
    reviewer: String(args.reviewer || REVIEWER_AGENT),
    findings: args.findings === undefined ? (verdict === 'pass' ? 0 : null) : Number(args.findings),
    note: args.note ? String(args.note) : '',
    blocking: args.blocking ? String(args.blocking).split(';').map((s) => s.trim()).filter(Boolean) : [],
    fingerprint: scopeFingerprint(root),
    recorded_at: new Date().toISOString(),
  };

  mkdirSync(path.join(root, GATE_DIR_REL), { recursive: true });
  writeFileSync(verdictPath(root, taskId), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ recorded: verdictPath(root, taskId), verdict: payload.verdict, fingerprint: payload.fingerprint })}\n`);
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
  process.stdout.write(`${JSON.stringify({ task_id: taskId, gate: result.ok ? 'open' : 'closed', code: result.code, detail: result.detail || null, verdict: result.verdict || null }, null, 2)}\n`);
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
