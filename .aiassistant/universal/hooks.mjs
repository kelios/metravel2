// OpenCode v1.19.6: session/tools.ts wraps MCP before execution and passes its
// raw CallToolResult to the after hook. Keep canonical Claude hooks as owners.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const NODE = '/opt/homebrew/opt/node@22/bin/node';
const PREFIX = 'mcp__metravel-task-board__';
const HOOKS = new Set(['task-quality-gate.mjs', 'review-gate.mjs', 'task-claim.mjs', 'board-compact.mjs']);
const GUARDED = new Set(['metravel_task_create', 'metravel_task_update']);

function canonicalName(tool) {
  const match = /^(?:metravel_task_board_|mcp__metravel-task-board__|mcp__metravel_task_board__)(metravel_\w+)$/.exec(tool || '');
  return match ? PREFIX + match[1] : null;
}

function executeHook(file, payload, directory) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, CLAUDE_PROJECT_DIR: directory };
    for (const key of ['BOARD_TASK_GATE_BYPASS', 'REVIEW_GATE_BYPASS', 'TASK_CLAIM_BYPASS']) delete env[key];
    const child = spawn(NODE, [path.join(directory, '.claude/hooks', file)], {
      cwd: directory, env, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '', exceeded = false;
    const timer = setTimeout(() => child.kill('SIGKILL'), 20000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.length > 1024 * 1024) { exceeded = true; child.kill('SIGKILL'); }
    });
    // Diagnostics can contain repository/user data: never forward raw stderr.
    child.stderr.resume();
    child.on('error', () => { clearTimeout(timer); reject(new Error(`Cannot launch canonical hook ${file}`)); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0 || exceeded) return reject(new Error(`Canonical hook ${file} did not complete successfully`));
      try {
        const result = stdout.trim() ? stdout.trim().split('\n').map(line => JSON.parse(line)) : [];
        if (result.some(x => !x || typeof x !== 'object' || Array.isArray(x))) throw new Error();
        resolve(result);
      } catch { reject(new Error(`Canonical hook ${file} returned invalid JSON`)); }
    });
    child.stdin.on('error', () => {}); // Early hook exit is handled by close/error.
    child.stdin.end(JSON.stringify(payload));
  });
}

function createBridge({ directory, runHook = executeHook, loadSettings }) {
  const root = path.resolve(directory);
  const pending = new Map();
  const readSettings = loadSettings || (async () => JSON.parse(await readFile(path.join(root, '.claude/settings.json'), 'utf8')));
  async function run(event, input, args, rawResponse) {
    const tool = canonicalName(input.tool);
    if (!tool) return { notes: [] };
    const method = tool.slice(PREFIX.length);
    if (GUARDED.has(method) && !input.sessionID) throw new Error('Board mutation requires a stable session ID');
    const settings = await readSettings();
    const files = [];
    for (const entry of settings.hooks?.[event] || []) {
      if (!new RegExp(`^(?:${entry.matcher || '.*'})$`).test(tool)) continue;
      for (const hook of entry.hooks || []) {
        const match = /^node "\$\{CLAUDE_PROJECT_DIR:-\.\}\/\.claude\/hooks\/([a-z-]+\.mjs)"$/.exec(hook.command || '');
        if (!match || !HOOKS.has(match[1])) throw new Error('Unsupported canonical board hook command; update bridge explicitly');
        files.push(match[1]);
      }
    }
    if (event === 'PreToolUse' && GUARDED.has(method)) {
      const required = method === 'metravel_task_create' ? ['task-quality-gate.mjs']
        : ['task-quality-gate.mjs', 'review-gate.mjs', 'task-claim.mjs'];
      if (required.some(file => !files.includes(file))) throw new Error('Canonical board pre-hooks are missing; mutation blocked');
    }
    const payload = { hook_event_name: event, tool_name: tool, tool_input: args,
      session_id: input.sessionID, cwd: root, ...(rawResponse === undefined ? {} : { tool_response: rawResponse }) };
    const notes = [];
    let compact;
    for (const file of files) {
      for (const message of await runHook(file, payload, root)) {
        const out = message.hookSpecificOutput || {};
        if (out.permissionDecision === 'deny') throw new Error(out.permissionDecisionReason || 'Canonical board hook denied this operation');
        if (message.systemMessage) notes.push(message.systemMessage);
        if (out.additionalContext) notes.push(out.additionalContext);
        if (/НЕ проверен|хук упал|прочитать не удалось/.test(message.systemMessage || '')) {
          if (event === 'PostToolUse') throw new Error('Canonical post-operation verification was unavailable');
          if (GUARDED.has(method)) throw new Error('Canonical board verification was unavailable; mutation blocked');
        }
        if (typeof out.updatedToolOutput === 'string') compact = out.updatedToolOutput;
      }
    }
    return { notes, compact };
  }
  return {
    'tool.execute.before': async (input, output) => {
      if (!canonicalName(input.tool)) return;
      const { notes } = await run('PreToolUse', input, output.args);
      const key = `${input.sessionID}:${input.callID}`;
      if (pending.size >= 512) pending.delete(pending.keys().next().value);
      pending.set(key, notes);
    },
    'tool.execute.after': async (input, output) => {
      if (!canonicalName(input.tool)) return;
      const key = `${input.sessionID}:${input.callID}`;
      const before = pending.get(key) || [];
      pending.delete(key);
      // Every post-hook receives the SAME unmodified response, including claims.
      const raw = structuredClone(output);
      let post;
      try {
        post = await run('PostToolUse', input, input.args, raw);
      } catch {
        // The MCP operation has already completed. Do not turn its successful
        // receipt into a tool error that invites a duplicate mutation/retry.
        const reconcile = input.tool.includes('sprint') ? 'metravel_sprint_get' : 'metravel_task_get';
        const warning = 'Проверка после операции не завершена; post-гейты не подтверждены. '
          + 'Операция могла уже успешно выполниться. Сверьте фактическое состояние через '
          + reconcile + '; не повторяйте запись вслепую.';
        const context = [...before, warning].join('\n\n');
        if (Array.isArray(output.content)) output.content.push({ type: 'text', text: context });
        else if (typeof output.output === 'string') output.output += '\n\n' + context;
        return;
      }
      const { notes, compact } = post;
      const context = [...before, ...notes].join('\n\n');
      if (Array.isArray(output.content)) {
        const text = compact ?? output.content.filter(x => x.type === 'text').map(x => x.text).join('\n');
        output.content = [{ type: 'text', text: [text, context].filter(Boolean).join('\n\n') },
          ...output.content.filter(x => x.type !== 'text')];
      } else if (typeof output.output === 'string') {
        output.output = [compact ?? output.output, context].filter(Boolean).join('\n\n');
      } else throw new Error('Unsupported OpenCode board output shape; cannot preserve canonical post-hook context');
    },
  };
}

// Export only the plugin: OpenCode's legacy loader invokes every function export.
export default async function MeTravelHooks({ directory }, { runHook, loadSettings } = {}) {
  return createBridge({ directory, runHook, loadSettings });
}
