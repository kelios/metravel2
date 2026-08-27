#!/usr/bin/env node
/**
 * Normalize a Grok hook event into the Claude stdin shape expected by
 * `.claude/hooks/*.mjs`, then translate deny/additionalContext back.
 *
 * Usage: node adapt-claude-hook.mjs <task-quality-gate|review-gate>
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const HOOKS = {
  'task-quality-gate': 'task-quality-gate.mjs',
  'review-gate': 'review-gate.mjs',
};

const name = process.argv[2];
const script = HOOKS[name];
if (!script) {
  process.stderr.write(`usage: adapt-claude-hook.mjs ${Object.keys(HOOKS).join('|')}\n`);
  process.exit(2);
}

const root =
  process.env.GROK_WORKSPACE_ROOT ||
  process.env.CLAUDE_PROJECT_DIR ||
  process.cwd();

let raw = '';
try {
  raw = readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let input = {};
try {
  input = JSON.parse(raw || '{}');
} catch {
  process.exit(0);
}

const nested = input.toolInput && typeof input.toolInput === 'object' ? input.toolInput : {};
const grokToolName = String(input.toolName || input.tool_name || nested.tool_name || '');
const mappedTool = grokToolName.startsWith('mcp__')
  ? grokToolName
  : grokToolName.replace(/^metravel-task-board__/, 'mcp__metravel-task-board__');

const toolInput =
  nested.tool_input && typeof nested.tool_input === 'object'
    ? nested.tool_input
    : input.tool_input || nested;

const eventName = String(
  input.hook_event_name ||
    input.hookEventName ||
    process.env.GROK_HOOK_EVENT ||
    '',
).replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
const claudeEvent =
  eventName === 'preToolUse' || eventName === 'PreToolUse'
    ? 'PreToolUse'
    : eventName === 'postToolUse' || eventName === 'PostToolUse'
      ? 'PostToolUse'
      : eventName;

const claudeInput = {
  ...input,
  hook_event_name: claudeEvent,
  hookEventName: claudeEvent,
  tool_name: mappedTool,
  tool_input: toolInput,
  tool_response: input.tool_response || input.toolResult || input.tool_result,
};

const child = spawnSync(process.execPath, [path.join(root, '.claude', 'hooks', script)], {
  cwd: root,
  env: {
    ...process.env,
    CLAUDE_PROJECT_DIR: root,
    GROK_WORKSPACE_ROOT: root,
  },
  input: `${JSON.stringify(claudeInput)}\n`,
  encoding: 'utf8',
  maxBuffer: 4 * 1024 * 1024,
});

if (child.stderr) process.stderr.write(child.stderr);

const stdout = (child.stdout || '').trim();
if (!stdout) process.exit(child.status ?? 0);

let payload;
try {
  payload = JSON.parse(stdout.split('\n').filter(Boolean).pop() || '{}');
} catch {
  process.stdout.write(child.stdout);
  process.exit(child.status ?? 0);
}

const specific = payload.hookSpecificOutput || {};
if (specific.permissionDecision === 'deny') {
  process.stdout.write(
    `${JSON.stringify({
      decision: 'deny',
      reason: specific.permissionDecisionReason || payload.systemMessage || 'denied by board gate',
      systemMessage: payload.systemMessage,
      hookSpecificOutput: specific,
    })}\n`,
  );
  process.exit(0);
}

process.stdout.write(`${JSON.stringify(payload)}\n`);
process.exit(child.status ?? 0);
