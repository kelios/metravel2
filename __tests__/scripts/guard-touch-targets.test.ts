const fs = require('fs')
const path = require('path')

const { makeTempDir, removeDir } = require('./cli-test-utils')

const {
  MIN_TOUCH_TARGET,
  CONTRACT_VERSION,
  SCAN_DIRS,
  NUMERIC_SIZE_PROPS,
  collectStyleSizes,
  collectStyleReferences,
  collectInteractiveStyleNames,
  findUnlistedWrappers,
  isStyleModule,
  scanFile,
  scanStyleModule,
  scanTouchTargets,
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

  describe('styles declared outside the consuming component (#1274 acceptance)', () => {
    // Возврат карточки: экран мастера квеста жил на 26 и 36 dp, а гард молчал.
    // Стили лежали в `<feature>Styles/*.ts` и приезжали в JSX пропом, поэтому
    // резолвинг «свой файл + сиблинг .styles.ts» их не видел в принципе.
    const writeQuestLikeTree = (rootDir: string) => {
      fs.mkdirSync(path.join(rootDir, 'components', 'quests', 'wizardStyles'), { recursive: true })
      fs.writeFileSync(
        path.join(rootDir, 'components', 'quests', 'wizardStyles', 'stepsNavStyles.ts'),
        `export const createStepsNavStyles = (colors, isMobile) => ({
           stepDotMini: { width: isMobile ? 26 : 32, height: isMobile ? 26 : 32, backgroundColor: colors.bg },
           navActiveTitle: { fontSize: 13, color: colors.text },
         })`,
        'utf8',
      )
      // Стили приходят пропом: в этом файле нет ни импорта стилей, ни StyleSheet.
      fs.writeFileSync(
        path.join(rootDir, 'components', 'quests', 'QuestStepDot.tsx'),
        `import { Pressable } from 'react-native'
         export const QuestStepDot = ({ styles }) => (
           <Pressable style={styles.stepDotMini} hitSlop={12} />
         )`,
        'utf8',
      )
    }

    it('finds a sub-minimum size declared in a style module and reached only by prop', () => {
      const rootDir = makeTempDir('guard-touch-targets-')
      try {
        writeQuestLikeTree(rootDir)
        const entries = toBaselineEntries(scanTouchTargets(rootDir))

        expect(entries).toEqual({
          'components/quests/wizardStyles/stepsNavStyles.ts::stepDotMini': { size: 26, dimension: 'width' },
        })
      } finally {
        removeDir(rootDir)
      }
    })

    it('addresses the finding to the declaring file, not to the JSX consumer', () => {
      const rootDir = makeTempDir('guard-touch-targets-')
      try {
        writeQuestLikeTree(rootDir)
        const files = scanTouchTargets(rootDir).map((finding: any) => finding.file)

        expect(files).toEqual(['components/quests/wizardStyles/stepsNavStyles.ts'])
        expect(files).not.toContain('components/quests/QuestStepDot.tsx')
      } finally {
        removeDir(rootDir)
      }
    })

    it('ignores a style module name that nothing interactive uses', () => {
      const rootDir = makeTempDir('guard-touch-targets-')
      try {
        fs.mkdirSync(path.join(rootDir, 'components', 'demoStyles'), { recursive: true })
        fs.writeFileSync(
          path.join(rootDir, 'components', 'demoStyles', 'badgeStyles.ts'),
          `export const createBadgeStyles = () => ({
             badgeDot: { width: 8, height: 8 },
             badgeLabel: { fontSize: 11 },
           })`,
          'utf8',
        )

        expect(scanTouchTargets(rootDir)).toEqual([])
      } finally {
        removeDir(rootDir)
      }
    })

    it('resolves an adaptive size to its worst branch', () => {
      // `isMobile ? 26 : 32` — недомерок на мобильном, и это тот случай, ради
      // которого гард и существует.
      const styles = collectStyleSizes(
        parse(`const s = { row: { width: isMobile ? 26 : 32 }, cell: { height: 44 } }`),
        { includeFactories: true },
      )

      expect(styles.row).toEqual({ width: 26 })
    })

    it('does not read Platform.select branches as a style table', () => {
      const styles = collectStyleSizes(
        parse(`const s = {
          a: { width: 44 },
          b: { ...Platform.select({ web: { width: 10 }, android: { width: 12 } }) },
        }`),
        { includeFactories: true },
      )

      expect(styles).not.toHaveProperty('web')
      expect(styles).not.toHaveProperty('android')
    })

    it('recognises style modules by file and directory name', () => {
      expect(isStyleModule('components/quests/questWizardStyles/headerStyles.ts')).toBe(true)
      expect(isStyleModule('components/MapPage/Map/PlacePopupCard/styles.ts')).toBe(true)
      expect(isStyleModule('components/travel/PointList.styles.ts')).toBe(true)
      expect(isStyleModule('components/quests/QuestWizard.tsx')).toBe(false)
    })

    it('collects the names that stylise interactive elements', () => {
      const names = collectInteractiveStyleNames(
        parse(`
          import { Pressable, View } from 'react-native'
          export const Probe = () => (
            <View style={styles.wrapper}>
              <Pressable style={({ pressed }) => [styles.dot, pressed && styles.dotPressed]} />
            </View>
          )
        `),
      )

      expect([...names].sort()).toEqual(['dot', 'dotPressed'])
      expect(names.has('wrapper')).toBe(false)
    })

    it('sees a local wrapper that forwards style into a Pressable', () => {
      // Кнопка «Назад» в шапке: тег — `ActionButton`, а не `Pressable`, и внутри
      // обёртки имени стиля нет. На устройстве она мерилась 40dp, пока гард
      // молчал.
      const findings = scan(`
        import { Pressable, StyleSheet } from 'react-native'
        const styles = StyleSheet.create({ backButton: { width: 40, height: 40 } })
        function ActionButton({ onPress, style, children }) {
          return <Pressable onPress={onPress} style={[style, focus]}>{children}</Pressable>
        }
        export const Probe = () => <ActionButton style={styles.backButton} onPress={() => {}} />
      `)

      expect(findings.map((finding: any) => finding.style)).toContain('backButton')
    })

    it('sees CardActionPressable as an interactive element (#1734)', () => {
      // 53 кнопки в 18 файлах жили вне проверки: обёртка проекта над Pressable
      // размера не назначает, а в списке интерактивных элементов не была.
      const findings = scan(`
        import { StyleSheet } from 'react-native'
        import CardActionPressable from '@/components/ui/CardActionPressable'
        const styles = StyleSheet.create({ clear: { width: 26, height: 26 } })
        export const Probe = () => <CardActionPressable style={styles.clear} onPress={() => {}} />
      `)

      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({ style: 'clear', size: 26, element: 'CardActionPressable' })
    })

    it('opens a file whose only interactive element is a listed wrapper, not a Pressable (#1739)', () => {
      // Фильтр-подсказка был рукописным `/Pressable|Touchable/`: файл, где
      // единственная кнопка — `<IconButton style={...}>`, в скан не попадал, и
      // пять сабминимальных стилей жили за зелёным гейтом. Теперь подсказка
      // выводится из INTERACTIVE_ELEMENTS и отстать от списка не может.
      const source = `
        import { StyleSheet } from 'react-native'
        import IconButton from '@/components/ui/IconButton'
        const styles = StyleSheet.create({ compact: { width: 20, height: 20 } })
        export const Probe = () => <IconButton icon={null} label="x" style={styles.compact} />
      `
      expect(source).not.toMatch(/Pressable|Touchable/)

      const findings = scan(source)
      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({ style: 'compact', size: 20, element: 'IconButton' })
    })

    it('does not treat a wrapper without a style prop as interactive', () => {
      const findings = scan(`
        import { Pressable, StyleSheet, View } from 'react-native'
        const styles = StyleSheet.create({ badge: { width: 16, height: 16 } })
        function Badge({ children }) {
          return <View>{children}</View>
        }
        export const Probe = () => <Badge style={styles.badge} />
      `)

      expect(findings).toEqual([])
    })

    it('reports a style-module size only for interactive names', () => {
      const rootDir = makeTempDir('guard-touch-targets-')
      try {
        fs.mkdirSync(path.join(rootDir, 'components'), { recursive: true })
        fs.writeFileSync(
          path.join(rootDir, 'components', 'probeStyles.ts'),
          `export const create = () => ({ btn: { width: 30 }, dot: { width: 8 } })`,
          'utf8',
        )

        const findings = scanStyleModule({
          rootDir,
          filePath: 'components/probeStyles.ts',
          interactiveNames: new Set(['btn']),
        })

        expect(findings).toHaveLength(1)
        expect(findings[0]).toMatchObject({ style: 'btn', size: 30, file: 'components/probeStyles.ts' })
      } finally {
        removeDir(rootDir)
      }
    })
  })

  describe('size declared by a numeric prop, not by style (#1744)', () => {
    // `ColorChip` рисует круг `chipSize` и без `touchTargetSize` нажимается
    // ровно в нём; до `style` этот размер не доходит, и гард по ключам
    // `width/height` потребителя не видел — так модалка «Моих точек» жила с
    // 32dp при зелёном гейте.
    const chip = (props: string, prelude = '') => `
      import React from 'react'
      import ColorChip from '@/components/ui/ColorChip'
      ${prelude}
      export const Probe = () => <ColorChip color="red" onPress={() => {}} ${props} />
    `

    it('flags a chipSize below the minimum when no touch frame is requested (negative probe)', () => {
      const findings = scan(chip('chipSize={32}'))

      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({
        file: 'components/Probe.tsx',
        key: 'components/Probe.tsx::ColorChip(chipSize=32)',
        dimension: 'chipSize',
        size: 32,
        element: 'ColorChip',
      })
    })

    it('reads the primitive default when chipSize is omitted', () => {
      const findings = scan(chip(''))
      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({ dimension: 'chipSize', size: NUMERIC_SIZE_PROPS.ColorChip.defaultSize })
    })

    it('resolves a same-file constant as the chip size', () => {
      const findings = scan(chip('chipSize={COLOR_CHIP_SIZE}', 'const COLOR_CHIP_SIZE = 28'))
      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({ size: 28 })
    })

    it('resolves the chip size imported from a sibling module', () => {
      // Размер чипа и вертикальный запас родителя обязаны считаться от одной
      // константы, поэтому в JSX стоит имя из `*.styles.ts`, а не литерал.
      // Пока гард читал только литералы, он молчал ровно на том вызове, ради
      // которого заведён (#1744).
      const rootDir = makeTempDir('guard-touch-targets-')
      try {
        fs.mkdirSync(path.join(rootDir, 'components'), { recursive: true })
        fs.writeFileSync(
          path.join(rootDir, 'components', 'Probe.styles.ts'),
          'export const MANUAL_COLOR_CHIP_SIZE = 32\n',
          'utf8',
        )

        const findings = scanFile({
          rootDir,
          filePath: 'components/Probe.tsx',
          content: `
            import ColorChip from '@/components/ui/ColorChip'
            import { MANUAL_COLOR_CHIP_SIZE } from './Probe.styles'
            export const Probe = () => <ColorChip color="red" chipSize={MANUAL_COLOR_CHIP_SIZE} />
          `,
        })

        expect(findings).toHaveLength(1)
        expect(findings[0]).toMatchObject({ dimension: 'chipSize', size: 32 })
      } finally {
        removeDir(rootDir)
      }
    })

    it('takes the worst branch of an adaptive chip size', () => {
      const findings = scan(chip('chipSize={isMobile ? 24 : 48}', 'const isMobile = true'))
      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({ size: 24 })
    })

    it('passes a chip whose touch frame reaches the minimum (control)', () => {
      expect(scan(chip(`chipSize={20} touchTargetSize={${MIN_TOUCH_TARGET}}`))).toEqual([])
    })

    it('flags a touch frame that is itself below the minimum', () => {
      const findings = scan(chip('chipSize={32} touchTargetSize={40}'))
      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({ dimension: 'touchTargetSize', size: 40 })
    })

    it('treats a token-valued touch frame as intentional and does not guess it', () => {
      expect(scan(chip('chipSize={32} touchTargetSize={DESIGN_TOKENS.touchTarget.minWidth}'))).toEqual([])
    })

    it('keeps the worst of prop size and style size', () => {
      const source = `
        import { StyleSheet } from 'react-native'
        import ColorChip from '@/components/ui/ColorChip'
        const styles = StyleSheet.create({ chip: { width: 24, height: 24 } })
        export const Probe = () => <ColorChip color="red" chipSize={32} style={styles.chip} />
      `
      const findings = scan(source)
      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({ style: 'chip', size: 24 })
    })
  })

  describe('exported wrappers outside INTERACTIVE_ELEMENTS (#1734)', () => {
    // Класс дефекта: обёртка над Pressable экспортируется из одного файла,
    // используется тегом в другом и в список не попала — её вызовы гард не
    // смотрит, а зелёный прогон ничем не отличается от «не проверяли».
    const wrapperSource = `
      import { Pressable } from 'react-native'
      const Wrap = ({ style, onPress, children }) => (
        <Pressable style={style} onPress={onPress}>{children}</Pressable>
      )
      export default Wrap
    `
    // Потребитель импортирует `Pressable` только ради фильтра-подсказки гарда:
    // файл без этого слова в скан не попадает вовсе (известное слепое пятно,
    // #1739), а здесь проверяется список, а не фильтр.
    const consumerSource = (tag: string, from: string) => `
      import { Pressable, StyleSheet } from 'react-native'
      import ${tag} from '${from}'
      const styles = StyleSheet.create({ tiny: { width: 20, height: 20 } })
      export const Screen = () => <${tag} style={styles.tiny} onPress={() => {}} />
    `

    const withRepo = (files: Record<string, string>, probe: (rootDir: string) => void) => {
      const rootDir = makeTempDir('guard-touch-targets-wrappers-')
      try {
        for (const [relative, content] of Object.entries(files)) {
          const absolute = path.join(rootDir, relative)
          fs.mkdirSync(path.dirname(absolute), { recursive: true })
          fs.writeFileSync(absolute, content, 'utf8')
        }
        probe(rootDir)
      } finally {
        removeDir(rootDir)
      }
    }

    it('reports a cross-file wrapper that the list does not know', () => {
      withRepo(
        {
          'components/ui/Wrap.tsx': wrapperSource,
          'components/Screen.tsx': consumerSource('Wrap', '@/components/ui/Wrap'),
        },
        (rootDir) => {
          expect(findUnlistedWrappers(rootDir)).toEqual([
            { name: 'Wrap', declaredIn: 'components/ui/Wrap.tsx', usedIn: 'components/Screen.tsx' },
          ])
          // Пока обёртка не в списке, её сабминимальный вызов невидим — это и
          // есть дыра, которую закрывает проверка выше.
          expect(scanTouchTargets(rootDir)).toEqual([])
        },
      )
    })

    it('matches the JSX name the consumer writes, not the internal component name', () => {
      // Default-экспорт импортируется под любым именем; гард сверяет тег.
      withRepo(
        {
          'components/ui/Wrap.tsx': wrapperSource,
          'components/Screen.tsx': consumerSource('IconButton', '../components/ui/Wrap'),
        },
        (rootDir) => {
          expect(findUnlistedWrappers(rootDir)).toEqual([])
          expect(scanTouchTargets(rootDir).map((finding: any) => finding.style)).toEqual(['tiny'])
        },
      )
    })

    it('ignores wrappers used only inside their own file', () => {
      withRepo(
        {
          'components/Local.tsx': `${wrapperSource}
            export const Screen = () => <Wrap style={{ width: 20 }} onPress={() => {}} />`,
        },
        (rootDir) => {
          expect(findUnlistedWrappers(rootDir)).toEqual([])
        },
      )
    })

    it('fails the CLI run without touching the baseline', () => {
      withRepo(
        {
          'components/ui/Wrap.tsx': wrapperSource,
          'components/Screen.tsx': consumerSource('Wrap', '@/components/ui/Wrap'),
          'scripts/touch-targets-baseline.json': JSON.stringify({
            contractVersion: CONTRACT_VERSION,
            minTouchTarget: MIN_TOUCH_TARGET,
            scope: [...SCAN_DIRS],
            entries: {},
          }),
        },
        (rootDir) => {
          const { run } = require('@/scripts/guard-touch-targets')
          const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
          try {
            expect(run(parseArgs(['--root', rootDir]))).toBe(1)
            expect(stderr.mock.calls.map(String).join('')).toMatch(/<Wrap> from components\/ui\/Wrap\.tsx/)
          } finally {
            stderr.mockRestore()
          }
        },
      )
    })

    it('knows every exported wrapper in the repository', () => {
      // Регрессионный контроль класса: новая обёртка над Pressable, не внесённая
      // в INTERACTIVE_ELEMENTS, валит обычный прогон тестов.
      expect(findUnlistedWrappers(process.cwd())).toEqual([])
    })
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
