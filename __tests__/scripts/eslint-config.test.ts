import path from 'node:path'
import { runNodeCli } from './cli-test-utils'
import baseline from '../fixtures/eslint9-rule-policy.json'

const repoRoot = path.resolve(__dirname, '../..')
const cases = [
  {
    name: 'accepts JSX references and valid hooks without eslint-plugin-react',
    filePath: 'components/EslintProbe.tsx',
    code: `import { useState } from 'react';
      const Label = ({ value }: { value: number }) => <span>{value}</span>;
      export function Screen() {
        const [value] = useState(0);
        return <Label value={value} />;
      }`,
    ruleIds: [],
  },
  {
    name: 'rejects conditional hooks',
    filePath: 'components/EslintProbe.tsx',
    code: `import { useState } from 'react';
      export function Screen({ visible }: { visible: boolean }) {
        if (visible) useState(0);
        return <span />;
      }`,
    ruleIds: ['react-hooks/rules-of-hooks'],
  },
  {
    name: 'rejects unused TypeScript variables',
    filePath: 'utils/eslintProbe.ts',
    code: 'export function read() { const unused = 42; return true; }',
    ruleIds: ['@typescript-eslint/no-unused-vars'],
  },
  {
    name: 'reports unused JavaScript variables',
    filePath: 'scripts/eslint-probe.js',
    code: 'const unused = 42; export const value = true;',
    ruleIds: ['no-unused-vars'],
  },
  {
    name: 'rejects external navigation outside the chokepoint',
    filePath: 'components/EslintProbe.tsx',
    code: `import { Linking } from 'react-native';
      export const open = () => Linking.openURL('https://example.com');`,
    ruleIds: ['no-restricted-syntax'],
  },
  {
    name: 'rejects JSON-LD that Helmet would silently drop',
    filePath: 'components/EslintProbe.tsx',
    code: `export const schema = <script dangerouslySetInnerHTML={{ __html: '{}' }} />;`,
    ruleIds: ['no-restricted-syntax'],
  },
]

describe('repository ESLint behavior', () => {
  let diagnostics: Array<Array<{ ruleId: string | null; fatal?: boolean }>>
  let policies: Record<string, Record<string, unknown[]>>
  let versions: { eslint: string; policy: string }

  beforeAll(() => {
    // Load the real flat config outside Jest's VM, which cannot import it dynamically.
    const result = runNodeCli(['-e', `
      const { ESLint } = require('eslint');
      (async () => {
        const eslint = new ESLint();
        const cases = ${JSON.stringify(cases)};
        const output = [];
        for (const { filePath, code } of cases) {
          const [result] = await eslint.lintText(code, { filePath });
          output.push(result.messages);
        }
        const policies = {};
        for (const filePath of ${JSON.stringify(Object.keys(baseline.profiles))}) {
          const config = await eslint.calculateConfigForFile(filePath);
          policies[filePath] = Object.fromEntries(Object.entries(config.rules)
            .filter(([, [severity]]) => severity > 0));
        }
        const versions = {
          eslint: require('eslint/package.json').version,
          policy: require('@eslint/js/package.json').version,
        };
        process.stdout.write(JSON.stringify({ diagnostics: output, policies, versions }));
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `], {}, { cwd: repoRoot, timeoutMs: 30_000 })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    ;({ diagnostics, policies, versions } = JSON.parse(result.stdout))
  }, 35_000)

  it.each(cases.map((probe, index) => ({ ...probe, index })))('$name', ({ index, ruleIds }) => {
    expect(diagnostics[index].some(message => message.fatal)).toBe(false)
    expect(diagnostics[index].map(message => message.ruleId)).toEqual(ruleIds)
  })

  it('runs ESLint 10 with the independently versioned, accepted rule policy', () => {
    expect(versions.eslint).toMatch(/^10\./)
    expect(versions.policy).toBe(baseline.policyVersion)
  })

  it.each(Object.entries(baseline.profiles))('preserves every active rule and its options for %s', (file, rules) => {
    const expected: Record<string, unknown[]> = { ...baseline.commonRules, ...rules }
    // ESLint 10 exposes two existing defaults and tightens globalThis shadowing.
    // Keep these measured engine changes explicit; all other options stay strict.
    for (const [rule, settings] of Object.entries(baseline.engine10Defaults)) {
      if (rule in expected) expected[rule] = settings
    }
    expect(policies[file]).toEqual(expected)
  })
})
