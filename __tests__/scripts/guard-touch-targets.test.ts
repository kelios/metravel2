const fs = require('fs')
const path = require('path')

const { makeTempDir, removeDir } = require('./cli-test-utils')

const {
  MIN_TOUCH_TARGET,
  CONTRACT_VERSION,
  SCAN_DIRS,
  collectStyleSizes,
  collectStyleReferences,
  scanFile,
  toBaselineEntries,
  compareToBaseline,
  parseArgs,
} = require('@/scripts/guard-touch-targets')

const ts = require('typescript')

const parse = (code: string) =>
  ts.createSourceFile('probe.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

const scan = (content: string, filePath = 'components/Probe.tsx') =>
  scanFile({ rootDir: process.cwd(), filePath, content })

const componentWith = (styleBody: string, jsxProps = '') => `
import { Pressable, StyleSheet, View } from 'react-native'

const styles = StyleSheet.create({
  target: { ${styleBody} },
})

export const Probe = () => (
  <Pressable onPress={() => {}} ${jsxProps} style={styles.target}>
    <View />
  </Pressable>
)
`

describe('guard-touch-targets', () => {
  it('flags an interactive element smaller than the minimum touch target (negative probe)', () => {
    const findings = scan(componentWith('width: 32, height: 32'))

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      file: 'components/Probe.tsx',
      style: 'target',
      size: 32,
      element: 'Pressable',
    })
  })

  it('passes an element that sizes its own view to the minimum (control)', () => {
    expect(scan(componentWith(`width: ${MIN_TOUCH_TARGET}, height: ${MIN_TOUCH_TARGET}`))).toEqual([])
  })

  it('does not accept hitSlop as a substitute for size', () => {
    // Ядро семейства #192 → #1044 → #1271: hitSlop не выходит за границы
    // плотного родителя, поэтому 26dp + hitSlop остаётся недомерком.
    const findings = scan(componentWith('width: 26, height: 26', 'hitSlop={8}'))

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ size: 26, hitSlop: true })
  })

  it('reads the Pressable callback style form', () => {
    // Именно эта форма сначала спрятала находки #1274 от аудита.
    const findings = scan(`
      import { Pressable, StyleSheet } from 'react-native'
      const styles = StyleSheet.create({ pill: { minHeight: 36 }, pressed: { opacity: 0.5 } })
      export const Probe = () => (
        <Pressable style={({ pressed }) => [styles.pill, pressed && styles.pressed]} />
      )
    `)

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ style: 'pill', dimension: 'minHeight', size: 36 })
  })

  it('closes the inline-style bypass', () => {
    // Иначе гард обходится одним `style={{ width: 32 }}` мимо StyleSheet.
    const findings = scan(`
      import { Pressable } from 'react-native'
      export const Probe = () => <Pressable style={{ width: 32, height: 32 }} />
    `)

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ size: 32, key: 'components/Probe.tsx::inline(width=32)' })
  })

  it('prefers the worst of inline and named styles', () => {
    const findings = scan(`
      import { Pressable, StyleSheet } from 'react-native'
      const styles = StyleSheet.create({ box: { minHeight: 40 } })
      export const Probe = () => <Pressable style={[styles.box, { height: 24 }]} />
    `)

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ size: 24, dimension: 'height' })
  })

  it('treats minWidth/minHeight 0 as the flex idiom, not as a size', () => {
    expect(scan(componentWith('minWidth: 0, minHeight: 0, flexShrink: 1'))).toEqual([])
  })

  it('ignores non-interactive elements', () => {
    const findings = scan(`
      import { StyleSheet, View } from 'react-native'
      const styles = StyleSheet.create({ dot: { width: 8, height: 8 } })
      export const Probe = () => <View style={styles.dot} />
    `)

    expect(findings).toEqual([])
  })

  it('resolves styles from a sibling .styles.ts file', () => {
    const rootDir = makeTempDir('guard-touch-targets-')
    try {
      fs.mkdirSync(path.join(rootDir, 'components'), { recursive: true })
      fs.writeFileSync(
        path.join(rootDir, 'components', 'Probe.styles.ts'),
        `import { StyleSheet } from 'react-native'
         export const getStyles = () => StyleSheet.create({ close: { width: 26, height: 26 } })`,
        'utf8',
      )

      const findings = scanFile({
        rootDir,
        filePath: 'components/Probe.tsx',
        content: `
          import { Pressable } from 'react-native'
          import { getStyles } from './Probe.styles'
          export const Probe = () => {
            const styles = getStyles()
            return <Pressable style={styles.close} />
          }
        `,
      })

      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({ style: 'close', size: 26 })
    } finally {
      removeDir(rootDir)
    }
  })

  it('collects declared sizes and skips non-numeric values', () => {
    const styles = collectStyleSizes(
      parse(`
        import { StyleSheet } from 'react-native'
        const s = StyleSheet.create({
          a: { width: 40, minHeight: 0, maxWidth: 10 },
          b: { height: SIZE },
        })
      `),
    )

    expect(styles.a).toEqual({ width: 40 })
    expect(styles.b).toEqual({})
  })

  it('collects style references from arrays, conditionals and callbacks', () => {
    const read = (expression: string) => {
      const source = parse(`const x = ${expression}`)
      const declaration = (source.statements[0] as any).declarationList.declarations[0]
      return collectStyleReferences(declaration.initializer)
    }

    expect(read('styles.one')).toEqual(['one'])
    expect(read('[styles.one, flag && styles.two]')).toEqual(['one', 'two'])
    expect(read('() => [styles.one, flag ? styles.two : styles.three]')).toEqual(['one', 'two', 'three'])
    expect(read('() => { return styles.one }')).toEqual(['one'])
  })

  it('keeps the worst declared size per file::style in the baseline', () => {
    const entries = toBaselineEntries([
      { key: 'a.tsx::btn', size: 40, dimension: 'width' },
      { key: 'a.tsx::btn', size: 32, dimension: 'height' },
      { key: 'b.tsx::pill', size: 36, dimension: 'minHeight' },
    ])

    expect(entries).toEqual({
      'a.tsx::btn': { size: 32, dimension: 'height' },
      'b.tsx::pill': { size: 36, dimension: 'minHeight' },
    })
  })

  describe('baseline ratchet', () => {
    const baseline = {
      contractVersion: CONTRACT_VERSION,
      minTouchTarget: MIN_TOUCH_TARGET,
      scope: [...SCAN_DIRS],
      entries: { 'a.tsx::btn': { size: 32, dimension: 'width' } },
    }

    it('accepts a frozen entry that did not get worse', () => {
      const findings = [{ key: 'a.tsx::btn', size: 32, dimension: 'width' }]
      expect(compareToBaseline(findings, baseline)).toEqual([])
    })

    it('accepts an improved entry', () => {
      const findings = [{ key: 'a.tsx::btn', size: 40, dimension: 'width' }]
      expect(compareToBaseline(findings, baseline)).toEqual([])
    })

    it('rejects a new sub-minimum element', () => {
      const findings = [
        { key: 'a.tsx::btn', size: 32, dimension: 'width' },
        { key: 'b.tsx::fresh', size: 24, dimension: 'height' },
      ]

      expect(compareToBaseline(findings, baseline)).toEqual([
        { key: 'b.tsx::fresh', kind: 'new', baseline: null, current: 24, dimension: 'height' },
      ])
    })

    it('rejects a frozen entry that shrank further', () => {
      const findings = [{ key: 'a.tsx::btn', size: 28, dimension: 'width' }]

      expect(compareToBaseline(findings, baseline)).toEqual([
        { key: 'a.tsx::btn', kind: 'regressed', baseline: 32, current: 28, dimension: 'width' },
      ])
    })

    it('refuses a baseline written for another contract or scope', () => {
      expect(() => compareToBaseline([], { ...baseline, contractVersion: 0 })).toThrow(/contractVersion/)
      expect(() => compareToBaseline([], { ...baseline, scope: ['app'] })).toThrow(/scope/)
      expect(() => compareToBaseline([], { ...baseline, minTouchTarget: 48 })).toThrow(/minTouchTarget/)
    })
  })

  it('parses CLI flags', () => {
    expect(parseArgs([])).toMatchObject({ update: false, json: false, baseline: 'scripts/touch-targets-baseline.json' })
    expect(parseArgs(['--update', '--json'])).toMatchObject({ update: true, json: true })
    expect(parseArgs(['--baseline', 'custom.json'])).toMatchObject({ baseline: 'custom.json' })
  })

  it('keeps the committed baseline in sync with the repository', () => {
    // Регрессионный контроль семейства: новый сабминимальный элемент валит эту
    // проверку в обычном прогоне тестов, а не только в отдельной guard-команде.
    const { scanTouchTargets } = require('@/scripts/guard-touch-targets')
    const committed = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'scripts/touch-targets-baseline.json'), 'utf8'),
    )

    expect(compareToBaseline(scanTouchTargets(process.cwd()), committed)).toEqual([])
  })
})
