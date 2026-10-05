import path from 'node:path';
import { runNodeCli } from './cli-test-utils';

/**
 * Хук `board-compact` сжимает ответы MCP-борда до попадания в контекст сессии.
 *
 * Заведён 05.10.2026: одна смена статуса карточки возвращала её целиком (15 КБ), и это
 * эхо перечитывалось на каждом следующем ходу. Тест гоняет хук как процесс на
 * синтетическом stdin и держит три свойства: квитанция записи не несёт описания,
 * чтение карточки описание сохраняет, а любой непонятный ответ остаётся нетронутым.
 */

const HOOK = path.join(process.cwd(), '.claude/hooks/board-compact.mjs');
const TOOL = (name: string) => `mcp__metravel-task-board__${name}`;

const DESCRIPTION = `## Простыми словами\n\n${'Длинное описание карточки. '.repeat(400)}\n\n## Task Contract\n\nScope: x`;

const task = (over: Record<string, unknown> = {}) => ({
  id: 2236,
  sprint: 24,
  sprint_title: 'iPhone / App Store — первый релиз',
  epic: null,
  story: null,
  title: '[FE][MAP][Android] Тап у края кнопки над картой уходит и в карту',
  description: DESCRIPTION,
  kind: 'bug',
  kind_display: 'Bug',
  status: 'in_progress',
  status_display: 'In Progress',
  urgency: 'high',
  urgency_display: 'High',
  area: 'front',
  area_display: 'Frontend',
  reporter: 'claude',
  assignee: 'claude',
  needs_human: false,
  blocked_by: null,
  depends_on: [],
  depends_on_details: [],
  related_to: [2219],
  related_to_details: [
    { id: 2219, title: 'Кнопки карты на планшете', area: 'front', status: 'todo', urgency: 'medium' },
  ],
  position: 0,
  created_at: '2026-10-05T01:22:15Z',
  updated_at: '2026-10-05T11:06:12Z',
  ...over,
});

const run = (toolName: string, toolResponse: unknown, env: Record<string, string> = {}) => {
  const result = runNodeCli([HOOK], env, {
    input: JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: toolName, tool_response: toolResponse }),
  });
  expect(result.status).toBe(0);
  const stdout = String(result.stdout || '').trim();
  return stdout ? (JSON.parse(stdout).hookSpecificOutput.updatedToolOutput as string) : null;
};

describe('board-compact hook', () => {
  it('отдаёт квитанцию вместо эха карточки на update и create', () => {
    for (const tool of ['metravel_task_update', 'metravel_task_create']) {
      const out = run(TOOL(tool), task());
      expect(out).toContain('#2236 in_progress high front bug');
      expect(out).toContain('related_to: #2219');
      expect(out).not.toContain('Длинное описание');
      expect(out!.length).toBeLessThan(600);
    }
  });

  it('сохраняет описание целиком на get и убирает дубли служебных полей', () => {
    const out = run(TOOL('metravel_task_get'), task());
    expect(out).toContain(DESCRIPTION);
    expect(out).toContain('#2219 todo medium front | Кнопки карты на планшете');
    expect(out).not.toContain('status_display');
    expect(out).not.toContain('\\n');
  });

  it('сжимает список до строки на карточку и честно называет пустой', () => {
    const out = run(TOOL('metravel_tasks_list'), [task(), task({ id: 2264, status: 'todo', blocked_by: 2236 })]);
    expect(out!.split('\n')).toEqual([
      'Карточек: 2',
      expect.stringContaining('#2236 in_progress high front bug [sprint 24] |'),
      expect.stringContaining('#2264 todo high front bug [blocked_by #2236, sprint 24] |'),
    ]);
    expect(run(TOOL('metravel_tasks_list'), [])).toBe('Карточек: 0');
  });

  it('читает ответ в любой форме сервера: объект, content-блоки, строка JSON', () => {
    const text = JSON.stringify(task());
    const expected = run(TOOL('metravel_task_update'), task());
    expect(run(TOOL('metravel_task_update'), { content: [{ type: 'text', text }] })).toBe(expected);
    expect(run(TOOL('metravel_task_update'), [{ type: 'text', text }])).toBe(expected);
    expect(run(TOOL('metravel_task_update'), text)).toBe(expected);
  });

  it('не трогает ошибку, чужой инструмент, непонятную форму и выключенный режим', () => {
    expect(run(TOOL('metravel_task_update'), { status: 'error', message: 'HTTP 401' })).toBeNull();
    expect(run(TOOL('metravel_task_update'), { isError: true, content: [{ type: 'text', text: 'boom' }] })).toBeNull();
    expect(run(TOOL('metravel_task_update'), 'не JSON')).toBeNull();
    expect(run(TOOL('metravel_sprints_list'), [{ id: 24, title: 'Спринт' }])).toBeNull();
    expect(run('mcp__other__tool', task())).toBeNull();
    expect(run(TOOL('metravel_task_update'), task(), { BOARD_COMPACT: '0' })).toBeNull();
  });
});
