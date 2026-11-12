import fs from 'node:fs';
import path from 'node:path';

const readProjectFile = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

// Правило владельца от 06.11.2026 (3a035f354): `area=front` и `area=back` идут
// одним полным циклом, запрос «делай todo / задачи спринта» включает обе области.
// Оно заменило правило от 18.09.2026 «бэкенд из этого workspace только читается»,
// которое этот файл проверял раньше (`backend-read-only-governance`) и из-за
// которого оставался красным на main (#3303): правило сняли, а тест — нет.
// Здесь заперты обе стороны: действующая формулировка есть во всех always-on и
// бордовых документах, а снятый запрет в них не возвращается.
describe('frontend and backend cards share one lifecycle (owner rule 2026-11-06)', () => {
  const agents = readProjectFile('AGENTS.md');
  const rules = readProjectFile('docs/RULES.md');
  const board = readProjectFile('docs/TASK_BOARD_MCP.md');
  const ticketFlow = readProjectFile('.claude/skills/ticket-flow/SKILL.md');
  // Адаптер Grok — не источник правил (AGENTS.md §1), но его always-on файл читается
  // вместе с AGENTS.md: строка «только фронтенд» пережила смену правила (#3314).
  const grok = readProjectFile('.grok/rules/00-grok.md');

  it('keeps the unified lifecycle in always-on, rules, board docs and the ticket runbook', () => {
    expect(agents).toMatch(/`area=front` и `area=back` проходят один полный цикл/);
    expect(agents).toMatch(/«делай todo \/ задачи спринта» включает обе области/);
    expect(agents).toMatch(/Код, ревью и Git веди в репозитории своей области/);

    expect(rules).toMatch(/^### Frontend and backend task lifecycle$/m);
    expect(rules).toMatch(/includes\s+eligible `area=front` and `area=back` cards/);
    expect(rules).toMatch(/Keep one\s+writer per card/);

    expect(board).toMatch(/^### Единый цикл для `area=front` и `area=back`$/m);
    expect(board).toMatch(/включают\s+обе области/);

    expect(ticketFlow).toMatch(/^## Маршрут `area=back`$/m);
    expect(ticketFlow).toMatch(/Общий запрос на todo\/спринт включает frontend и backend/);

    expect(grok).toMatch(/`area=front` и `area=back` проходят один полный цикл/);
    expect(grok).toMatch(/по todo, борду или спринту включает обе области/);
  });

  it('does not bring the withdrawn read-only rule back', () => {
    for (const text of [agents, rules, board, ticketFlow, grok]) {
      expect(text).not.toMatch(/[Бб]экенд[^.\n]{0,80}только читается/);
      expect(text).not.toMatch(/`area=back` не открывает/);
      expect(text).not.toMatch(/does not authorize `area=back` implementation/);
      expect(text).not.toMatch(/из фронтового workspace не реализуется/);
      expect(text).not.toMatch(/охватывает только фронтенд/);
      expect(text).not.toMatch(/услови[яй] прямого назначения `area=back`/);
    }
  });
});
