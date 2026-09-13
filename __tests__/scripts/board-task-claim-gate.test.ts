import fs from 'node:fs';
import path from 'node:path';
import { makeTempDir, removeDir, runNodeCli } from './cli-test-utils';

/**
 * Гейт `task-claim` держит правило «одну карточку борда ведёт одна сессия».
 *
 * Он заведён после 13.09.2026, когда две параллельные сессии одновременно вели #1923 и
 * с разницей в пятнадцать секунд применили на прод РАЗНЫЙ текст одного шага квеста:
 * ни борд, ни API, ни скрипт не возразили, выиграл последний писатель. WIP=1 было прозой,
 * а проза этого не удержала.
 *
 * Тест гоняет хук как процесс на синтетическом stdin: проверяется реальный контракт
 * (`permissionDecision`, `additionalContext`, файл claim'а), а не внутренние функции.
 */

const HOOK = path.join(process.cwd(), '.claude/hooks/task-claim.mjs');
const UPDATE_TOOL = 'mcp__metravel-task-board__metravel_task_update';
const GET_TOOL = 'mcp__metravel-task-board__metravel_task_get';
const TASK_ID = 1923;

const MINUTE = 60 * 1000;

let sandbox: string;
let transcripts: string;

/** Транскрипт сессии — источник её «живости»: свежий mtime = сессия работает. */
const touchSession = (sessionId: string, minutesAgo = 0): string => {
  const file = path.join(transcripts, `${sessionId}.jsonl`);
  fs.writeFileSync(file, '');
  const when = new Date(Date.now() - minutesAgo * MINUTE);
  fs.utimesSync(file, when, when);
  return file;
};

type HookOutput = Record<string, any>;

const runHook = (
  payload: Record<string, unknown>,
  env: Record<string, string> = {},
): HookOutput => {
  const result = runNodeCli(
    [HOOK],
    { CLAUDE_PROJECT_DIR: sandbox, ...env },
    { input: JSON.stringify(payload) },
  );
  expect(result.status).toBe(0);
  const out = result.stdout.trim();
  return out ? JSON.parse(out) : {};
};

const update = (
  sessionId: string,
  status: string,
  event: 'PreToolUse' | 'PostToolUse',
  env?: Record<string, string>,
): HookOutput =>
  runHook(
    {
      hook_event_name: event,
      tool_name: UPDATE_TOOL,
      session_id: sessionId,
      transcript_path: path.join(transcripts, `${sessionId}.jsonl`),
      cwd: sandbox,
      tool_input: { task_id: TASK_ID, status },
      tool_response: { id: TASK_ID, status },
    },
    env,
  );

const readCard = (sessionId: string, status: string): HookOutput =>
  runHook({
    hook_event_name: 'PostToolUse',
    tool_name: GET_TOOL,
    session_id: sessionId,
    transcript_path: path.join(transcripts, `${sessionId}.jsonl`),
    cwd: sandbox,
    tool_input: { task_id: TASK_ID },
    tool_response: { id: TASK_ID, status },
  });

const claimFile = (): string => path.join(sandbox, '.codex-temp/task-claim', `${TASK_ID}.json`);
const claimExists = (): boolean => fs.existsSync(claimFile());
const claimOwner = (): string => JSON.parse(fs.readFileSync(claimFile(), 'utf8')).session_id;

const decision = (out: HookOutput): string | undefined => out.hookSpecificOutput?.permissionDecision;
const reason = (out: HookOutput): string => out.hookSpecificOutput?.permissionDecisionReason ?? '';
const context = (out: HookOutput): string => out.hookSpecificOutput?.additionalContext ?? '';

beforeEach(() => {
  sandbox = makeTempDir('task-claim-');
  transcripts = makeTempDir('task-claim-tr-');
  touchSession('sessA');
  touchSession('sessB');
});

afterEach(() => {
  removeDir(sandbox);
  removeDir(transcripts);
});

describe('task-claim: кто взял карточку', () => {
  it('перевод в in_progress записывает claim на сессию', () => {
    update('sessA', 'in_progress', 'PostToolUse');
    expect(claimExists()).toBe(true);
    expect(claimOwner()).toBe('sessA');
  });

  it('та же сессия берёт свою карточку снова без возражений', () => {
    update('sessA', 'in_progress', 'PostToolUse');
    expect(update('sessA', 'in_progress', 'PreToolUse')).toEqual({});
  });

  it('РЕГРЕССИЯ #1923: чужая живая сессия не может взять карточку молча', () => {
    update('sessA', 'in_progress', 'PostToolUse');
    const out = update('sessB', 'in_progress', 'PreToolUse');
    expect(decision(out)).toBe('deny');
    // Отказ обязан вести к разговору, а не к тупику: без этих двух имён агент
    // не знает, чем заменить перехват, и просто попробует другой путь.
    expect(reason(out)).toContain('ListAgents');
    expect(reason(out)).toContain('SendMessage');
  });

  it('стережёт только момент взятия: review и testing чужая сессия двигает свободно', () => {
    // Дальше по пайплайну статус двигают агенты (`code-review-gate`, `board-reviewer`),
    // и блокировать их здесь значило бы ломать штатный workflow.
    update('sessA', 'in_progress', 'PostToolUse');
    expect(update('sessB', 'review', 'PreToolUse')).toEqual({});
    expect(update('sessB', 'testing', 'PreToolUse')).toEqual({});
  });

  it('брошенная карточка не блокирует борд: протухший claim перехватывается', () => {
    update('sessA', 'in_progress', 'PostToolUse');
    const stale = JSON.parse(fs.readFileSync(claimFile(), 'utf8'));
    stale.refreshed_at = new Date(Date.now() - 10 * 60 * MINUTE).toISOString();
    stale.claimed_at = stale.refreshed_at;
    fs.writeFileSync(claimFile(), JSON.stringify(stale));
    touchSession('sessA', 10 * 60);

    const out = update('sessB', 'in_progress', 'PreToolUse');
    expect(decision(out)).toBeUndefined();
    expect(out.systemMessage).toContain('протух');
  });

  it('done снимает claim — карточка освобождается', () => {
    update('sessA', 'in_progress', 'PostToolUse');
    update('sessA', 'done', 'PostToolUse');
    expect(claimExists()).toBe(false);
  });

  it('обход виден: TASK_CLAIM_BYPASS=1 пропускает и объявляет себя', () => {
    update('sessA', 'in_progress', 'PostToolUse');
    const out = update('sessB', 'in_progress', 'PreToolUse', { TASK_CLAIM_BYPASS: '1' });
    expect(decision(out)).toBeUndefined();
    expect(out.systemMessage).toContain('ОБХОД');
  });
});

describe('task-claim: чтение карточки предупреждает до начала работы', () => {
  it('РЕГРЕССИЯ #1923: открыл чужую карточку в работе — узнал об этом сразу', () => {
    // Дыра, в которую провалился #1923: карточка УЖЕ была `in_progress`, своего
    // `task_update` сессия не делала, и пишущая половина гейта не сработала бы.
    update('sessA', 'in_progress', 'PostToolUse');
    expect(context(readCard('sessB', 'in_progress'))).toContain('держит другая живая сессия');
  });

  it('своя карточка читается молча', () => {
    update('sessA', 'in_progress', 'PostToolUse');
    expect(readCard('sessA', 'in_progress')).toEqual({});
  });

  it('карточка в работе без claim'.concat(' при живых соседях — повод спросить'), () => {
    // Claim может отсутствовать у карточки, взятой до появления гейта. Различить
    // «брошена» и «её ведут» по данным борда нельзя — можно только спросив.
    touchSession('sessC');
    const out = readCard('sessB', 'in_progress');
    expect(context(out)).toContain('ListAgents');
    expect(context(out)).toContain("claim'а на неё нет");
  });

  it('соседей нет — гейт молчит и не шумит на одиночной сессии', () => {
    touchSession('sessA', 10 * 60);
    expect(readCard('sessB', 'in_progress')).toEqual({});
  });

  it('карточка не в работе — гейт молчит', () => {
    expect(readCard('sessB', 'todo')).toEqual({});
    expect(readCard('sessB', 'done')).toEqual({});
  });
});

describe('task-claim: гейт не имеет права уронить борд', () => {
  it('битый stdin не блокирует работу с карточками', () => {
    const result = runNodeCli(
      [HOOK],
      { CLAUDE_PROJECT_DIR: sandbox },
      { input: 'не json' },
    );
    expect(result.status).toBe(0);
  });

  it('чужой инструмент проходит мимо гейта', () => {
    expect(
      runHook({
        hook_event_name: 'PreToolUse',
        tool_name: 'mcp__metravel-task-board__metravel_tasks_list',
        session_id: 'sessB',
        tool_input: { status: 'in_progress' },
      }),
    ).toEqual({});
  });
});
