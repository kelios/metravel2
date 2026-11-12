import fs from 'node:fs';
import path from 'node:path';

// #3277: блоки «Статус на борде», «Проверка по platform impact» и слои
// доказательств iOS были скопированы в 7, 8 и 5 ролей. Текст живёт один раз в
// `docs/AGENT_ROLE_CONTRACTS.md`, роль держит ссылку и свои отличия.

const SHARED_DOC = 'docs/AGENT_ROLE_CONTRACTS.md';
const AGENTS_DIR = '.claude/agents';
const BOARD = 'Статус на борде (WIP-видимость)';
const PLATFORM = 'Проверка по platform impact';
const IOS_LAYERS = 'Слои доказательств iOS';

const EXECUTOR_ROLES = [
  'achievements-expert',
  'android-expert',
  'map-expert',
  'profile-expert',
  'quest-expert',
  'refactor-surgeon',
  'travel-expert',
];
const IOS_ROLES = ['ios-analyst', 'ios-architect', 'ios-designer', 'ios-expert', 'ios-reviewer'];
const ROLE_SECTIONS: Record<string, string[]> = {
  ...Object.fromEntries(EXECUTOR_ROLES.map((role) => [role, [BOARD, PLATFORM]])),
  'dev-loop': [PLATFORM],
  ...Object.fromEntries(IOS_ROLES.map((role) => [role, [IOS_LAYERS]])),
};

// Формулировки iOS-слоёв в ролях расходились по падежам, поэтому дословная
// сверка с таблицей документа их не ловит: это маркеры прежнего блока.
const LEGACY_IOS_MARKERS = [/физический iPhone обязателен для/u, /TestFlight build — единственн/u];

const MIN_SHARED_BLOCK = 80;
const MIN_SHARED_CELL = 60;
const MIN_REPEATED_BLOCK = 220;
const MIN_REPEATED_SECTION = 400;
const MIN_ROLES_FOR_REPEAT = 3;

const readProjectFile = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();

const stripFrontmatter = (markdown: string): string => markdown.replace(/^---\n[\s\S]*?\n---\n/, '');

/** Пункты списка с продолжением, абзацы и строки таблиц — по одному блоку. */
const blocksOf = (markdown: string): string[] => {
  const blocks: string[] = [];
  let current: string | null = null;
  const flush = () => {
    if (current !== null) blocks.push(normalize(current));
    current = null;
  };
  for (const line of stripFrontmatter(markdown).split('\n')) {
    if (/^\s*$/.test(line) || /^#/.test(line) || /^```/.test(line)) flush();
    else if (/^\s*([-*]|\d+\.)\s+/.test(line) || /^\s*\|/.test(line)) {
      flush();
      current = line;
    } else current = current === null ? line : `${current} ${line}`;
  }
  flush();
  return blocks;
};

const sectionsOf = (markdown: string): { title: string; body: string }[] =>
  stripFrontmatter(markdown)
    .split(/^## /m)
    .slice(1)
    .map((part) => {
      const lineEnd = part.indexOf('\n');
      return { title: part.slice(0, lineEnd).trim(), body: normalize(part.slice(lineEnd)) };
    });

/** Фрагменты общего документа, которые не должны появляться в роли дословно. */
const sharedFragments = (doc: string): string[] => {
  const fragments: string[] = [];
  for (const block of blocksOf(doc)) {
    if (block.startsWith('|')) {
      for (const cell of block.split('|').map((value) => value.trim())) {
        if (cell.length >= MIN_SHARED_CELL) fragments.push(cell);
      }
    } else if (block.length >= MIN_SHARED_BLOCK) fragments.push(block);
  }
  return fragments;
};

const copiedFragments = (doc: string, role: string): string[] => {
  const roleText = normalize(role);
  return sharedFragments(doc).filter((fragment) => roleText.includes(fragment));
};

const repeatedAcrossRoles = (
  roles: Record<string, string>,
  unitsOf: (markdown: string) => string[],
  minLength: number
): string[] => {
  const owners = new Map<string, Set<string>>();
  for (const [name, markdown] of Object.entries(roles)) {
    for (const unit of unitsOf(markdown)) {
      if (unit.length < minLength) continue;
      if (!owners.has(unit)) owners.set(unit, new Set());
      owners.get(unit)?.add(name);
    }
  }
  return [...owners]
    .filter(([, names]) => names.size >= MIN_ROLES_FOR_REPEAT)
    .map(([unit, names]) => `${[...names].sort().join(', ')}: ${unit.slice(0, 80)}…`);
};

describe('agent role shared blocks (#3277)', () => {
  const doc = readProjectFile(SHARED_DOC);
  const roles: Record<string, string> = Object.fromEntries(
    fs
      .readdirSync(path.join(process.cwd(), AGENTS_DIR))
      .filter((name) => name.endsWith('.md'))
      .map((name) => [name.replace(/\.md$/, ''), readProjectFile(`${AGENTS_DIR}/${name}`)])
  );

  it('keeps the shared sections in one classified document', () => {
    const titles = sectionsOf(doc).map((section) => section.title);
    expect(titles).toEqual(expect.arrayContaining([BOARD, PLATFORM, IOS_LAYERS]));
    expect(readProjectFile('docs/INDEX.md')).toContain(`\`${SHARED_DOC}\``);
  });

  it.each(Object.entries(ROLE_SECTIONS))('%s links to its shared sections', (role, sections) => {
    const text = normalize(roles[role] ?? '');
    expect(text).toContain(SHARED_DOC);
    for (const section of sections) expect(text).toContain(`«${section}»`);
  });

  it('does not copy a shared block back into a role', () => {
    const copies = Object.entries(roles).flatMap(([name, markdown]) => [
      ...copiedFragments(doc, markdown).map((fragment) => `${name}: ${fragment.slice(0, 80)}…`),
      ...LEGACY_IOS_MARKERS.filter((marker) => marker.test(normalize(markdown))).map(
        (marker) => `${name}: ${marker.source}`
      ),
    ]);
    expect(copies).toEqual([]);
  });

  it('does not repeat one long block or section across three or more roles', () => {
    expect(repeatedAcrossRoles(roles, blocksOf, MIN_REPEATED_BLOCK)).toEqual([]);
    expect(
      repeatedAcrossRoles(roles, (markdown) => sectionsOf(markdown).map((section) => section.body), MIN_REPEATED_SECTION)
    ).toEqual([]);
  });

  it('detects a pasted shared block, a legacy iOS bullet and a repeated block', () => {
    const boardBullet = blocksOf(doc).find((block) => block.includes('ДО первой правки кода')) ?? '';
    expect(boardBullet.length).toBeGreaterThanOrEqual(MIN_SHARED_BLOCK);
    const pasted = `---\nname: sample\n---\n\n## Борд\n\n${boardBullet}\n`;
    expect(copiedFragments(doc, pasted)).toEqual([boardBullet]);
    expect(copiedFragments(doc, '## Борд\n\nСвоя короткая ссылка на общий раздел.\n')).toEqual([]);

    const iosCell = sharedFragments(doc).find((fragment) => fragment.startsWith('camera/photo/HEIC')) ?? '';
    expect(copiedFragments(doc, `- физический iPhone: ${iosCell};\n`)).toEqual([iosCell]);
    expect(LEGACY_IOS_MARKERS.some((marker) => marker.test('- физический iPhone обязателен для camera'))).toBe(true);

    const local = `- ${'своё правило роли '.repeat(15)}\n`;
    const sample = { a: local, b: local, c: local };
    expect(repeatedAcrossRoles(sample, blocksOf, MIN_REPEATED_BLOCK)).toHaveLength(1);
    expect(repeatedAcrossRoles({ a: local, b: local }, blocksOf, MIN_REPEATED_BLOCK)).toEqual([]);
  });
});
