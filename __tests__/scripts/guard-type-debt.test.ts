import fs from 'node:fs'
import path from 'node:path'

import {
  makeTempDir,
  removeDir,
  runNodeCli,
  writeTextFile,
} from './cli-test-utils'

const repoRoot = path.resolve(__dirname, '../..')
const guardPath = path.join(repoRoot, 'scripts/guard-type-debt.js')
const {
  compareToBaseline,
  countTypeDebt,
  createBaseline,
  scanTypeDebt,
} = require('@/scripts/guard-type-debt')

describe('guard-type-debt', () => {
  it('splits as-any casts into styleCast (noise) and logicCast (risk)', () => {
    const counts = countTypeDebt(`
      const typed = source as any
      const array = source as any[]
      const styled = ({ display: 'grid', cursor: 'pointer' }) as any
      const weight = { fontWeight: token.weight as any }
      // the words "as any" in a comment are not a cast
      // @ts-ignore -- legacy bridge
      // @ts-expect-error -- intentional incompatible fixture
      // eslint-disable-next-line react-hooks/exhaustive-deps
    `, 'components/example.tsx')

    expect(counts).toEqual({
      styleCast: 2,
      logicCast: 2,
      tsIgnore: 1,
      tsExpectError: 1,
      eslintDisable: 1,
    })
  })

  it('classifies every cast in a *.styles.ts file as styleCast', () => {
    const counts = countTypeDebt(
      'export const s = anything as any\n',
      'components/Thing.styles.ts',
    )
    expect(counts).toMatchObject({ styleCast: 1, logicCast: 0 })
  })

  it('groups debt by production domain and file', () => {
    const root = makeTempDir('metravel-type-debt-scan-')
    try {
      writeTextFile(path.join(root, 'components/Card.tsx'), 'const value = input as any\n')
      writeTextFile(path.join(root, 'hooks/useThing.ts'), '// @ts-ignore -- fixture\nexport {}\n')
      writeTextFile(path.join(root, '__tests__/ignored.test.ts'), 'const ignored = input as any\n')

      const scan = scanTypeDebt(root)

      expect(scan.totals).toMatchObject({ logicCast: 1, tsIgnore: 1 })
      expect(scan.domains.components.logicCast).toBe(1)
      expect(scan.domains.hooks.tsIgnore).toBe(1)
      expect(scan.files['__tests__/ignored.test.ts']).toBeUndefined()
    } finally {
      removeDir(root)
    }
  })

  it('fails both the file and domain budgets when debt increases', () => {
    const root = makeTempDir('metravel-type-debt-compare-')
    try {
      const filePath = path.join(root, 'components/Card.tsx')
      writeTextFile(filePath, 'const first = input as any\n')
      const baseline = createBaseline(root)

      writeTextFile(filePath, 'const first = input as any\nconst second = input as any\n')
      const violations = compareToBaseline(scanTypeDebt(root), baseline)

      expect(violations).toEqual(expect.arrayContaining([
        expect.objectContaining({ scope: 'domain', name: 'components', metric: 'logicCast' }),
        expect.objectContaining({ scope: 'file', name: 'components/Card.tsx', metric: 'logicCast' }),
      ]))
    } finally {
      removeDir(root)
    }
  })

  it('updates and enforces a synthetic baseline through the CLI', () => {
    const root = makeTempDir('metravel-type-debt-cli-')
    const baselinePath = path.join(root, 'baseline.json')
    try {
      writeTextFile(path.join(root, 'utils/example.ts'), 'export const value = source as any\n')

      const update = runNodeCli([
        guardPath,
        '--root', root,
        '--baseline', baselinePath,
        '--update',
      ])
      expect(update.status).toBe(0)
      expect(fs.existsSync(baselinePath)).toBe(true)

      const pass = runNodeCli([
        guardPath,
        '--root', root,
        '--baseline', baselinePath,
      ])
      expect(pass.status).toBe(0)

      writeTextFile(
        path.join(root, 'utils/example.ts'),
        'export const value = source as any\nexport const next = source as any\n',
      )
      const fail = runNodeCli([
        guardPath,
        '--root', root,
        '--baseline', baselinePath,
      ])
      expect(fail.status).toBe(1)
      expect(fail.stderr).toContain('metric=logicCast')
    } finally {
      removeDir(root)
    }
  })
})
