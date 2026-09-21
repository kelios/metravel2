const fs = require('fs')
const path = require('path')

const {
  APPROVED_DEFERRED_LOADING,
  OUTPUT_CONTRACT_VERSION,
  REGISTRY_MARKER,
  RULES_PATH,
  RULES_SECTION_HEADING,
  buildJsonResult,
  collectSourceFiles,
  evaluateGuard,
  findDeferralSites,
  parseArgs,
  readRegistryFiles,
  shouldScanFile,
} = require('@/scripts/guard-web-deferred-loading')

const rulesWith = (...files: string[]) =>
  [
    '## Operations',
    '',
    RULES_SECTION_HEADING,
    '',
    '- Some other bullet mentioning `components/Other.tsx` — not an entry.',
    `- ${REGISTRY_MARKER}. One entry per file.`,
    ...files.map((file) => `  - \`${file}\` — what waits.`),
    '  - Timer or idle only, invisible to the guard: `hooks/useIdleOnly.ts` (idle).',
    '- Next bullet.',
    '  - `components/NotInRegistry.tsx` — outside the registry block.',
    '',
    '## UI rules',
    '',
    '  - `components/AfterSection.tsx` — another section.',
  ].join('\n')

const readRealTree = () => {
  const rootDir = process.cwd()
  const sources = collectSourceFiles(rootDir).map((filePath: string) => ({
    filePath,
    content: fs.readFileSync(path.join(rootDir, filePath), 'utf8'),
  }))
  const rulesText = fs.readFileSync(path.join(rootDir, RULES_PATH), 'utf8')
  return { sources, rulesText }
}

describe('guard-web-deferred-loading', () => {
  it('parses --json flag', () => {
    expect(parseArgs([])).toEqual({ output: 'text' })
    expect(parseArgs(['--json'])).toEqual({ output: 'json' })
  })

  it('scans web app sources only', () => {
    expect(shouldScanFile('components/home/Home.tsx')).toBe(true)
    expect(shouldScanFile('hooks/useProgressiveLoading.ts')).toBe(true)
    expect(shouldScanFile('components/travel/Map.native.tsx')).toBe(false)
    expect(shouldScanFile('components/travel/Map.ios.tsx')).toBe(false)
    expect(shouldScanFile('components/travel/__tests__/Map.tsx')).toBe(false)
    expect(shouldScanFile('components/travel/Map.test.tsx')).toBe(false)
    expect(shouldScanFile('__tests__/components/Home.test.tsx')).toBe(false)
    expect(shouldScanFile('scripts/guard-web-deferred-loading.js')).toBe(false)
    expect(shouldScanFile('components/home/Home.md')).toBe(false)
  })

  describe('findDeferralSites', () => {
    const kinds = (content: string) =>
      findDeferralSites({ content }).sites.map((site: { kind: string; line: number }) => `${site.kind}@${site.line}`)

    it('counts every observer construction spelling', () => {
      expect(
        kinds(
          [
            'const a = new IntersectionObserver(cb)',
            'const b = new window.IntersectionObserver(cb, { rootMargin: "200px" })',
            'const c = new (window as any).IntersectionObserver(cb)',
            'const d = new IntersectionObserverCtor(cb)',
          ].join('\n'),
        ),
      ).toEqual(['observer@1', 'observer@2', 'observer@3', 'observer@4'])
    })

    it('counts a construction through a local alias', () => {
      expect(
        kinds(['const Observer = w?.IntersectionObserver;', 'created = new Observer(cb, {})'].join('\n')),
      ).toEqual(['observer@2'])
    })

    it('counts hook calls and wrapper usages but not the hook definition', () => {
      expect(
        kinds(
          [
            'export function useProgressiveLoad(config) {}',
            'const { shouldLoad } = useProgressiveLoad({ priority: "low" })',
            '<DeferredSection priority="low">',
            '<DeferredSection>',
          ].join('\n'),
        ),
      ).toEqual(['useProgressiveLoad@2', 'DeferredSection@3', 'DeferredSection@4'])
    })

    it('ignores comments and string contents', () => {
      const result = findDeferralSites({
        content: [
          '// new IntersectionObserver(cb) and useProgressiveLoad({}) in a comment',
          '/* <DeferredSection priority="low"> */',
          "const hint = 'new IntersectionObserver(cb)'",
          'const doc = `useProgressiveLoad({})`',
        ].join('\n'),
      })
      expect(result.sites).toEqual([])
      expect(result.mentionLine).toBeNull()
    })

    it('reports a type or feature-check mention without counting a site', () => {
      const result = findDeferralSites({
        content: [
          'const observers = new Map<string, IntersectionObserver>()',
          "if (typeof IntersectionObserver === 'undefined') return",
        ].join('\n'),
      })
      expect(result.sites).toEqual([])
      expect(result.mentionLine).toBe(1)
    })
  })

  describe('readRegistryFiles', () => {
    it('reads only the entries of the registry bullet inside the section', () => {
      const text = rulesWith('hooks/useProgressiveLoading.ts').replace(
        '  - `hooks/useProgressiveLoading.ts` — what waits.',
        '  - `hooks/useProgressiveLoading.ts` — what waits.\n  - `hooks/a.ts`, `hooks/b.ts` — two files in one entry.',
      )
      const registry = readRegistryFiles(text)
      expect(registry.found).toBe(true)
      expect([...registry.files].sort()).toEqual(['hooks/a.ts', 'hooks/b.ts', 'hooks/useProgressiveLoading.ts'])
    })

    it('reports a missing section or registry bullet', () => {
      expect(readRegistryFiles('## Other\n- `hooks/a.ts` — x').found).toBe(false)
      expect(readRegistryFiles(`${RULES_SECTION_HEADING}\n\n- Only prose.\n`).found).toBe(false)
    })
  })

  describe('evaluateGuard', () => {
    const approved = { 'components/Approved.tsx': 1 }
    const approvedSource = {
      filePath: 'components/Approved.tsx',
      content: 'const { shouldLoad } = useProgressiveLoad({ priority: "low" })',
    }

    it('passes when files, counts and the registry agree', () => {
      const result = evaluateGuard({
        sources: [approvedSource, { filePath: 'components/Plain.tsx', content: 'export const x = 1' }],
        rulesText: rulesWith('components/Approved.tsx'),
        approved,
      })
      expect(result).toMatchObject({ ok: true, violations: [] })
    })

    it('fails on a new deferred load in a file outside the registry', () => {
      const result = evaluateGuard({
        sources: [
          approvedSource,
          {
            filePath: 'components/NewSection.tsx',
            content: 'const x = 1\nconst { shouldLoad } = useProgressiveLoad({ priority: "low" })',
          },
        ],
        rulesText: rulesWith('components/Approved.tsx'),
        approved,
      })
      expect(result.ok).toBe(false)
      expect(result.violations).toEqual([
        expect.objectContaining({ rule: 'unlisted-file', file: 'components/NewSection.tsx', line: 2 }),
      ])
    })

    it('fails on the hook under another name in a file outside the registry', () => {
      for (const content of [
        "import { useProgressiveLoad as useLazySection } from '@/hooks/useProgressiveLoading'\nconst { shouldLoad } = useLazySection({ priority: 'low' })",
        "import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'\nconst useLazy = useProgressiveLoad",
      ]) {
        const result = evaluateGuard({
          sources: [approvedSource, { filePath: 'components/RenamedHook.tsx', content }],
          rulesText: rulesWith('components/Approved.tsx'),
          approved,
        })
        expect(result.violations).toEqual([
          expect.objectContaining({ rule: 'unlisted-file', file: 'components/RenamedHook.tsx', line: 1 }),
        ])
      }
    })

    it('fails on a file that only checks for the observer', () => {
      const result = evaluateGuard({
        sources: [
          approvedSource,
          { filePath: 'hooks/useMaybeVisible.ts', content: "if (typeof IntersectionObserver === 'undefined') {}" },
        ],
        rulesText: rulesWith('components/Approved.tsx'),
        approved,
      })
      expect(result.violations).toEqual([
        expect.objectContaining({ rule: 'unlisted-file', file: 'hooks/useMaybeVisible.ts' }),
      ])
    })

    it('fails when an approved file gains a deferral site', () => {
      const result = evaluateGuard({
        sources: [
          {
            filePath: 'components/Approved.tsx',
            content: `${approvedSource.content}\nconst io = new IntersectionObserver(cb)`,
          },
        ],
        rulesText: rulesWith('components/Approved.tsx'),
        approved,
      })
      expect(result.violations).toEqual([
        expect.objectContaining({ rule: 'site-count', file: 'components/Approved.tsx' }),
      ])
    })

    it('fails on an approved file that no longer defers anything', () => {
      const result = evaluateGuard({
        sources: [{ filePath: 'components/Approved.tsx', content: 'export const x = 1' }],
        rulesText: rulesWith('components/Approved.tsx'),
        approved,
      })
      expect(result.violations).toEqual([
        expect.objectContaining({ rule: 'stale-entry', file: 'components/Approved.tsx' }),
      ])
    })

    it('fails when the registry and the allowlist disagree', () => {
      const result = evaluateGuard({
        sources: [approvedSource],
        rulesText: rulesWith('components/OnlyInRules.tsx'),
        approved,
      })
      expect(result.violations.map((v: { rule: string; snippet: string }) => [v.rule, v.snippet])).toEqual([
        ['registry-parity', 'components/Approved.tsx is approved in the guard but missing from the registry'],
        ['registry-parity', 'components/OnlyInRules.tsx is in the registry but missing from APPROVED_DEFERRED_LOADING'],
      ])
    })

    it('fails without the registry and on an empty scan', () => {
      expect(evaluateGuard({ sources: [approvedSource], rulesText: '', approved }).violations).toEqual([
        expect.objectContaining({ rule: 'registry-missing' }),
      ])
      expect(
        evaluateGuard({ sources: [], rulesText: rulesWith(), approved: {} }).violations,
      ).toEqual([expect.objectContaining({ rule: 'empty-scan' })])
    })
  })

  describe('against the checked-out tree', () => {
    const tree = readRealTree()

    it('passes, and the scan is not vacuous', () => {
      const result = evaluateGuard(tree)
      expect(result.violations).toEqual([])
      expect(result.ok).toBe(true)
      expect(tree.sources.length).toBeGreaterThan(500)
      expect(Object.keys(APPROVED_DEFERRED_LOADING).length).toBeGreaterThan(10)
    })

    it('turns red on a synthetic new deferred section outside the registry', () => {
      const result = evaluateGuard({
        ...tree,
        sources: [
          ...tree.sources,
          {
            filePath: 'components/quests/QuestSyntheticSection.tsx',
            content: 'export function X() {\n  const { shouldLoad } = useProgressiveLoad({ priority: "low" })\n}',
          },
        ],
      })
      expect(result.ok).toBe(false)
      expect(result.violations).toEqual([
        expect.objectContaining({ rule: 'unlisted-file', file: 'components/quests/QuestSyntheticSection.tsx' }),
      ])
    })
  })

  it('builds the json contract output', () => {
    const json = buildJsonResult({
      ok: false,
      reason: 'fail reason',
      violations: [{ rule: 'unlisted-file', file: 'a.ts', line: 3, snippet: 'useProgressiveLoad @3' }],
    })
    expect(json).toEqual({
      contractVersion: OUTPUT_CONTRACT_VERSION,
      ok: false,
      reason: 'fail reason',
      violations: [{ rule: 'unlisted-file', file: 'a.ts', line: 3, snippet: 'useProgressiveLoad @3' }],
      violationCount: 1,
    })
  })

  it('is wired into lint, lint:ci and check:fast', () => {
    // Гейт и есть регрессионный контроль правила: выпади он из общей цепочки,
    // реестр в RULES.md снова стал бы прозой, которую никто не сверяет.
    const readRepoFile = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
    const { scripts } = JSON.parse(readRepoFile('package.json'))
    expect(scripts['guard:web-deferred-loading']).toBe('node scripts/guard-web-deferred-loading.js')
    expect(scripts.lint).toContain('npm run guard:web-deferred-loading')
    expect(scripts['lint:ci']).toContain('npm run guard:web-deferred-loading')
    expect(readRepoFile('scripts/run-fast-scope-checks.js')).toContain(
      "runCommand('npm', ['run', 'guard:web-deferred-loading'])",
    )
  })
})
