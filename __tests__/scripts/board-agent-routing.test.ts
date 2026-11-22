import fs from 'node:fs';
import path from 'node:path';
import { makeTempDir, removeDir } from './cli-test-utils';

const { spawnSyncWithStdin } = require('../../scripts/lib/runSyncWithStdin');
// A hook or IDE may export Git's own worktree/index. Use only the runtime path in this fixture.
const fixtureEnv = { PATH: process.env.PATH, REVIEW_GATE_BYPASS: '0', BOARD_COMPACT: '1' };

type Group = { matcher: string; hooks: { command: string }[] };
type Event = 'PreToolUse' | 'PostToolUse';
const root = process.cwd();
const groups: Record<Event, Group[]> = JSON.parse(fs.readFileSync(path.join(root, '.codex/hooks.json'), 'utf8')).hooks;
const update = 'mcp__metravel_task_board__metravel_task_update';
const id = 44;
const card = (area: string, status = 'testing') => ({ id, area, status, title: 'Fixture' });
let checkout: string;
let nested: string;

beforeAll(() => {
  checkout = makeTempDir('board agent hooks ');
  nested = path.join(checkout, 'subdir');
  fs.mkdirSync(nested);
  expect(spawnSyncWithStdin('git', ['init', '-q', checkout], { cwd: checkout, env: fixtureEnv }).status).toBe(0);
  for (const rel of ['.claude/hooks', 'scripts/lib/boardTaskContract.mjs']) {
    const dest = path.join(checkout, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(path.join(root, rel), dest, { recursive: true });
  }
});
afterAll(() => removeDir(checkout));

function invoke(command: string, event: Event, tool: string, args: object, response?: unknown) {
  const input = JSON.stringify({ hook_event_name: event, tool_name: tool, tool_input: args, tool_response: response });
  const result = spawnSyncWithStdin('sh', ['-c', command], {
    cwd: nested, input, env: fixtureEnv, encoding: 'utf8', timeout: 10000,
  });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  return result.stdout ? JSON.parse(result.stdout) : undefined;
}

function configured(event: Event, tool: string, script: string) {
  const matches = groups[event].filter(g => new RegExp(`^(?:${g.matcher})$`).test(tool))
    .flatMap(g => g.hooks).filter(h => h.command.endsWith(`/${script}.mjs`));
  expect(matches).toHaveLength(1);
  return matches[0].command;
}

const post = (response: unknown, args = { task_id: id, status: 'testing' }) =>
  invoke(configured('PostToolUse', update, 'review-gate'), 'PostToolUse', update, args, response)?.hookSpecificOutput.additionalContext;

test('all configured hooks run from a nested directory in a checkout with spaces', () => {
  for (const event of ['PreToolUse', 'PostToolUse'] as const) {
    for (const group of groups[event]) {
      for (const { command } of group.hooks) {
        expect(invoke(command, event, 'other', {})).toBeUndefined();
      }
    }
  }
  for (const tool of [update, update.replace('metravel_task_board', 'metravel-task-board')]) {
    const receipt = invoke(configured('PostToolUse', tool, 'board-compact'), 'PostToolUse', tool, {}, card('front'));
    expect(receipt.hookSpecificOutput.updatedToolOutput).toContain('#44');
    const pre = invoke(configured('PreToolUse', tool, 'review-gate'), 'PreToolUse', tool, { task_id: id, status: 'testing' });
    expect(pre.hookSpecificOutput.permissionDecision).toBe('deny');
  }
});

test('routes confirmed backend cards to their checkout and frontend review by risk', () => {
  const back = post({ content: [{ type: 'text', text: JSON.stringify(card('back')) }] });
  expect(back).toContain('backend-change-workflow');
  expect(back).not.toContain('frontend-deployer');
  const review = post({ structuredContent: card('front', 'review') }, { task_id: id, status: 'review' });
  expect(review).toContain('review-auditor');
  expect(review).toContain('code-review-gate');
});

test('routes web and native acceptance using the affected platforms', () => {
  expect(post(card('front'))).toContain('Если требуется web');
  for (const area of ['android', 'ios']) {
    const context = post(card(area));
    expect(context).toContain(area);
    expect(context).toContain('board-reviewer');
    expect(context).not.toContain('frontend-deployer');
  }
});

test('requires reading an ambiguous receipt and emits no follow-up for a failed tool', () => {
  for (const receipt of [{}, { ...card('front'), id: id + 1 }, card('front', 'review'), card('unknown')]) {
    expect(post(receipt)).toContain('metravel_task_get');
    expect(post(receipt)).not.toContain('frontend-deployer');
  }
  expect(post({ isError: true, content: [] })).toBeUndefined();
  expect(post([{ type: 'text', text: '{"status":"error"}' }])).toBeUndefined();
});

test('an explicit backend transition cannot use a frontend verdict', () => {
  const pre = invoke(configured('PreToolUse', update, 'review-gate'), 'PreToolUse', update, { task_id: id, area: 'back', status: 'testing' });
  expect(pre.hookSpecificOutput).toMatchObject({ permissionDecision: 'deny', permissionDecisionReason: expect.stringContaining('backend-change-workflow') });
});
