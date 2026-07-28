import fs from 'node:fs';
import path from 'node:path';

const readProjectFile = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('problem-memory governance', () => {
  it('requires the history verdict before board create, reopen, or split', () => {
    const agents = readProjectFile('AGENTS.md');
    const boardDocs = readProjectFile('docs/TASK_BOARD_MCP.md');
    const boardSkill = readProjectFile('.codex/skills/metravel-ticket-board/SKILL.md');
    const contractSkill = readProjectFile('.codex/skills/metravel-task-contract/SKILL.md');
    const ticketBoardAgent = readProjectFile('.claude/agents/ticket-board.md');

    expect(agents).toContain('$metravel-problem-memory');
    expect(boardDocs).toMatch(/До `metravel_task_create`, reopen или split[\s\S]*Problem Memory Verdict/);
    expect(boardDocs).toContain('## Problem History');
    expect(boardSkill).toMatch(/\$metravel-problem-memory[\s\S]*before create, reopen, split/);
    expect(contractSkill).toMatch(/Do not create, reopen, or split a task without a Problem Memory Verdict/);
    expect(ticketBoardAgent).toMatch(/До create\/reopen\/split обязательно вызови[\s\S]*problem-memory/);
  });

  it('keeps one canonical four-way decision vocabulary across the workflow', () => {
    const files = [
      'docs/PROBLEM_MEMORY.md',
      'docs/TASK_BOARD_MCP.md',
      '.codex/skills/metravel-problem-memory/SKILL.md',
      '.codex/skills/metravel-task-contract/SKILL.md',
      '.claude/agents/problem-memory.md',
      '.claude/agents/ticket-board.md',
    ];

    for (const file of files) {
      const content = readProjectFile(file);
      for (const verdict of ['reuse', 'reopen', 'create-linked', 'create-new']) {
        expect(content).toContain(verdict);
      }
    }
  });

  it('keeps the problem-memory agent read-only and board mutations in ticket-board', () => {
    const problemMemoryAgent = readProjectFile('.claude/agents/problem-memory.md');
    const frontmatter = problemMemoryAgent.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';

    expect(frontmatter).not.toMatch(/metravel_task_(create|update|delete)/);
    expect(problemMemoryAgent).toMatch(/не мутируешь борд/i);
    expect(problemMemoryAgent).toMatch(/создаёт и двигает[\s\S]*ticket-board/i);
  });
});
