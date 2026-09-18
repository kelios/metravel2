import fs from 'node:fs';
import path from 'node:path';

const readProjectFile = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('backend is read-only from this workspace', () => {
  it('keeps the no-implementation rule in always-on and board docs', () => {
    const agents = readProjectFile('AGENTS.md');
    const rules = readProjectFile('docs/RULES.md');
    const grok = readProjectFile('.grok/rules/00-grok.md');
    const board = readProjectFile('docs/TASK_BOARD_MCP.md');
    const ticketFlow = readProjectFile('.claude/skills/ticket-flow/SKILL.md');
    const ticketBoard = readProjectFile('.codex/skills/metravel-ticket-board/SKILL.md');

    expect(agents).toMatch(/только читается/);
    expect(agents).toMatch(/сделай все todo/);
    expect(agents).toMatch(/area=back` не открывает/);

    expect(rules).toMatch(/does not authorize `area=back` implementation/);
    expect(rules).toMatch(/Do not spawn agents, open worktrees, or set cwd into a backend checkout/);

    expect(grok).toMatch(/Бэкенд только читается/);
    expect(grok).toMatch(/Сделай все todo/);
    expect(grok).toMatch(/spawn_subagent` с `cwd` в бэк-checkout/);

    expect(board).toMatch(/из фронтового workspace не реализуется/);
    expect(board).toMatch(/все todo/);

    expect(ticketFlow).toMatch(/Батч «все todo»/);
    expect(ticketFlow).toMatch(/только читает/);

    expect(ticketBoard).toMatch(/Do not implement `area=back`/);
  });
});
