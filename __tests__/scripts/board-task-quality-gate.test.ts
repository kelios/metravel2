import fs from 'node:fs';
import path from 'node:path';

import {
  hasNonCanonicalField,
  readFieldValue,
  validateBoardTask,
} from '../../scripts/lib/boardTaskContract.mjs';

const readProjectFile = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const codes = (task: Record<string, unknown>, options?: Record<string, unknown>): string[] =>
  validateBoardTask(task, options).errors.map((e: { code: string }) => e.code);

/**
 * Эталонная карточка: семь разделов в каноническом порядке, затем Problem History и Task Contract
 * с полями-идентификаторами. От неё отталкиваются негативные кейсы ниже.
 */
const validDescription = `## Простыми словами

Что сейчас: список путешествий рядом пустой, хотя рядом есть маршруты.
Как должно быть: под статьёй видно до шести соседних маршрутов.
Кого задевает: всех читателей статьи, это обрывает переход к следующей.

## В чём проблема

На \`/travel/384\` блок «Рядом можно посмотреть» пуст, ответ API отдаёт 59 результатов.

## Из-за чего возникла

Клиент читает массив, а сервер отдаёт пагинированный конверт \`{count, results}\`.

## Что должно быть сделано

1. Разобрать конверт ответа.
2. Показать пустое состояние только при \`count === 0\`.

Не входит: бэкенд и редизайн блока.

## Что уже сделано

- 2026-08-22: воспроизведено на проде — чем подтверждено: ответ API с 59 результатами.

## Что блокирует

Ничего, можно брать в работу.

## Как протестировать

Открыть \`/travel/384\`, увидеть карточки в блоке «Рядом можно посмотреть».

## Problem History

Problem key: travel-near-empty
Historical matches: #1435
Verdict: create-new
Canonical task: нет
Root-cause delta: не регрессия, разбор конверта не менялся.

## Task Contract

Scope: разбор ответа \`/near/\`; не входит бэкенд.
User-visible result: до шести соседних маршрутов под статьёй.
Data/API contract: \`GET /api/travels/{id}/near/\` → \`{count:number, results:TravelCardDto[]}\`.
Platform impact: desktop web, mobile web.
Localization impact: none — новых строк нет.
Dependencies: нет.
Fallback/mock policy: моки только в unit-тестах.
Validation: \`npm run test:run -- useNearTravelData\`, браузерная проверка \`/travel/384\`.
Regression control: unit-тест на пагинированный конверт.
Done gate: зелёный тест + карточки видны в браузере на dev.
`;

const validTask = {
  description: validDescription,
  area: 'front',
  kind: 'bug',
  status: 'todo',
  sprint: 25,
  needs_human: false,
  depends_on: [],
  assignee: 'claude',
};

describe('board task contract validator', () => {
  it('accepts a card that follows the documented structure', () => {
    const result = validateBoardTask(validTask);
    expect(result.errors).toEqual([]);
  });

  it('rejects a card without the seven mandatory sections', () => {
    const result = codes({ ...validTask, description: 'Проблема: маркеры не кликаются. Починить.' });
    expect(result).toEqual(expect.arrayContaining(['missing-sections', 'ph-missing', 'tc-missing']));
  });

  it('rejects a description that opens with the technical analysis instead of the plain-language lead', () => {
    const description = validDescription.replace('## Простыми словами', '## Технический разбор');
    expect(codes({ ...validTask, description })).toEqual(expect.arrayContaining(['lead-not-first']));
  });

  it('treats contract field names as identifiers and flags decorative formatting', () => {
    const description = validDescription.replace('Scope: разбор', '**Scope.** разбор');
    expect(hasNonCanonicalField(description, 'Scope')).toBe(true);
    expect(codes({ ...validTask, description })).toEqual(expect.arrayContaining(['tc-format']));
  });

  it('requires fields inside their own section instead of accepting a duplicate elsewhere', () => {
    const description = validDescription
      .replace('Scope: разбор', 'Missing scope: разбор')
      .replace(
        'На `/travel/384` блок',
        'Scope: эта строка находится вне Task Contract и не должна его чинить.\n\nНа `/travel/384` блок',
      );

    expect(codes({ ...validTask, description })).toEqual(expect.arrayContaining(['tc-fields']));
  });

  it('requires the plain-language lead fields inside the lead section', () => {
    const description = validDescription
      .replace('Кого задевает:', 'Кого затрагивает:')
      .replace(
        'На `/travel/384` блок',
        'Кого задевает: эта строка находится в техническом разделе.\n\nНа `/travel/384` блок',
      );

    expect(codes({ ...validTask, description })).toEqual(expect.arrayContaining(['lead-fields']));
  });

  it('rejects a needs_human card that also carries a Task Contract', () => {
    const result = codes({ ...validTask, needs_human: true });
    expect(result).toEqual(expect.arrayContaining(['human-with-contract', 'human-sections']));
  });

  it('accepts a needs_human card written from the human-task template', () => {
    const description = [
      '## Что нужно сделать',
      'Утвердить сборку 1.2.3 для отправки в App Review.',
      '',
      '## Зачем',
      'Агент не может принимать решение о релизе.',
      '',
      '## Шаги',
      '1. Открыть App Store Connect.',
      '2. Выбрать сборку 1.2.3.',
      '',
      '## Где',
      'App Store Connect → TestFlight.',
      '',
      '## Готово когда',
      'Сборка отмечена как выбранная для ревью.',
    ].join('\n');
    expect(codes({ ...validTask, needs_human: true, description })).toEqual([]);
  });

  it('does not treat an explicit `none` as an empty contract field', () => {
    expect(readFieldValue(validDescription, 'Localization impact')).toContain('none');
    expect(codes(validTask)).not.toEqual(expect.arrayContaining(['tc-empty']));
  });

  it('requires a permanent regression control for bugs', () => {
    const description = validDescription.replace(
      'Regression control: unit-тест на пагинированный конверт.',
      'Regression control: none',
    );
    expect(codes({ ...validTask, description })).toEqual(
      expect.arrayContaining(['bug-without-regression-control']),
    );
  });

  it('requires a sprint and a named blocker', () => {
    expect(codes({ ...validTask, sprint: null })).toEqual(expect.arrayContaining(['no-sprint']));
    expect(codes({ ...validTask, status: 'blocked_by', blocked_by: null, depends_on: [] })).toEqual(
      expect.arrayContaining(['blocked-without-link']),
    );
  });

  it('separates defects fixable by text from defects fixable only by a field', () => {
    // Иначе карточка со `status=blocked_by` без блокера навсегда заперта в плохом описании:
    // любая правка текста упирается в ошибку, которую текст не исправляет.
    const parked = { ...validTask, status: 'blocked_by', blocked_by: null, depends_on: [] };
    const result = validateBoardTask(parked);
    const codeOf = (list: { code: string }[]) => list.map((p) => p.code);

    expect(codeOf(result.fieldErrors)).toContain('blocked-without-link');
    expect(codeOf(result.textErrors)).not.toContain('blocked-without-link');
    expect(codeOf(result.errors)).toContain('blocked-without-link');
  });

  it('flags a card parked in blocked_by while its own text says nothing blocks it', () => {
    expect(
      codes({ ...validTask, status: 'blocked_by', blocked_by: 1513, depends_on: [] }),
    ).toEqual(expect.arrayContaining(['blocked-contradiction']));
  });
});

describe('board task quality gate wiring', () => {
  it('runs the gate before task create and task update', () => {
    const settings = JSON.parse(readProjectFile('.claude/settings.json'));
    const preHooks = settings?.hooks?.PreToolUse ?? [];
    const gate = preHooks.find((entry: { hooks: { command: string }[] }) =>
      entry.hooks.some((hook) => hook.command.includes('task-quality-gate.mjs')),
    );
    expect(gate).toBeDefined();
    expect(gate.matcher).toContain('metravel_task_create');
    expect(gate.matcher).toContain('metravel_task_update');
  });

  it('keeps the audit entry point available as an npm command', () => {
    const packageJson = JSON.parse(readProjectFile('package.json'));
    expect(packageJson.scripts['board:audit']).toContain('scripts/audit-board-tasks.mjs');
  });
});

describe('needs_human boundary is stated where the card is authored', () => {
  // Правило разошлось с практикой: на 2026-08-22 флаг стоял у 9 из 14 открытых backend-карточек
  // против 8 из 344 закрытых. Формулировка границы обязана жить во всех файлах, откуда заводят карточку.
  const files = [
    'docs/TASK_BOARD_MCP.md',
    '.claude/agents/ticket-board.md',
    '.codex/skills/metravel-ticket-board/SKILL.md',
    '.codex/skills/metravel-task-contract/SKILL.md',
  ];

  it.each(files)('%s разводит работу владельца и human-only действие', (file) => {
    const content = readProjectFile(file);
    expect(content).toMatch(/needs_human/);
    expect(content).toMatch(/Task Contract/);
    expect(content.toLowerCase()).toContain('взаимоисключа');
  });
});
